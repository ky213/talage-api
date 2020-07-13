'use strict';

const PdfPrinter = require('pdfmake');
const crypt = global.requireShared('./services/crypt.js');
const moment = require('moment');

const validator = global.requireShared('./helpers/validator.js');
const signature = require('./acordhelpers/signature.js');
const generate = require('./acordhelpers/state-rating-sheets.js');
const styles = require('./acordhelpers/document-style/acord-form-wc/styles.js');
const positions = require('./acordhelpers/document-style/acord-form-wc/positions.js');

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
 *
 * @returns {generatedAcord} Generated ACORD form for selected application and insurer
 */
exports.create = async function(application_id, insurer_id){

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

	// Application and business information query
	const sql = `SELECT
					a_qt.policy_type,
					b.name,
					b.dba,
					IF(b.founded = '0000-00-00', -1, YEAR(CURDATE()) - YEAR(b.founded) - (DATE_FORMAT(CURDATE(), '%m%d') < DATE_FORMAT(b.founded, '%m%d'))) AS yrs_in_bus,
					b.website,
					b.entity_type,
					b.ncci_number,
					b.owners,
					b.num_owners,
					i_code.sic,
					i_code.naics,
					i_code.description AS industry_description,
					DATE_FORMAT(app.wc_effective_date, "%m/%d/%Y") AS effective_date,
					DATE_FORMAT(app.wc_expiration_date, "%m/%d/%Y") AS expiration_date,
					a.id AS address_id,
					a.address,
					a.address2,
					a.zip,
					a.billing,
					LOWER(insured_zip.city) AS city,
					insured_zip.county,
					insured_zip.territory,
					app.owners_covered,
					app.has_ein,
					app.waiver_subrogation,
					app.additional_insured,
					IFNULL(app.agency, 1) AS agent,
					app.wc_limits AS limits,
					agency.name AS agencyName,
					al.address AS mailing_address,
					al.zip AS mailing_zip,
					LOWER(agent_zip.city) AS agencyCity,
					agent_zip.territory AS agencyTerritory,
					al.fname AS producerFName,
					al.lname AS producerLName,
					al.phone AS agencyPhone,
					al.email AS agencyEmail,
					c.fname AS contactFName,
					c.lname AS contactLName,
					c.phone AS contactPhone,
					c.email AS contactEmail,
					b.ein,
					a_c.ncci_code AS activity_code,
					a_c.payroll,
					a.full_time_employees,
					a.part_time_employees,
					payment.name AS payment,
					${insurer_id ? `insurers.name AS insurer,` : ''}
					claims.id
					FROM clw_talage_applications AS app
					LEFT JOIN clw_talage_application_policy_types AS a_qt ON a_qt.application = app.id
					LEFT JOIN clw_talage_businesses AS b ON app.business = b.id
					LEFT JOIN clw_talage_addresses AS a ON a.business = b.id
					LEFT JOIN clw_talage_agencies AS agency ON agency.id = IFNULL(app.agency, 1)
					LEFT JOIN clw_talage_agency_locations AS al ON al.agency = agency.id AND al.primary = 1
					LEFT JOIN clw_talage_zip_codes AS agent_zip ON al.zip = agent_zip.zip
					LEFT JOIN clw_talage_zip_codes AS insured_zip ON a.zip = insured_zip.zip
					LEFT JOIN clw_talage_contacts AS c ON c.business = b.id
					LEFT JOIN clw_talage_industry_codes AS i_code ON b.industry_code = i_code.id
					LEFT JOIN clw_talage_claims AS claims ON claims.application = app.id
					LEFT JOIN clw_talage_address_activity_codes AS a_c ON a.id = a_c.address
					LEFT JOIN clw_talage_policies AS policies ON policies.application =  app.id
					LEFT JOIN clw_talage_payment_plans AS payment ON policies.payment_plan =  payment.id
					${insurer_id ? `LEFT JOIN clw_talage_insurers AS insurers ON  insurers.id = ${insurer_id}` : ''}
					WHERE  app.id = ${application_id}`;

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
	const wc_check = application_data.find(entry => entry.policy_type === 'WC');

	if(!wc_check){
		message = 'The requested application is not for Workers\' Compensation';
		log.error(message + __location);
		return {'error': message};
	}

	// Check for a business name
	let applicant_name = '';
	if(application_data[0].name && application_data[0].name.byteLength){
		const name = await crypt.decrypt(application_data[0].name);
		applicant_name += `${name}\n`;
	}
	else{
		message = 'ACORD form generation failed. Business name missing for application.';
		log.error(message + __location);
		return {'error': message};
	}

	// Missing data array
	const missing_data = [];

	// Build producer name and address
	let agency = application_data[0].agencyName;
	if(application_data[0].mailing_address && application_data[0].mailing_address.byteLength){
		const mailingAddress = await crypt.decrypt(application_data[0].mailing_address);
		agency += `\n${mailingAddress}`;
	}
	else{
		missing_data.push('Agency address');
	}
	agency += `\n${application_data[0].agencyCity.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}, ${application_data[0].agencyTerritory} ${application_data[0].mailing_zip}`;


	// Producer Name
	let producer_name = '';
	if(application_data[0].producerFName && application_data[0].producerLName){
		const fName = await crypt.decrypt(application_data[0].producerFName);
		const lName = await crypt.decrypt(application_data[0].producerLName);
		producer_name = `${fName} ${lName}`;
	}
	else{
		missing_data.push('Producer contact name');
	}

	// Producer office phone
	let producer_phone = '';
	if(application_data[0].agencyPhone && application_data[0].agencyPhone.byteLength){
		producer_phone = await crypt.decrypt(application_data[0].agencyPhone);
		producer_phone = `(${producer_phone.substr(0, 3)}) ${producer_phone.substr(3, 3)} - ${producer_phone.substr(6, 4)}`;
	}
	else{
		missing_data.push('Producer phone number');
	}

	// Producer email
	let producer_email = '';
	if(application_data[0].agencyEmail && application_data[0].agencyEmail.byteLength){
		producer_email = await crypt.decrypt(application_data[0].agencyEmail);
	}
	else{
		missing_data.push('Producer contact email');
	}

	// Contact Name
	let contactName = '';
	if(application_data[0].contactFName && application_data[0].contactLName){
		const fName = await crypt.decrypt(application_data[0].contactFName);
		const lName = await crypt.decrypt(application_data[0].contactLName);
		contactName = `${fName} ${lName}`;
	}
	else{
		missing_data.push('Contact name');
	}

	// Contact Phone
	let contactPhone = '';
	if(application_data[0].contactPhone && application_data[0].contactPhone.byteLength){
		contactPhone = await crypt.decrypt(application_data[0].contactPhone);
		contactPhone = `(${contactPhone.substr(0, 3)}) ${contactPhone.substr(3, 3)} - ${contactPhone.substr(6, 4)}`;
	}
	else{
		missing_data.push('Contact phone number');
	}

	// Contact Email
	let contactEmail = '';
	if(application_data[0].contactEmail && application_data[0].contactEmail.byteLength){
		contactEmail = await crypt.decrypt(application_data[0].contactEmail);
	}
	else{
		missing_data.push('Contact email');
	}

	// Applicant website
	let applicant_website = '';
	if(application_data[0].website && application_data[0].website.byteLength){
		applicant_website = await crypt.decrypt(application_data[0].website);

		// Strip off http:// and https://
		applicant_website = applicant_website.replace('http://', '');
		applicant_website = applicant_website.replace('https://', '');
	}

	// Applicant ein
	let ein = '';
	if(application_data[0].ein && application_data[0].ein.byteLength){
		ein = await crypt.decrypt(application_data[0].ein);
	}
	if(application_data[0].has_ein){
		ein = `${ein.substr(0, 2)} - ${ein.substr(2, 7)}`;
	}
	else{
		ein = `${ein.substr(0, 3)} - ${ein.substr(3, 2)} - ${ein.substr(5, 4)}`;
	}

	//Determine the payment plan (if it exists) so the correct check box can be marked
	let other_payment_plan = true;
	if(application_data[0].payment){
		if(application_data[0].payment === 'Semi-Annual' || application_data[0].payment === 'Annual' || application_data[0].payment === 'Quarterly'){
			other_payment_plan = false;
		}
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
		'image': `${__dirname}/acordhelpers/img/acord_form_wc_page1.jpg`,
		'width': 612
	},
		{
			'height': 792,
			'image': `${__dirname}/acordhelpers/img/acord_form_wc_page2.jpg`,
			'width': 612
		},
		{
			'height': 792,
			'image': `${__dirname}/acordhelpers/img/acord_form_wc_page3.jpg`,
			'width': 612
		},
		{
			'height': 792,
			'image': `${__dirname}/acordhelpers/img/acord_form_wc_page4.jpg`,
			'width': 612
		}];

	// Define base document
	const docDefinition = {
		'background': function(currentPage){
			// If we're on the first page return the background for the first page
			if(currentPage === 1){
				return img[0];
			}
			// If we're on a page 2 state rating sheet
			if(currentPage >= 2 && currentPage <= territories.length + 1){
				return img[1];
			}
			// The current page is after the state rating sheets
			return img[currentPage - territories.length];
		},
		'content': [
			// Date
			{
				'absolutePosition': positions.date,
				'style': styles.date,
				'text': moment().format('L')
			},
			{
				'absolutePosition': positions.agency,
				'style': styles.address,
				'text': agency
			},
			{
				'absolutePosition': positions.producer_name,
				'text': producer_name
			},
			{
				'absolutePosition': positions.producer_phone,
				'text': producer_phone
			},
			{
				'absolutePosition': positions.producer_email,
				'text': producer_email
			},
			{
				'absolutePosition': positions.insurer_id,
				'text': insurer_id ? insurer_id : ''
			},
			{
				'absolutePosition': positions.company,
				'text': application_data[0].insurer ? application_data[0].insurer : ''
			},
			{
				'absolutePosition': positions.applicant_name,
				'text': applicant_name
			},
			{
				'absolutePosition': positions.yrs_in_bus,
				'text': application_data[0].yrs_in_bus === -1 ? '' : application_data[0].yrs_in_bus
			},
			{
				'absolutePosition': positions.naics,
				'text': application_data[0].naics
			},
			{
				'absolutePosition': positions.sic,
				'text': application_data[0].sic
			},
			{
				'absolutePosition': positions.applicant_website,
				'style': styles.website,
				'text': applicant_website.length > 30 ? '' : applicant_website
			},
			{
				'absolutePosition': positions.applicant_phone,
				'text': contactPhone
			},
			{
				'absolutePosition': positions.applicant_email,
				'text': contactEmail
			},
			{
				'absolutePosition': positions[`entity_${application_data[0].entity_type}`],
				'text': 'X'
			},
			{
				'absolutePosition': positions.ein,
				'text': ein
			},
			{
				'absolutePosition': positions.submission_status,
				'text': 'X'
			},
			{
				'absolutePosition': positions.billing_plan,
				'text': 'X'
			},
			{
				'absolutePosition': positions.payment_plan,
				'text': other_payment_plan ? application_data[0].payment : ''
			},
			{
				'absolutePosition': other_payment_plan ? positions.other_payment_plan_checkbox : positions[application_data[0].payment],
				'text': 'X'
			},
			{
				'absolutePosition': positions.audit,
				'text': 'X'
			},
			{
				'absolutePosition': positions.proposed_eff_date,
				'text': application_data[0].effective_date === '00/00/0000' ? '' : application_data[0].effective_date
			},
			{
				'absolutePosition': positions.proposed_exp_date,
				'text': application_data[0].expiration_date === '00/00/0000' ? '' : application_data[0].expiration_date
			}
		],
		'defaultStyle': {
			'font': 'Helvetica',
			'fontSize': 8
		},
		'pageSize': 'LETTER'
	};

	// Start sql ncci code query
	let sql_ncci = `SELECT
							n.territory,
							GROUP_CONCAT(assoc.code) AS activity_codes,
							n.code,
							n.sub,
							n.description
						FROM clw_talage_activity_code_associations AS assoc
						LEFT JOIN clw_talage_insurer_ncci_codes AS n ON assoc.insurer_code = n.id
						WHERE n.insurer = ${insurer_id} and ((assoc.code = ${application_data[0].activity_code} and n.territory = '${application_data[0].territory}')`;

	// Loop through addresses
	const activity_code_data = {};
	const addresses = [];
	const location_offset = 25;
	const territories = [];
	let found_mailing_address = false;

	for(const index in application_data){
		if(Object.prototype.hasOwnProperty.call(application_data, index)){
			const data = application_data[index];

			// Store address number for state rating page
			let location_num = 0;

			// If we haven't seen the territory yet
			if(!territories.includes(data.territory) && !territories.includes(`\n${data.territory}`)){
				if(territories.length % 5 === 0){
					territories.push(`\n${data.territory}`);
				}
				else{
					territories.push(data.territory);
				}

				// Add activity code data for new territory
				activity_code_data[data.territory] = {};
			}

			// If we haven't seen the address yet and it exists
			if(!addresses.includes(data.address_id) && data.address_id){

				// Add address to list of addresses seen
				addresses.push(data.address_id);

				let street_address = '';
				let city = '';
				if(data.city){
					city = data.city.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
				}

				if(data.address && data.address.byteLength){
					const address = await crypt.decrypt(data.address); // eslint-disable-line no-await-in-loop
					street_address += `${address}`;
				}
				else{
					missing_data.push('Business location address');
				}

				// If this is the mailing address, add it to the top of the form and write it as Location 01
				if(data.billing){
					found_mailing_address = true;
					location_num = 1;

					// Write company mailing address and list as location 1

					// Add Location 01
					docDefinition.content = docDefinition.content.concat([
						{
							'absolutePosition': positions.location,
							'text': `${street_address}, ${city}, ${data.county}, ${data.territory}, ${data.zip}`
						}, {
							'absolutePosition': positions.location_num,
							'text': '01'
						}
					]);


					if(data.address2 && data.address2.byteLength){
						const address2 = await crypt.decrypt(data.address2); // eslint-disable-line no-await-in-loop
						street_address += `${address2}\n`;
					}

					// Add the mailing address
					docDefinition.content.push({
						'absolutePosition': positions.mailing_address,
						'style': styles.address,
						'text': `${street_address}\n${city}, ${data.territory} ${data.zip}`
					});

				}
				else{
					// Add as next location
					location_num = addresses.length + (found_mailing_address ? 0 : 1);

					const new_location = [
						{
							'absolutePosition': {
								'x': positions.location.x,
								'y': positions.location.y + (location_num - 1) * location_offset
							},
							'text': `${street_address}, ${city}, ${data.county}, ${data.territory}, ${data.zip}`
						}, {
							'absolutePosition': {
								'x': positions.location_num.x,
								'y': positions.location_num.y + (location_num - 1) * location_offset
							},
							// eslint-disable-next-line no-undefined
							'text': location_num.toLocaleString(undefined, {'minimumIntegerDigits': 2})
						}
					];

					// Only 3 locations on the first page
					if(location_num < 4){
						docDefinition.content = docDefinition.content.concat(new_location);
					}
					else{
						// Add the location to the overflow page - need to find pdf for location overflow page
					}

				}

				// Store data for state rating page
				activity_code_data[data.territory][data.address_id] = {
					'activity_codes': {},
					'full_time_employees': data.full_time_employees,
					'loc_num': location_num,
					'part_time_employees': data.part_time_employees,
					'total_payroll': 0
				};
			}

			// If we haven't seen this activity code at this location yet, add it
			if(!Object.prototype.hasOwnProperty.call(activity_code_data[data.territory][data.address_id].activity_codes, data.activity_code)){
				activity_code_data[data.territory][data.address_id].activity_codes[data.activity_code] = data.payroll;
				activity_code_data[data.territory][data.address_id].total_payroll += data.payroll;

				// Add to query for insurer ncci code
				sql_ncci = sql_ncci.concat(` or (assoc.code = ${data.activity_code} and n.territory = '${data.territory}')`);
			}
		}
	}

	// Finish the sql query for ncci codes
	sql_ncci = sql_ncci.concat(')');

	// Make sure the mailing address was found at some point
	if(!found_mailing_address){
		message = 'ACORD form generation failed. Mailing address missing for application.';
		log.error(message + __location);
		return {'error': message};
	}

	// Add list of territories
	docDefinition.content.push({
		'absolutePosition': positions.territory_list,
		'text': territories.join(', ')
	});

	// See if any of the territories are CA or OR
	let hasCA = false;
	let hasOR = false;
	territories.forEach((terr) => {
		if(terr.trim() === 'CA'){
			hasCA = true;
		}
		else if(terr.trim() === 'OR'){
			hasOR = true;
		}
	});

	// Limits
	let limit1 = '';
	let limit2 = '';
	let limit3 = '';
	// eslint-disable-next-line default-case
	switch(application_data[0].limits){
		// 1M-1M-1M
		case '100000010000001000000':
			limit1 = '1,000,000';
			limit2 = '1,000,000';
			limit3 = '1,000,000';
			break;
		// 2M-2M-2M
		case '200000020000002000000':
			limit1 = '2,000,000';
			limit2 = '2,000,000';
			limit3 = '2,000,000';
			break;
		// 500K-1M-500K
		case '5000001000000500000':
			if(hasCA){
				limit1 = '1,000,000';
				limit2 = '1,000,000';
				limit3 = '1,000,000';
			}
			else{
				limit1 = '500,000';
				limit2 = '1,000,000';
				limit3 = '500,000';
			}
			break;
		// 500K-500K-500K
		case '500000500000500000':
			if(hasCA){
				limit1 = '1,000,000';
				limit2 = '1,000,000';
				limit3 = '1,000,000';
			}
			else{
				limit1 = '500,000';
				limit2 = '500,000';
				limit3 = '500,000';
			}
			break;
		// 100K-500K-500K
		case '100000500000100000':
			if(hasCA){
				limit1 = '1,000,000';
				limit2 = '1,000,000';
				limit3 = '1,000,000';
			}
			else if(hasOR){
				limit1 = '500,000';
				limit2 = '500,000';
				limit3 = '500,000';
			}
			else{
				limit1 = '100,000';
				limit2 = '500,000';
				limit3 = '100,000';
			}
			break;
	}

	docDefinition.content.push({
			'absolutePosition': positions.employers_liability_1,
			'text': limit1
		},
		{
			'absolutePosition': positions.employers_liability_2,
			'text': limit2
		},
		{
			'absolutePosition': positions.employers_liability_3,
			'text': limit3
		});

	// Add the contact information
	const contact_info_offset = 12;
	for(let i = 0; i < 3; i++){
		docDefinition.content = docDefinition.content.concat([{
			'absolutePosition': {
				'x': positions.contact_info_name.x,
				'y': positions.contact_info_name.y + i * contact_info_offset
			},
			'text': contactName
		},
			{
				'absolutePosition': {
					'x': positions.contact_info_phone.x,
					'y': positions.contact_info_phone.y + i * contact_info_offset
				},
				'text': contactPhone
			},
			{
				'absolutePosition': {
					'x': positions.contact_info_email.x,
					'y': positions.contact_info_email.y + i * contact_info_offset
				},
				'text': contactEmail
			}]);
	}

	// Adding excluded owners
	if(!application_data[0].owners_covered){
		if(application_data[0].owners && application_data[0].owners.byteLength){

			let owners = await crypt.decrypt(application_data[0].owners);
			owners = JSON.parse(owners);
			const owner_offset = 24;

			// The maximum number of owners that can be listed on this page is 4
			for(let i = 0; i < owners.length && i < 4; i++){
				docDefinition.content = docDefinition.content.concat([
					{
						'absolutePosition': {
							'x': positions.owner_loc_num.x,
							'y': positions.owner_loc_num.y + i * owner_offset
						},
						'style': styles.owner,
						'text': '01'
					},
					{
						'absolutePosition': {
							'x': positions.owner.x,
							'y': positions.owner.y + i * owner_offset
						},
						'style': styles.owner,
						'text': `${owners[i].fname} ${owners[i].lname}`
					},
					{
						'absolutePosition': {
							'x': positions.owner_duties.x,
							'y': positions.owner_duties.y + i * owner_offset
						},
						'style': styles.owner,
						'text': 'OWNER'
					},
					{
						'absolutePosition': {
							'x': positions.owner_inc_exc.x,
							'y': positions.owner_inc_exc.y + i * owner_offset
						},
						'style': styles.owner,
						'text': 'EXC'
					}
				]);
			}
		} else {
			missing_data.push(`Owners excluded, but no names given`);
		}
	} else {
		docDefinition.content = docDefinition.content.concat([
			{
				'absolutePosition': positions.owner,
				'text': application_data[0].num_owners + ' OWNERS INCLUDED IN COVERAGE'
			}
		]);
	}

	// Group the NCCI codes
	sql_ncci += ' GROUP BY n.code, n.sub;';

	// Query for insurers ncci codes
	let ncci_data = [];
	if(application_data[0].insurer){
		ncci_data = await db.query(sql_ncci).catch(function(error){
			message = 'ACORD form generation failed. Database error: ' + error;
			log.error(message + __location);
			return {'error': message};
		});
	}

	// Replace any null values with an empty string
	ncci_data.forEach(row => Object.values(row).map(element => element === null ? '' : element))

	// Check that all the activity codes are supported by the selected insurer
	if(ncci_data.length){
		// Convert all activity_codes into an array
		ncci_data.map(function(code){
			code.activity_codes = code.activity_codes.split(',');
			return code;
		});

		// Combine duplicate activity codes
		for(const territory in activity_code_data){
			if(Object.prototype.hasOwnProperty.call(activity_code_data, territory)){
				// Loop over each location in this territory
				for(const locationId in activity_code_data[territory]){
					if(Object.prototype.hasOwnProperty.call(activity_code_data[territory], locationId)){
						// For this location, combine activity codes as necessary
						const activityCodes = {};
						const seenCodes = {};
						for(const activityCode in activity_code_data[territory][locationId].activity_codes){
							if(Object.prototype.hasOwnProperty.call(activity_code_data[territory][locationId].activity_codes, activityCode)){
								// Isolate the payroll
								const payroll = activity_code_data[territory][locationId].activity_codes[activityCode];

								// Get the NCCI code that corresponds to this activity code
								let ncci = '';
								ncci_data.forEach(function(codeObj){
									if(codeObj.activity_codes.includes(activityCode)){
										ncci = codeObj.code + (codeObj.sub ? codeObj.sub : '');
									}
								});

								// Check if this ncci code is the same as one already seen in this location, and if so, combine them
								if(Object.keys(seenCodes).includes(ncci)){
									// Combine
									activityCodes[seenCodes[ncci]] += payroll;
								}
								else{
									// Add this code as a separate code
									activityCodes[activityCode] = payroll;

									// Mark this code as seen
									seenCodes[ncci] = activityCode;
								}

							}
						}

						// Store the updated activity codes back into the data object
						activity_code_data[territory][locationId].activity_codes = activityCodes;
					}
				}
			}
		}
	}

	// Add NAICS and SIC to ncci code data
	ncci_data.naics = application_data[0].naics;
	ncci_data.sic = application_data[0].sic;
	ncci_data.waiver_subrogation = application_data[0].waiver_subrogation;
	ncci_data.additional_insured = application_data[0].additional_insured;

	// Generate all the state rating sheets and add them to the document
	const stateRatingResult = await generate.state_rating_sheets(activity_code_data, ncci_data);

	if(!ncci_data.length){
		missing_data.push('One or more activity codes are not supported by this insurer');
	}

	docDefinition.content = docDefinition.content.concat(stateRatingResult);

	// Beginning of page 3
	docDefinition.content.push({
		'pageBreak': 'before',
		'text': ''
	});

	// Add industry description
	docDefinition.content.push({
		'absolutePosition': positions.industry_description,
		'style': styles.industry_description,
		'text': application_data[0].industry_description
	});

	// Past claims
	docDefinition.content.push({
		'absolutePosition': positions.no_claims,
		'style': styles.no_claims,
		'text': 'N/A'
	});

	// General information questions and their corresponding questions on the application
	const general_information_questions = {
		'1002': 4,
		'1004': 23,
		'1010': 17,
		'1011': 10,
		'1012': 13,
		'1013': 15,
		'1033': 22.1,
		'1035': 14.1,
		'1074': 6,
		'1145': 2,
		'1273': 3,
		'1335': 20,
		'965': 5,
		'967': 22,
		'971': 7,
		'972': 11,
		'973': 8,
		'979': 9,
		'980': 12,
		'987': 14,
		'989': 18,
		'991': 24,
		'992': 19,
		'994': 16,
		'995': 21,
		'997': 1
	};

	// Run the query
	const sql_base = `SELECT 	app_q.question AS number,
										q_a.answer,
										q.type,
										app_q.text_answer
										FROM clw_talage_application_questions AS  app_q
										LEFT JOIN clw_talage_question_answers AS q_a ON app_q.answer = q_a.id
										INNER JOIN clw_talage_questions AS q ON app_q.question = q.id
										WHERE app_q.application = ${application_id} and (app_q.question =`;

	// Build rest of the query for the listed questions on the form
	// eslint-disable-next-line no-useless-escape
	const sql_questions = sql_base.concat(Object.keys(general_information_questions).join(' or app_q.question = ')).concat(')');

	const question_data = await db.query(sql_questions).catch(function(error){
		message = 'ACORD form generation failed. Database error: ' + error;
		log.error(message + __location);
		return {'error': message};
	});

	// Replace any null values with an empty string
	question_data.forEach(row => Object.values(row).map(element => element === null ? '' : element))

	const num_questions_page_3 = 16;
	const page_4_questions = [];

	// If there are no questions then don't fill in that section
	if(question_data.length){
		question_data.forEach(function(question){

			let question_answer = '';

			// If it is a yes or no question, check the box. If there is a text answer write it in
			if(question.type === 1){
				if(question.answer === 'Yes'){
					question_answer = 'Y';
				}
				else if(question.answer === 'No'){
					question_answer = 'N';
				}
			}
			else{
				question_answer = question.text_answer;
			}
			const answer = {
				'absolutePosition': positions[`general_info_${general_information_questions[question.number]}`],
				'style': styles.Y_N,
				'text': question_answer
			};
			// If the question is on page 3, add it to page 3
			if(general_information_questions[question.number] <= num_questions_page_3){
				docDefinition.content.push(answer);
			}
			else{
				// The question is on page 4, add it to page 4 array to be added after document page break
				page_4_questions.push(answer);
			}

			// Remove the answered question from the question list
			delete general_information_questions[question.number];

		});
	}
	// Write in default answer to remaining questions
	Object.values(general_information_questions).forEach(function(question){
		let answer_text = '';
		// Default answers to not include text explanations, all text questions are left blank
		if(question % 1 === 0){
			// Default answer for all non-text questions
			answer_text = 'N';
		}
		const answer = {
			'absolutePosition': positions[`general_info_${question}`],
			'style': styles.Y_N,
			'text': answer_text
		};
		// If the question is on page 3, add it to page 3
		if(question <= num_questions_page_3){
			docDefinition.content.push(answer);
		}
		else{
			// The question is on page 4, add it to page 4 array to be added after document page break
			page_4_questions.push(answer);
		}
	});

	// Beginning of page 4
	docDefinition.content.push({
		'pageBreak': 'before',
		'text': ''
	});

	// Add page 4 questions
	docDefinition.content = docDefinition.content.concat(page_4_questions);

	// If the agent is Talage
	if(application_data[0].agent === 1){
		// Add producer's signature
		docDefinition.content.push({
			'absolutePosition': positions.signature,
			'height': 20,
			'image': signature.talage_signature,
			'width': 80
		});
	}

	// Create PDF
	const doc = printer.createPdfKitDocument(docDefinition);

	return {
		'doc': doc,
		'missing_data': missing_data
	};
}