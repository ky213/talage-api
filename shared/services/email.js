/**
 * Encryption/Decryption helper. Provides an interface for our internal encryption service.
 */

'use strict';

const crypt = require('./crypt.js');
const moment_timezone = require('moment-timezone');
const request = require('request');

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
 * @return {boolean} - True if successful; false otherwise
 */
exports.send = async function(recipients, subject, content, keys = {}, brand = 'talage', agency = 0){
	// If we are in the test environment, don't send and just return true
	if(global.settings.ENV === 'test'){
		return true;
	}

	// Make sure we have recipients
	if(!recipients || !recipients.length){
		log.warn('Email helper: You must supply recipients when using send()');
		return false;
	}

	// Make sure we have a subject
	if(typeof subject !== 'string' || !subject){
		log.warn('Email helper: You must supply a subject when using send()');
		return false;
	}

	// Make sure we have content
	if(typeof content !== 'string' || !content){
		log.warn('Email helper: You must supply content when using send()');
		return false;
	}

	// Make sure the brand is lowercase
	if(brand && typeof brand === 'string'){
		brand = brand.toLowerCase();
	}else{
		log.warn('Email helper: Invalid brand supplied to send(), must be a string');
		return false;
	}

	// If the brand is 'agency' or 'digalent-agency', make sure an agency was supplied
	if((brand === 'agency' || brand === 'digalent-agency') && (typeof agency !== 'number' || !agency)){
		log.warn('Email helper: When using a brand of "agency" or "digalent-agency" an agency must be supplied to send()');
		return false;
	}

	// If there were keys supplied, write the appropriate records to the database
	if(typeof keys === 'object' && Object.keys(keys).length){
		// Get the current time in the Pacific timezone
		const now = moment_timezone.tz('America/Los_Angeles');

		// Begin populating a list of columns to insert into the database
		const columns = {
			'checked_out': '0',
			'message': await crypt.encrypt(content),
			'sent': now.format('YYYY-MM-DD HH:mm:ss'),
			'subject': subject
		};

		// Handle the Application key
		if(Object.prototype.hasOwnProperty.call(keys, 'application') && typeof keys.application === 'number' && keys.application > 0){
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
		if(Object.prototype.hasOwnProperty.call(keys, 'agencyLocation') && typeof keys.agencyLocation === 'number' && keys.agencyLocation > 0){
			// Add the agencyLocation to the columns list
			columns.agency_location = keys.agencyLocation;
		}

		// Store a record of this sent message
		const insertQuery = `INSERT INTO #__messages (${Object.keys(columns).join(',')}) VALUES (${Object.values(columns).map(function(val){
			return db.escape(val);
		}).join(',')})`;
		db.query(insertQuery).catch(function(){
			log.error('Unable to record email message in the database');
		});
	}

	// Begin building out the data that will be sent into the email service
	const requestData = {
		'from': brand,
		'html': content,
		'subject': subject,
		'to': recipients
	};

	// If an agency was supplied, add it to the request
	if(agency){
		requestData.agency = agency;
	}

	// Send the email using the email service
	let error = false;
	await request({
		'json': requestData,
		'method': 'POST',
		'url': `http://localhost:${global.settings.PRIVATE_API_PORT}/v1/email/email`
	}, function(e){
		error = true;
		if(e){
			// do not log emails....
			log.error(`Email helper: Failed to send email.`);
			log.verbose(e);
		}
	});

	if(error){
		return false;
	}
	return true;
};