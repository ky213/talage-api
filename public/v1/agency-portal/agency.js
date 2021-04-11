/* eslint-disable object-curly-newline */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable array-element-newline */
'use strict';
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const AgencyLandingPageBO = global.requireShared('./models/AgencyLandingPage-BO.js');
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const InsurerBO = global.requireShared('models/Insurer-BO.js');
const InsurerPolicyTypeBO = global.requireShared('models/InsurerPolicyType-BO.js');


const crypt = global.requireShared('./services/crypt.js');
const util = require('util');
const sendOnboardingEmail = require('./helpers/send-onboarding-email.js');
const auth = require('./helpers/auth-agencyportal.js');
const validator = global.requireShared('./helpers/validator.js');
const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


/**
 * Generates a random password for the user's first login
 *
 * @return {string} - A random 8 character or number string
 */
function generatePassword() {
    return Math.random().toString(36).substr(2, 8);
}

/**
 * Deletes a single Agency
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function deleteAgency(req, res, next) {
    let error = false;

    // Make sure this is an agency network
    if (req.authentication.isAgencyNetworkUser === false) {
        log.info('Forbidden: User is not authorized to delete agencies');
        return next(serverHelper.forbiddenError('You are not authorized to delete agencies'));
    }

    // Check that query parameters were received
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: Query parameters missing');
        return next(serverHelper.requestError('Query parameters missing'));
    }

    // Validate the ID
    if (!Object.prototype.hasOwnProperty.call(req.query, 'id')) {
        return next(serverHelper.requestError('ID missing'));
    }

    if (!await validator.integer(req.query.id)) {
        return next(serverHelper.requestError('ID is invalid'));
    }
    const id = parseInt(req.query.id, 10);

    // Get the agencies that we are permitted to manage
    const agencies = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }

    // Make sure this Agency Network has access to this Agency
    if (!agencies.includes(id)) {
        log.info('Forbidden: User is not authorized to delete this agency');
        return next(serverHelper.forbiddenError('You are not authorized to delete this agency'));
    }

    let userId = null;
    try{
        userId = req.authentication.userID;
    }
    catch(err){
        log.error("Error gettign userID " + err + __location);
    }

    const agencyBO = new AgencyBO();
    // Load the request data into it
    const resp = await agencyBO.deleteSoftById(id,userId).catch(function(err) {
        log.error("Agency Delete load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    // Make sure the query was successful
    if (resp === false) {
        log.error('User delete failed');
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    res.send(200, 'Deleted');
}

/**
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getTerritories(req, res, next) {

    const allTerritoriesSQL = `
		SELECT
			abbr,
			name
		FROM clw_talage_territories
		ORDER BY name ASC;
	`;
    // Query the database
    const allTerritories = await db.query(allTerritoriesSQL).catch(function(err) {
        log.error('DB query for territories list failed: ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });
    // Return the response
    res.send(200, {"territories": allTerritories});
    return next();
}

/**
 * Returns the record for a single Agency
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgency(req, res, next) {
    let error = false;

    // Determine which permissions group to use (start with the default permission needed by an agency network)
    let permissionGroup = 'agencies';

    // If this is not an agency network, use the agency specific permissions
    if (req.authentication.isAgencyNetworkUser === false) {
        permissionGroup = 'settings';
    }

    // Make sure the authentication payload has everything we are expecting
    await auth.validateJWT(req, permissionGroup, 'view').catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }

    // Get the agents that we are permitted to view
    const agents = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }

    // Check that query parameters were received
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: Query parameters missing');
        return next(serverHelper.requestError('Query parameters missing'));
    }

    // Check for required parameters
    if (!Object.prototype.hasOwnProperty.call(req.query, 'agent') || !req.query.agent) {
        log.info('Bad Request: You must specify an agent');
        return next(serverHelper.requestError('You must specify an agent'));
    }

    // By default, the use first agency available to this user (for non-agency network users, they will only have one which is their agency)
    let agent = agents[0];

    // If this is an agency network, use the one from the request
    if (req.authentication.isAgencyNetworkUser !== false) {
        agent = parseInt(req.query.agent, 10);
    }

    // Validate parameters
    if (!await validator.integer(agent)) {
        log.info('Bad Request: Invalid agent selected');
        return next(serverHelper.requestError('The agent you selected is invalid'));
    }

    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!agents.includes(parseInt(agent, 10))) {
        log.info('Forbidden: User is not authorized to access the requested agent');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested agent'));
    }

    error = null;
    const agencyBO = new AgencyBO();
    // Load the request data into it
    const agency = await agencyBO.getById(agent).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        log.error(`Error getting Agency: ${agent} ` + error + __location);
        return next(error);
    }
    if (error && error.message === "not found") {
        log.error(`Agency not found: ${agent}` + __location);
        return next(serverHelper.notFoundError('Agency not found'));
    }

    // Make sure we got back the expected data
    if (!agency) {
        log.error(`Agency not found after having passed request validation agencyId ${agent} ` + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }
    agency.state = agency.active ? "Active" : "Inactive";
    //remove old property names.
    const removePropList = ["agency_network","ca_license_number","fname", "lname", "wholesale_agreement_signed", "docusign_envelope_id","do_not_report", "enable_optout"];
    for(let i = 0; i < removePropList.length; i++){
        if(agency[removePropList[i]]){
            delete agency[removePropList[i]]
        }
    }

    // Build the response
    const response = {...agency};
    //log.debug('Get Agency ' + JSON.stringify(response))

    // Return the response
    res.send(200, response);
    return next();
}

/**
 * Creates a single Agency
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function postAgency(req, res, next) {
    let error = false;

    // Make sure this is an agency network
    if (req.authentication.isAgencyNetworkUser === false) {
        log.info('Forbidden: Only Agency Networks are authorized to create agencies');
        return next(serverHelper.forbiddenError('You are not authorized to create agencies'));
    }

    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received');
        return next(serverHelper.requestError('No data was received'));
    }

    // Log the entire request
    log.verbose(util.inspect(req.body, false, null));

    // Make sure all information is present
    if (!Object.prototype.hasOwnProperty.call(req.body, 'firstName') || typeof req.body.firstName !== 'string' || !req.body.firstName) {
        log.warn('firstName is required');
        return next(serverHelper.requestError('You must enter an the First Name of the agent'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'lastName') || typeof req.body.lastName !== 'string' || !req.body.lastName) {
        log.warn('lastName is required');
        return next(serverHelper.requestError('You must enter an the Last Name of the agent'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'name') || typeof req.body.name !== 'string' || !req.body.name) {
        log.warn('name is required');
        return next(serverHelper.requestError('You must enter an Agency Name'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'email') || typeof req.body.email !== 'string' || !req.body.email) {
        log.warn('email is required');
        return next(serverHelper.requestError('You must enter an Email Address'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'territories') || typeof req.body.territories !== 'object' || req.body.territories.length < 1) {
        log.warn('territories are required');
        return next(serverHelper.requestError('You must select at least one Territory'));
    }


    // Begin compiling a list of territories
    const insurerIDs = [];
    let territoryAbbreviations = [];
    // TODO Move to Model
    // Build a query for getting all insurers with their territories
    const agencyNetworkId = req.authentication.agencyNetworkId


    // Validate
    if (!validator.agency_name(req.body.name)) {
        log.warn('Invalid agency name');
        return next(serverHelper.requestError('The agency name entered is not valid.'));
    }
    if (!validator.email(req.body.email)) {
        log.warn('Invalid email address');
        return next(serverHelper.requestError('The email address entered is not valid.'));
    }

    let useAgencyPrime = false;

    if(req.body.useAgencyPrime){
        useAgencyPrime = req.body.useAgencyPrime;
    }

    let insurers = [];
    if(useAgencyPrime === false){
        if (!Object.prototype.hasOwnProperty.call(req.body, 'agencyIds') || typeof req.body.agencyIds !== 'object' || (Object.keys(req.body.agencyIds).length < 1 && Object.keys(req.body.talageWholesale).length < 1)){
            log.warn('agencyId or Talage Wholesale are required');
            return next(serverHelper.requestError('You must enter at least one Agency ID or Talage Wholesale'));
        }


        try{
            let agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetworkJSON = await agencyNetworkBO.getById(agencyNetworkId).catch(function(err) {
                log.error("agencyNetworkBO load error " + err + __location);
                error = err;
            });
            if (error) {
                return next(error);
            }

            // eslint-disable-next-line prefer-const
            let insurerIdArray = agencyNetworkJSON.insurerIds;

            if(insurerIdArray.length > 0){
                const insurerBO = new InsurerBO();
                const insurerPolicyTypeBO = new InsurerPolicyTypeBO();
                const query = {"insurerId": insurerIdArray}
                let insurerDBJSONList = await insurerBO.getList(query);
                if(insurerDBJSONList && insurerDBJSONList.length > 0){
                    for(let insurerDB of insurerDBJSONList){
                        insurerDB.territories = await insurerBO.getTerritories(insurerDB.insurerId);
                        //check if any insurerPolicyType is wheelhouse enabled.
                        // eslint-disable-next-line object-property-newline
                        const queryPT = {"wheelhouse_support": true, insurerId: insurerDB.insurerId};
                        const insurerPtDBList = await insurerPolicyTypeBO.getList(queryPT)
                        if(insurerPtDBList && insurerPtDBList.length > 0){
                            insurerDB.policyTypes = insurerPtDBList;
                            if(insurerDB.territories){
                                territoryAbbreviations = territoryAbbreviations.concat(insurerDB.territories);
                            }
                            insurerIDs.push(insurerDB.insurerId);
                            insurers.push(insurerDB)
                        }
                        else {
                            log.info(`No wheelhouse enabled products for insurer ${insurerDB.insurerId}` + __location)
                        }
                    }
                }
            }

        }
        catch(err){
            log.error(`Error get Agency Network Insurer List ` + err + __location);
        }

        req.body.territories.forEach(function(territoryAbbreviation) {
            if (!territoryAbbreviations.includes(territoryAbbreviation)) {
                error = serverHelper.requestError('Invalid territory in request. Please contact us.');
            }
        });
        if (error) {
            return next(error);
        }


        for (let insurerID in req.body.agencyIds) {
            if (Object.prototype.hasOwnProperty.call(req.body.agencyIds, insurerID)) {
            // Convert the insurer ID into a number
                insurerID = parseInt(insurerID, 10);

                // Make sure the insurer ID is permitted
                if (!insurerIDs.includes(insurerID)) {
                    return next(serverHelper.requestError('Invalid insurer ID in request. Please contact us.'));
                }

                // Make sure the field wasn't left blank
                if (!req.body.agencyIds[insurerID]) {
                    return next(serverHelper.requestError('An agency ID is required for each insurer.'));
                }

                // Make sure the agentId field wasn't left blank for insurers that require agent id
                const maybeInsurer = insurers.filter((ins) => ins.insurerId === insurerID);
                const insurer = maybeInsurer.length > 0 ? maybeInsurer[0] : null;
                // if we find the insurer and the enable agent id is true and the agentId field is empty then throw error
                if (insurer !== null) {
                    if (insurer.enable_agent_id === 1 && !req.body.agentIds[insurerID]) {
                        return next(serverHelper.requestError('An Agent ID is required for each insurer.'));
                    }
                }
                else {
                    log.error('We have in insurer info being sent to the backend with an insurer id that does not exist in the db. Error at ' + __location)
                }
            }
        }

    }


    // Localize data variables
    const email = req.body.email.toLowerCase();
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const name = req.body.name;
    const territories = req.body.territories;
    const agencyIds = req.body.agencyIds;
    const agentIds = req.body.agentIds;
    const talageWholesaleJson = req.body.talageWholesale;

    // Make sure we don't already have an user tied to this email address
    const emailHash = await crypt.hash(email);
    const emailHashSQL = `
			SELECT ${db.quoteName('id')}
			FROM \`#__agency_portal_users\`
			WHERE \`email_hash\` = ${db.escape(emailHash)}
			LIMIT 1;
		`;
    const emailHashResult = await db.query(emailHashSQL).catch(function(e) {
        log.error(e.message);
        error = serverHelper.internalError('Error querying database. Check logs.');
    });
    if (error) {
        return next(error);
    }
    if (emailHashResult.length > 0) {
        return next(serverHelper.requestError('The email address you specified is already associated with another agency. Please check the email address.'));
    }

    // Generate a slug for this agency (will be used to define their unique storefront link)
    const initalSlug = name.
        trim().
        replace(/\s/g, '-').
        replace(/[^a-zA-Z0-9-]/g, '').
        toLowerCase().
        substring(0, 30);

    // Make sure the slug is unique
    let slug = initalSlug;
    let verifiedUnique = false;
    let slugCount = 1;
    const agencyBO = new AgencyBO();
    while (!verifiedUnique) {
        let slugExists = false;
        try{
            slugExists = await agencyBO.checkIfSlugExists(slug);
        }
        catch(err){
            log.error("Agency slug check db error " + err + __location);
            return next(serverHelper.internalError('Error querying database. Check logs.'));
        }


        // If no response was received, this is unique
        if (slugExists === false) {
            verifiedUnique = true;
        }
        else {
            if (slugCount === 1) {
                slug = `${slug.substring(0, 27)}-${slugCount}`;
            }
            else {
                slug = slug.substring(0, slug.length - slugCount.toString().length) + slugCount;
            }
            slugCount++;
        }
    }


    let wholesale = 0;
    if (req.authentication.agencyNetworkId === 2) {
        wholesale = 1;
    }


    const newAgencyJSON = {
        name: name,
        email: email,
        agencyNetworkId: req.authentication.agencyNetworkId,
        firstName: firstName,
        lastName: lastName,
        slug: slug,
        wholesale: wholesale

    }
    error = null;
    // Load the request data into it
    await agencyBO.saveModel(newAgencyJSON).catch(function(err) {
        log.error("agencyBO.save error " + err + __location);
        error = err;
    });

    // Get the ID of the new agency
    const agencyId = agencyBO.id;

    // Create Insurers array:
    const insurerArray = [];
    if(useAgencyPrime === false){
        //regular
        for (const insurerID in agencyIds) {
            const insurerIdInt = parseInt(insurerID, 10)
            // Do not default to WC only.
            // base it on the insurer setup.
            //Find insurer in insurelist
            try{
                const insurerJSON = insurers.find((ins) => ins.insurerId === insurerIdInt);
                if(insurerJSON){
                    const insurerAL = {
                        "insurerId": insurerIdInt,
                        "agencyId": agencyIds[insurerID],
                        talageWholesale: false,
                        "policyTypeInfo": {
                            "notifyTalage": false
                        }
                    };
                    if(insurerJSON.policyTypes && insurerJSON.policyTypes.length > 0){
                        for(const insurerPolicyType of insurerJSON.policyTypes){
                            insurerAL.policyTypeInfo[insurerPolicyType.policy_type] = {
                                "enabled": true,
                                "useAcord": false,
                                "acordInfo": {"sendToEmail": ""}
                            }
                        }
                        if (agentIds[insurerID]) {
                            insurerAL.agentId = agentIds[insurerID];
                        }
                    }
                    else {
                        log.error(`did not find policyTypes for ${JSON.stringify(insurerJSON)}` + __location)
                    }
                    insurerArray.push(insurerAL);
                }
                else {
                    log.error(`did not find insurer ${insurerID}  in list ${JSON.stringify(insurers)}` + __location)
                }
            }
            catch(err){
                log.error(`Create Agency add agency location insurer ` + err + __location)
            }
        }
        //talage wholesale
        for (const insurerID in talageWholesaleJson) {
            const insurerIdInt = parseInt(insurerID, 10)
            // Do not default to WC only.
            // base it on the insurer setup.
            //Find insurer in insurelist
            try{
                const insurerJSON = insurers.find((ins) => ins.insurerId === insurerIdInt);
                if(insurerJSON){
                    //insurerDB.policyTypes = insurerPtDBList;
                    const insurerAL = {
                        "insurerId": insurerIdInt,
                        talageWholesale: true,
                        policyTypeInfo: {}
                    };
                    if(insurerJSON.policyTypes && insurerJSON.policyTypes.length > 0){
                        for(const insurerPolicyType of insurerJSON.policyTypes){
                            insurerAL.policyTypeInfo[insurerPolicyType.policy_type] = {
                                "enabled": true,
                                "useAcord": false,
                                "acordInfo": {"sendToEmail": ""}
                            }
                        }
                    }
                    else {
                        log.error(`did not find policyTypes for ${JSON.stringify(insurerJSON)}` + __location)
                    }
                    insurerArray.push(insurerAL);
                }
                else {
                    log.error(`did not find insurer ${insurerID}  in list ${JSON.stringify(insurers)}` + __location)
                }
            }
            catch(err){
                log.error(`Create Agency add agency location insurer ` + err + __location)
            }
        }

    }

    // Create a default location for this agency
    const newAgencyLocationJSON = {
        agencyId: agencyId,
        email: email,
        agencyNetworkId: req.authentication.agencyNetworkId,
        firstName: firstName,
        lastName: lastName,
        useAgencyPrime: useAgencyPrime,
        insurers: insurerArray,
        territories: territories,
        additionalInfo: {territories: territories}
    }
    log.verbose(JSON.stringify(newAgencyLocationJSON))
    const agencyLocationBO = new AgencyLocationBO();
    await agencyLocationBO.saveModel(newAgencyLocationJSON).catch(function(err) {
        log.error("Add Agency - agencyLocationBO.save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(serverHelper.internalError('Error saving to database.'));
    }

    const newAgencyLandingPageJSON = {
        agencyId: agencyId,
        name: 'Get Quotes',
        slug: 'get-quotes',
        primary: 1
    };
    const agencyLandingPageBO = new AgencyLandingPageBO();
    await agencyLandingPageBO.saveModel(newAgencyLandingPageJSON).catch(function(err) {
        log.error("Add Agency - agencyLandingPageBO.save error " + err + __location);
        error = err;
    });
    //Agency already created not return error over landing page.


    // Create a user for agency portal access
    // // Encrypt the user's information
    const encrypted = {
        "email": email,
        "firstName": firstName,
        "lastName": lastName
    };
    await crypt.batchProcessObject(encrypted, 'encrypt', ['email',
        'firstName',
        'lastName']);
    const password = generatePassword();
    const hashedPassword = await crypt.hashPassword(password);
    const createUserSQL = `
			INSERT INTO \`#__agency_portal_users\` (\`agency\`, \`can_sign\`, \`email\`, \`email_hash\`, \`group\`, \`password\`)
			VALUES (${db.escape(agencyId)}, 1, ${db.escape(encrypted.email)}, ${db.escape(emailHash)}, 1, ${db.escape(hashedPassword)});
		`;
    log.info('creating user');
    const createUserResult = await db.query(createUserSQL).catch(function(e) {
        log.error(e.message);
        return next(serverHelper.internalError('Error querying database. Check logs.'));
    });

    // Get the ID of the new agency user
    const userID = createUserResult.insertId;

    const onboardingEmailResponse = await sendOnboardingEmail(req.authentication.agencyNetworkId, userID, firstName, lastName, name, slug, email);

    if (onboardingEmailResponse) {
        return next(serverHelper.internalError(onboardingEmailResponse));
    }

    // Return the response
    res.send(200, {
        "agencyId": agencyId,
        "code": 'Success',
        "message": 'Agency Created'
    });
    return next();
}

/**
 * Updates a single Agency
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function updateAgency(req, res, next) {
    let error = false;

    // Determine which permissions group to use (start with the default permission needed by an agency network)
    let permissionGroup = 'agencies';

    // If this is not an agency network, use the agency specific permissions
    if (req.authentication.isAgencyNetworkUser === false) {
        permissionGroup = 'settings';
    }

    // Make sure the authentication payload has everything we are expecting
    await auth.validateJWT(req, permissionGroup, 'view').catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }

    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received');
        return next(serverHelper.requestError('No data was received'));
    }

    // Validate the ID
    if (!Object.prototype.hasOwnProperty.call(req.body, 'id')) {
        return next(serverHelper.requestError('ID missing'));
    }
    if (!await validator.integer(req.body.id)) {
        return next(serverHelper.requestError('ID is invalid'));
    }
    const id = parseInt(req.body.id, 10);
    req.body.id = id;
    // Get the agencies that we are permitted to manage
    const agencies = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }

    // Make sure this Agency Network has access to this Agency
    if (!agencies.includes(id)) {
        log.info('Forbidden: User is not authorized to delete this agency');
        return next(serverHelper.forbiddenError('You are not authorized to delete this agency'));
    }

    // Initialize an agency object
    error = null;
    log.debug("saving agency")
    const agencyBO = new AgencyBO();
    // Load the request data into it
    await agencyBO.saveModel(req.body).catch(function(err) {
        log.error("agencyBO.save error " + err + __location);
        error = err;
    });
    if(error){
        return next(serverHelper.requestError(error));
    }
    //deal with logo

    // Send back a success response
    res.send(200, {"logo": agencyBO.logo});
    return next();
}

/**
 *
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function postSocialMediaTags(req, res, next) {
// TODO: DELETE ENDPOINT NEXT SPRINT


    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0 && !req.body.id) {
        log.warn('No data was received');
        return next(serverHelper.requestError('No data was received'));
    }

    const agencies = await auth.getAgents(req).catch(function(e) {
        log.error("unable to getAgents for user " + e + __location);
    });

    const id = parseInt(req.body.id, 10);

    // Make sure this Agency Network has access to this Agency
    if (!agencies.includes(id)) {
        log.info('Forbidden: User is not authorized to delete this agency');
        return next(serverHelper.forbiddenError('You are not authorized to delete this agency'));
    }

    const agency = new AgencyBO();
    let agencyJSON = null;
    try {
        agencyJSON = await agency.getById(req.body.id);

    }
    catch (err) {
        log.error(err + __location);
    }

    if(agencyJSON){

        if (!agencyJSON.additionalInfo) {
            agencyJSON.additionalInfo = {};
        }
        if (!agencyJSON.additionalInfo.socialMediaTags) {
            agencyJSON.additionalInfo.socialMediaTags = {};
        }
        agencyJSON.additionalInfo.socialMediaTags.facebookPixel = req.body.pixelId;


        await agency.saveModel(agencyJSON).catch(function(err) {
            log.error('Save Agency:',err, __location);
        });


        res.send(200, 'socialMediaTags');
    }
    else{
        res.send(404,'Not Found');
    }
    return next();

}

/**
 *
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function postSocialMediaInfo(req, res, next) {

    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0 && !req.body.id) {
        log.warn('No data was received');
        return next(serverHelper.requestError('No data was received'));
    }
    let id = -1;
    if(req.authentication.isAgencyNetworkUser){
        const agencies = await auth.getAgents(req).catch(function(e) {
            log.error("unable to getAgents for user " + e + __location);
        });

        id = parseInt(req.body.id, 10);
        // Make sure this Agency Network has access to this Agency
        if (!agencies.includes(id)) {
            log.info('Forbidden: User is not authorized to update this agency');
            return next(serverHelper.forbiddenError('You are not authorized to update this agency'));
        }
    }
    else {
        id = req.authentication.agents[0];
    }
    const agency = new AgencyBO();
    let agencyJSON = null;
    try {
        agencyJSON = await agency.getById(id);

    }
    catch (err) {
        log.error(err + __location);
    }
    if(agencyJSON){

        if (!agencyJSON.socialMediaTags) {
            agencyJSON.socialMediaTags = [];
        }
        agencyJSON.socialMediaTags = req.body.socialMediaTags;
        await agency.saveModel(agencyJSON).catch(function(err) {
            log.error('Save Agency:',err, __location);
        });
        res.send(200, 'Social Media Tags Saved');
    }
    else{
        res.send(404,'Not Found');
    }
    return next();
}
exports.registerEndpoint = (server, basePath) => {
    server.addDeleteAuth('Delete Agency', `${basePath}/agency`, deleteAgency, 'agencies', 'manage');
    server.addGetAuth('Get Agency', `${basePath}/agency`, getAgency, 'agencies', 'view');
    server.addGetAuth('Get Agency', `${basePath}/agency/territories`, getTerritories, 'agencies', 'view');
    server.addPostAuth('Post Agency', `${basePath}/agency`, postAgency, 'agencies', 'manage');
    server.addPutAuth('Put Agency', `${basePath}/agency`, updateAgency, 'agencies', 'manage');
    server.addPostAuth('Post Agency', `${basePath}/agency/socialMediaTags`, postSocialMediaTags, 'agencies', 'manage');
    server.addPostAuth('Post Social Media Tags', `${basePath}/agency/socialMediaInfo`, postSocialMediaInfo, 'agencies', 'manage');
};