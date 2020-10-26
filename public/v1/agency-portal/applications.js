/* eslint-disable no-extra-parens */
'use strict';
const auth = require('./helpers/auth.js');
const crypt = global.requireShared('./services/crypt.js');
const csvStringify = require('csv-stringify');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const moment = require('moment');
const serverHelper = require('../../../server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

/**
 * Validates the parameters for the applications call
 * @param {Array} parent - The list of parameters to validate
 * @param {Array} expectedParameters - The list of expected parameters
 * @return {boolean} true or false for if the parameters are valid
 */
function validateParameters(parent, expectedParameters){
    if (!parent){
        log.error('Bad Request: Missing all parameters' + __location);
        return false;
    }
    for (let i = 0; i < expectedParameters.length; i++){
        const expectedParameter = expectedParameters[i];
        if (!Object.prototype.hasOwnProperty.call(parent, expectedParameter.name) || typeof parent[expectedParameter.name] !== expectedParameter.type && expectedParameters[i].optional !== true){
            log.error(`Bad Request: Missing ${expectedParameter.name} parameter (${expectedParameter.type})` + __location);
            return false;
        }
        const parameterValue = parent[expectedParameter.name];
        if (Object.prototype.hasOwnProperty.call(expectedParameter, 'values') && !expectedParameter.values.includes(parameterValue)){
            log.error(`Bad Request: Invalid value for ${expectedParameters[i].name} parameter (${parameterValue})` + __location);
            return false;
        }
        if (expectedParameters[i].verifyDate && parameterValue && !moment(parameterValue).isValid()){
            log.error(`Bad Request: Invalid date value for ${expectedParameters[i].name} parameter (${parameterValue})` + __location);
            return false;
        }
    }
    return true;
}

/**
 * Generate a CSV file of exported application data
 *
 * @param {array} agents - The list of agents this user is permitted to access
 * @param {mixed} agencyNetwork - The ID of the agency network if the user is an agency network user, false otherwise
 * @returns {Promise.<String, Error>} A promise that returns a string of CSV data on success, or an Error object if rejected
 */
function generateCSV(agents, agencyNetwork){
    return new Promise(async(fulfill, reject) => {
        let error = false;

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

        // Define the different statuses and their user-friendly values
        const statusMap = {
            'acord_sent': 'ACORD form sent',
            'bound': 'Bound',
            'declined': 'Declined',
            'error': 'Error',
            'incomplete': 'Incomplete',
            'quoted': 'Quoted',
            'quoted_referred': 'Quoted (referred)',
            'referred': 'Referred',
            'request_to_bind': 'Request to bind',
            'request_to_bind_referred': 'Request to bind (referred)',
            'wholesale': 'Wholesale'
		};
		let whereAddition = '';
		if(agencyNetwork){
			whereAddition += 'AND ag.do_not_report = 0'
		}
        // Prepare to get all application data
        let sql = `
            SELECT
                a.status,
                ad.address,
                ad.address2,
                ad.zip,
                ag.name AS agency,
                b.dba,
                b.ein,
                b.entity_type,
                b.name,
                b.website,
                c.email,
                c.fname,
                c.lname,
                c.phone,
                pa.address AS primaryAddress,
                pa.address2 AS primaryAddress2,
                pa.zip AS primaryZip,
                z.city,
                z.territory,
                z2.city AS primaryCity,
                z2.territory AS primaryTerritory
            FROM clw_talage_applications AS a
            LEFT JOIN clw_talage_agencies AS ag ON a.agency = ag.id
            LEFT JOIN clw_talage_addresses AS ad ON a.business = ad.business AND ad.billing = 1
            LEFT JOIN (SELECT * FROM clw_talage_addresses AS ad2 GROUP BY ad2.business) AS pa ON a.business = pa.business
            LEFT JOIN clw_talage_businesses AS b ON a.business = b.id
            LEFT JOIN clw_talage_contacts AS c ON a.business = c.business AND c.primary = 1
            LEFT JOIN clw_talage_zip_codes AS z ON ad.zip = z.zip
            LEFT JOIN clw_talage_zip_codes AS z2 ON pa.zip = z2.zip
            WHERE
                a.state > 0
				AND ag.state > 0
				${whereAddition}
				
		`; 

        // This is a very special case. If this is the agency 'Solepro' (ID 12) is asking for applications, query differently
        if(!agencyNetwork && agents[0] === 12){
            sql += ` AND \`a\`.\`solepro\` = 1`;
        }
        else{
            sql += ` AND \`a\`.\`agency\` IN(${agents.join()})`;
        }

        // Run the query
        const data = await db.query(sql).catch(function(err){
            log.error(err.message);
            error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        });
        if(error){
            reject(error);
            return;
        }

        // If no data was returned, stop and alert the user
        if(data.length === 0){
            log.info('There are no applications to export');
            reject(serverHelper.requestError('There are no applications to export. Please try again when there are some applications in your account.'));
            return;
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

            /* --- Make the data pretty --- */

            // Address and Primary Address - Combine the two address lines (if there is an address and an address line 2)
            if(record.address && record.address2){
                record.address += `, ${record.address2}`;
            }
            if(record.primaryAddress && record.primaryAddress2){
                record.primaryAddress += `, ${record.primaryAddress2}`;
            }

            // Contact Name - Combine first and last
            record.contactName = `${record.fname} ${record.lname}`;

            // Business Name and DBA - Clean the name and DBA (grave marks in the name cause the CSV not to render)
            record.dba = record.dba ? record.dba.replace(/’/g, '\'') : null;
            record.name = record.name ? record.name.replace(/’/g, '\'') : null;

            // City and Primary City - Proper capitalization
            if(record.city){
                record.city = stringFunctions.ucwords(record.city.toLowerCase());
            }
            if(record.primaryCity){
                record.primaryCity = stringFunctions.ucwords(record.primaryCity.toLowerCase());
            }

            // Phone Number - Formatted
            record.phone = record.phone ? formatPhone(record.phone) : null;

            // Status
            if(Object.prototype.hasOwnProperty.call(statusMap, record.status)){
                record.status = statusMap[record.status];
            }
            else{
                record.status = 'Unknown';
            }
        }

        // Define the columns (and column order) in the CSV file and their user friendly titles
        const columns = {
            'name': 'Business Name',
            'dba': 'DBA',
            'status': 'Application Status',
            'agency': 'Agency',
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
            'website': 'Website'
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
                reject(serverHelper.internalError('Unable to generate CSV file'));
                return;
            }

            // Send the CSV data
            fulfill(output);
        });
    });
}

