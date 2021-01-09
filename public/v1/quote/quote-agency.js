/* eslint-disable array-element-newline */
/* eslint-disable prefer-const */
/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
//const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLandingPageBO = global.requireShared('./models/AgencyLandingPage-BO.js');
const ColorSchemeBO = global.requireShared('./models/ColorScheme-BO.js');
const IndustryCodeCategoryBO = global.requireShared('./models/IndustryCodeCategory-BO.js');

/**
 * Parses the quote app request URL and extracts the agency and page slugs
 *
 * @param {string} url - quote app request URL
 *
 * @returns {object} agencySlug, pageSlug
 */
function parseQuoteURL(url) {
    // Parse the agency slug
    let agencySlug = null;
    let pageSlug = null;
    url = url.replace(/index\.[a-zA-Z0-9]*\/*/, '');
    let quoteURL = null;
    try {
        quoteURL = new URL(url);
    }
    catch (error) {
        log.error(`Could not parse quote application url '${url}': ${error} ${__location}`);
        return {
            agencySlug: agencySlug,
            pageSlug: pageSlug
        };
    }
    let path = quoteURL.pathname;
    // Replace multiple slashes with a single one
    path = path.replace(/\/*/, '/');
    // Split out the components
    path = path.split('/');

    if (quoteURL.searchParams.has('agency')) {
        // URL: http://domain/?agency=agencySlug&page=pageSlug
        agencySlug = quoteURL.searchParams.get('agency');
        if (quoteURL.searchParams.has('page')) {
            pageSlug = quoteURL.searchParams.get('page');
        }
    }
    else if (path.length > 1 && path[1].length > 0) {
        // URL: http://domain/agencySlug/pageSlug
        agencySlug = path[1];
        if (path.length > 2 && path[2].length > 0) {
            pageSlug = path[2];
        }
    }
    else if (global.settings.DEFAULT_QUOTE_AGENCY_SLUG) {
        agencySlug = global.settings.DEFAULT_QUOTE_AGENCY_SLUG;
    }
    else {
        // Default to "talage"
        agencySlug = "talage";
    }
    return {
        agencySlug: agencySlug,
        pageSlug: pageSlug
    };
}

/**
 * Retrieves the agency information from a given agency/page slug.
 *
 * @param {string} agencySlug - agency slug
 * @param {object} pageSlug - page slug (optional)
 *
 * @returns {object} agency
 */
