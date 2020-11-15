/* eslint-disable object-curly-newline */
/* eslint-disable no-extra-parens */
'use strict';
const auth = require('./helpers/auth.js');
const crypt = global.requireShared('./services/crypt.js');
const csvStringify = require('csv-stringify');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const moment = require('moment');
const serverHelper = require('../../../server.js');
const {LexModelBuildingService} = require('aws-sdk');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const ApplicationBO = global.requireShared('models/Application-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const IndustryCodeBO = global.requireShared('./models/IndustryCode-BO.js');

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
                a.appStatusId,
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
                "acord_emailed",
                'referred',
                'declined',
                'quoting',
                "questions_done",
                "incomplete",
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
    // All parameters and their values have been validated at this point -SFv


    // Create MySQL date strings
    const startDateSQL = moment(req.params.startDate).utc().format('YYYY-MM-DD HH:mm:ss');
    const endDateSQL = moment(req.params.endDate).utc().format('YYYY-MM-DD HH:mm:ss');


    // Begin by only allowing applications that are not deleted from agencies that are also not deleted
    // Build Mongo Query
    const query = {"active": true};
    const orClauseArray = [];

    //let where = `${db.quoteName('a.state')} > 0 AND ${db.quoteName('ag.state')} > 0`;

    // Filter out any agencies with do_not_report value set to true
    if(req.authentication.agencyNetwork){
        query.agencyNetworkId = agencyNetwork;
        const agencyBO = new AgencyBO();
        // eslint-disable-next-line prefer-const
        let agencyQuery = {
            do_not_report: 0,
            agency_network: agencyNetwork
        }
        if(req.params.searchText){
            agencyQuery.name = req.params.searchText
        }
        const agencyList = await agencyBO.getList(agencyQuery).catch(function(err) {
            log.error("Agency List load error " + err + __location);
            error = err;
        });
        if (agencyList && agencyList.length > 0) {
            // eslint-disable-next-line prefer-const
            let agencyIdArray = [];
            for (const agency of agencyList) {
                agencyIdArray.push(agency.id);
            }
            const agencyListFilter = {agencyId: {$in: agencyIdArray}};
            orClauseArray.push(agencyListFilter);
        }
        else {
            log.warn("Application Search no agencies found " + __location);
        }
    }
    else {
        query.agencyId = agents[0];
        if(query.agencyId === 12){
            query.solepro = true;
        }
    }
    if(req.params.searchApplicationStatus){
        query.status = req.params.searchApplicationStatus;
    }


    // ================================================================================
    // Build the Mongo $OR array

    // Add a text search clause if requested
    if (req.params.searchText.length > 0){

        const industryCodeBO = new IndustryCodeBO();
        // eslint-disable-next-line prefer-const
        let industryCodeQuery = {do_not_report: 0}
        if(req.params.searchText){
            industryCodeQuery.description = req.params.searchText
        }
        const industryCodeList = await industryCodeBO.getList(industryCodeQuery).catch(function(err) {
            log.error("industryCodeBO List load error " + err + __location);
            error = err;
        });
        if (industryCodeList && industryCodeList.length > 0) {
            // eslint-disable-next-line prefer-const
            let industryCodeIdArray = [];
            for (const industryCode of industryCodeList) {
                industryCodeIdArray.push(industryCode.id);
            }
            const industryCodeListFilter = {industryCode: {$in: industryCodeIdArray}};
            orClauseArray.push(industryCodeListFilter);
        }
        else {
            log.warn("Application Search no agencies found " + __location);
        }

        req.params.searchText = req.params.searchText.toLowerCase();
        const mailingCity = {mailingCity: `%${req.params.searchText}%`}
        const mailingState = {mailingState: `%${req.params.searchText}%`}
        const businessName = {businessName: `%${req.params.searchText}%`}
        const dba = {dba: `%${req.params.searchText}%`}

        orClauseArray.push(mailingCity);
        orClauseArray.push(mailingState);
        orClauseArray.push(businessName);
        orClauseArray.push(dba);

        const uuid = {uuid: `%${req.params.searchText}%`}
        orClauseArray.push(uuid);

        if(isNaN(req.params.searchText) === false && req.params.searchText.length > 3){
            const testInteger = Number(req.params.searchText);
            if(Number.isInteger(testInteger)){
                const mysqlId = {mysqlId: testInteger}
                const mailingZipcode = {mailingZipcode: `${req.params.searchText}%`}
                orClauseArray.push(mysqlId);
                orClauseArray.push(mailingZipcode);
            }
        }

    }
    // Add a application status search clause if requested
    if (req.params.searchApplicationStatus.length > 0){
        const status = {status: req.params.searchApplicationStatus}
        orClauseArray.push(status);
    }

    // ================================================================================

    if(startDateSQL){
        query.searchbegindate = startDateSQL;
    }
    if(endDateSQL){
        query.searchbegindate = startDateSQL;
    }


    // eslint-disable-next-line prefer-const
    let requestParms = JSON.parse(JSON.stringify(req.params));
    let applicationsTotalCount = 0;
    let applicationsSearchCount = 0;

    const applicationBO = new ApplicationBO();

    let applicationList = [];
    try{
        // eslint-disable-next-line prefer-const
        let totalQueryJson = {};
        if(query.agencyNetworkId){
            totalQueryJson.agencyNetworkId = query.agencyNetworkId
        }
        else if(query.agencyId){
            totalQueryJson.agencyId = query.agencyId
        }
        const applicationsTotalCountJSON = await applicationBO.getAppListForAgencyPortalSearch(totalQueryJson,[],{count: 1});
        applicationsTotalCount = applicationsTotalCountJSON.count;

        const applicationsSearchCountJSON = await applicationBO.getAppListForAgencyPortalSearch(query, orClauseArray,{count: 1})
        applicationsSearchCount = applicationsSearchCountJSON.count;

        applicationList = await applicationBO.getAppListForAgencyPortalSearch(query,orClauseArray,requestParms);
        for (const application of applicationList) {
            application.business = application.businessName;
            application.agency = application.agencyId;
            application.date = application.createdAt;
            application.location = `${application.mailingCity}, ${application.mailingState} ${application.mailingZipcode} `

        }

    }
    catch(err){
        log.error(`Error Getting application doc JSON.stringify(requestParms) JSON.stringify(query)` + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    // Exit with default values if no applications were received
    if (!applicationList.length){
        res.send(200, {
            "applications": [],
            "applicationsSearchCount": 0,
            "applicationsTotalCount": applicationsTotalCount
        });
        return next();
    }


    // Build the response
    const response = {
        "applications": applicationList,
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