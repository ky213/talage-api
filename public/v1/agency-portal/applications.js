/* eslint-disable object-property-newline */
/* eslint-disable object-curly-newline */
/* eslint-disable no-extra-parens */
'use strict';
const auth = require('./helpers/auth-agencyportal.js');
const csvStringify = require('csv-stringify');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const moment = require('moment');
const serverHelper = global.requireRootPath('server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const ApplicationBO = global.requireShared('models/Application-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const IndustryCodeBO = global.requireShared('./models/IndustryCode-BO.js');
const InsurerBO = global.requireShared('./models/Insurer-BO.js');
const mongoose = require('mongoose');
const Quote = mongoose.model('Quote');
const InsurerPolicyTypeBO = global.requireShared('models/InsurerPolicyType-BO.js');
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const AgencyLocationBO = global.requireShared("models/AgencyLocation-BO.js");

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
        if ((!Object.prototype.hasOwnProperty.call(parent, expectedParameter.name) || typeof parent[expectedParameter.name] !== expectedParameter.type) && expectedParameters[i].optional !== true){
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
 * @param {array} applicationList - The list of appplication to put in CSV
 * @returns {Promise.<String, Error>} A promise that returns a string of CSV data on success, or an Error object if rejected
 */
function generateCSV(applicationList){
    return new Promise(async(fulfill, reject) => {


        // Define the different statuses and their user-friendly values
        const statusMap = {
            'acord_sent': 'ACORD form sent',
            'bound': 'Bound',
            'declined': 'Declined',
            'error': 'Error',
            'incomplete': 'Incomplete',
            'acord_emailed': 'Acord Emailed',
            'quoting': 'Quoting',
            'quoted': 'Quoted',
            'quoted_referred': 'Quoted (referred)',
            'questions_done': 'Questions Done',
            'referred': 'Referred',
            'request_to_bind': 'Request to bind',
            'request_to_bind_referred': 'Request to bind (referred)',
            'wholesale': 'Wholesale'
        };

        // If no data was returned, stop and alert the user
        if(!applicationList){
            log.info('There are no applications to export');
            reject(serverHelper.requestError('There are no applications to export. Please try again when there are some applications in your account.'));
            return;
        }
        if(applicationList.length === 0){
            log.info('There are no applications to export');
            reject(serverHelper.requestError('There are no applications to export. Please try again when there are some applications in your account.'));
            return;
        }

        // Process the returned data
        for(const applicationDoc of applicationList){

            /* --- Make the data pretty --- */
            // Address and Primary Address - Combine the two address lines (if there is an address and an address line 2)
            if(applicationDoc.mailingAddress && applicationDoc.mailingAddress2){
                applicationDoc.mailingAddress += `, ${applicationDoc.mailingAddress2}`;
            }

            // Business Name and DBA - Clean the name and DBA (grave marks in the name cause the CSV not to render)
            applicationDoc.dba = applicationDoc.dba ? applicationDoc.dba.replace(/’/g, '\'') : null;
            applicationDoc.name = applicationDoc.name ? applicationDoc.name.replace(/’/g, '\'') : null;

            //Get Primary Location
            const primaryLocation = applicationDoc.locations.find(locationTest => locationTest.billing === true);
            if(primaryLocation){
                applicationDoc.primaryAddress = primaryLocation.address;
                if(applicationDoc.primaryAddress && primaryLocation.address2){
                    applicationDoc.primaryAddress += `, ${primaryLocation.address2}`;
                }

                // City and Primary City - Proper capitalization
                if(primaryLocation.city){
                    applicationDoc.city = stringFunctions.ucwords(primaryLocation.city.toLowerCase());
                    applicationDoc.primaryCity = stringFunctions.ucwords(primaryLocation.city.toLowerCase());
                }
                applicationDoc.primaryState = primaryLocation.state;
                applicationDoc.primaryZip = primaryLocation.zipcode;
            }


            //get Primary Contact
            const customerContact = applicationDoc.contacts.find(contactTest => contactTest.primary === true);
            // Phone Number - Formatted
            if(customerContact){
                applicationDoc.email = customerContact.email;
                applicationDoc.phone = customerContact.phone ? formatPhone(customerContact.phone) : null;
                // Contact Name - Combine first and last
                if(customerContact.firstName){
                    applicationDoc.contactName = `${customerContact.firstName} ${customerContact.lastName}`;
                }
            }

            // Status
            if(Object.prototype.hasOwnProperty.call(statusMap, applicationDoc.status)){
                applicationDoc.status = statusMap[applicationDoc.status];
            }
            else{
                applicationDoc.status = 'Unknown';
            }
            const createdAtMoment = moment(applicationDoc.createdAt)
            applicationDoc.createdString = createdAtMoment.format("YYYY-MM-DD hh:mm");

            // get referrer information, if none then default to agency portal
            if(!applicationDoc.referrer){
                applicationDoc.referrer = 'Agency Portal';
            }
        }

        // Define the columns (and column order) in the CSV file and their user friendly titles
        const columns = {
            'businessName': 'Business Name',
            'dba': 'DBA',
            'status': 'Application Status',
            'agencyName': 'Agency',
            'referrer': 'Source',
            'mailingAddress': 'Mailing Address',
            'mailingCity': 'Mailing City',
            'mailingState': 'Mailing State',
            'mailingZipcode': 'Mailing Zip Code',
            'primaryAddress': 'Physical Address',
            'primaryCity': 'Physical City',
            'primaryState': 'Physical State',
            'primaryZip': 'Physical Zip Code',
            'contactName': 'Contact Name',
            'email': 'Contact Email',
            'phone': 'Contact Phone',
            'entityType': 'Entity Type',
            'einClear': 'EIN',
            'website': 'Website',
            'createdString' : 'Created (UTC)'
        };

        // Establish the headers for the CSV file
        const options = {
            'columns': columns,
            'header': true
        };

        // Generate the CSV data
        csvStringify(applicationList, options, function(err, output){
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
    let noCacheUse = false;
    log.debug(`AP getApplications parms ${JSON.stringify(req.params)}` + __location)
    const initialRequestParms = JSON.parse(JSON.stringify(req.params))
    const start = moment();
    // Localize data variables that the user is permitted to access
    const agencyNetworkId = parseInt(req.authentication.agencyNetworkId, 10);
    let returnCSV = false;
    // Use same query builder.
    // Check if we are exporting a CSV instead of the JSON list
    if(req.params && Object.prototype.hasOwnProperty.call(req.params, 'format') && req.params.format === 'csv'){
        returnCSV = true;
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
                'error',
                'dead']
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

    // Validate the parameters
    if (returnCSV === false && !validateParameters(req.params, expectedParameters)){
        return next(serverHelper.requestError('Bad Request: missing expected parameter'));
    }
    // All parameters and their values have been validated at this point -SFv


    // Create MySQL date strings
    let startDateMoment = null;
    let endDateMoment = null;

    //Fix bad dates coming in.
    if(req.params.startDate){
        //req.params.startDate = moment('2017-01-01').toISOString();
        startDateMoment = moment(req.params.startDate).utc();
    }

    if(req.params.endDate){
        endDateMoment = moment(req.params.endDate).utc();
        const now = moment().utc();
        const diffSecond = now.diff(endDateMoment, 'seconds')
        if(diffSecond < 5 && req.params.searchText && req.params.searchText.indexOf("pd:") === -1 && req.params.searchText && req.params.searchText.indexOf("pde:") === -1){
            endDateMoment = null;
        }
        // now....
        // log.debug('AP Application Search resetting end date' + __location);
        //req.params.endDate = moment().toISOString();
    }

    // Begin by only allowing applications that are not deleted from agencies that are also not deleted
    // Build Mongo Query
    let policyDateSearch = false;
    let policyDateExpiredSearch = false;
    let modifiedSearch = false;

    const query = {"active": true};
    if(startDateMoment){
        query.searchbegindate = startDateMoment.toISOString();
    }
    if(endDateMoment){
        query.searchenddate = endDateMoment.toISOString();
    }
    if(req.params.searchText && req.params.searchText.indexOf("md:") > -1){
        noCacheUse = true;
        modifiedSearch = true;
        req.params.searchText = req.params.searchText.replace("md:", "").trim()
        query.beginmodifieddate = query.searchbegindate
        query.endmodifieddate = query.searchenddate
        if(query.searchbegindate){
            delete query.searchbegindate;
        }
        if(query.searchenddate){
            delete query.searchenddate;
        }

    }


    if(req.params.searchText && req.params.searchText.indexOf("pd:") > -1){
        noCacheUse = true;
        policyDateSearch = true;
        req.params.searchText = req.params.searchText.replace("pd:", "").trim()
        query.beginpolicydate = query.searchbegindate
        query.endpolicydate = query.searchenddate
        if(query.searchbegindate){
            delete query.searchbegindate;
        }
        if(query.searchenddate){
            delete query.searchenddate;
        }

    }

    if(req.params.searchText && req.params.searchText.indexOf("pde:") > -1){
        noCacheUse = true;
        policyDateExpiredSearch = true;
        req.params.searchText = req.params.searchText.replace("pde:", "").trim()
        query.beginpolicyexprdate = query.searchbegindate
        query.endpolicyexprdate = query.searchenddate
        if(query.searchbegindate){
            delete query.searchbegindate;
        }
        if(query.searchenddate){
            delete query.searchenddate;
        }
    }

    const orClauseArray = [];

    if(req.params.searchText && req.params.searchText.toLowerCase().startsWith("i:")){
        noCacheUse = true;
        log.debug("Insurer Search")
        try{
            //insurer search
            const searchWords = req.params.searchText.split(" ");
            const insurerText = searchWords[0].substring(2);
            req.params.searchText = '';
            if(searchWords.length > 1){
                //reset searchtext to remove insurer

                searchWords.forEach((searchWord,index) => {
                    if(index > 0){
                        req.params.searchText += ' ' + searchWord;
                    }
                })
                req.params.searchText = req.params.searchText.trim();
            }
            log.debug("New searchText " + req.params.searchText + __location)
            let insurerId = 0;
            //if string (insure name)
            if(isNaN(insurerText)){
                const insurerBO = new InsurerBO();
                // eslint-disable-next-line object-property-newline
                const queryInsurer = {$or: [{"name": {"$regex": insurerText,"$options": "i"}}, {slug: insurerText}]}
                const insurerList = await insurerBO.getList(queryInsurer);
                if(insurerList && insurerList.length){
                    insurerId = insurerList[0].insurerId
                }
            }
            else {
                insurerId = parseInt(insurerText,10)
            }
            if(insurerId > 0){
                //create match
                // eslint-disable-next-line prefer-const
                let matchClause = {
                    active: true,
                    insurerId: insurerId
                }
                let dateQuery = null;
                if(!startDateMoment || !startDateMoment.isValid()){
                    startDateMoment = moment().add(-90,"d");
                }
                if(startDateMoment && startDateMoment.isValid() && endDateMoment && endDateMoment.isValid()){
                    dateQuery = {
                        $gte: startDateMoment.toDate(),
                        $lte: endDateMoment.toDate()
                    }
                }
                else if(startDateMoment && startDateMoment.isValid()){
                    dateQuery = {
                        $gte: startDateMoment.toDate()
                    }
                }
                else if(endDateMoment && endDateMoment.isValid()){
                    dateQuery = {
                        $lte: endDateMoment.toDate()
                    }
                }
                if(policyDateSearch){
                    //Created in previous 90 days. application part of filter will refine the filter to exact match.
                    if(!endDateMoment){
                        endDateMoment = moment();
                    }

                    matchClause.createdAt = {
                        $gte: startDateMoment.add(-90,"d").toDate(),
                        $lte: endDateMoment.toDate()
                    }
                }
                else if(policyDateExpiredSearch){
                    //Created in previous 90 days. application part of filter will refine the filter to exact match.
                    // we only do annual policies - 2021-08-31
                    if(!endDateMoment){
                        endDateMoment = moment();
                    }
                    matchClause.createdAt = {
                        $gte: startDateMoment.add(-1,"y").add(-90,"d").toDate(),
                        $lte: endDateMoment.add(-1,"y").toDate()
                    }

                }
                else if(modifiedSearch) {
                    matchClause.updatedAt = dateQuery
                }
                else {
                    matchClause.createdAt = dateQuery
                }

                // let policyDateSearch = false;
                // let policyDateExpiredSearch = false;
                // let modifiedSearch = false;


                if(req.params.searchText.toLowerCase().startsWith("iq:")){
                    const searchWords2 = req.params.searchText.split(" ");
                    const insurerStatusIdText = searchWords2[0].substring(3);
                    req.params.searchText = '';
                    if(searchWords2.length > 1){
                        //reset searchtext to remove insurer

                        searchWords2.forEach((searchWord,index) => {
                            if(index > 0){
                                req.params.searchText += ' ' + searchWord;
                            }
                        })
                        req.params.searchText = req.params.searchText.trim();
                    }

                    try{
                        log.debug(`quoteStatus filter ${insurerStatusIdText}`)
                        const quoteStatusId = parseInt(insurerStatusIdText,10);
                        if(typeof quoteStatusId === 'number'){
                            matchClause.quoteStatusId = quoteStatusId
                        }
                    }
                    catch(err){
                        log.info(`bad iq parameter ${insurerStatusIdText} ` + __location);
                    }
                }
                log.debug('Insurer match clause ' + JSON.stringify(matchClause))
                const applicationIdJSONList = await Quote.aggregate([
                    {$match: matchClause},
                    {$group: {
                        _id: {
                            applicationId: '$applicationId'
                        },
                        count: {$sum: 1}
                    }},
                    {"$replaceRoot": {
                        "newRoot": {
                            "$mergeObjects": [{"count": "$count"}, "$_id"]
                        }
                    }},
                    {$project: {
                        applicationId: 1
                    }}
                ])
                if(applicationIdJSONList && applicationIdJSONList.length > 0){
                    log.debug('adding insurer application ids ' + __location)
                    // eslint-disable-next-line prefer-const
                    let applicationIdArray = []
                    applicationIdJSONList.forEach((applicationIdJSON) => {
                        applicationIdArray.push(applicationIdJSON.applicationId);
                    });
                    query.applicationId = {$in: applicationIdArray};
                }
                else {
                    log.debug(`no quote hits for insurer ${insurerId} ` + __location);
                    // match sure no applications go back
                    query.applicationId = "asdf";
                }
            }
            else {
                // match sure no applications go back
                query.applicationId = "asdf";
            }
        }
        catch(err){
            log.error(`application search on Insurer error ${err}` + __location)
        }

    }
    if(req.params.searchText && req.params.searchText.toLowerCase().indexOf("handledbytalage") > -1){
        noCacheUse = true;
        query.handledByTalage = true;
        req.params.searchText = req.params.searchText.replace("handledbytalage", "").trim();
    }
    //let skiprenewals = false;
    if(req.params.searchText && req.params.searchText.toLowerCase().indexOf("skiprenewals") > -1){
        noCacheUse = true;
        query.renewal = {$ne: true};
        req.params.searchText = req.params.searchText.replace("skiprenewals", "").trim()
    }

    if(req.params.searchText.length === 1 && req.params.searchText.search(/\W/) > -1){
        req.params.searchText = '';
    }

    // ================================================================================
    // Build the Mongo $OR array
    // eslint-disable-next-line array-element-newline
    const productTypeList = ["WC","GL", "BOP", "CYBER", "PL"];
    // Add a text search clause if requested
    if (req.params.searchText && req.params.searchText.length > 1){
        noCacheUse = true;
        if(productTypeList.indexOf(req.params.searchText.toUpperCase()) > -1){
            orClauseArray.push({"policies.policyType":  req.params.searchText.toUpperCase()})

            //remove ProductType code if it is a standalone word.
        }
        const industryCodeBO = new IndustryCodeBO();
        // eslint-disable-next-line prefer-const
        let industryCodeQuery = {};
        if(req.params.searchText.length > 2){
            industryCodeQuery.description = req.params.searchText
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
        }

        req.params.searchText = req.params.searchText.toLowerCase();

        const businessName = {businessName: `%${req.params.searchText}%`}
        const dba = {dba: `%${req.params.searchText}%`}
        orClauseArray.push(businessName);
        orClauseArray.push(dba);

        const mailingCity = {mailingCity: `%${req.params.searchText}%`}
        orClauseArray.push(mailingCity);

        if(req.params.searchText.length === 2){
            const mailingState = {mailingState: `%${req.params.searchText}%`}
            orClauseArray.push(mailingState);
        }

        if(req.params.searchText.length > 2){
            const uuid = {uuid: `%${req.params.searchText}%`}
            orClauseArray.push(uuid);
            const agencyCode = {agencyCode: `%${req.params.searchText}%`}
            orClauseArray.push(agencyCode);
        }

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
    //agency search has to be after insurer search

    // Filter out any agencies with do_not_report value set to true
    try{

        if(req.authentication.isAgencyNetworkUser){
            query.agencyNetworkId = agencyNetworkId;
            const agencyBO = new AgencyBO();
            // eslint-disable-next-line prefer-const
            let agencyQuery = {
                doNotReport: true,
                agencyNetworkId: agencyNetworkId
            }
            // eslint-disable-next-line prefer-const
            let donotReportAgencyIdArray = []
            //use agencybo method that does redis caching.
            const noReportAgencyList = await agencyBO.getByAgencyNetworkDoNotReport(agencyNetworkId);
            if(noReportAgencyList && noReportAgencyList.length > 0){
                for(const agencyJSON of noReportAgencyList){
                    donotReportAgencyIdArray.push(agencyJSON.systemId);
                }
                if (donotReportAgencyIdArray.length > 0) {
                    query.agencyId = {$nin: donotReportAgencyIdArray};
                }
            }
            if(req.params.searchText.length > 2){
                agencyQuery.name = req.params.searchText + "%"
                agencyQuery.doNotReport = false;
                const noActiveCheck = true;
                const donotGetAGencyNetowork = false;
                const agencyList = await agencyBO.getList(agencyQuery,donotGetAGencyNetowork, noActiveCheck).catch(function(err) {
                    log.error("Agency List load error " + err + __location);
                    error = err;
                });
                if (agencyList && agencyList.length > 0) {
                    // eslint-disable-next-line prefer-const
                    let agencyIdArray = [];
                    for (const agency of agencyList) {
                        agencyIdArray.push(agency.systemId);
                        //prevent in from being too big.
                        if(agencyIdArray.length > 100){
                            break;
                        }
                    }
                    agencyIdArray = agencyIdArray.filter(function(value){
                        return donotReportAgencyIdArray.indexOf(value) === -1;
                    });
                    const agencyListFilter = {agencyId: {$in: agencyIdArray}};
                    orClauseArray.push(agencyListFilter);
                }
                else {
                    log.debug("Application Search no agencies found " + __location);
                }
            }
        }
        else {
            // Get the agents that we are permitted to view
            const agents = await auth.getAgents(req).catch(function(e){
                error = e;
            });
            if(error){
                return next(error);
            }
            query.agencyId = agents[0];
            if(query.agencyId === 12){
                query.solepro = true;
            }
        }
        if(req.params.searchApplicationStatus){
            query.status = req.params.searchApplicationStatus;
        }
    }
    catch(err){
        log.error("AP get App list error " + err + __location);
    }


    // Add a application status search clause if requested
    if (req.params.searchApplicationStatus && req.params.searchApplicationStatus.length > 0){
        const status = {status: req.params.searchApplicationStatus}
        orClauseArray.push(status);
    }

    // eslint-disable-next-line prefer-const
    let requestParms = JSON.parse(JSON.stringify(req.params));

    let applicationsSearchCount = 0;
    let applicationsTotalCount = 0;
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

        // query object is altered in getAppListForAgencyPortalSearch
        const countQuery = JSON.parse(JSON.stringify(query))
        const applicationsSearchCountJSON = await applicationBO.getAppListForAgencyPortalSearch(countQuery, orClauseArray,{count: 1, page: requestParms.page}, applicationsTotalCount, noCacheUse)
        applicationsSearchCount = applicationsSearchCountJSON.count;
        applicationList = await applicationBO.getAppListForAgencyPortalSearch(query,orClauseArray,requestParms, applicationsSearchCount, noCacheUse);
        for (const application of applicationList) {
            application.business = application.businessName;
            application.agency = application.agencyId;
            application.date = application.createdAt;
            if(application.mailingCity){
                application.location = `${application.mailingCity}, ${application.mailingState} ${application.mailingZipcode} `
            }
            else {
                application.location = "";
            }
        }

    }
    catch(err){
        log.error(`Error Getting application doc JSON.stringify(requestParms) JSON.stringify(query) error:` + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(returnCSV === true){
        const csvData = await generateCSV(applicationList).catch(function(e){
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
        const endMongo = moment();
        const diff = endMongo.diff(start, 'milliseconds', true);
        log.info(`AP Get Application List CSV duration: ${diff} milliseconds for query ${JSON.stringify(query)} noCacheUse ${noCacheUse} ` + __location);
        return next();

    }
    else {
        // Exit with default values if no applications were received
        if (!applicationList || !applicationList.length){
            // Removed applicationsTotalCount after Sept 1st, 2021
            res.send(200, {
                "applications": [],
                "applicationsSearchCount": 0,
                "applicationsTotalCount": 1
            });
            return next();
        }


        // Build the response
        // Removed applicationsTotalCount after Sept 1st, 2021
        const response = {
            "applications": applicationList,
            "applicationsSearchCount": applicationsSearchCount,
            "applicationsTotalCount": 1
        };
        // Return the response
        res.send(200, response);
        const endMongo = moment();
        const diff = endMongo.diff(start, 'milliseconds', true);
        log.info(`AP Get Application List duration: ${diff} milliseconds for query ${JSON.stringify(query)} orClauseArray ${JSON.stringify(orClauseArray)} noCacheUse ${noCacheUse}  request parms ${JSON.stringify(initialRequestParms)}` + __location);
        return next();
    }
}

/**
 * Populates the resources object with insurers and policies
 *
 * @param {object} resources - Resources Object to be decorated
 * @param {array} insurerIdArray - Array of insurer ids
 *
 * @returns {void}
 */
async function populateInsurersAndPolicies(resources, insurerIdArray){
    const insurerBO = new InsurerBO();
    const insurerPolicyTypeBO = new InsurerPolicyTypeBO();
    const query = {"insurerId": insurerIdArray};
    const insurerDBJSONList = await insurerBO.getList(query);
    if(insurerDBJSONList.length > 0){
        const insurerList = insurerDBJSONList.map(insurerObj => ({name: insurerObj.name, insurerId: insurerObj.insurerId, slug: insurerObj.slug}));
        // sort list by name
        const sortFunction = function(firstInsurerObj, secondInsurerObj){
            // sort alphabetically
            if(firstInsurerObj.name > secondInsurerObj.name){
                return 1;
            }
            if(firstInsurerObj.name < secondInsurerObj.name){
                return -1;
            }
            return 0;
        }
        const sortedInsurerList = insurerList.sort(sortFunction);
        resources.insurers = sortedInsurerList;
        const queryPT =
        {
            "wheelhouse_support": true,
            insurerId: insurerIdArray
        };
        const insurerPtDBList = await insurerPolicyTypeBO.getList(queryPT);
        let listOfPolicies = [];
        if(insurerPtDBList?.length > 0){
            // just map them to a policy type list, so WC, CYBER, GL ...
            listOfPolicies = insurerPtDBList.map(insurerPolicyType => insurerPolicyType.policy_type);
        }
        // lets go ahead and grab the unique values for policy types and store in the policy type selections list
        if(listOfPolicies.length > 0){
            const productTypeSelections = [];
            // push policy type to the productTypeSelections if it isn't in the list, ensures no duplicate values
            for(let i = 0; i < listOfPolicies.length; i++){
                const policyType = listOfPolicies[i];
                if(productTypeSelections.indexOf(policyType) === -1){
                    productTypeSelections.push(policyType);
                }
            }
            if(productTypeSelections.length > 0){
                resources.productTypeSelections = productTypeSelections;
            }
        }
    }
}

/**
 * Responds to get requests for the get resources endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getApplicationsResources(req, res, next){
    const resources = {};
    let error = null;
    // determine if signed in is an agencyNetwork User or agency user
    const isAgencyNetworkUser = req.authentication.isAgencyNetworkUser;

    // our default list, if or when we add a new product, add it to this const list
    const defaultProductTypeFilters =
        [
            "WC",
            "GL",
            "BOP",
            "CYBER",
            "PL"
        ];

    resources.productTypeSelections = defaultProductTypeFilters;

    // if login is agency network grab the id
    if(isAgencyNetworkUser === true){
        const agencyNetworkId = req.authentication.agencyNetworkId;
        try{
            // grab the agencyNetworkDB
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetworkJSON = await agencyNetworkBO.getById(agencyNetworkId).catch(function(err) {
                log.error(`agencyNetworkBO load error for agencyNetworkId ${agencyNetworkId} ${err} ${__location}`);
                error = err;
            });
            if (error) {
                return next(error);
            }
            // grab all the insurers for this agency network
            const insurerIdArray = agencyNetworkJSON.insurerIds;
            // add insurers and policies to the resources
            if(insurerIdArray.length > 0){
                await populateInsurersAndPolicies(resources, insurerIdArray);
            }
        }
        catch(err){
            log.error(`Error retrieving Agency Network Insurer and Policies List for agency network id: ${agencyNetworkId}` + err + __location);
        }
    }
    else {
        // grab the list of agencies from the req.authentication
        const listOfAgencyIds = req.authentication.agents;
        // make sure we got agencyIds back, safety check, in this flow should always be 1 but even if more we just grab the first one
        if(listOfAgencyIds?.length > 0){
            const agencyLocationBO = new AgencyLocationBO();
            let locationList = [];
            // we should only have a single agency id if the req is not agencyNetwork
            // grab the agency
            const agencyId = listOfAgencyIds[0];
            const query = {"agencyId": agencyId}
            const getChildren = true;
            const getAgencyName = false;
            const useAgencyPrimeInsurers = true;
            const insurerIdArray = [];
            try {
                // grab all the locations for an agency
                locationList = await agencyLocationBO.getList(query, getAgencyName, getChildren, useAgencyPrimeInsurers).catch(function(err){
                    log.error(`Could not get agency locations for agencyId ${agencyId} ` + err.message + __location);
                    error = err;
                });
                if (error) {
                    return next(error);
                }
                // iterate through each location and grab the insurerId
                for(let i = 0; i < locationList.length; i++){
                    const locationObj = locationList[i];
                    if(locationObj?.insurers && locationObj?.insurers?.length > 0){
                        // grab all the insurers
                        const locationInsurers = locationObj.insurers;
                        // for each insurer grab their id and push into insurerId Array
                        for(let j = 0; j < locationInsurers.length; j++){
                            const insurer = locationInsurers[j];
                            // if the id doesn't exist in the isnurerIdArray then add it to the list
                            if(insurerIdArray.indexOf(insurer.insurerId) === -1){
                                insurerIdArray.push(insurer.insurerId);
                            }
                        }
                    }
                }
                if(insurerIdArray.length > 0){
                    await populateInsurersAndPolicies(resources, insurerIdArray);
                }
            }
            catch(err){
                log.error(`Error retrieving Agency Insurer and Policies List for agency id: ${agencyId}` + err + __location);
            }
        }
        else{
            log.error(`Error,  req.authentication.agents is returning empty agency list: ${JSON.stringify(req.authentication.agents)} ${__location}`)
        }
    }
    // Add date filters
    const dateFilters = [
        {
            label: 'Created Date',
            value: ''
        },
        {
            label: 'Modified Date',
            value: 'md:'
        },
        {
            label: 'Policy Effective Date',
            value: 'pd:'
        },
        {
            label: 'Policy Expiration Date',
            value: 'pde:'
        }
    ]
    resources.dateFilters = dateFilters;
    // Add Skip Filters
    const skipFilters = [{label: 'Renewals', value: 'skiprenewals'}, {label: 'System Generated', value: 'system'}]
    resources.skipFilters = skipFilters;

    // Add quoteStatusSelections
    const quoteStatusSelections =
    [
        {label: "Errored", value:"iq:10"},
        {label: "Auto Declined", value:"iq:15"},
        {label: "Declined", value:"iq:20"},
        {label: "Acord Emailed", value:"iq:30"},
        {label: "Referred", value:"iq:40"},
        {label: "Quoted", value:"iq:50"},
        {label: "Referred Quoted", value:"iq:55"},
        {label: "Bind Requested", value:"iq:60"},
        {label: "Bind Requested For Referral", value:"iq:65"},
        {label: "Bound", value:"iq:100"}
    ]
    resources.quoteStatusSelections = quoteStatusSelections;
    // return the resources
    res.send(200, resources);
    return next();

}

exports.registerEndpoint = (server, basePath) => {
    server.addPostAuth('Get applications', `${basePath}/applications`, getApplications, 'applications', 'view');
    server.addGetAuth('Get applications', `${basePath}/applications`, getApplications, 'applications', 'view');
    server.addGetAuth('Get applications list view resources', `${basePath}/applications/resources`, getApplicationsResources, 'applications', 'view');
};