async function getAgencyFromSlugs(agencySlug, pageSlug) {
    if(!agencySlug){
        log.error(`No slug supplied getAgencyFromSlugsquote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${__location}`);
        return null;
    }


    let agencyWebInfo = null;
    //Get agency record.
    const agencyBO = new AgencyBO();
    //TODO .....
    //ag.slug = ${db.escape(agencySlug)}

    try {
        agencyWebInfo = await agencyBO.getbySlug(agencySlug);
    }
    catch (err) {
        log.error(`Error retrieving Agency in quote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${err} ${__location}`);
        return null;
    }
    if(!agencyWebInfo){
        log.warn(`Could not retrieve Agency quote engine agencySlug ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${__location}`);
        return null;
    }
    try{
        //map to old SQL return columns.
        const oldMap = {
            caLicenseNumber: "californiaLicense",
            name: "agencyName",
            agencyNetworkId: "agencyNetwork",
            enabelOptOut: "enable_optout",
            systemId: "agencyId"
        }
        for (const property in oldMap) {
            if(agencyWebInfo[property]){
                agencyWebInfo[oldMap[property]] = agencyWebInfo[property];
            }
        }
        //Quote App expect 1 or 0
        agencyWebInfo.enable_optout = agencyWebInfo.enabelOptOut ? 1 : 0;
    }
    catch (err) {
        log.error(`Error mapping to response properties quote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${err} ${__location}`);
    }

    //If get landing page
    let haveLandingPage = false;
    const agencyLandingPageBO = new AgencyLandingPageBO();
    try{
        let getPrimary = false;
        if(!pageSlug){
            getPrimary = true;
        }

        let landingPageJSON = await agencyLandingPageBO.getbySlug(agencyWebInfo.agencyId, pageSlug, getPrimary)
        const lpPropToAdd = {
            systemId: "landingPageID",
            agencyLocationId: "agency_location_id",
            industryCodeId: "industryCode",
            industryCodeCategoryId: "industryCodeCategory",
            colorSchemeId: "colorScheme",
            introHeading: "introHeading",
            introText: "introText",
            showIndustrySection: "showIndustrySection",
            showIntroText: "showIntroText",
            additionalInfo: "landingPageAdditionalInfo",
            meta: "meta",
            banner: "banner",
            heading: "heading",
            about: "about"
        }

        if(landingPageJSON){
            for (const property in lpPropToAdd) {
                if(landingPageJSON[property] || landingPageJSON[property] === false || landingPageJSON[property] === 0){
                    if(lpPropToAdd[property] !== property){
                        agencyWebInfo[lpPropToAdd[property]] = landingPageJSON[property];
                    }
                    //new style
                    agencyWebInfo[property] = landingPageJSON[property];
                }
            }

            haveLandingPage = true;
        }
    }
    catch(err){
        log.error(`Error retrieving Landing Page in quote engine agency ${agencySlug} id: ${agencyWebInfo.agencyId} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${err} ${__location}`);
        return null;
    }

    if(haveLandingPage === false){
        log.warn(`Could not retrieve Landing Page quote engine agency ${agencySlug} id: ${agencyWebInfo.agencyId} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${__location}`);
        return null;
    }

    //color scheme.
    try{
        if(agencyWebInfo.colorSchemeId){
            const colorSchemeBO = new ColorSchemeBO();
            const colorSchemeJSON = await colorSchemeBO.getById(agencyWebInfo.colorSchemeId);
            const csPropToAdd = {
                primary: "primary",
                primary_accent: "primaryAccent",
                secondary: "secondary",
                secondary_accent: "secondaryAccent",
                tertiary: "tertiary",
                tertiary_accent: "tertiaryAccent"
            }

            for (const property in csPropToAdd) {
                if(colorSchemeJSON[property]){
                    agencyWebInfo[csPropToAdd[property]] = colorSchemeJSON[property];
                    //new style
                    agencyWebInfo[property] = colorSchemeJSON[property];
                }
            }

        }
    }
    catch(err){
        log.error(`Error retrieving ColorScheme in quote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${err} ${__location}`);
        return null;
    }

    try{
        if(agencyWebInfo.industryCodeCategoryId){
            const industryCodeCategoryBO = new IndustryCodeCategoryBO();
            const industryCodeCategoryJSON = await industryCodeCategoryBO.getById(agencyWebInfo.industryCodeCategoryId);
            agencyWebInfo.industryCodeCategory = industryCodeCategoryJSON.name;
        }
    }
    catch(err){
        log.error(`Error retrieving IndustryCodeCategory in quote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${err} ${__location}`);
    }
    try {
        //Get AgencyNetworkBO  If missing landing page content get AgnencyNetwork = 1 for it.
        const agencyNetworkBO = new AgencyNetworkBO();
        // eslint-disable-next-line no-unused-vars
        let error = null;
        const agencyNetworkJSON = await agencyNetworkBO.getById(agencyWebInfo.agencyNetwork).catch(function(err){
            error = err;
            log.error("Get AgencyNetwork Error " + err + __location);
        });
        //Check featurer - optout
        if(agencyNetworkJSON && agencyNetworkJSON.feature_json && agencyNetworkJSON.feature_json.applicationOptOut === false){
            agencyWebInfo.enable_optout = 0
            agencyWebInfo.enabelOptOut = false;
        }

        if(agencyNetworkJSON && agencyNetworkJSON.footer_logo){
            agencyWebInfo.footer_logo = agencyNetworkJSON.footer_logo
        }
        if(agencyNetworkJSON && agencyNetworkJSON.landing_page_content){
            agencyWebInfo.landingPageContent = agencyNetworkJSON.landing_page_content;
        }
        else {
            //get from default AgencyNetwork
            log.debug(`AgencyNetwork ${agencyWebInfo.agencyNetwork} using default landingpage`)
            const agencyNetworkJSONDefault = await agencyNetworkBO.getById(1).catch(function(err){
                error = err;
                log.error("Get AgencyNetwork 1 Error " + err + __location);
            });

            if(agencyNetworkJSONDefault && agencyNetworkJSONDefault.landing_page_content){
                agencyWebInfo.landingPageContent = agencyNetworkJSONDefault.landing_page_content;
                if(!agencyWebInfo.footer_logo){
                    agencyWebInfo.footer_logo = agencyNetworkJSONDefault.footer_logo;
                }
            }
        }
    }
    catch (err) {
        log.error(`Could not parse landingPageContent/meta in agency ${agencySlug}: ${err} ${__location}`);
        return null;
    }

    let locations = null;
    try{
        const query = {"agencyId": agencyWebInfo.agencyId}
        const getAgencyName = true;
        const getChildren = true;
        const addAgencyPrimaryLocation = true;
        const agencyLocationBO = new AgencyLocationBO();

        locations = await agencyLocationBO.getList(query, getAgencyName,getChildren, addAgencyPrimaryLocation);
        let insurerList = [];
        // eslint-disable-next-line array-element-newline
        let removeList = ["additionalInfo", "territories", "createdAt", "updatedAt", "agencyPortalModifiedUser","active"]
        if(locations){
            for(let j = 0; j < locations.length; j++) {
                let location = locations[j];
                location.id = location.systemId;
                location.fname = location.firstName;
                location.lname = location.lastName;
                location.territory = location.state;
                location.zip = location.zipcode;
                location.appointments = location.territories;
                if(location.insurers && location.insurers.length > 0){
                    for(let i = 0; i < location.insurers.length; i++) {
                        let insurer = location.insurers[i];
                        insurer.agencylocation = location.id;
                        //backward compatible for Quote App.  properties for WC, BOP, GL
                        if(insurer.policyTypeInfo){
                            insurer.policy_type_info = insurer.policyTypeInfo
                            const policyTypeCd = ['WC','BOP','GL']
                            for(const pt of policyTypeCd){
                                if(insurer.policy_type_info[pt] && insurer.policy_type_info[pt].enabled === true){
                                    insurer[pt.toLowerCase()] = 1;
                                }
                                else {
                                    insurer[pt.toLowerCase()] = 0;
                                }
                            }
                        }
                        insurerList.push(insurer);
                    }
                    //delete location.insurers;
                }
                else {
                    log.error(`No insurers for location ${location.systemId}` + __location)
                }
                for(let i = 0; i < removeList.length; i++) {
                    if(location[removeList[i]]){
                        delete location[removeList[i]]
                    }
                }
            }
        }
        else {
            log.error(`No locations for Agency ${agencyWebInfo.id}` + __location)
        }
        agencyWebInfo.locations = locations
        agencyWebInfo.insurers = insurerList;
    }
    catch(err){
        log.error("Error processing Agency locations " + err + __location);
    }
    // Retrieve Officer Titles
    const officerTitlesSql = `SELECT officerTitle from \`officer_titles\``;

    // Including an require statements.
    const officerTitlesResult = await db.query(officerTitlesSql).catch(function(err){
        log.error('officer_titles ' + err + __location);
    });
    const officerTitleArr = [];
    officerTitlesResult.forEach(officerTitleObj => officerTitleArr.push(officerTitleObj.officerTitle));
    if(officerTitleArr.length > 0){
        agencyWebInfo.officerTitles = officerTitleArr;
    }

    try{
        await agencyLandingPageBO.addPageHit(agencyWebInfo.landingPageID)
    }
    catch(err){
        log.error(`Error update hits continue landingPageID ${agencyWebInfo.landingPageID}` + __location)
    }

    // log.debug("final agencyWebInfo " + JSON.stringify(agencyWebInfo) + __location);

    return agencyWebInfo;
}

