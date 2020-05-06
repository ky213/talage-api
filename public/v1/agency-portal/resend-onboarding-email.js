'use strict';

const util = require('util');
const sendOnboardingEmail = require('./helpers/send-onboarding-email.js');
const serverHelper = require('../../../server.js');
const auth = require('./helpers/auth.js');

/**
 * Resends the onboarding email
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PostResendOnboardingEmail(req, res, next) {
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'agencies', 'view').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Make sure this is an agency network
	if (req.authentication.agencyNetwork === false) {
		log.info('Forbidden: User is not authorized to create agencies');
		return next(serverHelper.ForbiddenError('You are not authorized to create agencies'));
	}

	// Check for data
	if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
		log.warn('No data was received');
		return next(serverHelper.RequestError('No data was received'));
	}

	// Log the entire request
	log.verbose(util.inspect(req.body, false, null));

	// Make sure all information is present
	if (!Object.prototype.hasOwnProperty.call(req.body, 'firstName') || typeof req.body.firstName !== 'string' || !req.body.firstName) {
		log.warn('firstName is required');
		return next(serverHelper.RequestError('You must enter an the First Name of the agent'));
	}
	if (!Object.prototype.hasOwnProperty.call(req.body, 'lastName') || typeof req.body.lastName !== 'string' || !req.body.lastName) {
		log.warn('lastName is required');
		return next(serverHelper.RequestError('You must enter an the Last Name of the agent'));
	}
	if (!Object.prototype.hasOwnProperty.call(req.body, 'agencyName') || typeof req.body.agencyName !== 'string' || !req.body.agencyName) {
		log.warn('agencyName is required');
		return next(serverHelper.RequestError('You must enter an Agency Name'));
	}
	if (!Object.prototype.hasOwnProperty.call(req.body, 'userEmail') || typeof req.body.userEmail !== 'string' || !req.body.userEmail) {
		log.warn('userEmail is required');
		return next(serverHelper.RequestError('You must enter a User Email Address'));
	}
	if (!Object.prototype.hasOwnProperty.call(req.body, 'slug') || typeof req.body.slug !== 'string' || !req.body.slug) {
		log.warn('slug is required');
		return next(serverHelper.RequestError('You must enter a slug'));
	}
	if (!Object.prototype.hasOwnProperty.call(req.body, 'userID') || typeof req.body.userID !== 'number' || !req.body.userID) {
		log.warn('userID is required');
		return next(serverHelper.RequestError('You must enter a UserID'));
	}

	const onboardingEmailResponse = await sendOnboardingEmail(req.authentication.agencyNetwork, req.body.userID, req.body.firstName, req.body.lastName, req.body.agencyName, req.body.slug, req.body.userEmail);

	if (onboardingEmailResponse) {
		return next(serverHelper.InternalError(onboardingEmailResponse));
	}

	// Return the response
	res.send(200, {
		'code': 'Success',
		'message': 'Email sent'
	});
	return next();
}

exports.RegisterEndpoint = (server, basePath) => {
	server.AddPostAuth('Resend Onboarding Email', basePath + '/resend-onboarding-email', PostResendOnboardingEmail);
	server.AddPostAuth('Resend Onboarding Email (depr)', basePath + '/resendOnboardingEmail', PostResendOnboardingEmail);
};