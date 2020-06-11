'use strict';
const crypt = global.requireShared('./services/crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const auth = require('./helpers/auth.js');
const serverHelper = require('../../../server.js');

/**
 * Responds to get requests for the certificate endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getApplication(req, res, next) {
	let error = false;

	// Check for data
	if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
		log.error('Bad Request: No data received ' + __location);
		return next(serverHelper.requestError('Bad Request: No data received'));
	}

	// Get the agents that we are permitted to view
	const agents = await auth.getAgents(req).catch(function (e) {
		error = e;
	});
	if (error) {
		log.error('Error get application getAgents ' + error + __location);
		return next(error);
	}

	// Make sure basic elements are present
	if (!req.query.id) {
		log.error('Bad Request: Missing ID ' + __location);
		return next(serverHelper.requestError('Bad Request: You must supply an ID'));
	}

	// Validate the application ID
	if (!(await validator.is_valid_id(req.query.id))) {
		log.error('Bad Request: Invalid id ' + __location);
		return next(serverHelper.requestError('Invalid id'));
	}

	// Check if this is Solepro and grant them special access
	let where = `${db.quoteName('a.agency')} IN (${agents.join(',')})`;
	if (agents.length === 1 && agents[0] === 12) {
		// This is Solepro (no restriction on agency ID, just applications tagged to them)
		where = `${db.quoteName('a.solepro')} = 1`;
	}

	// Define a query for retrieving basic application information
	const sql = `
			SELECT
				${db.quoteName('a.additional_insured', 'additionalInsured')},
				${db.quoteName('a.agency')},
				${db.quoteName('a.id')},
				${db.quoteName('a.last_step', 'lastStep')},
				${db.quoteName('a.solepro')},
				${db.quoteName('a.waiver_subrogation', 'waiverSubrogation')},
				${db.quoteName('a.years_of_exp', 'yearsOfExp')},
				${db.quoteName('b.website')},
				${db.quoteName('a.wholesale')},
				${db.quoteName('a.bop_effective_date', "businessOwner'sPolicyEffectiveDate")},
				${db.quoteName('a.bop_expiration_date', "businessOwner'sPolicyExpirationDate")},
				${db.quoteName('a.gl_effective_date', 'generalLiabilityEffectiveDate')},
				${db.quoteName('a.gl_expiration_date', 'generalLiabilityExpirationDate')},
				${db.quoteName('a.wc_effective_date', "workers'CompensationEffectiveDate")},
				${db.quoteName('a.wc_expiration_date', "workers'CompensationExpirationDate")},
				${db.quoteName('a.limits')},
				${db.quoteName('a.wc_limits', 'wcLimits')},
				${db.quoteName('a.deductible')},
				${db.quoteName('ad.unemployment_num', 'unemploymentNum')},
				${db.quoteName('ag.name', 'agencyName')},
				${db.quoteName('b.id', 'businessID')},
				${db.quoteName('b.name', 'businessName')},
				${db.quoteName('b.dba')},
				${db.quoteName('b.ein')},
				${db.quoteName('b.mailing_address', 'address')},
				${db.quoteName('b.mailing_address2', 'address2')},
				${db.quoteName('b.owners')},
				${db.quoteName('b.founded')},
				${db.quoteName('b.entity_type', 'entityType')},
				${db.quoteName('c.email')},
				${db.quoteName('c.fname')},
				${db.quoteName('c.lname')},
				${db.quoteName('c.phone')},
				${db.quoteName('z.city')},
				${db.quoteName('z.territory')},
				LPAD(CONVERT(${db.quoteName('z.zip')},char), 5, '0') AS zip,
				GROUP_CONCAT(${db.quoteName('apt.policy_type')}) AS policy_types
			FROM ${db.quoteName('#__applications', 'a')}
			LEFT JOIN ${db.quoteName('#__application_policy_types', 'apt')} ON ${db.quoteName('a.id')} = ${db.quoteName('apt.application')}
			LEFT JOIN ${db.quoteName('#__businesses', 'b')} ON ${db.quoteName('a.business')} = ${db.quoteName('b.id')}
			LEFT JOIN ${db.quoteName('#__contacts', 'c')} ON ${db.quoteName('c.business')} = ${db.quoteName('b.id')}
			LEFT JOIN ${db.quoteName('#__zip_codes', 'z')} ON ${db.quoteName('z.zip')} = ${db.quoteName('b.mailing_zip')}
			LEFT JOIN ${db.quoteName('#__agencies', 'ag')} ON ${db.quoteName('a.agency')} = ${db.quoteName('ag.id')}
			LEFT JOIN ${db.quoteName('#__addresses', 'ad')} ON ${db.quoteName('a.business')} = ${db.quoteName('ad.business')} AND ${db.quoteName('ad.billing')} = 1
			WHERE  ${db.quoteName('a.id')} = ${req.query.id} AND ${where}
			GROUP BY ${db.quoteName('a.id')}
			LIMIT 1;
		`;

	// Query the database
	const applicationData = await db.query(sql).catch(function (err) {
		log.error('Error get application database query ' + err.message + __location);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	});

	// Make sure an application was found
	if (applicationData.length !== 1) {
		log.error('Error get application, application not found ' + __location);
		return next(serverHelper.notFoundError('The application could not be found.'));
	}

	// Get the application from the response
	const application = applicationData[0];

	// Decrypt any necessary fields
	await crypt.batchProcessObject(application, 'decrypt', ['address', 'address2', 'businessName', 'dba', 'ein', 'email', 'fname', 'lname', 'owners', 'phone', 'website']);

	// Decode the owners
	application.owners = JSON.parse(application.owners);

	// Get all addresses for this business
	const addressSQL = `
			SELECT
				${db.quoteName('a.id')},
				${db.quoteName('a.address')},
				${db.quoteName('a.address2')},
				${db.quoteName('a.billing')},
				${db.quoteName('a.ein')},
				${db.quoteName('a.zip')},
				${db.quoteName('a.full_time_employees')},
				${db.quoteName('a.part_time_employees')},
				${db.quoteName('a.square_footage')},
				${db.quoteName('a.unemployment_num')},
				${db.quoteName('zc.city')},
				${db.quoteName('zc.territory')}
			FROM ${db.quoteName('#__addresses', 'a')}
			LEFT JOIN ${db.quoteName('#__zip_codes', 'zc')} ON ${db.quoteName('a.zip')} = ${db.quoteName('zc.zip')}
			WHERE ${db.quoteName('a.business')} = ${application.businessID};
		`;

	// Query the database
	const addressData = await db.query(addressSQL).catch(function (err) {
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	});

	// Decrypt the encrypted fields
	await crypt.batchProcessObjectArray(addressData, 'decrypt', ['address', 'address2', 'ein']);

	// Only process addresses if some were returned
	application.locations = [];
	if (addressData.length > 0) {
		// Get the activity codes for all addresses
		const codesSQL = `
				SELECT
					${db.quoteName('aac.address')},
					${db.quoteName('ac.description')},
					${db.quoteName('aac.payroll')}
				FROM ${db.quoteName('#__address_activity_codes', 'aac')}
				LEFT JOIN ${db.quoteName('#__activity_codes', 'ac')} ON ${db.quoteName('ac.id')} = ${db.quoteName('aac.ncci_code')}
				WHERE ${db.quoteName('aac.address')} IN (${addressData.map(function (address) {
			return address.id;
		})});
			`;

		// Query the database
		const codesData = await db.query(codesSQL).catch(function (err) {
			log.error(err.message);
			return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
		});

		// Loop over each address and do a bit more work
		addressData.forEach(function (address) {
			// Get all codes that are associated with this address and add them
			address.activityCodes = [];
			if (codesData.length > 0) {
				codesData.forEach(function (code) {
					if (code.address === address.id) {
						address.activityCodes.push(code);
					}
				});
			}

			// Add this address to the application object
			application.locations.push(address);
		});
	}

	// Get the quotes from the database
	const quotesSQL = `
			SELECT
				${db.quoteName('q.api_result')},
				${db.quoteName('q.policy_type')},
				${db.quoteName('pt.name', 'policyTypeName')},
				${db.quoteName('pay.name', 'paymentPlan')},
				${db.quoteName('q.insurer')},
				${db.quoteName('q.amount')},
				${db.quoteName('q.bound')},
				${db.quoteName('i.logo')},
				${db.quoteName('q.quote_letter')},
				${db.quoteName('q.number')},
				${db.quoteName('q.status')}
			FROM ${db.quoteName('#__quotes', 'q')}
			LEFT JOIN  ${db.quoteName('#__policies', 'p')} ON ${db.quoteName('p.quote')} = ${db.quoteName('q.id')}
			LEFT JOIN  ${db.quoteName('#__payment_plans', 'pay')} ON ${db.quoteName('pay.id')} = ${db.quoteName('p.payment_plan')}
			LEFT JOIN  ${db.quoteName('#__insurers', 'i')} ON ${db.quoteName('i.id')} = ${db.quoteName('q.insurer')}
			LEFT JOIN  ${db.quoteName('#__policy_types', 'pt')} ON ${db.quoteName('pt.abbr')} = ${db.quoteName('q.policy_type')}
			LEFT JOIN  ${db.quoteName('#__applications', 'a')} ON ${db.quoteName('q.application')} = ${db.quoteName('a.id')}
			
			WHERE ${db.quoteName('q.application')} = ${req.query.id} AND ${db.quoteName('q.state')} = 1;
		`;

	const quotes = await db.query(quotesSQL).catch(function (err) {
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	});

	// Add the quotes to the return object and determine the application status
	application.quotes = [];
	if (quotes.length > 0) {
		// Add the quotes to the response
		application.quotes = quotes;
	}

	// TO DO: Should questions be moved to this same endpoint? Probably.

	// Return the response
	res.send(200, application);
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get application', `${basePath}/application`, getApplication, 'applications', 'view');
};