/**
 * Responds to POST requests and returns policy quotes
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgency(req, res, next) {
    if (!req.query.url) {
        res.send(400, {error: 'Missing URL'});
        return next();
    }
    const {
        agencySlug, pageSlug
    } = parseQuoteURL(req.query.url);

    let agency = null;
    if (agencySlug) {
        // Try to get the agency as request using both the agencySlug and the pageSlug
        agency = await getAgencyFromSlugs(agencySlug, pageSlug);

        // If that fails and it tried a valid pageSlug, fall back to just the agencySlug. If pageSlug is null, then this call was already made above.
        if (agency === null && pageSlug) {
            // Thought about adding log.warn, but that could get horrible with crawlers
            agency = await getAgencyFromSlugs(agencySlug, null);
        }

        // If that fails and there is a default agency slug, fall back to the default agencySlug
        if (agency === null && global.settings.DEFAULT_QUOTE_AGENCY_SLUG) {
            agency = await getAgencyFromSlugs(global.settings.DEFAULT_QUOTE_AGENCY_SLUG, null);
        }

        // If that fails, return the talage agency
        if (agency === null) {
            agency = await getAgencyFromSlugs('talage', null);
        }
        if(!agency){
            log.warn(`No agency for url ${req.query.url}` + __location);
        }

    }
    res.send(200, {agency: agency});
    return next();
}

/**
 * Responds to POST requests and returns social media meta data
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencySocialMetadata(req, res, next) {
    if (!req.query.url) {
        res.send(400, {error: 'Missing URL'});
        return next();
    }
    const slugs = parseQuoteURL(req.query.url);
    let agencySlug = slugs.agencySlug;
    const pageSlug = slugs.pageSlug;

    if (!agencySlug) {
        agencySlug = 'talage';
    }

    let agencyJson = null;
    //Get agency record.
    const agencyBO = new AgencyBO();

    try {
        agencyJson = await agencyBO.getbySlug(agencySlug);
    }
    catch (err) {
        log.error(`Error retrieving Agency in quote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}) url ${req.query.url}: ${err} ${__location}`);
        return null;
    }
    if(!agencyJson){
        log.warn(`Could not retrieve Agency quote engine agencySlug ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}) url ${req.query.url}: ${__location}`);
        res.send(404, {error: 'Could not retrieve agency'});
        return next();
    }

    try {
        const agencyNetworkBO = new AgencyNetworkBO();
        // eslint-disable-next-line no-unused-vars
        let error = null;
        const agencyNetworkJSON = await agencyNetworkBO.getById(agencyJson.agencyNetworkId).catch(function(err){
            error = err;
            log.error("Get AgencyNetwork Error " + err + __location);
        })
        if(agencyNetworkJSON && agencyNetworkJSON.landing_page_content){
            agencyJson.landingPageContent = agencyNetworkJSON.landing_page_content;
        }
        else {
            //get from default AgencyNetwork
            log.debug(`AgencyNetwork ${agencyJson.agencyNetworkId} using default landingpage`)
            const agencyNetworkJSONDefault = await agencyNetworkBO.getById(1).catch(function(err){
                error = err;
                log.error("Get AgencyNetwork 1 Error " + err + __location);
            });

            if(agencyNetworkJSONDefault && agencyNetworkJSONDefault.landing_page_content){
                agencyJson.landingPageContent = agencyNetworkJSONDefault.landing_page_content;
            }
        }

    }
    catch (error) {
        log.error(`Could not parse landingPageContent in agency slug '${agencySlug}' for social metadata: ${error} ${__location}`);
        res.send(400, {error: 'Could not process agency data'});
        return next();
    }

    try {

        if (agencyJson.additionalInfo && agencyJson.additionalInfo.socialMediaTags && agencyJson.additionalInfo.socialMediaTags.facebookPixel) {
            agencyJson.facebookPixel = agencyJson.additionalInfo.socialMediaTags.facebookPixel;
        }

    }
    catch(err){
        log.error(`Getting Facebook Pixel ${err} ${__location}`);
    }

    if(!agencyJson.landingPageContent){
        agencyJson.landingPageContent = {bannerHeadingDefault: ""};
    }
  

    res.send(200, {
        metaTitle: agencyJson.name,
        metaDescription: agencyJson.landingPageContent.bannerHeadingDefault ? agencyJson.landingPageContent.bannerHeadingDefault : agencyJson.defaultLandingPageContent.bannerHeadingDefault,
        metaImage: `${global.settings.IMAGE_URL}/public/agency-logos/${agencyJson.logo}`,
        metaFaviconImage: `${global.settings.IMAGE_URL}/public/agency-logos/favicon/${agency.favicon}`,
        metaURL: agencyJson.website,
        metaPixel: agencyJson.facebookPixel
    });
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAppWF('Get Quote Agency', `${basePath}/agency`, getAgency);
    server.addGet('Get Quote Agency Metadata', `${basePath}/agency/social-metadata`, getAgencySocialMetadata);
};