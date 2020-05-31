/**
 * Sends an email
 */

'use strict';

const Sendgrid = require('@sendgrid/mail');
const crypt = global.requireShared('./services/crypt.js');
const fs = require('fs');
const imgSize = require('./helpers/imgSize.js');
const util = require('util');
const serverHelper = require('../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

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
		log.warn("Email Service PostEmail: " + 'No data was received');
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
		log.warn("Email Service PostEmail: " + message);
		return next(serverHelper.requestError(message));
	}
	const system = req.body.from.toLowerCase();

	// Validate the html parameter
	if(!Object.prototype.hasOwnProperty.call(req.body, 'html') || typeof req.body.html !== 'string'){
		const message = `Invalid 'html' parameter. Must be a string.`;
		log.warn("Email Service PostEmail: " + message);
		return next(serverHelper.requestError(message));
	}

	// If this is an agency, make sure we have an agency ID in the payload
	if(system === 'agency' || system === 'digalent-agency'){
		if(!Object.prototype.hasOwnProperty.call(req.body, 'agency') || !/^\d*$/.test(req.body.agency)){
			const message = `You must specify an agency when sending from '${system}'`;
			log.warn("Email Service PostEmail: " + message);
			return next(serverHelper.requestError(message));
		}

		req.body.agency = parseInt(req.body.agency, 10);

		// Validate the agency
		if(!await validator.agency(req.body.agency)){
			const message = 'The agency specified is not valid';
			log.warn("Email Service PostEmail: " + message);
			return next(serverHelper.requestError(message));
		}
	}

	// Make sure we have a template for this system
	const template = `${__dirname}/helpers/templates/${system}.html`;
	if(!fs.existsSync(template)){
		const message = 'There is no email template setup for the specified system.';
		log.error("Email Service PostEmail: " + message);
		return next(serverHelper.internalError(message));
	}

	// Bring in the Template HTML and perform a couple of replacements
	req.body.html = fs.readFileSync(template, 'utf8').replace('{{subject}}', req.body.subject).replace('{{content}}', req.body.html);

	// If this is an agency, there is some additional replacement that needs to occur
	if(system === 'agency' || system === 'digalent-agency'){
		// Query the database to get some information
		let hadError = false;
		const sql = `SELECT \`name\`, \`logo\`, \`website\` FROM \`#__agencies\` WHERE \`id\` = ${db.escape(req.body.agency)} AND \`state\` = 1 LIMIT 1;`;
		const agency = await db.query(sql).catch(function(error){
			log.verbose("Email Service PostEmail: " + error);
			hadError = true;
		});
		if(hadError){
			const message = 'Unable to retrieve agency information from the database';
			log.error("Email Service PostEmail: " + message);
			return next(serverHelper.internalError(message));
		}

		let logoHTML = `<h1 style="padding: 35px 0;">${agency[0].name}</h1>`;

		// If the user has a logo, use it; otherwise, use a heading
		if(agency[0].logo){

			try{
				const imgInfo = await imgSize(`https://${global.settings.S3_BUCKET}.s3-us-west-1.amazonaws.com/public/agency-logos/${agency[0].logo}`);

				// Determine if image needs to be scaled down
				const maxHeight = 100;
				const maxWidth = 300;
				if(imgInfo.height > maxHeight || imgInfo.width > maxWidth){
					// Scale the image down proportionally
					const ratio = Math.min(maxWidth / imgInfo.width, maxHeight / imgInfo.height);
					imgInfo.height *= ratio;
					imgInfo.width *= ratio;
				}

				logoHTML = `<img alt="${agency[0].name}" src="https://${global.settings.S3_BUCKET}.s3-us-west-1.amazonaws.com/public/agency-logos/${agency[0].logo}" height="${imgInfo.height}" width="${imgInfo.width}">`;
			}catch(e){
				// This sucks, but we will fail back to the default email heading for safety
				log.warn("Email Service PostEmail: " + `Agency ${req.body.agency} logo image not found. Defaulting to text for logo. (${e})`);
			}
		}

		// If the user had a website, we should wrap the logo in a link
		if(agency[0].website){
			// Decrypt the website address
			const website = await crypt.decrypt(agency[0].website);

			// Wrap the logo in a link
			logoHTML = `<a href="${website}" target="_blank">${logoHTML}</a>`;
		}

		// Perform the replacements
		req.body.html = req.body.html.replace('{{logo}}', logoHTML);
	}

	// Replace the from parameter with the address set herein
	req.body.from = systems[system];

	// Log email details
	let to = req.body.to;
	if(typeof to === 'object'){
		to = to.join(',');
	}
	to = to.replace(/^(.)(.*)(.)@(.*)$/, `$1****$3@$4`);

	if(global.settings.ENV === 'development' && global.settings.OVERRIDE_EMAIL && global.settings.OVERRIDE_EMAIL === 'YES'){
		to = global.settings.TEST_EMAIL
		req.body.to = global.settings.TEST_EMAIL
		log.debug('Overriding email: ' + req.body.to)
	}

	log.verbose(util.inspect({
		'from': req.body.from,
		'subject': req.body.subject,
		'system': system,
		'to': to
	}, false, null));

	// Adjust the subject based on the environment
	if(Object.prototype.hasOwnProperty.call(req.body, 'subject') && typeof req.body.subject === 'string'){
		if(global.settings.ENV === 'test'){
			req.body.subject = `[TEST] ${req.body.subject}`;
		}else if(global.settings.ENV === 'development'){
			req.body.subject = `[DEV TEST] ${req.body.subject}`;
		}else if(global.settings.ENV === 'staging'){
			req.body.subject = `[STA TEST] ${req.body.subject}`;
		}else if(global.settings.ENV === 'demo'){
			req.body.subject = `[DEMO TEST] ${req.body.subject}`;
		}
	}
	
	// Set the Sendgrid API key
	Sendgrid.setApiKey(global.settings.SENDGRID_API_KEY);

	// Initialize the email object
	await Sendgrid.send(req.body).then(function(){
		log.info('Email successfully sent');
		res.send(200, {
			'message': 'Email sent',
			'status': 'success'
		});
	}, function(error){
		// Make sure the error returned is an object and has a code
		if(typeof error !== 'object' || !Object.prototype.hasOwnProperty.call(error, 'code')){
			const message = 'An unexpected error was returned from Sendgrid. Check the logs for more information.';
			log.error("Email Service PostEmail: " + message);
			log.verbose(util.inspect(error, false, null));
			res.send(serverHelper.internalError(message));
			return;
		}

		// If this is a 400, something wrong was sent in
		if(error.code === 400){
			// Check that the response object has the properties we are expecting, and if not, exit
			if(!Object.prototype.hasOwnProperty.call(error, 'response') || !Object.prototype.hasOwnProperty.call(error.response, 'body') || !Object.prototype.hasOwnProperty.call(error.response.body, 'errors') || typeof error.response.body.errors !== 'object'){
				const message = 'Sendgrid may have changed the way it returns errors. Check the logs for more information.';
				log.error("Email Service PostEmail: " + message);
				log.verbose(util.inspect(error, false, null));
				res.send(serverHelper.internalError(message));
				return;
			}

			// Parse the error message to return something useful
			const errors = [];
			error.response.body.errors.forEach(function(errorObj){
				errors.push(errorObj.message);
			});

			// Build the message to be sent
			const message = `Sendgrid returned the following errors: ${errors.join(', ')}`;
			log.warn(`Email Failed: ${message}`);
			res.send(serverHelper.requestError(message));
		}else{
			// Some other type of error occurred
			const message = 'An unexpected error was returned from Sendgrid. Check the logs for more information.';
			log.error("Email Service PostEmail: " + message);
			log.verbose(util.inspect(error, false, null));
			res.send(serverHelper.internalError(message));
		}
	});

	return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Post Email', `${basePath}/email`, PostEmail);
	server.addPost('Post Email (depr)', `${basePath}/`, PostEmail);
};