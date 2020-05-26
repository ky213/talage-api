/**
 * This module handles all tasks related to authenticating with the DocuSign API.
 */

'use strict';

// Require packages
const DocuSign = require('docusign-esign');
const moment = require('moment-timezone');

// Set some default constants
const jwtLife = 24 * 60; // The number of seconds we are requesting the JWT stay valid, 1 hour
const scopes = 'signature'; // The scopes of capabilities we will request from DocuSign
const tokenReplaceMinutes = 5; // The accessToken must have at least this much time left or it will be replaced

// Initialize variables
let accessToken = null;
let tokenExpirationTime = null;

/**
 * Obtains a new accessToken from DocuSign using the JWT flow.
 *
 * @returns {void}
 */
async function getNewToken(config) {
	// Initialize the DocuSign API
	const docusignApiClient = new DocuSign.ApiClient();

	// Determine which is the proper server to use for DocuSign
	docusignApiClient.setOAuthBasePath(config.authBasePath);

	// Request the JWT Token
	await docusignApiClient.requestJWTUserToken(config.integrationKey, config.impersonatedUser, scopes, config.privateKey, jwtLife).then(function (result) {
		// Store the token and expiration time locally for later use
		log.verbose('New token obtained.');
		accessToken = result.body.access_token;
		tokenExpirationTime = moment().add(result.body.expires_in, 's');
	}, function (error) {
		log.error(`Unable to authenicate to DocuSign. (${error.status} ${error.message})`);
		if (error.response.res.text === '{"error":"consent_required"}') {
			log.verbose(`Consent needs to be provided. Try https://${config.authBasePath}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${config.integrationKey}&redirect_uri=https://agents.insurancewheelhouse.com`);
		} else {
			log.verbose(error.response.res.text);
		}
	});
}

/**
 * This method verifies that we have a valid accessToken.
 * It should be called before any API call to DocuSign.
 * It checks that the existing access accessToken can be used.
 * If the existing accessToken is expired or doesn't exist, then
 * a new accessToken will be obtained from DocuSign by using
 * the JWT flow.
 *
 * @returns {void}
 */
module.exports = async function (config) {
	// Check if we have an existing token
	if (!accessToken || !tokenExpirationTime) {
		log.verbose('No DocuSign token exists. Getting a new one.');
		await getNewToken(config);
		return accessToken;
	}

	// Check if we need a new token
	if (tokenExpirationTime.subtract(tokenReplaceMinutes, 'm').isBefore(moment())) {
		log.verbose('Docusign token is expired or close to expiring. Getting a new one');
		await getNewToken(config);
		return accessToken;
	}

	return accessToken;
};