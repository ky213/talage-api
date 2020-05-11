'use strict';

const jwt = require('jsonwebtoken');
const request = require('request');

module.exports = async function(agencyNetwork, userID, firstName, lastName, agencyName, slug, userEmail){
	// Get the content of the email
	const emailContentSQL = `
			SELECT
				JSON_EXTRACT(\`custom_emails\`, '$.onboarding') AS emailData
			FROM \`#__agency_networks\`
			WHERE \`id\` IN (${db.escape(agencyNetwork)},1)
			ORDER BY \`id\` DESC
			LIMIT 2;
		`;
	const emailContentResult = await db.query(emailContentSQL).catch(function(e){
		log.error(e.message);
		return 'Error querying database. Check logs.';
	});

	/*
	 * Get the onboaring email message and subject. It checks to see if result 0 has it, and then checks if result 1 has it.
	 * Note: Shouldn't we be guaranteed to have both a message and subject in the first result? Why are multiple results returned?
	 */

	// Ensure we have at least one valid result
	if(!emailContentResult || !emailContentResult[0]){
		log.error('send-onboarding-email.js: Error querying database. Missing first result.');
		return 'Error querying database. Missing first result.';
	}

	// Decode the JSON
	emailContentResult[0].emailData = JSON.parse(emailContentResult[0].emailData);
	if(emailContentResult[1]){
		emailContentResult[1].emailData = JSON.parse(emailContentResult[1].emailData);
	}

	// Populate the email message
	let emailMessage = '';
	if(emailContentResult[0].emailData && emailContentResult[0].emailData.message){
		emailMessage = emailContentResult[0].emailData.message;
	}else if(emailContentResult[1] && emailContentResult[1].emailData && emailContentResult[1].emailData.message){
		emailMessage = emailContentResult[1].emailData.message;
	}else{
		log.error('send-onboarding-email: Could not find email message');
		return 'Could not find email message';
	}

	// Populate the email subject
	const emailSubject = '';
	if(emailContentResult[0].emailData && emailContentResult[0].emailData.subject){
		emailMessage = emailContentResult[0].emailData.subject;
	}else if(emailContentResult[1] && emailContentResult[1].emailData && emailContentResult[1].emailData.subject){
		emailMessage = emailContentResult[1].emailData.subject;
	}else{
		log.error('send-onboarding-email: Could not find email subject');
		return 'Could not find email subject';
	}

	// Create a limited life JWT
	const token = jwt.sign({'userID': userID}, global.settings.AUTH_SECRET_KEY, {'expiresIn': '7d'});


	// Format the brand
	let brandraw = global.settings.BRAND.toLowerCase();
	let portalurl = global.settings.PORTAL_URL;
	let appurl = global.settings.APPLICATION_URL;
	if(agencyNetwork === 2){
		brandraw = 'Digalent';
		if(global.settings.ENV === 'production'){
			portalurl = 'https://agents.digalent.com';
			appurl = 'https://insure.digalent.com';
		}else if(global.settings.ENV === 'staging'){
			portalurl = 'https://agents.sta.digalent.com';
			appurl = 'https://sta.digalent.com';
		}else if(global.settings.ENV === 'demo'){
			portalurl = 'https://demo.agents.digalent.com';
			appurl = 'https://demo.insure.digalent.com';
		}

	}
	let brand = brandraw.toLowerCase();
	brand = `${brand.charAt(0).toUpperCase() + brand.slice(1)}`;

	// Prepare the email to send to the user
	const emailData = {
		'from': brandraw,
		'html': emailMessage.
			replace(/{{Agent First Name}}/g, firstName).
			replace(/{{Agent Last Name}}/g, lastName).
			replace(/{{Agency}}/g, agencyName).
			replace(/{{Application Link}}/g, `${appurl}/${slug}`).
			replace(/{{Brand}}/g, brand).
			replace(/{{Activation Link}}/g, `<a href="${portalurl}/reset-password/${token}" style="background-color:#ED7D31;border-radius:0.25rem;color:#FFF;font-size:1.3rem;padding-bottom:0.75rem;padding-left:1.5rem;padding-top:0.75rem;padding-right:1.5rem;text-decoration:none;text-transform:uppercase;">Activate My Account</a>`),
		'subject': emailSubject.replace('{{Brand}}', brand),
		'to': userEmail
	};


	/*
	 * Format the brand
	 * let brand = global.settings.BRAND.toLowerCase();
	 * brand = `${brand.charAt(0).toUpperCase() + brand.slice(1)}`;
	 */

	// Send an email to the user
	request({
		'json': emailData,
		'method': 'POST',
		'url': `http://localhost:${global.settings.PRIVATE_API_PORT}/v1/email/email`
	}, function(err){
		if(err){
			const errorStr = `Failed to send the onboarding email to ${userEmail} during the creation of the agency ${agencyName}. Please send manually.`;
			log.error(errorStr);
			log.verbose(err);
			return errorStr;
		}
	});

	// If nothing goes wrong
	return false;

};