/**
 * Sends an email
 */

'use strict';

const status = global.requireShared('./helpers/status.js');

/**
 * Updates an application status
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function updateApplicationStatus(req, res, next) {
	// Update the application status
	status.updateApplicationStatus(req.params.id);

	// Return success
	res.send(200);
	return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPut('Update an application status', `${basePath}/:id/status`, updateApplicationStatus);
};