/* eslint-disable guard-for-in */
/* eslint-disable array-element-newline */
'use strict';
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const AgencyLandingPageBO = global.requireShared('./models/AgencyLandingPage-BO.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');

const crypt = global.requireShared('./services/crypt.js');
const util = require('util');
const sendOnboardingEmail = require('./helpers/send-onboarding-email.js');
const auth = require('./helpers/auth.js');
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
    if (req.authentication.agencyNetwork === false) {
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
    if (!await validator.agent(req.query.id)) {
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

    // Update the Agency (we set the state to -2 to signify that the Agency is deleted)
    const updateSQL = `
			UPDATE clw_talage_agencies
			SET
				state = -2
			WHERE
				id = ${id}
			LIMIT 1;
		`;

    // Run the query
    const result = await db.query(updateSQL).catch(function(err) {
        log.error('clw_talage_agencies error ' + err + __location);
        error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });
    if (error) {
        return next(error);
    }

    // Make sure the query was successful
    if (result.affectedRows !== 1) {
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
    if (req.authentication.agencyNetwork === false) {
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
    if (req.authentication.agencyNetwork !== false) {
        agent = parseInt(req.query.agent, 10);
    }

    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!agents.includes(parseInt(agent, 10))) {
        log.info('Forbidden: User is not authorized to access the requested agent');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested agent'));
    }

    // Validate parameters
    if (!await validator.agent(agent)) {
        log.info('Bad Request: Invalid agent selected');
        return next(serverHelper.requestError('The agent you selected is invalid'));
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
        log.error('Agency not found after having passed validation' + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    //do some cleanup
    // eslint-disable-next-line guard-for-in
    for (const property in agency) {
        if (property === 'ca_license_number') {
            agency.caLicenseNumber = agency.ca_license_number
        }
        else if (property === 'state') {
            agency.state = agency.state > 0 ? "Active" : "Inactive";
        }


        if (typeof agency[property] === 'object' && agency[property] !== null && agency[property].length === 0) {
            agency[property] = null;
        }
    }
    const agencyNetworkId = agency.agency_network
    log.debug('agencyNetworkId: ' + agencyNetworkId);
    // Define some queries to get locations, pages and users
    const allTerritoriesSQL = `
		SELECT
			\`abbr\`,
			\`name\`
		FROM \`clw_talage_territories\`
		ORDER BY \`name\` ASC;
	`;

    const networkInsurersSQL = `
                SELECT
                    i.id,
                    i.logo,
                    i.name,
                    i.agency_id_label,
                    i.agent_id_label,
                    i.enable_agent_id,
                    GROUP_CONCAT(it.territory) AS territories
                FROM clw_talage_agency_network_insurers AS agi
                LEFT JOIN clw_talage_insurers AS i ON agi.insurer = i.id
                LEFT JOIN clw_talage_insurer_territories AS it ON i.id = it.insurer
                LEFT JOIN clw_talage_insurer_policy_types AS pti ON i.id = pti.insurer
                WHERE
                    i.id IN (select insurer from clw_talage_agency_network_insurers where agency_network = ${agencyNetworkId}) AND
                    i.state = 1 AND
                    pti.wheelhouse_support = 1

                GROUP BY i.id
                ORDER BY i.name ASC;
	`;


    let users = null;
    try {
        const agencyPortalUserBO = new AgencyPortalUserBO();
        users = await agencyPortalUserBO.getByAgencyId(agent);
    }
    catch (err) {
        log.error('DB query failed: ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }


    // Query the database
    const allTerritories = await db.query(allTerritoriesSQL).catch(function(err) {
        log.error('DB query failed: ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    //TODO Delete this next iteration start deletion section, logic moved to agency-locations
    // START DELETE SECTION
    const agencyLocationBO = new AgencyLocationBO();

    let locations = null;
    try {
        const query = {"agency": agent}
        const getChildren = true;
        locations = await agencyLocationBO.getList(query, getChildren)
        locations.forEach((location) => {
            location.openTime = location.open_time;
            location.closeTime = location.close_time;
        });
    }
    catch (err) {
        log.error(err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    // END DELETE SECTION

    //log.debug("agency get locations: " + JSON.stringify(locations))


    const networkInsurers = await db.query(networkInsurersSQL).catch(function(err) {
        log.error('DB query failed: ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });


    const agencyLandingPageBO = new AgencyLandingPageBO();
    const pageQuery = {"agency": agent}
    const pages = await agencyLandingPageBO.getList(pageQuery).catch(function(err) {
        log.error("Add Agency - agencyLandingPageBO.getList error " + err + __location);
    });
    if (pages) {
        pages.forEach((page) => {
            if (page.color_scheme) {
                page.colorScheme = page.color_scheme
            }
        });
    }

    // Convert the network insurer territory data into an array
    networkInsurers.map(function(networkInsurer) {
        if (networkInsurer.territories) {
            networkInsurer.territories = networkInsurer.territories.split(',');
        }
        return networkInsurer;
    });
    // For each network insurer grab the policy_types
    for (let i = 0; i < networkInsurers.length; i++) {
        const insurer = networkInsurers[i];
        // Grab all of the policy type and accord support for a given insurer
        const policyTypeSql = `
			SELECT policy_type, acord_support
			FROM clw_talage_insurer_policy_types
			WHERE
				insurer = ${insurer.id}
		`
        let policyTypesResults = null;
        try {
            policyTypesResults = await db.query(policyTypeSql);
        }
        catch (err) {
            log.error(`Could not retrieve policy and accord_support for insurer ${insurer} :  ${err}  ${__location}`);
            return next(serverHelper.internalError('Internal Error'));
        }
        // Push policy types and accord support for said policy type into an array
        insurer.policyTypes = [];
        policyTypesResults.forEach((policyType) => {
            insurer.policyTypes.push(policyType);
        });
    }
    // Build the response
    const response = {
        ...agency,
        "locations": locations,
        "networkInsurers": networkInsurers,
        "pages": pages,
        "territories": allTerritories,
        "users": users
    };
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
    if (req.authentication.agencyNetwork === false) {
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
    if (!Object.prototype.hasOwnProperty.call(req.body, 'agencyIds') || typeof req.body.agencyIds !== 'object' || Object.keys(req.body.agencyIds).length < 1) {
        log.warn('agencyIds are required');
        return next(serverHelper.requestError('You must enter at least one Agency ID'));
    }

    // Begin compiling a list of territories
    const insurerIDs = [];
    let territoryAbbreviations = [];
    // TODO Move to Model
    // Build a query for getting all insurers with their territories
    const agencyNetworkId = req.authentication.agencyNetworkId

    const insurersSQL = `
                SELECT
                    i.id,
                    i.enable_agent_id,
                    GROUP_CONCAT(it.territory) AS territories
                FROM clw_talage_insurers as i
                LEFT JOIN clw_talage_insurer_territories as it ON it.insurer = i.id
                WHERE i.id IN (select insurer from clw_talage_agency_network_insurers where agency_network = ${agencyNetworkId} ) AND i.state > 0
                GROUP BY i.id
                ORDER BY i.name ASC;
		`;

    // Run the query
    const insurers = await db.query(insurersSQL).catch(function(err) {
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Convert the territories list into an array
    insurers.forEach(function(insurer) {
        if (insurer.territories) {
            insurer.territories = insurer.territories.split(',');
            territoryAbbreviations = territoryAbbreviations.concat(insurer.territories);
        }
        else {
            log.warn(`Creating Agency Insurer has not territories ${insurer.id}` + __location)
        }
        insurerIDs.push(insurer.id);
    });

    // Validate
    if (!validator.agency_name(req.body.name)) {
        log.warn('Invalid agency name');
        return next(serverHelper.requestError('The agency name entered is not valid.'));
    }
    if (!validator.email(req.body.email)) {
        log.warn('Invalid email address');
        return next(serverHelper.requestError('The email address entered is not valid.'));
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
            const maybeInsurer = insurers.filter((ins) => ins.id === insurerID);
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

    // Localize data variables
    const email = req.body.email.toLowerCase();
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const name = req.body.name;
    const territories = req.body.territories;
    const agencyIds = req.body.agencyIds;
    const agentIds = req.body.agentIds;

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
    while (!verifiedUnique) {
        // SQL to check if the generated agency slug already exists
        const slugSQL = `
				SELECT ${db.quoteName('id')}
				FROM ${db.quoteName('#__agencies')}
				WHERE ${db.quoteName('slug')} = ${db.escape(slug)}
				LIMIT 1;
			`;

        // Run the query
        // eslint-disable-next-line  no-await-in-loop
        const slugExists = await db.query(slugSQL).catch(function(e) {
            log.error(e.message);
            return next(serverHelper.internalError('Error querying database. Check logs.'));
        });

        // If no response was received, this is unique
        if (slugExists.length === 0) {
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
    if (req.authentication.agencyNetwork === 2) {
        wholesale = 1;
    }


    const newAgencyJSON = {
        name: name,
        email: email,
        agency_network: req.authentication.agencyNetwork,
        fname: firstName,
        lname: lastName,
        slug: slug,
        wholesale: wholesale
    }
    error = null;
    const agencyBO = new AgencyBO();
    // Load the request data into it
    await agencyBO.saveModel(newAgencyJSON).catch(function(err) {
        log.error("agencyBO.save error " + err + __location);
        error = err;
    });

    // Get the ID of the new agency
    const agencyId = agencyBO.id;

    // Create Insurers array:
    // Defaults to WC being enbled only.
    const insurerArray = [];
    for (const insurerID in agencyIds) {
        const insurerIdInt = parseInt(insurerID, 10)
        const insurer = {
            "insurer": insurerIdInt,
            "gl": 0,
            "wc": 1,
            "bop": 0,
            "agencyId": agencyIds[insurerID],
            "policy_type_info": {
                "WC": {
                    "enabled": true,
                    "useAcord": false,
                    "acordInfo": {"sendToEmail": ""}
                },
                "GL": {
                    "enabled": false,
                    "useAcord": false,
                    "acordInfo": {"sendToEmail": ""}
                },
                "BOP": {
                    "enabled": false,
                    "useAcord": false,
                    "acordInfo": {"sendToEmail": ""}
                },
                "notifyTalage": false
            }
        };
        if (agentIds[insurerID]) {
            insurer.agentId = agentIds[insurerID];
        }
        insurerArray.push(insurer);
    }
    // Create a default location for this agency
    const newAgencyLocationJSON = {
        agency: agencyId,
        email: email,
        agency_network: req.authentication.agencyNetwork,
        fname: firstName,
        lname: lastName,
        insurers: insurerArray,
        additionalInfo: {territories: territories}
    }

    const agencyLocationBO = new AgencyLocationBO();
    await agencyLocationBO.saveModel(newAgencyLocationJSON).catch(function(err) {
        log.error("Add Agency - agencyLocationBO.save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(serverHelper.internalError('Error saving to database.'));
    }

    const newAgencyLandingPageJSON = {
        agency: agencyId,
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

    const onboardingEmailResponse = await sendOnboardingEmail(req.authentication.agencyNetwork, userID, firstName, lastName, name, slug, email);

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
    if (req.authentication.agencyNetwork === false) {
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
    if (!await validator.agent(req.body.id)) {
        return next(serverHelper.requestError('ID is invalid'));
    }
    const id = parseInt(req.body.id, 10);

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

    // Ensure the primary location is loaded LAST in the array to prevent MySQL unique constraint errors when saving
    req.body.locations.sort(function(a) {
        return a.primary ? 1 : -1;
    });

    // Initialize an agency object
    error = null;
    log.debug("saving agency")
    const agencyBO = new AgencyBO();
    // Load the request data into it
    await agencyBO.saveModel(req.body).catch(function(err) {
        log.error("agencyBO.save error " + err + __location);
        error = err;
    });

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
    let error = false;

    // Determine which permissions group to use (start with the default permission needed by an agency network)
    let permissionGroup = 'agencies';

    // If this is not an agency network, use the agency specific permissions
    if (req.authentication.agencyNetwork === false) {
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

    //Agency Model
    const agencyBO = new AgencyBO();

    const agencies = await agencyBO.getList().catch(function(error) {
        log.error("error");
        process.exit(1);
    });

    for (let i = 0; i < agencies.length; i++) {
        let agencyJSON = null;
        const agency = new AgencyBO();
        try {
            agencyJSON = await agency.getById(agencies[i].id);
        }
        catch (error) {
            log.error("error");
            process.exit(1);
        }
        if (agencyJSON.id === req.body.id) {

            if (!agencyJSON.additionalInfo) {
                agencyJSON.additionalInfo = {};
            }
            if (!agencyJSON.additionalInfo.socialMediaTags) {
                agencyJSON.additionalInfo.socialMediaTags = {};
            }
            agencyJSON.additionalInfo.socialMediaTags.facebookPixel = req.body.pixelId;


            //agencyJSON.additionalInfo=[{socialMediaTags:{

            //}}]
        }
        const result = await agency.saveModel(agencyJSON).catch(function(error) {
            // Check if this was
            log.error("error");
            process.exit(1);
        });
    }

    res.send(200, 'socialMediaTags');
    return next();

}

exports.registerEndpoint = (server, basePath) => {
    server.addDeleteAuth('Delete Agency', `${basePath}/agency`, deleteAgency, 'agencies', 'manage');
    server.addGetAuth('Get Agency', `${basePath}/agency`, getAgency, 'agencies', 'view');
    server.addGetAuth('Get Agency', `${basePath}/agency/territories`, getTerritories, 'agencies', 'view');
    server.addPostAuth('Post Agency', `${basePath}/agency`, postAgency, 'agencies', 'manage');
    server.addPutAuth('Put Agency', `${basePath}/agency`, updateAgency, 'agencies', 'manage');
    server.addPostAuth('Post Agency', `${basePath}/agency/socialMediaTags`, postSocialMediaTags, 'agencies', 'manage');

};