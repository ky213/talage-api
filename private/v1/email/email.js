/**
 * Sends an email
 */

'use strict';

const Sendgrid = require('@sendgrid/mail');
const crypt = requireShared('./services/crypt.js');
const fs = require('fs');
const imgSize = require('./helpers/imgSize.js');
const util = require('util');

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
async function PostEmail(req, res, next) {

	// Check for data
	if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
		log.warn('No data was received');
		return next(ServerRequestError('No data was received'));
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
	if (!Object.prototype.hasOwnProperty.call(req.body, 'from') || typeof req.body.from !== 'string' || !Object.keys(systems).includes(req.body.from.toLowerCase())) {
		const message = `Invalid 'from' parameter. Must be one of: ${Object.keys(systems).join(', ')}`;
		log.warn(message);
		return next(ServerRequestError(message));
	}
	const system = req.body.from.toLowerCase();

	// Validate the html parameter
	if (!Object.prototype.hasOwnProperty.call(req.body, 'html') || typeof req.body.html !== 'string') {
		const message = `Invalid 'html' parameter. Must be a string.`;
		log.warn(message);
		return next(ServerRequestError(message));
	}

	// If this is an agency, make sure we have an agency ID in the payload
	if (system === 'agency' || system === 'digalent-agency') {
		if (!Object.prototype.hasOwnProperty.call(req.body, 'agency') || !/^\d*$/.test(req.body.agency)) {
			const message = `You must specify an agency when sending from '${system}'`;
			log.warn(message);
			return next(ServerRequestError(message));
		}

		req.body.agency = parseInt(req.body.agency, 10);

		// Validate the agency
		if (!await validator.agency(req.body.agency)) {
			const message = 'The agency specified is not valid';
			log.warn(message);
			return next(ServerRequestError(message));
		}
	}

	// Make sure we have a template for this system
	const template = `/home/node/app/templates/${system}.html`;
	if (!fs.existsSync(template)) {
		const message = 'There is no email template setup for the specified system.';
		log.error(message);
		return next(ServerInternalError(message));
	}

	// Bring in the Template HTML and perform a couple of replacements
	req.body.html = fs.readFileSync(template, 'utf8').replace('{{subject}}', req.body.subject).replace('{{content}}', req.body.html);

	// If this is an agency, there is some additional replacement that needs to occur
	if (system === 'agency' || system === 'digalent-agency') {
		// Query the database to get some information
		let hadError = false;
		const sql = `SELECT \`name\`, \`logo\`, \`website\` FROM \`#__agencies\` WHERE \`id\` = ${db.escape(req.body.agency)} AND \`state\` = 1 LIMIT 1;`;
		const agency = await db.query(sql).catch(function (error) {
			log.verbose(error);
			hadError = true;
		});
		if (hadError) {
			const message = 'Unable to retrieve agency information from the database';
			log.error(message);
			return next(ServerInternalError(message));
		}

		let logoHTML = `<h1 style="padding: 35px 0;">${agency[0].name}</h1>`;

		// If the user has a logo, use it; otherwise, use a heading
		if (agency[0].logo) {

			try {
				const imgInfo = await imgSize(`https://${settings.S3_BUCKET}.s3-us-west-1.amazonaws.com/public/agency-logos/${agency[0].logo}`);

				// Determine if image needs to be scaled down
				const maxHeight = 100;
				const maxWidth = 300;
				if (imgInfo.height > maxHeight || imgInfo.width > maxWidth) {
					// Scale the image down proportionally
					const ratio = Math.min(maxWidth / imgInfo.width, maxHeight / imgInfo.height);
					imgInfo.height *= ratio;
					imgInfo.width *= ratio;
				}

				logoHTML = `<img alt="${agency[0].name}" src="https://${settings.S3_BUCKET}.s3-us-west-1.amazonaws.com/public/agency-logos/${agency[0].logo}" height="${imgInfo.height}" width="${imgInfo.width}">`;
			} catch (e) {
				// This sucks, but we will fail back to the default email heading for safety
				log.warn(`Agency ${req.body.agency} logo image not found. Defaulting to text for logo. (${e})`);
			}
		}

		// If the user had a website, we should wrap the logo in a link
		if (agency[0].website) {
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
	if (typeof to === 'object') {
		to = to.join(',');
	}
	to = to.replace(/^(.)(.*)(.)@(.*)$/, `$1****$3@$4`);
	log.verbose(util.inspect({
		'from': req.body.from,
		'subject': req.body.subject,
		system,
		to
	}, false, null));

	// Adjust the subject based on the environment
	if (Object.prototype.hasOwnProperty.call(req.body, 'subject') && typeof req.body.subject === 'string') {
		if (settings.ENV === 'test') {
			req.body.subject = `[TEST] ${req.body.subject}`;
		} else if (settings.ENV === 'development') {
			req.body.subject = `[DEV TEST] ${req.body.subject}`;
		} else if (settings.ENV === 'staging') {
			req.body.subject = `[STA TEST] ${req.body.subject}`;
		}
	}

	// Set the Sendgrid API key
	Sendgrid.setApiKey(settings.SENDGRID_API_KEY);

	// Initialize the email object
	await Sendgrid.send(req.body).then(function () {
		log.info('Email successfully sent');
		res.send(200, {
			'message': 'Email sent',
			'status': 'success'
		});
	}, function (error) {
		// Make sure the error returned is an object and has a code
		if (typeof error !== 'object' || !Object.prototype.hasOwnProperty.call(error, 'code')) {
			const message = 'An unexpected error was returned from Sendgrid. Check the logs for more information.';
			log.error(message);
			log.verbose(util.inspect(error, false, null));
			res.send(ServerInternalError(message));
			return;
		}

		// If this is a 400, something wrong was sent in
		if (error.code === 400) {
			// Check that the response object has the properties we are expecting, and if not, exit
			if (!Object.prototype.hasOwnProperty.call(error, 'response') || !Object.prototype.hasOwnProperty.call(error.response, 'body') || !Object.prototype.hasOwnProperty.call(error.response.body, 'errors') || typeof error.response.body.errors !== 'object') {
				const message = 'Sendgrid may have changed the way it returns errors. Check the logs for more information.';
				log.error(message);
				log.verbose(util.inspect(error, false, null));
				res.send(ServerInternalError(message));
				return;
			}

			// Parse the error message to return something useful
			const errors = [];
			error.response.body.errors.forEach(function (errorObj) {
				errors.push(errorObj.message);
			});

			// Build the message to be sent
			const message = `Sendgrid returned the following errors: ${errors.join(', ')}`;
			log.warn(`Email Failed: ${message}`);
			res.send(ServerRequestError(message));
		} else {
			// Some other type of error occurred
			const message = 'An unexpected error was returned from Sendgrid. Check the logs for more information.';
			log.error(message);
			log.verbose(util.inspect(error, false, null));
			res.send(ServerInternalError(message));
		}
	});

	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath) => {
	ServerAddPost('Post Email', basePath + '/email', PostEmail);
	ServerAddPost('Post Email (depr)', basePath + '/', PostEmail);
};