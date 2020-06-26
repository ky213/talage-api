'use strict';

const auth = require('./helpers/auth.js');
const crypt = global.requireShared('./services/crypt.js');
const csvStringify = require('csv-stringify');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const serverHelper = require('../../../server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

/**
 * Retrieves available banners
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getExport(req, res, next) {
	let error = false;

	// Get the agents that we are permitted to view
	const agents = await auth.getAgents(req).catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Define the columns that need to be decrypted
	const needDecrypting = [
		'address',
		'address2',
		'dba',
		'ein',
		'fname',
		'lname',
		'name',
		'email',
		'phone',
		'primaryAddress',
		'primaryAddress2',
		'website'
	];

	// Prepare to get all application data
	const sql = `
		SELECT
			\`a\`.\`id\`,
			\`ad\`.\`address\`,
			\`ad\`.\`address2\`,
			\`ad\`.\`zip\`,
			\`b\`.\`dba\`,
			\`b\`.\`ein\`,
			\`b\`.\`entity_type\`,
			\`b\`.\`name\`,
			\`b\`.\`website\`,
			\`c\`.\`email\`,
			\`c\`.\`fname\`,
			\`c\`.\`lname\`,
			\`c\`.\`phone\`,
			\`pa\`.\`address\` AS \`primaryAddress\`,
			\`pa\`.\`address2\` AS \`primaryAddress2\`,
			\`pa\`.\`zip\` AS \`primaryZip\`,
			\`z\`.\`city\`,
			\`z\`.\`territory\`,
			\`z2\`.\`city\` AS \`primaryCity\`,
			\`z2\`.\`territory\` AS \`primaryTerritory\`
		FROM \`#__applications\` AS \`a\`
		LEFT JOIN \`#__addresses\` AS \`ad\` ON \`a\`.\`business\` = \`ad\`.\`business\` AND \`ad\`.\`billing\` = 1
		LEFT JOIN (SELECT * FROM \`#__addresses\` AS \`ad2\` GROUP BY \`ad2\`.\`business\`) AS \`pa\` ON \`a\`.\`business\` = \`pa\`.\`business\`
		LEFT JOIN \`#__businesses\` AS \`b\` ON \`a\`.\`business\` = \`b\`.\`id\`
		LEFT JOIN \`#__contacts\` AS \`c\` ON \`a\`.\`business\` = \`c\`.\`business\` AND \`c\`.\`primary\` = 1
		LEFT JOIN \`#__zip_codes\` AS \`z\` ON \`ad\`.\`zip\` = \`z\`.\`zip\`
		LEFT JOIN \`#__zip_codes\` AS \`z2\` ON \`pa\`.\`zip\` = \`z2\`.\`zip\`
		WHERE
			\`a\`.\`agency\` IN (${agents.join()})
			AND \`a\`.\`state\` > 0;
	`;

	// Run the query
	const data = await db.query(sql).catch(function(err){
		log.error(err.message);
		error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
	});
	if(error){
		return next(error);
	}

	// If no data was returned, stop and alert the user
	if(data.length === 0){
		log.info('There are no applications to export');
		return next(serverHelper.requestError('There are no applications to export. Please try again when there are some applications in your account.'));
	}

	// Process the returned data
	for(const record of data){
		for(const property in record){
			if(Object.prototype.hasOwnProperty.call(record, property)){
				// Decrypt if needed
				if(needDecrypting.includes(property)){
					record[property] = await crypt.decrypt(record[property]);
				}
			}
		}

		// Clean the name and DBA (grave marks in the name cause the CSV not to render)
		record.dba = record.dba ? record.dba.replace(/’/g, '\'') : null;
		record.name = record.name.replace(/’/g, '\'');

		// Combine the contact name for this record
		record.contactName = `${record.fname} ${record.lname}`;

		// Format the City
		if(record.city){
			record.city = stringFunctions.ucwords(record.city.toLowerCase());
		}
		if(record.primaryCity){
			record.primaryCity = stringFunctions.ucwords(record.primaryCity.toLowerCase());
		}

		// Format the phone number
		record.phone = formatPhone(record.phone);

		// Combine the two address lines (if there is an address and an address line 2)
		if(record.address && record.address2){
			record.address += `, ${record.address2}`;
		}
		if(record.primaryAddress && record.primaryAddress2){
			record.primaryAddress += `, ${record.primaryAddress2}`;
		}
	}

	// Define the columns (and column order) in the CSV file and their user friendly titles
	const columns = {
		'name': 'Business Name',
		'dba': 'DBA',
		'address': 'Mailing Address',
		'city': 'Mailing City',
		'territory': 'Mailing State',
		'zip': 'Mailing Zip Code',
		'primaryAddress': 'Physical Address',
		'primaryCity': 'Physical City',
		'primaryTerritory': 'Physical State',
		'primaryZip': 'Physical Zip Code',
		'contactName': 'Contact Name',
		'email': 'Contact Email',
		'phone': 'Contact Phone',
		'entity_type': 'Entity Type',
		'ein': 'EIN',
		'website': 'Website',
		'id': 'ID'
	};

	// Establish the headers for the CSV file
	const options = {
		'columns': columns,
		'header': true
	};

	// Generate the CSV data
	csvStringify(data, options, function(err, output){
		// Check if an error was encountered while creating the CSV data
		if(err){
			log.error(`Application Export to CSV error: ${err} ${__location}`);
			error = serverHelper.internalError('Unable to generate CSV file');
			return;
		}

		// Set the headers so the browser knows we are sending a CSV file
		res.writeHead(200, {
			'Content-Disposition': 'attachment; filename=applications.csv',
			'Content-Length': output.length,
			'Content-Type': 'text-csv'
		});

		// Send the CSV data
		res.end(output);
	});
	if(error){
		return next(error);
	}
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get Export', `${basePath}/export-applications`, getExport, 'applications', 'view');
};