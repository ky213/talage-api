/* eslint-disable array-element-newline */
'use strict';
const AgencyModel = global.requireShared('models/Agency-model.js');
const crypt = global.requireShared('./services/crypt.js');
const util = require('util');
const sendOnboardingEmail = require('./helpers/send-onboarding-email.js');
const auth = require('./helpers/auth.js');
const validator = global.requireShared('./helpers/validator.js');
const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');

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

    // Prepare to get the information for this agency
    const agencyInfoSQL = `
			SELECT
				${db.quoteName('id')},
				IF(${db.quoteName('state')} >= 1, 'Active', 'Inactive') AS ${db.quoteName('state')},
				${db.quoteName('name')},
				${db.quoteName('ca_license_number', 'caLicenseNumber')},
				${db.quoteName('email')},
				${db.quoteName('fname')},
				${db.quoteName('lname')},
				${db.quoteName('phone')},
				${db.quoteName('logo')},
				${db.quoteName('website')},
                ${db.quoteName('slug')},
				${db.quoteName('enable_optout', 'enableOptout')}
			FROM ${db.quoteName('#__agencies')}
			WHERE ${db.quoteName('id')} = ${agent}
			LIMIT 1;
		`;

    // Going to the database to get the user's info
    const agencyInfo = await db.query(agencyInfoSQL).catch(function(err) {
        log.error(err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Make sure we got back the expected data
    if (!agencyInfo || agencyInfo.length !== 1) {
        log.error('Agency not found after having passed validation');
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    // Get the agency from the response and do some cleanup
    const agency = agencyInfo[0];
    for (const property in agency) {
        if (typeof agency[property] === 'object' && agency[property] !== null && agency[property].length === 0) {
            agency[property] = null;
        }
    }

    // Define some queries to get locations, pages and users
    const allTerritoriesSQL = `
		SELECT
			\`abbr\`,
			\`name\`
		FROM \`clw_talage_territories\`
		ORDER BY \`name\` ASC;
	`;
    const locationsSQL = `
			SELECT
				${db.quoteName('l.id')},
				${db.quoteName('l.state')},
				${db.quoteName('l.email')},
				${db.quoteName('l.fname')},
				${db.quoteName('l.lname')},
				${db.quoteName('l.phone')},
				${db.quoteName('l.address')},
                ${db.quoteName('l.address2')},
                ${db.quoteName('l.city')},
                ${db.quoteName('l.state_abbr')},
                ${db.quoteName('l.zipcode')},
				${db.quoteName('l.open_time', 'openTime')},
				${db.quoteName('l.close_time', 'closeTime')},
				${db.quoteName('l.primary')}
			FROM ${db.quoteName('#__agency_locations', 'l')}
			WHERE ${db.quoteName('l.agency')} = ${agent} AND l.state > 0;
		`;
    const networkInsurersSQL = `
		SELECT
			\`i\`.\`id\`,
			\`i\`.\`logo\`,
			\`i\`.\`name\`,
			\`i\`.agency_id_label,
			\`i\`.agent_id_label,
            \`i\`.enable_agent_id,
		GROUP_CONCAT(\`it\`.\`territory\`) AS \`territories\`
		FROM \`clw_talage_agency_network_insurers\` AS \`agi\`
		LEFT JOIN \`clw_talage_insurers\` AS \`i\` ON \`agi\`.\`insurer\` = \`i\`.\`id\`
		LEFT JOIN \`clw_talage_insurer_territories\` AS \`it\` ON \`i\`.\`id\` = \`it\`.\`insurer\`
		LEFT JOIN \`clw_talage_insurer_policy_types\` AS \`pti\` ON \`i\`.\`id\` = \`pti\`.\`insurer\`
		WHERE
			\`i\`.\`id\` IN (${req.authentication.insurers.join(',')}) AND
			\`i\`.\`state\` = 1 AND
			\`pti\`.\`wheelhouse_support\` = 1

		GROUP BY \`i\`.\`id\`
		ORDER BY \`i\`.\`name\` ASC;
	`;
    const pagesSQL = `
			SELECT
				${db.quoteName('id')},
				${db.quoteName('about')},
				${db.quoteName('banner')},
				${db.quoteName('color_scheme', 'colorScheme')},
				${db.quoteName('hits')},
				${db.quoteName('name')},
				${db.quoteName('primary')},
				${db.quoteName('slug')}
			FROM ${db.quoteName('#__agency_landing_pages')}
			WHERE ${db.quoteName('agency')} = ${agent} AND state > 0;
		`;
    const userSQL = `
    		SELECT
    			\`apu\`.\`id\`,
    			\`apu\`.\`last_login\` AS \`lastLogin\`,
    			\`apu\`.\`email\`,
    			\`apu\`.\`can_sign\` AS \`canSign\`,
    			\`apg\`.\`id\` AS \`group\`,
    			\`apg\`.\`name\` AS \`groupRole\`
    		FROM \`#__agency_portal_users\` AS \`apu\`
    		LEFT JOIN \`#__agency_portal_user_groups\` AS \`apg\` ON \`apu\`.\`group\` = \`apg\`.\`id\`
    		WHERE \`apu\`.\`agency\` = ${agent} AND state > 0;
    	`;
    let users = null;
    try{
        const agencyPortalUserBO = new AgencyPortalUserBO();
        users = await agencyPortalUserBO.getByAgencyId(agent);
    }
    catch(err){
        log.error('DB query failed: ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }


    // Query the database
    const allTerritories = await db.query(allTerritoriesSQL).catch(function(err){
        log.error('DB query failed: ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });
    const locations = await db.query(locationsSQL).catch(function(err){
        log.error('DB query failed: ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });
    const networkInsurers = await db.query(networkInsurersSQL).catch(function(err){
        log.error('DB query failed: ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });
    const pages = await db.query(pagesSQL).catch(function(err){
        log.error('DB query failed: ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });
    // const users = await db.query(userSQL).catch(function(err){
    //     log.error('DB query failed: ' + err.message + __location);
    //     return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    // });

    // Separate out location IDs and define some variables
    const locationIDs = locations.map((location) => location.id);
    let locationInsurers = [];
    let territories = [];

    // Get the insurers and territories
    if (req.authentication.insurers.length && locationIDs.length) {


        // Define queries for insurers and territories
        // TODO BUG insurer_policy_type not handled correctly
        // If insurer has multiple policyType duplicate rows are shown.
        // DISTINCT kills dups.
        // BUT the wheelhouse_support is not handled correctly for
        // multiple policy types.
        const insurersSQL = `
				SELECT DISTINCT
					${db.quoteName('i.id', 'insurer')},
					${db.quoteName('i.logo')},
					${db.quoteName('i.name')},
					${db.quoteName('i.agency_id_label', 'agency_id_label')},
					${db.quoteName('i.agent_id_label', 'agent_id_label')},
					${db.quoteName('i.enable_agent_id', 'enable_agent_id')},					
					${db.quoteName('li.id')},
					${db.quoteName('li.agency_location', 'locationID')},
					${db.quoteName('li.agency_id', 'agencyId')},
					${db.quoteName('li.agent_id', 'agentId')},
					${db.quoteName('li.bop')},
					${db.quoteName('li.gl')},
                    ${db.quoteName('li.wc')},
                    li.policy_type_info
				FROM ${db.quoteName('#__agency_location_insurers', 'li')}
				INNER JOIN ${db.quoteName('#__insurers', 'i')} ON ${db.quoteName('li.insurer')} = ${db.quoteName('i.id')}
				INNER JOIN ${db.quoteName('#__insurer_policy_types', 'pti')} ON ${db.quoteName('i.id')} = ${db.quoteName('pti.insurer')}
				WHERE
					${db.quoteName('li.agency_location')} IN (${locationIDs.join(',')}) AND
					${db.quoteName('i.id')} IN (${req.authentication.insurers.join(',')}) AND
					${db.quoteName('i.state')} > 0 AND
					${db.quoteName('pti.wheelhouse_support')} = 1
				ORDER BY ${db.quoteName('i.name')} ASC;
			`;
        const territoriesSQL = `
				SELECT
					${db.quoteName('lt.id')},
					${db.quoteName('lt.agency_location', 'locationID')},
					${db.quoteName('t.abbr')},
					${db.quoteName('t.name')}
				FROM ${db.quoteName('#__agency_location_territories', 'lt')}
				LEFT JOIN ${db.quoteName('#__territories', 't')} ON ${db.quoteName('lt.territory')} = ${db.quoteName('t.abbr')}
				WHERE ${db.quoteName('lt.agency_location')} IN (${locationIDs.join(',')})
				ORDER BY ${db.quoteName('t.name')} ASC;
			`;
        locationInsurers = await db.query(insurersSQL).catch(function(err) {
            log.error(err.message);
            return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
        });

        territories = await db.query(territoriesSQL).catch(function(err) {
            log.error(err.message);
            return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
        });
    }

    // Decrypt data from all the queries so far
    const agencyDecrypt = crypt.batchProcessObject(agency, 'decrypt', ['caLicenseNumber',
        'email',
        'fname',
        'lname',
        'phone',
        'website']);
    const locationsDecrypt = crypt.batchProcessObjectArray(locations, 'decrypt', ['address',
        'address2',
        'email',
        'fname',
        'lname',
        'phone']);
    //const usersDecrypt = crypt.batchProcessObjectArray(users, 'decrypt', ['email']);

    const insurersDecrypt = crypt.batchProcessObjectArray(locationInsurers, 'decrypt', ['agencyId', 'agentId']);

    // Wait for all data to decrypt
    await Promise.all([agencyDecrypt,
        locationsDecrypt,
        //usersDecrypt,
        insurersDecrypt]);

    // Parse json field
    locationInsurers.forEach((locationInsurer) => {
        if (locationInsurer.policy_type_info) {
            try {
                locationInsurer.policy_type_info = JSON.parse(locationInsurer.policy_type_info)
                //fix database 1/0 to true and false
                const policyTypeList = ["GL", "BOP","WC"];
                for(let i = 0; i < policyTypeList.length; i++){
                    const policyType = policyTypeList[i];
                    if(locationInsurer.policy_type_info[policyType]){
                        if(locationInsurer.policy_type_info[policyType].enabled === 1){
                            locationInsurer.policy_type_info[policyType].enabled = true;
                        }
                        else if(locationInsurer.policy_type_info[policyType].enabled === 0){
                            locationInsurer.policy_type_info[policyType].enabled = false;
                        }
                    }
                }
            }
            catch (err) {
                log.error(`Agency location insurer JSON parse error ${err} JSON ` + JSON.stringify(locationInsurer));
            }
        }
    });
    // Sort insurers and territories into the appropriate locations if necessary
    if (locationInsurers.length || territories.length) {
        locations.forEach((location) => {
            location.insurers = locationInsurers.filter((insurer) => insurer.locationID === location.id);
            location.territories = territories.
                filter((territory) => territory.locationID === location.id).
                map(function(territory) {
                    return territory.abbr;
                });
        });
    }

    // Convert the network insurer territory data into an array
    networkInsurers.map(function(networkInsurer) {
        networkInsurer.territories = networkInsurer.territories.split(',');
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
    const insurersSQL = `
			SELECT
				${db.quoteName('i.id')},
				${db.quoteName('i.enable_agent_id')},
				GROUP_CONCAT(${db.quoteName('it.territory')}) AS ${db.quoteName('territories')}
			FROM ${db.quoteName('#__insurers', 'i')}
			LEFT JOIN ${db.quoteName('#__insurer_territories', 'it')} ON ${db.quoteName('it.insurer')} = ${db.quoteName('i.id')}
			WHERE ${db.quoteName('i.id')} IN (${req.authentication.insurers.join(',')}) AND ${db.quoteName('i.state')} > 0
			GROUP BY ${db.quoteName('i.id')}
			ORDER BY ${db.quoteName('i.name')} ASC;
		`;

    // Run the query
    const insurers = await db.query(insurersSQL).catch(function(err) {
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Convert the territories list into an array
    insurers.forEach(function(insurer) {
        insurer.territories = insurer.territories.split(',');
        territoryAbbreviations = territoryAbbreviations.concat(insurer.territories);
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
            const maybeInsurer = insurers.filter((ins) => ins.id == insurerID);
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

    // Encrypt the user's information
    const encrypted = {
        "email": email,
        "firstName": firstName,
        "lastName": lastName
    };
    await crypt.batchProcessObject(encrypted, 'encrypt', ['email',
        'firstName',
        'lastName']);

    // Create the agency
    // Log.debug('TO DO: We need a wholesale toggle switch on the screen, but hidden for some Agency Networks');
    const createAgencySQL = `
			INSERT INTO ${db.quoteName('#__agencies')} (
				${db.quoteName('name')},
				${db.quoteName('email')},
				${db.quoteName('agency_network')},
				${db.quoteName('fname')},
				${db.quoteName('lname')},
				${db.quoteName('slug')},
				${db.quoteName('wholesale')}
			) VALUES (
				${db.escape(name)},
				${db.escape(encrypted.email)},
				${db.escape(req.authentication.agencyNetwork)},
				${db.escape(encrypted.firstName)},
				${db.escape(encrypted.lastName)},
				${db.escape(slug)},
				1
			);
		`;

    // Insert the value into the database
    const createAgencyResult = await db.query(createAgencySQL).catch(function(e) {
        log.error(e.message);
        error = serverHelper.internalError('Error querying database. Check logs.');
    });
    if (error) {
        return next(error);
    }

    // Get the ID of the new agency
    const agencyId = createAgencyResult.insertId;

    // Create a default location for this agency
    const createDefaultLocationSQL = `
			INSERT INTO ${db.quoteName('#__agency_locations')} (
				${db.quoteName('agency')},
				${db.quoteName('email')},
				${db.quoteName('fname')},
				${db.quoteName('lname')},
				${db.quoteName('primary')}
			) VALUES (
				${db.escape(agencyId)},
				${db.escape(encrypted.email)},
				${db.escape(encrypted.firstName)},
				${db.escape(encrypted.lastName)},
				1
			);
		`;

    // Insert the value into the database
    const createLocationResult = await db.query(createDefaultLocationSQL).catch(function(e) {
        log.error(e.message);
        error = serverHelper.internalError('Error querying database. Check logs.');
    });
    if (error) {
        return next(error);
    }

    // Get the ID of the new agency
    const locationID = createLocationResult.insertId;

    // Store the territories for this agency
    const territoryValues = [];
    territories.forEach((territoryAbbreviation) => {
        territoryValues.push(`(${db.escape(locationID)}, ${db.escape(territoryAbbreviation)})`);
    });

    // SQL to insert territories
    const associateTerritoriesSQL = `
			INSERT INTO ${db.quoteName('#__agency_location_territories')} (${db.quoteName('agency_location')}, ${db.quoteName('territory')})
			VALUES ${territoryValues.join(',')};
		`;

    // Insert the territories
    await db.query(associateTerritoriesSQL).catch(function(e) {
        log.error(e.message);
        error = serverHelper.internalError('Error querying database. Check logs.');
    });
    if (error) {
        return next(error);
    }

    // Store the insurers for this agency
    const agencyIdValues = [];
    for (const insurerID in agencyIds) {
        if (Object.prototype.hasOwnProperty.call(agencyIds, insurerID)) {
            // eslint-disable-next-line  no-await-in-loop
            const insureragencyId = await crypt.encrypt(agencyIds[insurerID]);
            // check to see if we have agent id if we do then encrypt it else we will just set the value to null
            // eslint-disable-next-line  no-await-in-loop
            const insureragentId = Object.prototype.hasOwnProperty.call(agentIds, insurerID) ? await crypt.encrypt(agentIds[insurerID]) : null;
            agencyIdValues.push(`(${db.escape(locationID)}, ${db.escape(insurerID)}, ${db.escape(insureragencyId)}, ${db.escape(insureragentId)}, 0, 0 ,1)`);
        }
    }
    const associateInsurersSQL = `
			INSERT INTO ${db.quoteName('#__agency_location_insurers')} (
				${db.quoteName('agency_location')},
				${db.quoteName('insurer')},
				${db.quoteName('agency_id')},
				${db.quoteName('agent_id')},
				${db.quoteName('bop')},
				${db.quoteName('gl')},
				${db.quoteName('wc')}
			) VALUES ${agencyIdValues.join(',')};
		`;
    await db.query(associateInsurersSQL).catch(function(e) {
        log.error(e.message);
        return next(serverHelper.internalError('Error querying database. Check logs.'));
    });

    // Create a landing page for this agency
    const landingPageSQL = `
			INSERT INTO  ${db.quoteName('#__agency_landing_pages')} (
				${db.quoteName('agency')},
				${db.quoteName('name')},
				${db.quoteName('slug')},
				${db.quoteName('primary')}
			) VALUES (
				${db.escape(agencyId)},
				${db.escape('Get Quotes')},
				${db.escape('get-quotes')},
				${db.escape(1)}
			);
		`;

    await db.query(landingPageSQL).catch(function(e) {
        log.error(e.message);
        return next(serverHelper.internalError('Error querying database. Check logs.'));
    });

    // Create a user for agency portal access
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
    const agency = new AgencyModel();

    // Load the request data into it
    await agency.load(req.body).catch(function(err) {
        error = err;
    });
    if (error) {
        return next(serverHelper.internalError(error));
    }

    // Save the agency
    await agency.save().catch(function(err) {
        error = err;
    });
    if (error) {
        return next(serverHelper.internalError(error));
    }

    // Send back a success response
    res.send(200, {"logo": agency.logo});
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addDeleteAuth('Delete Agency', `${basePath}/agency`, deleteAgency, 'agencies', 'manage');
    server.addGetAuth('Get Agency', `${basePath}/agency`, getAgency, 'agencies', 'view');
    server.addPostAuth('Post Agency', `${basePath}/agency`, postAgency, 'agencies', 'manage');
    server.addPutAuth('Put Agency', `${basePath}/agency`, updateAgency, 'agencies', 'manage');
};