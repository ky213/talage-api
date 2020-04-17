'use strict';

const jwt = require('jsonwebtoken');
const request = require('request');

module.exports = async function (agencyNetwork, userID, firstName, lastName, agencyName, slug, userEmail) {
	// Get the content of the email
	const emailContentSQL = `
			SELECT
				JSON_EXTRACT(\`custom_emails\`, '$.onboarding') AS emailData
			FROM \`#__agency_networks\`
			WHERE \`id\` IN (${db.escape(agencyNetwork)},1)
			ORDER BY \`id\` DESC
			LIMIT 2;
		`;
	const emailContentResult = await db.query(emailContentSQL).catch(function (e) {
		log.error(e.message);
		return 'Error querying database. Check logs.';
		// Return next(ServerInternalError());
	});

	// Decode the JSON
	emailContentResult[0].emailData = JSON.parse(emailContentResult[0].emailData);
	emailContentResult[1].emailData = JSON.parse(emailContentResult[1].emailData);

	// Use the email subject and text of this agency network, and if it is missing, use Wheelhouse's
	const emailMessage = emailContentResult[0].emailData && emailContentResult[0].emailData.message ? emailContentResult[0].emailData.message : emailContentResult[1].emailData.message;
	const emailSubject = emailContentResult[0].emailData && emailContentResult[0].emailData.subject ? emailContentResult[0].emailData.subject : emailContentResult[1].emailData.subject;

	// Create a limited life JWT
	const token = jwt.sign({ 'userID': userID }, settings.AUTH_SECRET_KEY, { 'expiresIn': '7d' });

	// Format the brand
	let brand = settings.BRAND.toLowerCase();
	brand = `${brand.charAt(0).toUpperCase() + brand.slice(1)}`;

	// Prepare the email to send to the user
	const emailData = {
		'from': settings.BRAND,
		'html': emailMessage.
			replace('{{Agent First Name}}', firstName).
			replace('{{Agent Last Name}}', lastName).
			replace('{{Agency}}', agencyName).
			replace('{{Application Link}}', `${settings.SITE_URL}/${slug}`).
			replace('{{Brand}}', brand).
			replace('{{Activation Link}}', `<a href="${settings.PORTAL_URL}/reset-password/${token}" style="background-color:#ED7D31;border-radius:0.25rem;color:#FFF;font-size:1.3rem;padding-bottom:0.75rem;padding-left:1.5rem;padding-top:0.75rem;padding-right:1.5rem;text-decoration:none;text-transform:uppercase;">Activate My Account</a>`),
		'subject': emailSubject.replace('{{Brand}}', brand),
		'to': userEmail
	};

	// Send an email to the user
	request({
		'json': emailData,
		'method': 'POST',
		'url': `http://localhost:${settings.PRIVATE_API_PORT}/v1/email/email`
	}, function (err) {
		if (err) {
			const errorStr = `Failed to send the onboarding email to ${userEmail} during the creation of the agency ${agencyName}. Please send manually.`;
			log.error(errorStr);
			log.verbose(err);
			return errorStr;
		}
	});

	// If nothing goes wrong
	return false;

};