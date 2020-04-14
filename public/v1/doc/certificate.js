/**
 * Checks that the API is running
 */

'use strict';

const atob = require('atob');
const moment = require('moment');
const PdfPrinter = require('pdfmake');
const RestifyError = require('restify-errors');

const crypt = requireShared('./services/crypt.js');
const validator = requireShared('./helpers/validator.js');
const checkboxes = require('./helpers/certificate/checkboxes.js');
const generate = require('./helpers/certificate/generate-page-2-3.js');
const signature = require('./helpers/signature.js');
const positions = require('./helpers/document-style/certificate/positions.js');
const styles = require('./helpers/document-style/certificate/styles.js');

/**
 * Responds to get requests for the certificate endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PostCertificate(req, res, next) {

	/* ---=== Check Request Requirements ===--- */

	// Check for data
	if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
		log.info('Bad Request: No data received');
		res.send(400, {
			'message': 'No data received',
			'status': 'error'
		});
		return next(new RestifyError.BadRequestError('Bad Request: No data received'));
	}

	// Make sure basic elements are present
	if (!req.body.business_id) {
		log.info('Bad Request: Missing Business ID');
		res.send(400, {
			'message': 'Missing Business ID',
			'status': 'error'
		});
		return next(new RestifyError.BadRequestError('Bad Request: You must supply a business ID'));
	}

	// Validate the business ID
	if (!await validator.is_valid_business(req.body.business_id)) {
		log.info('Bad Request: Invalid business id');
		res.send(400, {
			'message': 'Invalid business id',
			'status': 'error'
		});
		return next(new RestifyError.BadRequestError('Invalid business id'));
	}

	// Validate the Certificate Holder
	if (req.body.certificate_holder) {
		if (!req.body.certificate_holder.name) {
			log.info('Bad Request: Certificate holder name missing');
			res.send(400, {
				'message': 'Certificate holder name missing',
				'status': 'error'
			});
			return next(new RestifyError.BadRequestError('Bad Request: Certificate holder name missing'));
		}
		if (!req.body.certificate_holder.address) {
			log.info('Bad Request: Certificate holder address missing');
			res.send(400, {
				'message': 'Certificate holder address missing',
				'status': 'error'
			});
			return next(new RestifyError.BadRequestError('Bad Request: Certificate holder address missing'));
		}
		if (!req.body.certificate_holder.zip) {
			log.info('Bad Request: Certificate holder zip missing');
			res.send(400, {
				'message': 'Certificate holder zip missing',
				'status': 'error'
			});
			return next(new RestifyError.BadRequestError('Bad Request: Certificate holder zip missing'));
		}
		if (!validator.is_valid_zip(req.body.certificate_holder.zip)) {
			log.info('Bad Request: Invalid certificate holder zip');
			res.send(400, {
				'message': 'Invalid certificate holder zip',
				'status': 'error'
			});
			return next(new RestifyError.BadRequestError('Bad Request: Invalid certificate holder zip'));
		}
	}

	log.info('Returning Certificate');

	// Business and Policy information query
	const sql = `SELECT 
			\`b\`.\`name\`,
			\`b\`.\`dba\`,
			IF(\`p\`.\`policy_type\` ='BOP','GL',\`p\`.\`policy_type\`) AS \`policy_type\`,
			\`p\`.\`policy_number\`,
			DATE_FORMAT(\`p\`.\`effective_date\`, "%m/%d/%Y") AS \`effective_date\`,
			DATE_FORMAT(\`p\`.\`expiration_date\`, "%m/%d/%Y") AS \`expiration_date\`,
			\`w\`.\`name\` AS \`writer\`,
			\`w\`.\`naic\`,
			\`l\`.\`limit\` AS \`limit_id\`,
			FORMAT(\`l\`.\`amount\`, 0) AS \`amount\`,
			\`a\`.\`address\`,
			\`a\`.\`address2\`,
			\`a\`.\`zip\`,
			\`a\`.\`unemployment_num\`,
			LOWER(\`insured_zip\`.\`city\`) AS \`city\`,
			\`insured_zip\`.\`territory\`,
			\`app\`.\`owners_covered\`,
			\`app\`.\`has_ein\`,
			IFNULL(\`app\`.\`agency\`, 1) AS \`agent\`,
			\`agency\`.\`name\` AS \`agencyName\`,
			\`al\`.\`address\` AS \`mailing_address\`,
			\`al\`.\`zip\` AS \`mailing_zip\`,
			LOWER(\`agency_zip\`.\`city\`) AS \`agencyCity\`,
			\`agency_zip\`.\`territory\` AS \`agencyTerritory\`,
			\`al\`.\`fname\`,
			\`al\`.\`lname\`,
			\`al\`.\`phone\` AS \`agencyPhone\`,
			\`al\`.\`email\`,
			\`c\`.\`phone\`,
			\`b\`.\`ein\`
			FROM \`#__businesses\` AS \`b\`
			LEFT JOIN \`#__policies\` AS \`p\` ON \`b\`.\`id\` = \`p\`.\`business\`
			LEFT JOIN \`#__insurers\` AS \`i\` ON \`i\`.\`id\` = \`p\`.\`insurer\`
			LEFT JOIN \`#__insurer_writers\` AS \`w\` ON \`p\`.\`writer\` = \`w\`.\`id\`
			LEFT JOIN \`#__policy_limits\` AS \`l\` ON \`l\`.\`policy\` = \`p\`.\`id\`
			LEFT JOIN \`#__addresses\` AS \`a\` ON \`a\`.\`business\` = \`b\`.\`id\` and \`a\`.\`billing\` = 1
			LEFT JOIN \`#__applications\` AS \`app\` ON \`app\`.\`id\` = \`p\`.\`application\`
			LEFT JOIN \`#__agencies\` AS \`agency\` ON \`agency\`.\`id\` = IFNULL(\`app\`.\`agency\`, 1)
			LEFT JOIN \`#__agency_locations\` AS \`al\` ON \`al\`.\`agency\` = \`agency\`.\`id\` AND \`al\`.\`primary\` = 1
			LEFT JOIN \`#__zip_codes\` AS \`agency_zip\` ON \`al\`.\`zip\` = \`agency_zip\`.\`zip\`
			LEFT JOIN \`#__zip_codes\` AS \`insured_zip\` ON \`a\`.\`zip\` = \`insured_zip\`.\`zip\`
			LEFT JOIN \`#__contacts\` AS \`c\` ON \`c\`.\`business\` = \`b\`.\`id\`
			WHERE \`b\`.\`id\` = ${db.escape(req.body.business_id)} and \`p\`.\`state\` = 1 and (\`p\`.\`expiration_date\` >= CURDATE() OR \`p\`.\`effective_date\` > CURDATE());
		`;

	// Run the query
	const certificate_data = await db.query(sql).catch(function (error) {
		log.error(error);
		res.send(400, {
			'message': `Database Error: ${error}`,
			'status': 'error'
		});
		return next(new RestifyError.BadRequestError(`Database Error: ${error}`));
	});

	// Check the number of rows returned
	if (certificate_data.length === 0) {
		log.info('Given business ID has no active policies');
		res.send(400, {
			'message': 'Given business ID has no active policies',
			'status': 'error'
		});
		return next(new RestifyError.BadRequestError('Bad Request: Given business ID has no active policies'));
	}

	// Define font files
	const fonts = {
		'Courier': {
			'bold': 'Courier-Bold',
			'bolditalics': 'Courier-BoldOblique',
			'italics': 'Courier-Oblique',
			'normal': 'Courier'
		},
		'Helvetica': {
			'bold': 'Helvetica-Bold',
			'bolditalics': 'Helvetica-BoldOblique',
			'italics': 'Helvetica-Oblique',
			'normal': 'Helvetica'
		},
		'Times': {
			'bold': 'Times-Bold',
			'bolditalics': 'Times-BoldItalic',
			'italics': 'Times-Italic',
			'normal': 'Times-Roman'
		}
	};

	const printer = new PdfPrinter(fonts);

	// Define array to hold any missing data
	const missing_data = [];

	// Start building insured string
	let insured = '';

	// If the name is there, decrypt and add it
	if (certificate_data[0].name.byteLength) {
		const name = await crypt.decrypt(certificate_data[0].name);
		insured += `${name}\n`;
	} else {
		missing_data.push('Insured name');
	}
	// If there is a dba, decrypt and add it
	if (certificate_data[0].dba.byteLength) {
		const dba = await crypt.decrypt(certificate_data[0].dba);
		insured += `dba ${dba}\n`;
	}
	// If the first address line is there, decrypt and add it
	if (certificate_data[0].address) {
		const address = await crypt.decrypt(certificate_data[0].address);
		insured += `${address}\n`;
	} else {
		missing_data.push('Insured address');
	}
	// If there is a second address line, decrypt and add it
	if (certificate_data[0].address2 && certificate_data[0].address2.byteLength) {
		const address2 = await crypt.decrypt(certificate_data[0].address2);
		insured += `${address2}\n`;
	}
	if (certificate_data[0].zip) {
		insured += `${certificate_data[0].city.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}, ${certificate_data[0].territory} ${certificate_data[0].zip}`;
	} else {
		missing_data.push('Insured zip code');
	}

	// Build phone number string
	let phone = '';
	if (certificate_data[0].agencyPhone.byteLength) {
		phone = await crypt.decrypt(certificate_data[0].agencyPhone);
		phone = `(${phone.substr(0, 3)}) ${phone.substr(3, 3)} - ${phone.substr(6, 4)}`;
	} else {
		missing_data.push('Producer phone number');
	}

	// Build producer name and address
	let producer = certificate_data[0].agencyName;
	if (certificate_data[0].mailing_address.byteLength) {
		const mailingAddress = await crypt.decrypt(certificate_data[0].mailing_address);
		producer += `\n${mailingAddress}`;
	} else {
		missing_data.push('Producer address');
	}
	producer += `\n${certificate_data[0].agencyCity.toLowerCase().split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}, ${certificate_data[0].agencyTerritory} ${certificate_data[0].mailing_zip}`;

	// Contact Name
	let contact_name = '';
	if (certificate_data[0].fname && certificate_data[0].lname) {
		const fName = await crypt.decrypt(certificate_data[0].fname);
		const lName = await crypt.decrypt(certificate_data[0].lname);
		contact_name = `${fName} ${lName}`;
	} else {
		missing_data.push('Producer contact name');
	}
	// Contact email
	let contact_email = '';
	if (certificate_data[0].email.byteLength) {
		contact_email = await crypt.decrypt(certificate_data[0].email);
	} else {
		missing_data.push('Producer contact email');
	}
	const img = [{
		'height': 792,
		'image': '/home/node/img/certificate.jpg',
		'width': 612
	},
	{
		'height': 792,
		'image': '/home/node/img/NY_Form_page1.jpg',
		'width': 612
	},
	{
		'height': 792,
		'image': '/home/node/img/NY_Form_page2.jpg',
		'width': 612
	}];

	// Define base document
	const docDefinition = {
		'background'(currentPage) {
			return img[currentPage - 1];
		},
		'content': [
			// Date
			{
				'absolutePosition': positions.date,
				'style': styles.date,
				'text': moment().format('L')
			},
			// Producer
			{
				'absolutePosition': positions.producer,
				'style': styles.address,
				'text': producer
			},
			// Insured
			{
				'absolutePosition': positions.insured,
				'style': styles.address,
				'text': insured
			},
			// Contact Name
			{
				'absolutePosition': positions.contact_name,
				'text': contact_name
			},
			// Phone
			{
				'absolutePosition': positions.contact_phone,
				'text': phone
			},
			// E-mail Address
			{
				'absolutePosition': positions.contact_email,
				'text': contact_email
			},
			// Authorized Representative Signature
			{
				'absolutePosition': positions.signature,
				'height': 25,
				'image': signature.talage_signature,
				'width': 85
			}
		],
		'defaultStyle': {
			'font': 'Helvetica',
			'fontSize': 8
		},
		'pageSize': 'LETTER'
	};

	// Define valid policy types
	const valid_policy_types = ['GL',
		'WC',
		'UMB',
		'AL'];
	// Create writers object
	const all_writers = {};

	const page_2_data = [];

	certificate_data.forEach(function (data) {
		// If we haven't seen writer add them and the policy they wrote
		if (!Object.prototype.hasOwnProperty.call(all_writers, data.writer)) {
			// If the writer is null add it to the missing data message
			if (data.writer === null) {
				missing_data.push(`${data.policy_type} policy writer`);
			}
			// If the NAIC is null add it to the missing data message
			if (data.naic === null) {
				missing_data.push(`${data.policy_type} policy writer NAIC`);
			}
			all_writers[data.writer] = {
				'naic': data.naic,
				'policies': [data.policy_type]
			};
			// If we've seen the writer and the policy isn't listed under that writer add it
		} else if (!all_writers[data.writer].policies.includes(data.policy_type)) {
			if (data.writer === null) {
				missing_data.push(`${data.policy_type} policy writer`);
			}
			// If the NAIC is null add it to the missing data message
			if (data.naic === null) {
				missing_data.push(`${data.policy_type} policy writer NAIC`);
			}
			all_writers[data.writer].policies.push(data.policy_type);
		}
		// If we haven't seen this policy write the policy information
		if (valid_policy_types.includes(data.policy_type)) {
			// If WC, save off the row for NY Certificate
			if (!page_2_data.length && data.policy_type === 'WC' && data.territory === 'NY') {
				page_2_data.push(data);
			}
			//  Policy Num, Effective Date, Expiration Date
			if (data.policy_number === '') {
				missing_data.push(`${data.policy_type} policy number`);
			}
			docDefinition.content.push({
				'absolutePosition': positions[`${data.policy_type}_policy_number`],
				'style': styles.policy,
				'text': data.policy_number
			},
				{
					'absolutePosition': positions[`${data.policy_type}_effective_date`],
					'style': styles.policy_date,
					'text': data.effective_date
				},
				{
					'absolutePosition': positions[`${data.policy_type}_expiration_date`],
					'style': styles.policy_date,
					'text': data.expiration_date
				});
			// Check Boxes
			docDefinition.content = docDefinition.content.concat(checkboxes.checkPolicyBoxes(data.policy_type, data.owners_covered));

			// Policy information has been added, remove policy_type from list of valid policies
			valid_policy_types.splice(valid_policy_types.indexOf(data.policy_type), 1);
		}
		// Limit_id 10 does not get written on the certificate
		if (data.limit_id !== 10) {
			// Write the limit
			docDefinition.content.push({
				'absolutePosition': positions[`${data.policy_type}_limit_${data.limit_id}`],
				'style': styles.limit,
				'text': data.amount
			});
		}
	});

	// If there is missing data return message containing what is missing
	if (missing_data.length) {
		log.info(`Data was missing for business ${req.body.business_id}`);
		res.send(400, {
			'message': `Data was missing for business ${req.body.business_id}`,
			'missing': missing_data,
			'status': 'error'
		});
		return next(new RestifyError.BadRequestError(`Bad Request: Data was missing for business ${req.body.business_id}`));
	}

	// Create list of policies on certificate in order of appearance
	let used_policies = ['GL',
		'AL',
		'UMB',
		'WC'];
	used_policies = used_policies.filter(function (policy) {
		return valid_policy_types.indexOf(policy) === -1;
	});

	// Define letters for insurers
	const letters = ['A',
		'B',
		'C',
		'D',
		'E'];

	// Add writers and letters to document
	for (let i = 0; i < used_policies.length; ++i) {
		Object.entries(all_writers).forEach(function (writer) {
			if (writer[1].policies.includes(used_policies[i])) {
				docDefinition.content.push({
					'absolutePosition': positions[`insurer_${letters[0]}`],
					'text': `${writer[0]}`
				},
					{
						'absolutePosition': positions[`naic_${letters[0]}`],
						'style': styles.naic,
						'text': `${writer[1].naic}`
					});
				writer[1].policies.forEach(function (policy) {
					docDefinition.content.push({
						'absolutePosition': positions[`${policy}_insr_ltr`],
						'style': styles.letter,
						'text': letters[0]
					});
					used_policies.splice(used_policies.indexOf(policy), 1);
				});
				letters.shift();
			}

		});
	}

	let certificate_holder_info = '';
	const certificate_holder_save_data = {};
	// If there is a certificate holder add them
	if (req.body.certificate_holder) {
		// Run SQL to retrieve city and state
		const sql_address = `SELECT \`city\`,
										\`territory\`
										FROM \`#__zip_codes\` AS \`z\`
										WHERE ${req.body.certificate_holder.zip} = \`z\`.\`zip\``;
		const certificate_holder_location = await db.query(sql_address).catch(function (error) {
			log.error(error);
			res.send(400, {
				'message': `Database Error: ${error}`,
				'status': 'error'
			});
			return next(new RestifyError.BadRequestError(`Database Error: ${error}`));
		});

		if (certificate_holder_location.length === 0) {
			log.error('No data returned with given certificate holder zip');
			res.send(400, {
				'message': 'No data returned with given certificate holder zip',
				'status': 'error'
			});
			return next(new RestifyError.BadRequestError('Bad Request: No data returned with given certificate holder zip'));
		}

		certificate_holder_info = `${req.body.certificate_holder.name}\n${req.body.certificate_holder.address}\n${certificate_holder_location[0].city.toLowerCase().
			split(' ').
			map((word) => word.charAt(0).toUpperCase() + word.slice(1)).
			join(' ')}, ${certificate_holder_location[0].territory} ${req.body.certificate_holder.zip}`;

		// Save off data to be written to certificate history
		certificate_holder_save_data.city = certificate_holder_location[0].city;
		certificate_holder_save_data.territory = certificate_holder_location[0].territory;

		// Add the certificate holder information
		docDefinition.content.push({
			'absolutePosition': positions.certificate_holder,
			'style': styles.address,
			'text': certificate_holder_info
		});
		// There is no certificate holder
	} else {
		docDefinition.content.push({
			'absolutePosition': positions.certificate_holder,
			'style': styles.info,
			'text': 'EVIDENCE OF INSURANCE'
		});
	}

	// If NY WC applies, build the json with page 2 data and generate page 2 and 3
	if (page_2_data.length) {

		let business_phone = '';
		if (page_2_data[0].phone && page_2_data[0].phone.byteLength) {
			business_phone = await crypt.decrypt(page_2_data[0].phone);
			business_phone = `(${business_phone.substr(0, 3)}) ${business_phone.substr(3, 3)} - ${business_phone.substr(6, 4)}`;
		} else {
			missing_data.push('Business phone number');
			log.info(`Data was missing for business ${req.body.business_id}`);
			res.send(400, {
				'message': `Data was missing for business ${req.body.business_id}`,
				'missing': missing_data,
				'status': 'error'
			});
			return next(new RestifyError.BadRequestError(`Bad Request: Data was missing for business ${req.body.business_id}`));
		}

		const formatted_data = {
			'agent_name': contact_name,
			'agent_phone': phone,
			'certificate_holder': certificate_holder_info,
			insured,
			'phone': business_phone
		};

		page_2_data.push(formatted_data);
		// Data[0] contains raw data from sql query, data[1] contains data that has already been formatted above
		docDefinition.content = docDefinition.content.concat(generate.page_2_3(page_2_data));
	}


	// Create PDF
	const doc = printer.createPdfKitDocument(docDefinition);

	// Get the Joomla ID
	const payload = JSON.parse(atob(req.headers.authorization.split('.')[1].replace('-', '+').replace('_', '/')));

	// Base information for certificate history
	const certificate_history = {
		'business_id': req.body.business_id,
		'generated_by': Object.prototype.hasOwnProperty.call(payload, 'joomla_user') ? payload.joomla_user : 0,
		'generated_on': moment().format('YYYY-MM-DD HH:mm:ss')
	};

	// Encrypt certificate holder data to be written to database if it exists
	if (req.body.certificate_holder) {
		certificate_history.certificate_holder_name = await crypt.encrypt(req.body.certificate_holder.name);
		certificate_history.certificate_holder_address = await crypt.encrypt(req.body.certificate_holder.address);
		certificate_history.certificate_holder_city = await crypt.encrypt(certificate_holder_save_data.city);
		certificate_history.certificate_holder_state = await crypt.encrypt(certificate_holder_save_data.territory);
		certificate_history.certificate_holder_zip = await crypt.encrypt(req.body.certificate_holder.zip);
	}

	// Create fields string
	const fields = Object.keys(certificate_history).join(', ');

	// Escape each value, then create values string
	const values = Object.values(certificate_history);
	values.forEach(function (value, index) {
		values[index] = db.escape(value);
	});
	const escaped_values = values.join(', ');

	// Create the sql query to write certificate history
	const certificate_history_sql = `INSERT INTO #__certificate_history(${fields}) VALUES (${escaped_values})`;

	// Write record
	await db.query(certificate_history_sql).catch(function (error) {
		log.error(error);
		res.send(400, {
			'message': `Database Error: ${error}`,
			'status': 'error'
		});
		return next(new RestifyError.BadRequestError(`Database Error: ${error}`));
	});

	const chunks = [];
	let result = '';

	doc.on('data', function (chunk) {
		chunks.push(chunk);
	});
	doc.on('end', function () {
		result = Buffer.concat(chunks);

		res.writeHead(200, {
			'Content-Disposition': 'attachment; filename=accord-certificate.pdf',
			'Content-Length': result.length,
			'Content-Type': 'application/pdf'
		});
		res.end(result);
		log.info('Certificate Sent in Response');
	});

	doc.end();
	log.info('Certificate Generated!');

	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath, server) => {
	log.info(`    Registering ${basePath}/certificate (POST)`);
	server.post({
		'name': 'Get Certificate',
		'path': basePath + '/certificate'
	}, PostCertificate);
};