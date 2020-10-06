'use strict';
const auth = require('./helpers/auth.js');
const crypt = require('../../../shared/services/crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');

/**
 * Responds to get requests for the users endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getUsers(req, res, next){
	let error = false;
	const query = {};
	let where = ``;
	let retrievingAgencyUsersForAgencyNetwork = false;

	// Authentication required since endpoint serves users now for network agency for an agency
	// if network agency and wanting agency info confirm the agency is part of the network
	const jwtErrorMessage = await auth.validateJWT(req, req.authentication.agencyNetwork ? 'agencies':'users', 'view');
	if(jwtErrorMessage){
		return next(serverHelper.forbiddenError(jwtErrorMessage));
	}

	if(req.authentication.agencyNetwork && req.query.agency){
		const agencies = await auth.getAgents(req).catch(function(e){error = e;})
		if(error){
			return next(error);
		} 
		if (!await validator.agent(req.query.agency)) {
			log.warn(`Agency validation error: ${__location}`)
			return next(serverHelper.notFoundError('Agency is invalid'));
		}
		if (!agencies.includes(parseInt(req.query.agency, 10))) {
			log.warn(`Agency network tried to modify agency that is not part of its network. ${__location}`);
			return next(serverHelper.notFoundError('Agency is invalid'));
		}
		retrievingAgencyUsersForAgencyNetwork = true;
	}
	else if (req.authentication.agencyNetwork){
		where = `AND \`apu\`.\`agency_network\`= ${parseInt(req.authentication.agencyNetwork, 10)}`;
		query.agencynetworkid = parseInt(req.authentication.agencyNetwork, 10);
	}
	else {
		// Get the agents that we are permitted to view
		const agents = await auth.getAgents(req).catch(function(e){
			error = e;
		});
		if (error){
			return next(error);
		}

		where = `AND \`apu\`.\`agency\` = ${parseInt(agents[0], 10)}`;

		query.agencyid = parseInt(agents[0], 10);
	}

  //  Define a query to get a list of users
    // const usersSQL = `
	// 		SELECT
	// 			\`apu\`.\`id\`,
	// 			\`apu\`.\`email\`,
	// 			\`apg\`.\`id\` AS \`group\`,
	// 			\`apg\`.\`name\` AS \`groupRole\`,
	// 			\`apu\`.\`last_login\` AS \`lastLogin\`,
	// 			\`apu\`.\`can_sign\` AS \`canSign\`
	// 		FROM \`#__agency_portal_users\` AS \`apu\`
	// 		LEFT JOIN \`#__agency_portal_user_groups\` AS \`apg\` ON \`apu\`.\`group\` = \`apg\`.\`id\`
	// 		WHERE \`state\` > 0 ${where}
	// 	`;

    // //Get the users from the database
    // //TODO Fix catch logic
    // const users = await db.query(usersSQL).catch(function(err){
    //     log.error('__agency_portal_users error ' + err + __location);
    //     return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    // });

    // // // Decrypt everything we need
    // await crypt.batchProcessObjectArray(users, 'decrypt', ['email']);

	let users = null;
	if(retrievingAgencyUsersForAgencyNetwork){
		try{
			const agencyPortalUserBO = new AgencyPortalUserBO();
			users = await agencyPortalUserBO.getByAgencyId(parseInt(req.query.agency, 10));
		}
		catch(err){
			log.error('DB query failed while retrieving agency users for agency network: ' + err.message + __location);
			return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
		}
	}else {
		try{
			const agencyPortalUserBO = new AgencyPortalUserBO();
			const addPermissions = true;
			users = await agencyPortalUserBO.getList(query, addPermissions);
		}
		catch(err){
			log.error('DB query failed while trying to retrieve users' + err.message + __location);
			return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
		}
	}





    // Sort the list by email address
    users.sort(function(a, b){
        return a.email > b.email ? 1 : -1;
    });

    
    // const userGroupsSQL = `
	// 		SELECT
	// 			\`id\`,
	// 			\`name\`,
	// 			\`permissions\`
	// 		FROM \`#__agency_portal_user_groups\`
	// 		WHERE \`id\` != 3;
	// 	`;

    // const userGroups = await db.query(userGroupsSQL).catch(function(err){
    //     log.error('__agency_portal_user_group error ' + err + __location);
    //     return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    // });

    let userGroups = null;
    try{
        const agencyPortalUserBO = new AgencyPortalUserBO();
        userGroups = await agencyPortalUserBO.getGroupList();
    }
    catch(err){
        log.error('__agency_portal_user_groups error ' + err + __location);
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    }

    // Return the response
    res.send(200, {
        "userGroups": userGroups,
        "users": users
    });
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get users', `${basePath}/users`, getUsers, 'users', 'view');
};