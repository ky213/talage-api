/**
 * Sends an email
 */

'use strict';
const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const emailSvc = global.requireShared('./services/emailsvc.js');

/* -----==== Version 1 Functions ====-----*/

/**
 * Responds to POST requests to send an email
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PostEmail(req, res, next){

	// Check for data
	if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
		log.warn('Email Service PostEmail: No data was received' + __location);
		return next(serverHelper.requestError('No data was received'));
	}

	// Define systems with their sending email address
	const systems = {
		'agency': 'no-reply@insurancewheelhouse.com',
		'digalent': 'no-reply@digalent.com',
		'digalent-agency': 'no-reply@digalent.com',
		'talage': 'info@talageins.com',
		'wheelhouse': 'info@insurancewheelhouse.com'
	};

	// Validate the from parameter
	if(!Object.prototype.hasOwnProperty.call(req.body, 'from') || typeof req.body.from !== 'string' || !Object.keys(systems).includes(req.body.from.toLowerCase())){
		const message = `Invalid 'from' parameter. Must be one of: ${Object.keys(systems).join(', ')}`;
		log.warn("Email Service PostEmail: " + message + __location);
		return next(serverHelper.requestError(message));
	}
	const system = req.body.from.toLowerCase();

	// Validate the html parameter
	if(!Object.prototype.hasOwnProperty.call(req.body, 'html') || typeof req.body.html !== 'string'){
		const message = `Invalid 'html' parameter. Must be a string.`;
		log.warn("Email Service PostEmail: " + message + __location);
		return next(serverHelper.requestError(message));
	}

	// If this is an agency, make sure we have an agency ID in the payload
	if(system === 'agency' || system === 'digalent-agency'){
		if(!Object.prototype.hasOwnProperty.call(req.body, 'agency') || !/^\d*$/.test(req.body.agency)){
			const message = `You must specify an agency when sending from '${system}'`;
			log.warn("Email Service PostEmail: " + message + __location);
			return next(serverHelper.requestError(message));
		}

		req.body.agency = parseInt(req.body.agency, 10);

		// Validate the agency
		if(!await validator.agency(req.body.agency)){
			const message = 'The agency specified is not valid';
			log.warn("Email Service PostEmail: " + message + __location);
			return next(serverHelper.requestError(message));
		}
	}

	if(!Object.prototype.hasOwnProperty.call(req.body, 'to') || typeof req.body.to !== 'string'){
		const message = `Invalid 'to' parameter. `;
		log.warn("Email Service PostEmail: " + message + __location);
		return next(serverHelper.requestError(message));
	}

	if(!Object.prototype.hasOwnProperty.call(req.body, 'subject') || typeof req.body.subject !== 'string'){
		const message = `Invalid 'subject' parameter. `;
		log.warn("Email Service PostEmail: " + message + __location);
		return next(serverHelper.requestError(message));
	}


	//call email service
	const respSendEmail = await emailSvc.send(req.body.to, req.body.subject, req.body.html, req.body.keys, req.body.from, req.body.agency, req.body.attachments).catch(function(err){
		log.error("Send email error: " + err + __location);
		return res.send(serverHelper.internalError("SendEmail Error"));
	});
	if(respSendEmail === false){
		log.error("Send email error response was false: " + __location);
		return res.send(serverHelper.internalError("SendEmail Error"));
	}
	res.send(200, {
		'message': 'Email sent',
		'status': 'success'
	});
	return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Post Email', `${basePath}/email`, PostEmail);
	server.addPost('Post Email (depr)', `${basePath}/`, PostEmail);
};