/**
 * This module configures the DocuSign API for use
 */

'use strict';

// Require packages
const DocuSign = require('docusign-esign');

/**
 * This method configures the DocuSign API, ensuring it has a token and the correct paths
 *
 * @returns {object} - A reference to the DocuSign API class
 */
module.exports = async function(){

	// Initialize the API
	const docusignApiClient = new DocuSign.ApiClient();

	// Determine which is the proper server to use for DocuSign
	docusignApiClient.setOAuthBasePath(config.authBasePath);

	// Get the token
	const token = await require('./getToken.js')();

	// Set the token to be sent with each API request
	docusignApiClient.addDefaultHeader('Authorization', `Bearer ${token}`);
	let accountId = null;
	// Get our user info
	await docusignApiClient.getUserInfo(token).
		then(function(userInfo){
		// Grab the account ID and store it globally
			accountId = userInfo.accounts[0].accountId;

			// Set the path used for API requests
			docusignApiClient.setBasePath(`${userInfo.accounts[0].baseUri}/restapi`);
		}).catch(function(error){
			log.error('Unable to get User Info from DocuSign.');
			log.verbose(error);

		});

	// Return a reference to the DocuSign API that can be used for further API calls
	return {
		'accountId': accountId,
		'docusignApiClient': docusignApiClient
	};
};