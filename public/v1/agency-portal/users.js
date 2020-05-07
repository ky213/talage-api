'use strict';
const auth = require('./helpers/auth.js');
const crypt = require('../../../shared/services/crypt.js')
const serverHelper = require('../../../server.js');

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

		// Make sure the authentication payload has everything we are expecting
		await auth.validateJWT(req, 'users', 'view').catch(function(e){
			error = e;
		});
		if(error){
			return next(error);
		}

		let where = ``;
		if(req.authentication.agencyNetwork){
			where = `AND \`apu\`.\`agency_network\`= ${parseInt(req.authentication.agencyNetwork, 10)}`;
		}else{
			// Get the agents that we are permitted to view
			const agents = await auth.getAgents(req).catch(function(e){
				error = e;
			});
			if(error){
				return next(error);
			}

			where = `AND \`apu\`.\`agency\` = ${parseInt(agents[0], 10)}`;
		}

		// Define a query to get a list of users
		const usersSQL = `
			SELECT
				\`apu\`.\`id\`,
				\`apu\`.\`email\`,
				\`apg\`.\`id\` AS \`group\`,
				\`apg\`.\`name\` AS \`groupRole\`,
				\`apu\`.\`last_login\` AS \`lastLogin\`,
				\`apu\`.\`can_sign\` AS \`canSign\`
			FROM \`#__agency_portal_users\` AS \`apu\`
			LEFT JOIN \`#__agency_portal_user_groups\` AS \`apg\` ON \`apu\`.\`group\` = \`apg\`.\`id\`
			WHERE \`state\` > 0 ${where}
		`;

		// Get the users from the database
		const users = await db.query(usersSQL).catch(function(){
			return next(serverHelper.InternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
		});

		// Decrypt everything we need
		await crypt.batchProcessObjectArray(users, 'decrypt', [
			'email'
		]);

		// Sort the list by email address
		users.sort(function(a, b){
			return a.email > b.email ? 1 : -1;
		});

		// Excluding 'Administrator' for now as this permission is currently unused. It will be added soon.
		const userGroupsSQL = `
			SELECT
				\`id\`,
				\`name\`,
				\`permissions\`
			FROM \`#__agency_portal_user_groups\`
			WHERE \`id\` != 3;
		`;

		const userGroups = await db.query(userGroupsSQL).catch(function(){
			return next(serverHelper.InternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
		});

		// Return the response
		res.send(200, {
			'userGroups': userGroups,
			'users': users
		});
		return next();
	}

	




exports.RegisterEndpoint = (server, basePath) => {
	server.AddGetAuth('Get users', basePath + '/users', getUsers);
};