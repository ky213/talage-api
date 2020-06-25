/**
 * Encryption/Decryption helper. Provides an interface for our internal encryption service.
 */

'use strict';
const Sendgrid = require('@sendgrid/mail');
//const util = require('util');
const imageSize = require('image-size');
const url = require('url');
const https = require('https');
const crypt = require('./crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const fs = require('fs');
//const imgSize = require('./emailhelpers/imgSize.js');
const moment_timezone = require('moment-timezone');
//const request = require('request');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

/**
 * Sends an email to the address specified through our email service and saves the message data in the database
 *
 * @param {mixed} recipients - The recipient email addresses, accepts a single address as a string, a list of
 * 								addresses as a comma separated string, or an array of addresses
 * @param {string} subject - The subject of the email
 * @param {string} content - The HTML content of the email
 * @param {object} keys - (optional) An object of property names and values to tie this email to, an be an application id, agencyLocation, or both (preferred)
 * @param {string} brand - (optional) The name of the brand to use for this email (Default is talage)
 * @param {int} agency - (optional) The ID of the agency whose branding will appear on the email (brand must be agency or digalent-agency)
  @param {int} attachments - (optional) Array of JSON for attachments
 * @return {boolean} - True if successful; false otherwise
 */

exports.send = async function(recipients, subject, content, keys = {}, brand = 'talage', agency = 0, attachments){
	// If we are in the test environment, don't send and just return true
	if (global.settings.ENV === 'test'){
		return true;
	}
	var emailJSON = {};
	// Define systems with their sending email address
	const systems = {
		'agency': 'no-reply@insurancewheelhouse.com',
		'digalent': 'no-reply@digalent.com',
		'digalent-agency': 'no-reply@digalent.com',
		'talage': 'info@talageins.com',
		'wheelhouse': 'info@insurancewheelhouse.com'
	};

	// Make sure we have recipients
	if (!recipients || !recipients.length){
		log.warn('Email Service Send: You must supply recipients when using send()' + __location);
		return false;
	}

	// Make sure we have a subject
	if (typeof subject !== 'string' || !subject){
		log.warn('Email Service Send: You must supply a subject when using send()' + __location);
		return false;
	}

	// Make sure we have content
	if (typeof content !== 'string' || !content){
		log.warn('Email Service Send: You must supply content when using send()' + __location);
		return false;
	}

	// Make sure the brand is lowercase
	if (brand && typeof brand === 'string'){
		brand = brand.toLowerCase();
		if (!systems[brand]){
			log.error('Email Service Send: Invalid brand supplied to send(), must be a valid system. ' + __location);
			return false;
		}
	}
	else {
		log.error('Email Service Send: Invalid brand supplied to send(), must be a string' + __location);
		return false;
	}

	// If this is an agency, make sure we have an agency ID in the payload
	if (brand === 'agency' || brand === 'digalent-agency'){
		if (!agency || !/^\d*$/.test(agency)){
			const message = `You must specify an agency when sending from '${brand}'`;
			log.error("Email Service send: " + message + __location);
			return false;
		}

		emailJSON.agency = parseInt(agency, 10);

		// Validate the agency
		if (!await validator.agency(emailJSON.agency)){
			const message = 'The agency specified is not valid';
			log.warn("Email Service send: " + message + __location);
			return false;
		}
	}

	// If the brand is 'agency' or 'digalent-agency', make sure an agency was supplied
	if ((brand === 'agency' || brand === 'digalent-agency') && (typeof agency !== 'number' || !agency)){
		log.warn('Email Service Send: When using a brand of "agency" or "digalent-agency" an agency must be supplied to send()');
		return false;
	}

	// ******* Begin building out the data that will be sent into the email service ****************************************
	emailJSON.from = systems[brand];
	emailJSON.subject = subject;

	// ******  Template processing ************/
	// Make sure we have a template for this system
	const template = `${__dirname}/emailhelpers/templates/${brand}.html`;
	if (!fs.existsSync(template)){
		const message = 'There is no email template setup for the specified system.';
		log.error("Email Service send: " + message + __location);
		return false;
	}

	// Bring in the Template HTML and perform a couple of replacements
	emailJSON.html = fs.readFileSync(template, 'utf8').replace('{{subject}}', emailJSON.subject).replace('{{content}}', content);

	// If this is an agency, there is some additional replacement that needs to occur
	if (brand === 'agency' || brand === 'digalent-agency'){

		// default logoHTMl empty string
		let logoHTML = "";
		logoHTML = await getAgencyLogoHtml(emailJSON.agency).catch(function(err){
			log.error("Email Svc getAgencyLogoHtml error: " + err + __location);
		});
		emailJSON.html = emailJSON.html.replace('{{logo}}', logoHTML);
	}

	//Setup storing sent email.
	// Get the current time in the Pacific timezone
	const now = moment_timezone.tz('America/Los_Angeles');
	// Begin populating a list of columns to insert into the database
	const columns = {
		'checked_out': '0',
		'message': await crypt.encrypt(content),
		'sent': now.format('YYYY-MM-DD HH:mm:ss'),
		'subject': emailJSON.subject
	};


	// If there were keys supplied, write the appropriate records to the database
	if (keys && typeof keys === 'object' && Object.keys(keys).length){
		// Handle the Application key
		if (Object.prototype.hasOwnProperty.call(keys, 'application') && typeof keys.application === 'number' && keys.application > 0){
			// Add the application to the columns list
			columns.application = keys.application;

			// Since we know the application, we can determine the business, and we want both
			const businessQuery = `SELECT business FROM #__applications WHERE id = ${db.escape(columns.application)} LIMIT 1;`;
			const result = await db.query(businessQuery).catch(function(){
				log.error(`Email helper send() unable to get business ID from database for application ${columns.application}`);
			});
			columns.business = result[0].business;
		}

		// Handle the agencyLocation key
		if (Object.prototype.hasOwnProperty.call(keys, 'agencyLocation') && typeof keys.agencyLocation === 'number' && keys.agencyLocation > 0){
			// Add the agencyLocation to the columns list
			columns.agency_location = keys.agencyLocation;
		}
	}

	// Adjust the subject based on the environment
	if (emailJSON && emailJSON.subject && typeof emailJSON.subject === 'string' && global.settings.ENV !== 'production'){
		if (global.settings.ENV === 'test'){
			emailJSON.subject = `[TEST] ${emailJSON.subject}`;
		}
		else if (global.settings.ENV === 'development' || global.settings.ENV === 'awsdev'){
			emailJSON.subject = `[DEV TEST] ${emailJSON.subject}`;
		}
		else if (global.settings.ENV === 'staging'){
			emailJSON.subject = `[STA TEST] ${emailJSON.subject}`;
		}
		else if (global.settings.ENV === 'demo'){
			emailJSON.subject = `[DEMO TEST] ${emailJSON.subject}`;
		}
		else {
			//unknown or new env setting
			log.error("email unknown ENV setting " + global.settings.ENV);
			emailJSON.subject = `[DEV TEST] ${emailJSON.subject}`;

		}
	}
	emailJSON.to = recipients;

	// DO NOT send non talageins.com email in development (local) or awsdev
	// Scheduled tasks and db restores may lead to applications or agencies with "real" emails
	// in dev databases.
	if (global.settings.ENV === 'development' || global.settings.ENV === 'awsdev'){
		// Hard override
		if (global.settings.OVERRIDE_EMAIL && global.settings.OVERRIDE_EMAIL === 'YES' && global.settings.TEST_EMAIL){
			emailJSON.to = global.settings.TEST_EMAIL
			log.debug('Overriding email: ' + emailJSON.to)
		}
		else if (recipients.endsWith('@talageins.com') === false || recipients.includes(',')){
			// Soft override
			// eslint-disable-next-line keyword-spacing
			if (global.settings.TEST_EMAIL){
				emailJSON.to = global.settings.TEST_EMAIL
			}
			else {
				const overrideEmail = 'brian@talageins.com'
				emailJSON.to = overrideEmail;
			}
		}
	}

	if (attachments){
		emailJSON.attachments = attachments;
	}

	// Store mail before sending to SendGrid
	// Store a record of this sent message
	await saveEmailToDb(columns, emailJSON.to).catch(function(err){
		log.error("saveEmailToDb error: " + err + __location);
	});

	const sendGridResp = await sendUsingSendGrid(emailJSON).catch(function(err){
		log.error("SendUsingSendGrid error: " + err + __location);
	});

	return sendGridResp;

};

var saveEmailToDb = async function(columns, recipients){
	const insertQuery = `INSERT INTO clw_talage_messages (${Object.keys(columns).join(',')}) VALUES (${Object.values(columns).map(function(val){
		return db.escape(val);
	}).join(',')})`;
	let messagesId = null;
	await db.query(insertQuery).then(function(results){
		messagesId = results.insertId;
	}).catch(function(err){
		log.error('Unable to record email message in the database' + err + " sql: " + insertQuery + __location);
		throw err;
	});
	if (messagesId){
        if (global.settings.ENV === 'development' || global.settings.ENV === 'awsdev'){
            log.debug('recipients:' + recipients + __location)
        }
		//write to message_recipents table  clw_talage_message_recipients
		const recipientsList = recipients.split(',');
		let error = null;
		for (let i = 0; i < recipientsList.length; i++){
			const encryptRecipent = await crypt.encrypt(recipientsList[i]);
			const hashRecipent = await crypt.hash(recipientsList[i]);
			const insertQuery2 = `Insert INTO clw_talage_message_recipients (message,recipient,email_hash ) VALUES (${messagesId}, '${encryptRecipent}', '${hashRecipent}' )`
			// eslint-disable-next-line no-loop-func
			await db.query(insertQuery2).catch(function(errDb){
				log.error('Unable to record email messager ecipient in the database' + errDb + " sql: " + insertQuery2 + __location);
				error = errDb;
			});
		}
		if (error){
			throw error;
		}
	}
	return true;
}

var sendUsingSendGrid = async function(emailJSON){

	// Set the Sendgrid API key
	Sendgrid.setApiKey(global.settings.SENDGRID_API_KEY);

	// Initialize the email object
	await Sendgrid.send(emailJSON).then(function(){
		log.info('Email successfully sent.' + __location);
		return true;
	}).catch(function(error){

		// Make sure the error returned is an object and has a code
		if (typeof error !== 'object' || !Object.prototype.hasOwnProperty.call(error, 'code')){
			//const message = 'An unexpected error was returned from Sendgrid. Check the logs for more information. ' ;
			log.error("Email Service PostEmail: " + error);
			//log.verbose(util.inspect(error, false, null));
			return false;
		}

		// If this is a 400, something wrong was sent in
		if (error.code === 400){
			// Check that the response object has the properties we are expecting, and if not, exit
			if (!Object.prototype.hasOwnProperty.call(error, 'response') || !Object.prototype.hasOwnProperty.call(error.response, 'body') || !Object.prototype.hasOwnProperty.call(error.response.body, 'errors') || typeof error.response.body.errors !== 'object'){
				const message = 'Sendgrid may have changed the way it returns errors. Check the logs for more information. ';
				log.error("Email Service PostEmail: " + message + JSON.stringify(error) + __location);
				//log.verbose(util.inspect(error, false, null) + __location);
				return false;
			}

			// Parse the error message to return something useful
			const errors = [];
			error.response.body.errors.forEach(function(errorObj){
				errors.push(errorObj.message + __location);
			});

			// Build the message to be sent
			const message = `Sendgrid returned the following errors: ${errors.join(', ')}`;
			log.warn(`Email Failed: ${message}` + __location);
			return false;
		}
		else {
			// Some other type of error occurred
			const message = 'An unexpected error was returned from Sendgrid. Check the logs for more information. ';
			log.error("Email Service PostEmail: " + message + JSON.stringify(error) + __location);
			return false;
		}
	});
	return true;
}


/**
 * Determines the size of an image based on its URL
 *
 * @param {string} address - The publicly accessible web address of the image
 * @returns {Promise.<object, Error>} - A promise that returns the result of the request as an object with height, width, and type parameters, width and then height if resolved, or an Error if rejected
 */
var imgSize = function(address){
	// Send the request to the encryption service
	return new Promise(function(resolve, reject){
		try {
			// Parse out some of the information about this URL
			const options = url.parse(address);

			// Download the image
			// TO DO rewrite to us file svc. images are in S3.
			https.get(options, function(response){
				const chunks = [];

				if (response.statusCode !== 200){
					log.info(`Image not found (code: ${response.statusCode})`);
					reject(new Error(`Image not found`));
					return;
				}

				response.on('data', function(chunk){
					chunks.push(chunk);
				}).on('end', function(){
					// Return the result
					resolve(imageSize(Buffer.concat(chunks)));
				});
			});
		}
		catch (e){
			reject(new Error(`Unable to determine image size (${address})`));
		}
	});
};

var getAgencyLogoHtml = async function(agencyId){

	// Query the database to get some information
	//let hadError = false;
	const sql = `SELECT \`name\`, \`logo\`, \`website\` FROM \`#__agencies\` WHERE \`id\` = ${db.escape(agencyId)} AND \`state\` = 1 LIMIT 1;`;
	const agencyDB = await db.query(sql).catch(function(error){
		log.verbose("Email Service getAgencyLogoHtml: " + error + __location);
		throw error;
	});

	let logoHTML = `<h1 style="padding: 35px 0;">${agencyDB[0].name}</h1>`;

	// If the user has a logo, use it; otherwise, use a heading
	if (agencyDB[0].logo){

		try {
			const imgInfo = await imgSize(`https://${global.settings.S3_BUCKET}.s3-us-west-1.amazonaws.com/public/agency-logos/${agencyDB[0].logo}`);

			// Determine if image needs to be scaled down
			const maxHeight = 100;
			const maxWidth = 300;
			if (imgInfo.height > maxHeight || imgInfo.width > maxWidth){
				// Scale the image down proportionally
				const ratio = Math.min(maxWidth / imgInfo.width, maxHeight / imgInfo.height);
				imgInfo.height *= ratio;
				imgInfo.width *= ratio;
			}

			logoHTML = `<img alt="${agencyDB[0].name}" src="https://${global.settings.S3_BUCKET}.s3-us-west-1.amazonaws.com/public/agency-logos/${agencyDB[0].logo}" height="${imgInfo.height}" width="${imgInfo.width}">`;
		}
		catch (e){
			// we will fail back to the default email heading for safety
			log.error(`Email Service PostEmail: Agency ${agencyId} logo image not found. Defaulting to text for logo. (${e})` + __location);
			throw e;
		}
	}

	// If the user had a website, we should wrap the logo in a link
	if (agencyDB[0].website){
		// Decrypt the website address
		const website = await crypt.decrypt(agencyDB[0].website);

		// Wrap the logo in a link
		logoHTML = `<a href="${website}" target="_blank">${logoHTML}</a>`;
	}

	return logoHTML;


}