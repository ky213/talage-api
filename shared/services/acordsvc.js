'use strict';

const PdfPrinter = require('pdfmake');
const crypt = global.requireShared('./services/crypt.js');
const wc = require('./acordhelpers/wc.js');

const validator = global.requireShared('./helpers/validator.js');
const { createLogger } = require('restify/lib/bunyan_helper');

/**
 * @typedef generatedAcord
 * @type {Object}
 * @property {Object} doc - Object containing the acord form data
 * @property {Array} missing_data - Array containing strings describing any and all data missing from the application (primarily for business team use)
 * @property {String} error - Message describing any error encountered by the service to be passed to the front end
 */

/**
 * Responds to get requests for the certificate endpoint
 *
 * @param {number} application_id - id of the application for ACORD form generation
 * @param {number} insurer_id - id of the insurer for ACORD form generation
 * @param {string} policy_type - policy type of the requested form
 *
 * @returns {generatedAcord} Generated ACORD form for selected application, insurer, and policy type
 */
exports.create = async function(application_id, insurer_id, policy_type){

	let message = '';
	// Validate the application ID
	if(!application_id || !await validator.is_valid_application(application_id)){
		message = 'ACORD form generation failed. Bad Request: Invalid application id';
		log.info(message + __location);
		return {'error': message};
	}

	if(!insurer_id || !await validator.isValidInsurer(insurer_id)){
		message = 'ACORD form generation failed. Bad Request: Invalid insurer id';
		log.info(message + __location);
		return {'error': message};
	}

	if(policy_type.toLowerCase() === 'wc'){
		return await wc.createWC(application_id, insurer_id);
	}
	else if(policy_type.toLowerCase() === 'gl'){
		return await createGL(application_id, insurer_id);
	}

	return doc
}

async function createGL(application_id, insurer_id){

	const application_sql = `SELECT
					ag.name AS agency,
					ic.naics AS naic_code,
					a.gl_effective_date AS effective_date,
					a.limits,
					b.name
				FROM clw_talage_applications AS a
				INNER JOIN clw_talage_agencies AS ag ON a.agency = ag.id
				INNER JOIN clw_talage_businesses AS b ON a.business = b.id
				INNER JOIN clw_talage_industry_codes AS ic ON ic.id = b.industry_code
				WHERE a.id = ${application_id}`;

	// Run the query
	const application_data = await db.query(sql).catch(function(error){
		message = 'ACORD form generation failed due to database error.';
		log.error(message + error + __location);
		return {'error': message};
	});

	// Check the number of rows returned
	if(application_data.length === 0){
		message = 'ACORD form generation failed. Invalid Application ID '
		log.error(message + __location);
		return {'error': message};
	}

	// Replace any null values with an empty string
	application_data.forEach(row => Object.values(row).map(element => element === null ? '' : element))

	// Check that the applicant applied for WC
	const gl_check = application_data.find(entry => entry.policy_type === 'GL');

	if(!gl_check){
		message = 'The requested application is not for General Liability';
		log.error(message + __location);
		return {'error': message};
	}

	// Check for a business name
	let applicant_name = '';
	if(application_data[0].name && application_data[0].name.byteLength){
		const name = await crypt.decrypt(application_data[0].name);
		applicant_name += `${name}`;
	}
	else{
		message = 'ACORD form generation failed. Business name missing for application.';
		log.error(message + __location);
		return {'error': message};
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

	const img = [{
		'height': 792,
		'image': `${__dirname}/acordhelpers/img/acord_form_gl_page1.jpeg`,
		'width': 612
	},
		{
			'height': 792,
			'image': `${__dirname}/acordhelpers/img/acord_form_gl_page2.jpeg`,
			'width': 612
		},
		{
			'height': 792,
			'image': `${__dirname}/acordhelpers/img/acord_form_gl_page3.jpeg`,
			'width': 612
		},
		{
			'height': 792,
			'image': `${__dirname}/acordhelpers/img/acord_form_gl_page4.jpeg`,
			'width': 612
		}];

		const docDefinition = {
			'background': function(currentPage){
				// 1:1 background function for pages
				return img[currentPage-1];
		
			},
			'content': [],
			'defaultStyle': {
				'font': 'Helvetica',
				'fontSize': 8
			},
			'pageSize': 'LETTER'
		}

	docDefinition.content.push({
		'pageBreak': 'before',
		'text': ''
	});
	docDefinition.content.push({
		'pageBreak': 'before',
		'text': ''
	});
	docDefinition.content.push({
		'pageBreak': 'before',
		'text': ''
	});

	const doc = printer.createPdfKitDocument(docDefinition);

	return {
		'doc': doc
	};
	
}