/**
 * Retrieves quotes for an application and populates application.quotes[]
 * @param {Object} application - The application
 * @return {void}
 */
async function getQuotes(application){
    application.quotes = [];

    if (application.location){
        // Convert the case on the cities
        application.location = application.location.replace(/(^([a-zA-Z\p{M}]))|([ -][a-zA-Z\p{M}])/g, (s) => s.toUpperCase());
    }
    // Retrieve the quotes for this application and populate application.quotes[]
    const quotesSQL = `
		SELECT
			${db.quoteName('status')},
			${db.quoteName('api_result')},
			${db.quoteName('bound')}
		FROM ${db.quoteName('#__quotes', 'a')}
		WHERE ${db.quoteName('application')} = ${db.escape(application.id)}
	`;
    try {
        const quotes = await db.query(quotesSQL);
        quotes.forEach((quote) => {
            application.quotes.push(quote);
        });
    }
    catch (err){
        log.info(`Error retrieving quotes for application ${application.id}`);
    }
}

/**
 * Responds to get requests for the applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getApplications(req, res, next){
    let error = false;

    // Get the agents that we are permitted to view
    const agents = await auth.getAgents(req).catch(function(e){
        error = e;
    });
    if(error){
        return next(error);
    }

    // Localize data variables that the user is permitted to access
    const agencyNetwork = parseInt(req.authentication.agencyNetwork, 10);

    // Check if we are exporting a CSV instead of the JSON list
    if(req.params && Object.prototype.hasOwnProperty.call(req.params, 'format') && req.params.format === 'csv'){
        const csvData = await generateCSV(agents,agencyNetwork).catch(function(e){
            error = e;
        });
        if(error){
            return next(error);
        }

        // Set the headers so the browser knows we are sending a CSV file
        res.writeHead(200, {
            'Content-Disposition': 'attachment; filename=applications.csv',
            'Content-Length': csvData.length,
            'Content-Type': 'text-csv'
        });

        // Send the CSV data
        res.end(csvData);
        return next();
    }

    const expectedParameters = [
        {
            "name": 'page',
            "type": 'number'
        },
        {
            "name": 'limit',
            "type": 'number'
        },
        {
            "name": 'sort',
            "type": 'string',
            "values": ['business',
                'status',
                'agencyName',
                'industry',
                'location',
                'date']
        },
        {
            "name": 'sortDescending',
            "type": 'boolean'
        },
        {
            "name": 'searchText',
            "type": 'string'
        },
        {
            "name": 'searchApplicationStatus',
            "type": 'string',
            "values": ['',
                'bound',
                'request_to_bind_referred',
                'request_to_bind',
                'quoted_referred',
                'quoted',
                'referred',
                'declined',
                'error']
        },
        {
            "name": 'startDate',
            "type": 'string',
            "verifyDate": true,
            "optional": true
        },
        {
            "name": 'endDate',
            "type": 'string',
            "verifyDate": true,
            "optional": true
        }
    ];
    //Fix bad dates coming in.
    if(!req.params.startDate || (req.params.startDate && req.params.startDate.startsWith('T00:00:00.000'))){
        req.params.startDate = moment('2020-01-01').toISOString();
    }

    if(!req.params.endDate || (req.params.endDate && req.params.endDate.startsWith('T23:59:59.999'))){
        // now....
        log.debug('AP Application Search resetting end date' + __location);
        req.params.endDate = moment().toISOString();
    }


    // Validate the parameters
    if (!validateParameters(req.params, expectedParameters)){
        return next(serverHelper.requestError('Bad Request: missing expected parameter'));
    }
    // All parameters and their values have been validated at this point -SF

    // Create MySQL date strings
    const startDateSQL = moment(req.params.startDate).utc().format('YYYY-MM-DD HH:mm:ss');
    const endDateSQL = moment(req.params.endDate).utc().format('YYYY-MM-DD HH:mm:ss');

    // Make sure we got agents
    if (!agents.length){
        log.info('Bad Request: No agencies permitted');
        return next(serverHelper.requestError('Bad Request: No agencies permitted'));
    }

    // Begin by only allowing applications that are not deleted from agencies that are also not deleted
    let where = `${db.quoteName('a.state')} > 0 AND ${db.quoteName('ag.state')} > 0`;

	// Filter out any agencies with do_not_report value set to true
	if(req.authentication.agencyNetwork){
		where += ` AND ag.do_not_report = 0`;
	}

    // This is a very special case. If this is the agent 'Solepro' (ID 12) asking for applications, query differently
    if(!agencyNetwork && agents[0] === 12){
        where += ` AND ${db.quoteName('a.solepro')} = 1`;
    }
    else{
        where += ` AND ${db.quoteName('a.agency')} IN(${agents.join(',')})`;
    }


    // ================================================================================
    // Get the total number of applications for this agency
    const applicationsTotalCountSQL = `
			SELECT COUNT(DISTINCT ${db.quoteName('a.id')}) as count
			FROM ${db.quoteName('#__applications', 'a')}
			LEFT JOIN ${db.quoteName('#__agencies', 'ag')} ON ${db.quoteName('a.agency')} = ${db.quoteName('ag.id')}
			WHERE ${where}
		`;
    let applicationsTotalCount = 0;
    try {
        applicationsTotalCount = (await db.query(applicationsTotalCountSQL))[0].count;
    }
    catch (err){
        log.error(err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    // ================================================================================
    // Build the SQL search query

    // Add a text search clause if requested
    if (req.params.searchText.length > 0){
        req.params.searchText = req.params.searchText.toLowerCase();
        // Search the description (industry), city, territory (state), and business name columns
        where += `
				AND (
					${db.quoteName('b.mailing_city')} LIKE ${db.escape(`%${req.params.searchText}%`)}
                    OR ${db.quoteName('b.mailing_state_abbr')} LIKE ${db.escape(`%${req.params.searchText}%`)}
                    OR ${db.quoteName('b.name_clear')} LIKE ${db.escape(`%${req.params.searchText}%`)}
                    OR ${db.quoteName('b.dba_clear')} LIKE ${db.escape(`%${req.params.searchText}%`)}
			`;
        if (agencyNetwork){
            // If this user is an agency network role, then we search on the agency name
            where += ` OR ${db.quoteName('ag.name')} LIKE ${db.escape(`%${req.params.searchText}%`)}`;
        }
        else {
            // Otherwise, we search on industry description
            where += ` OR ${db.quoteName('ic.description')} LIKE ${db.escape(`%${req.params.searchText}%`)}`;
        }
        //if searchText is number search on application id
        if(req.params.searchText.length > 2){
            where += ` OR a.uuid LIKE ${db.escape(`%${req.params.searchText}%`)}`;
        }
        if(isNaN(req.params.searchText) === false && req.params.searchText.length > 3){
            const testInteger = Number(req.params.searchText);
            if(Number.isInteger(testInteger)){
                where += ` OR a.id  = ${db.escape(req.params.searchText)}`;
                where += ` OR b.mailing_zipcode LIKE ${db.escape(`${req.params.searchText}%`)}`
            }


        }
        where += ')';
    }
    // Add a application status search clause if requested
    if (req.params.searchApplicationStatus.length > 0){
        where += `
				AND ${db.quoteName('a.status')} = ${db.escape(req.params.searchApplicationStatus)}
			`;
    }

    // ================================================================================
    // Build the common SQL between the total count and paginated results

    let commonSQL = `
			FROM ${db.quoteName('#__applications', 'a')}
			LEFT JOIN ${db.quoteName('#__businesses', 'b')} ON ${db.quoteName('b.id')} = ${db.quoteName('a.business')}
			LEFT JOIN ${db.quoteName('#__industry_codes', 'ic')} ON ${db.quoteName('ic.id')} = ${db.quoteName('a.industry_code')}
			LEFT JOIN ${db.quoteName('#__agencies', 'ag')} ON ${db.quoteName('a.agency')} = ${db.quoteName('ag.id')}
        `;

    if(startDateSQL && endDateSQL){
        commonSQL += `WHERE ${db.quoteName('a.created')} BETWEEN CAST(${db.escape(startDateSQL)} AS DATETIME) AND CAST(${db.escape(endDateSQL)} AS DATETIME)  
             AND  ${where}`;
    }
    else {
        commonSQL += `WHERE ${where}`;
    }


    // ================================================================================
    // Get the number of total applications in the query. This can change between requests as applications are added so it needs to be calculated
    // Every time for proper pagination in the frontend.
    const applicationsSearchCountSQL = `
			SELECT COUNT(DISTINCT ${db.quoteName('a.id')}) as count
			${commonSQL}
		`;
    let applicationsSearchCount = 0;
    //log.debug("applicationsSearchCountSQL: " + applicationsSearchCountSQL)
    try {
        applicationsSearchCount = (await db.query(applicationsSearchCountSQL))[0].count;
    }
    catch (err){
        log.error(err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    // ================================================================================
    // Get the requested applications
    const applicationsSQL = `
			SELECT
				DISTINCT ${db.quoteName('a.id')},
				${db.quoteName('a.status')},
				${db.quoteName('a.agency')},
				${db.quoteName('a.created', 'date')},
				${db.quoteName('a.solepro')},
				${db.quoteName('a.wholesale')},
				${db.quoteName('ag.name', 'agencyName')},
				${db.quoteName('b.name_clear', 'business')},
				${db.quoteName('a.last_step', 'lastStep')},
				${db.quoteName('ic.description', 'industry')},
				RIGHT(${db.quoteName('uuid')}, 5) AS 'uuid',
				CONCAT(LOWER(${db.quoteName('b.mailing_city')}), ', ', ${db.quoteName('b.mailing_state_abbr')}, ' ',b.mailing_zipcode) AS ${db.quoteName('location')}
			${commonSQL}
			ORDER BY ${db.quoteName(req.params.sort)} ${req.params.sortDescending ? 'DESC' : 'ASC'}
			LIMIT ${req.params.limit}
			OFFSET ${req.params.page * req.params.limit}
		`;


    let applications = null;
    try {
        applications = await db.query(applicationsSQL);
    }
    catch (err){
        log.error(err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    // Exit with default values if no applications were received
    if (!applications.length){
        res.send(200, {
            "applications": [],
            "applicationsSearchCount": 0,
            "applicationsTotalCount": applicationsTotalCount
        });
        return next();
    }

    if(applications && applications.length > 0){
        // Decrypt the business names
        // using name_clear
        //await crypt.batchProcessObjectArray(applications, 'decrypt', ['business']);

        // Get all quotes for each application
        const getQuotesPromises = [];

        applications.forEach((application) => {
            getQuotesPromises.push(getQuotes(application));
        });
        await Promise.all(getQuotesPromises);
    }

    // Build the response
    const response = {
        "applications": applications,
        "applicationsSearchCount": applicationsSearchCount,
        "applicationsTotalCount": applicationsTotalCount
    };

    // Return the response
    res.send(200, response);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addPostAuth('Get applications', `${basePath}/applications`, getApplications, 'applications', 'view');
    server.addGetAuth('Get applications', `${basePath}/applications`, getApplications, 'applications', 'view');
};