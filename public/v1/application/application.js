/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const util = require('util');
const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
//Models
const applicationModel = global.requireShared('models/application-model.js');


/**
 * Responds to POST requests and returns policy quotes
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function Add(req, res, next){
	// Check for data
	if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
		log.warn('No data was received' + __location);
		return next(serverHelper.requestError('No data was received'));
	}

	// Make sure basic elements are present
	if(!req.body.business || !Object.prototype.hasOwnProperty.call(req.body, 'id') || !req.body.policies){
		log.warn('Some required data is missing' + __location);
		return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
	}

    //Validation passed, give requst application to model to process and save.
	const applicationRequestJson = req.body;
    applicationModel.newApplication(applicationRequestJson, true).then(function(modelResponse){
        res.send(200, modelResponse);
		return next();
    }).catch(function(err){
        res.send(500, err.message);
		next(serverHelper.requestError('Unable to save. ' + err.message));

    });
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Post Application', `${basePath}/application`, Add);
	server.addPost('Post Application (depr)', `${basePath}/`, Add);
};