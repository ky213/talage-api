'use strict';

const auth = require('./helpers/auth.js');
const serverHelper = require('../../../server.js');
const validator = global.requireShared('./helpers/validator.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const colorConverter = require('color-converter').default;
const AgencyLandingPageBO = global.requireShared('./models/AgencyLandingPage-BO.js');

/**
 * Checks whether the provided agency has a primary page other than the current page
 *
 * @param {int} agency - The ID of the agency to check
 * @param {int} page - The ID of the page to exempt from the check
 *
 * @return {boolean} - True if the agency has a primary page; false otherwise
 */
function hasOtherPrimary(agency, page) {
    return new Promise(async function(fulfill) {

        let gotHit = false;
        try{
            const systemId = parseInt(page, 10);
            const agencyLandingPageBO = new AgencyLandingPageBO();
            const nameQuery = {
                primary: true,
                agencyId: agency
            };
            const primaryList = await agencyLandingPageBO.getList(nameQuery);

            if (primaryList && primaryList.length){
                for(const landingPage of primaryList){
                    if(landingPage.systemId !== systemId
                        && landingPage.primary === true){
                        gotHit = true;
                    }
                }
            }
        }
        catch(err){
            log.error('agency_landing_pages error ' + err + __location)
        }
        fulfill(gotHit);
        return;
    });
}

/**
 * Calculates an accent color for a custom color scheme
 *
 * @param {object} rgbColorString - A color
 *
 * @returns {string} The color's accent color
 */
function calculateAccentColor(rgbColorString) {
    // TODO: move this to retrieving the color scheme so that we can adjust this on-the-fly -SF
    // We calculate the accents based on the HSV color space.
    const color = colorConverter.fromHex(rgbColorString);
    // Keep the saturation in the range of 0.2 - 0.8
    if (color.saturation > 0.5) {
        color.saturation = Math.max(0.2, color.saturation - 0.5);
    }
    else {
        color.saturation = Math.min(0.8, color.saturation + 0.5);
    }
    return color.toHex();
}

/**
 * Updates db with custom color and returns the custom color id
 * (create and inserts into db if doesn't exist else retrieves id of existing scheme if it does exist in db)
 * @param {object} data  - Custom color scheme object 	customColorScheme: {primary: 'string',secondary: 'string'}
 * @param {function} next - The next function from the request
 * @return {object} -- Object containing landing page information
 */
async function retrieveCustomColorScheme(data, next) {
    // see if record already exists
    const recordSearchQuery = `
		SELECT 
			\`id\`
		FROM \`#__color_schemes\` 					
		WHERE \`primary\` = ${db.escape(data.primary)} && \`secondary\` = ${db.escape(data.secondary)}
	`;
    // variable to hold existing id
    const exisitingColorId = await db.query(recordSearchQuery).catch(function(err) {
        log.error(`Error when trying to check if custom color already exists. \n ${err.message}`);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });
    // variable to hold new color id
    let newColorId = null;

    if (!data.primary_accent || data.primary_accent.length === 0) {
        data.primary_accent = calculateAccentColor(data.primary);
        data.secondary_accent = calculateAccentColor(data.secondary);
        // We hard code the tertiary color at white for now
        data.tertiary = '#FFFFFF';
        data.tertiary_accent = '#FFFFFF';
    }

    // if record does not exist then go ahead and insert into db
    // commit this update to the database
    if (exisitingColorId.length === 0) {
        const sql = `
				INSERT INTO \`#__color_schemes\` 
				(\`name\`, \`primary\`,\`primary_accent\`,\`secondary\`,\`secondary_accent\`,\`tertiary\`,\`tertiary_accent\`)
				VALUES (${db.escape(`Custom`)}, ${db.escape(data.primary)}, ${db.escape(data.primary_accent)}, ${db.escape(data.secondary)}, ${db.escape(data.secondary_accent)}, ${db.escape(data.tertiary)}, ${db.escape(data.tertiary_accent)})
		`;
        // Run the query
        const createCustomColorResult = await db.query(sql).catch(function(err) {
            log.error(err.message);
            return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
        });
        // Make sure the query was successful
        if (createCustomColorResult.affectedRows === 1) {
            newColorId = createCustomColorResult.insertId;
        }
        else {
            log.error('Custom color scheme update failed. Query ran successfully; however, no records were affected.');
            return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
        }
    }

    return exisitingColorId.length === 0 ? newColorId : exisitingColorId[0].id;

}

/**
 * Conditionally authenticates based on whether network making call or agency making call
 * @param {Object} req -- HTTP request object
 * @param {Object} data -- Data object can be req.query or req.params
 * @param {Function} next -- The next function to execute
 * @return {int}  -- The agency id
 */
async function retrieveAuthenticatedAgency(req, data, next){
    let error = false;
    let agency = null;
    const jwtErrorMessage = await auth.validateJWT(req, req.authentication.agencyNetwork ? 'agencies' : 'pages', 'manage');
    if (jwtErrorMessage) {
        return next(serverHelper.forbiddenError(jwtErrorMessage));
    }
    if (req.authentication.agencyNetwork) {
        // This is an agency network user, they can only modify agencies in their network
        // Get the agencies that we are permitted to manage
        const agencies = await auth.getAgents(req).catch(function(e) {
            error = e;
        });
        if (error) {
            return next(error);
        }
        // Validate the Agency ID
        if (!Object.prototype.hasOwnProperty.call(data, 'agency')) {
            return next(serverHelper.requestError('Agency missing'));
        }
        if (!await validator.agent(data.agency)) {
            return next(serverHelper.requestError('Agency is invalid'));
        }
        if (!agencies.includes(parseInt(data.agency, 10))) {
            return next(serverHelper.requestError('Agency is invalid'));
        }
        agency = data.agency;
    }
    else {
        // This is an agency user, they can only handle their own agency
        agency = req.authentication.agents[0];
    }
    return agency;
}

/**
 * Validates a landing page and returns a clean data object
 *
 * @param {object} request - HTTP request object
 * @param {function} next - The next function from the request
 * @param {int} agency - The agency id for landing page
 * @param {boolean} isUpdate - True if update request
 * @return {object} Object containing landing page information
 */
async function validate(request, next, agency, isUpdate = false) {
    // Establish default values
    const data = {
        about: '',
        banner: '',
        colorSchemeId: 1,
        heading: null,
        industryCode: null,
        industryCodeCategory: null,
        introHeading: null,
        introText: null,
        name: '',
        showIndustrySection: true,
        slug: '',
        customColorScheme: null
    };

    // Validate each parameter
    // HACK: Adding backward compatibility so if typeof request.body.landingPage === 'undefined' old ui use case else updated UI
    const landingPage = typeof request.body.landingPage === 'undefined' ? request.body : request.body.landingPage;

    // About (optional)
    if (Object.prototype.hasOwnProperty.call(landingPage, 'about') && landingPage.about) {
        // Strip out HTML
        landingPage.about = landingPage.about.replace(/(<([^>]+)>)/gi, '');

        // Check lengths
        if (landingPage.about.length > 400) {
            throw new Error('Reduce the length of your about text to less than 400 characters');
        }
        data.about = landingPage.about;
    }
    // Banner (optional)
    if (Object.prototype.hasOwnProperty.call(landingPage, 'banner') && landingPage.banner) {
        if (!await validator.banner(landingPage.banner)) {
            throw new Error('Banner is invalid');
        }
        data.banner = landingPage.banner;
    }
    // check if there is custom color scheme info
    // if scheme exists then upadate the custom color info
    // else just set the color_scheme to the one the user provided color scheme (a.k.a Theme)
    //
    if (Object.prototype.hasOwnProperty.call(landingPage, 'customColorScheme') && landingPage.customColorScheme) {
        data.colorSchemeId = await retrieveCustomColorScheme(landingPage.customColorScheme, next);

    }
    else if (Object.prototype.hasOwnProperty.call(landingPage, 'colorScheme') && landingPage.colorScheme) {
        data.colorSchemeId = landingPage.colorScheme;
    }

    // Heading (optional)
    if (Object.prototype.hasOwnProperty.call(landingPage, 'heading') && landingPage.heading) {
        if (landingPage.heading.length > 70) {
            throw new Error('Heading must be less the 70 characters');
        }
        if (!validator.landingPageHeading(landingPage.heading)) {
            throw new Error('Heading is invalid');
        }
        data.heading = landingPage.heading;
    }

    // Industry Code Category (optional)
    if (Object.prototype.hasOwnProperty.call(landingPage, 'industryCodeCategory') && landingPage.industryCodeCategory) {
        if (!await validator.industryCodeCategory(landingPage.industryCodeCategory)) {
            throw new Error('Industry Code Category is invalid');
        }
        data.industryCodeCategory = landingPage.industryCodeCategory;

        // Industry Code (optional) - only applicable if an Industry Code Category is set
        if (Object.prototype.hasOwnProperty.call(landingPage, 'industryCode') && landingPage.industryCode) {
            if (!await validator.industry_code(landingPage.industryCode)) {
                throw new Error('Industry Code is invalid');
            }
            data.industryCode = landingPage.industryCode;
        }
    }

    // Intro Heading (optional)
    if (Object.prototype.hasOwnProperty.call(landingPage, 'heading') && landingPage.heading) {
        landingPage.introHeading = landingPage.heading;
    }


    if (Object.prototype.hasOwnProperty.call(landingPage, 'introHeading') && landingPage.introHeading) {
        if (landingPage.introHeading.length > 70) {
            throw new Error('Introduction Heading must be less the 70 characters');
        }
        if (!validator.landingPageHeading(landingPage.introHeading)) {
            throw new Error('Introduction Heading is invalid');
        }
        data.introHeading = landingPage.introHeading;
    }

    // Intro Text (optional)
    if (Object.prototype.hasOwnProperty.call(landingPage, 'introText') && landingPage.introText) {
        // Strip out HTML
        landingPage.introText = landingPage.introText.replace(/(<([^>]+)>)/gi, '');

        // Check lengths
        if (landingPage.introText.length > 400) {
            throw new Error('Reduce the length of your introduction text to less than 400 characters');
        }

        data.introText = landingPage.introText;
    }

    // Name
    if (!Object.prototype.hasOwnProperty.call(landingPage, 'name') || !landingPage.name) {
        throw new Error('You must enter a page name');
    }
    if (!validator.landingPageName(landingPage.name)) {
        throw new Error('Page name is invalid');
    }
    data.name = landingPage.name;

    // Show Industry Section (optional)
    if (Object.prototype.hasOwnProperty.call(landingPage, 'showIndustrySection')) {
        if (typeof landingPage.showIndustrySection === 'boolean' && !landingPage.showIndustrySection) {
            data.showIndustrySection = false;
        }
    }

    // Slug (a.k.a. Link)
    if (!Object.prototype.hasOwnProperty.call(landingPage, 'slug') || !landingPage.slug) {
        throw new Error('You must enter a link');
    }
    if (!validator.slug(landingPage.slug)) {
        throw new Error('Link is invalid');
    }
    data.slug = landingPage.slug;
    let hitLimit = 0;
    if(isUpdate === true){
        hitLimit = 1;
    }
    log.debug("hitLimit: " + hitLimit);
    let gotHit = false;
    try{
        const agencyLandingPageBO = new AgencyLandingPageBO();
        const nameQuery = {
            nameExact: data.name,
            agencyId: agency
        };
        const nameList = await agencyLandingPageBO.getList(nameQuery);
        if (nameList && nameList.length > hitLimit){
            log.debug("nameList.length " + nameList.length)
            gotHit = true;
        }
        else {
            const slugQuery = {
                slugExact: data.slug,
                agencyId: agency
            };
            const slugList = await agencyLandingPageBO.getList(slugQuery);
            if(slugList && slugList.length > hitLimit){
                gotHit = true;
            }
        }
    }
    catch(err){
        log.error("Landing page validation " + err + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    if (gotHit === true) {
        throw new Error('This name or link is already in use. Choose a different one.');
    }
    return data;

}

/**
 * Creates a single landing page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function createLandingPage(req, res, next) {
    let error = false;
    // Determine the agency ID
    const agency = await retrieveAuthenticatedAgency(req, req.body, next);
    // HACK: Adding backward compatibility so if typeof request.body.landingPage === 'undefined' old ui use case else updated UI
    const landingPage = typeof req.body.landingPage === 'undefined' ? req.body : req.body.landingPage;
    // Check that at least some post parameters were received
    if (!req.body || typeof landingPage !== 'object' || Object.keys(landingPage).length === 0) {
        log.info('Bad Request: Parameters missing');
        return next(serverHelper.requestError('Parameters missing'));
    }

    // Validate the request and get back the data
    const data = await validate(req, next, agency).catch(function(err) {
        error = err.message;
    });

    if (error) {
        log.warn(`Error: ${error} ${__location}`);
        return next(serverHelper.requestError(error));
    }


    // showIntroText update additional_info json
    if(landingPage.additionalInfo && landingPage.showIntroText){
        landingPage.additionalInfo.showIntroText = landingPage.showIntroText;
    }
    else if (landingPage.showIntroText){
        landingPage.additionalInfo = {};
        landingPage.additionalInfo.showIntroText = landingPage.showIntroText;
    }
    data.additionalInfo = landingPage.additionalInfo;
    if(!data.additionalInfo) {
        data.additionalInfo = {};
    }
    data.additionalInfo = JSON.stringify(data.additionalInfo);

    // Define the data to be inserted, column: value
    // eslint-disable-next-line prefer-const
    let insertData = {
        about: data.about,
        agencyId: agency,
        banner: data.banner,
        colorSchemeId: data.colorSchemeId,
        heading: data.heading,
        agencyLocationId: landingPage.agencyLocationId,
        industryCodeId: data.industryCode,
        industryCodeCategoryId: data.industryCodeCategory,
        introHeading: data.introHeading,
        showIntroText: landingPage.showIntroText,
        introText: data.introText,
        name: data.name,
        showIndustrySection: data.showIndustrySection,
        slug: data.slug,
        additionalInfo: data.additionalInfo
    };

    if(!insertData.agencyLocationId){
        insertData.agencyLocationId = 0;
    }

    const agencyLandingPageBO = new AgencyLandingPageBO();
    await agencyLandingPageBO.saveModel(insertData).catch(function(err) {
        log.error("Insert Landing Page" + err.message + __location);
        error = err;
    });
    if(error){
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }
    else {
        // Send back a success response
        res.send(200, 'Created');
        return next();
    }
}

/**
 * Deletes a single landing page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function deleteLandingPage(req, res, next) {
    let error = false;

    // Check that query parameters were received
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: Query parameters missing');
        return next(serverHelper.requestError('Query parameters missing'));
    }
    const agency = await retrieveAuthenticatedAgency(req, req.query, next);
    // Validate the Landing Page ID
    if (!Object.prototype.hasOwnProperty.call(req.query, 'id')) {
        return next(serverHelper.requestError('ID missing'));
    }
    // if (!await validator.landingPageId(req.query.id, agency)) {
    //     return next(serverHelper.requestError('ID is invalid'));
    // }
    const id = req.query.id;

    // Make sure there is a primary page for this agency (we are not removing the primary page)
    if (!await hasOtherPrimary(agency, id)) {
        // Log a warning and return an error
        log.warn('This landing page is the primary page. You must make another page primary before deleting this one.');
        return next(serverHelper.requestError('This landing page is the primary page. You must make another page primary before deleting this one.'));
    }

    const systemId = parseInt(id, 10);
    const agencyLandingPageBO = new AgencyLandingPageBO();
    await agencyLandingPageBO.deleteSoftById(systemId).catch(function(err) {
        log.error("agencyLandingPageBO deleteSoft load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, 'Deleted');
}

/**
 * Retrieves the details of a single landing page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function getLandingPage(req, res, next) {
    // Check that query parameters were received
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: Query parameters missing');
        res.send(400, {});
        return next(serverHelper.requestError('Query parameters missing'));
    }
    // Check for required parameters
    if (!Object.prototype.hasOwnProperty.call(req.query, 'id') || !req.query.id) {
        log.info('Bad Request: You must specify a page');
        res.send(400, {});
        return next(serverHelper.requestError('You must specify a page'));
    }


    const agency = await retrieveAuthenticatedAgency(req, req.query,next);

    const agencyLandingPageBO = new AgencyLandingPageBO();
    let error = null
    const landingPageId = parseInt(req.query.id, 10)
    // eslint-disable-next-line prefer-const
    let landingPageJSON = await agencyLandingPageBO.getById(landingPageId).catch(function(err) {
        log.error(err.message + __location);
        error = err;
    });
    if(error){
        res.send(500, {});
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }
    // Make sure a page was found
    if (!landingPageJSON) {
        log.warn('Page not found' + __location);
        res.send(500, {});
        return next(serverHelper.requestError('Page not found'));
    }
    //check Agency for rights.
    const agencyId = parseInt(agency, 10);
    if(landingPageJSON.agencyId !== agencyId){
        res.send(400, {});
        return next(serverHelper.requestError('Page not found'));
    }
    //lagecy name
    landingPageJSON.id = landingPageJSON.systemId;
    landingPageJSON.colorScheme = landingPageJSON.colorSchemeId
    landingPageJSON.industryCode = landingPageJSON.industryCodeId
    landingPageJSON.industryCodeCategory = landingPageJSON.industryCodeCategoryId
    landingPageJSON.industryCodeCategory = landingPageJSON.industryCodeCategoryId

    // Convert the showIndustrySection value to a boolean
    landingPageJSON.showIndustrySection = Boolean(landingPageJSON.showIndustrySection);

    // if the page was found continue and query for the page color scheme
    const colorInformationSQL = `
				SELECT
				\`name\`,
				\`primary\`,
				\`secondary\`
				FROM  \`#__color_schemes\`
				WHERE \`id\` = ${landingPageJSON.colorSchemeId}
			`;
    let colorSchemeInfo = null;
    try {
        colorSchemeInfo = await db.query(colorInformationSQL);
    }
    catch (err) {
        log.error(err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    // make sure the color scheme was found
    if (colorSchemeInfo.length !== 1) {
        log.warn('Page not found');
        return next(serverHelper.requestError('Page not found'));
    }
    else {
        // if found go ahead and add and then set the customColorInfo field to either the scheme info or null which indicates it is not a custom color info
        landingPageJSON.customColorInfo = colorSchemeInfo[0].name === 'Custom' ? colorSchemeInfo[0] : null;
    }

    // Send the user's data back
    res.send(200, landingPageJSON);
    return next();
}

/**
 * Updates a single landing page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function updateLandingPage(req, res, next) {
    log.debug("update landing page " + JSON.stringify(req.body));
    let error = false;
    // Determine the agency ID
    const agency = await retrieveAuthenticatedAgency(req, req.body, next);
    // HACK: Adding backward compatibility so if typeof request.body.landingPage === 'undefined' old ui use case else updated UI
    const landingPage = typeof req.body.landingPage === 'undefined' ? req.body : req.body.landingPage;
    // Check that at least some post parameters were received
    if (!req.body || typeof landingPage !== 'object' || Object.keys(landingPage).length === 0) {
        log.info('Bad Request: Parameters missing' + __location);
        return next(serverHelper.requestError('Parameters missing'));
    }

    // Validate the ID
    if (!Object.prototype.hasOwnProperty.call(landingPage, 'id')) {
        throw new Error('ID missing');
    }

    // Validate the request and get back the data
    const isUpdate = true;
    const data = await validate(req, next, agency, isUpdate).catch(function(err) {
        error = err.message;
    });
    if (error) {
        log.warn(`Error: ${error} ${__location}`);
        return next(serverHelper.requestError(error));
    }


    // if (!await validator.landingPageId(landingPage.id)) {
    //     throw new Error('ID is invalid');
    // }
    data.id = landingPage.id;

    data.agencyLocationId = landingPage.agencyLocationId;
    if(!data.agencyLocationId){
        data.agencyLocationId = 0;
    }
    if(landingPage.additionalInfo && typeof landingPage.additionalInfo === "string"){
        landingPage.additionalInfo = JSON.parse(landingPage.additionalInfo);
    }

    // // showIntroText update additional_info json
    // if(landingPage.additionalInfo && typeof landingPage.showIntroText === "boolean"){
    //     landingPage.additionalInfo.showIntroText = landingPage.showIntroText;
    // }
    // else if (typeof landingPage.showIntroText === "boolean"){
    //     landingPage.additionalInfo = {};
    //     landingPage.additionalInfo.showIntroText = landingPage.showIntroText;
    // }

    const updateData = {
        id: data.id,
        about: data.about,
        agencyId: agency,
        banner: data.banner,
        colorSchemeId: data.colorSchemeId,
        heading: data.heading,
        agencyLocationId: data.agencyLocationId,
        industryCodeId: data.industryCode,
        industryCodeCategoryId: data.industryCodeCategory,
        introHeading: data.introHeading,
        showIntroText: landingPage.showIntroText,
        introText: data.introText,
        name: data.name,
        showIndustrySection: data.showIndustrySection,
        slug: data.slug,
        additionalInfo: data.additionalInfo
    };

    log.debug("updateData: " + JSON.stringify(updateData))
    const agencyLandingPageBO = new AgencyLandingPageBO();
    await agencyLandingPageBO.saveModel(updateData).catch(function(err) {
        log.error("Update Landing Page" + err.message + __location);
        error = err;
    });
    if(error){
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }
    else {
        // Send back a success response
        res.send(200, 'Saved');
        return next();
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addPostAuth('Create Landing Page', `${basePath}/landing-page`, createLandingPage, 'pages', 'manage');
    server.addGetAuth('Get Landing Page', `${basePath}/landing-page`, getLandingPage, 'pages', 'manage');
    server.addPutAuth('Update Landing Page', `${basePath}/landing-page`, updateLandingPage, 'pages', 'manage');
    server.addDeleteAuth('Delete Landing Page', `${basePath}/landing-page`, deleteLandingPage /* permissions handled in deleteLandingPage */);
};