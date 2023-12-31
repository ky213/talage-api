/* eslint-disable array-element-newline */
/* eslint-disable object-property-newline */
/* eslint-disable object-curly-newline */
/* eslint-disable no-extra-parens */
'use strict';
const auth = require('./helpers/auth-agencyportal.js');
const csvStringify = require('csv-stringify');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const zipcodeHelper = global.requireShared('./helpers/formatZipcode.js');
const moment = require('moment');
const serverHelper = global.requireRootPath('server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const ApplicationBO = global.requireShared('models/Application-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const IndustryCodeBO = global.requireShared('./models/IndustryCode-BO.js');
const InsurerBO = global.requireShared('./models/Insurer-BO.js');
const Quote = global.mongoose.Quote;
const InsurerPolicyTypeBO = global.requireShared('models/InsurerPolicyType-BO.js');
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const AgencyLocationBO = global.requireShared("models/AgencyLocation-BO.js");
const AgencyPortalUserBO = global.requireShared("./models/AgencyPortalUser-BO.js");
const {applicationStatus} = global.requireShared('./models/status/applicationStatus.js');
const TerritoryBO = global.requireShared('./models/Territory-BO.js');

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
        if (Object.prototype.hasOwnProperty.call(expectedParameter, 'values') && !expectedParameter.values.includes(parameterValue) && expectedParameter.optional !== true){
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
 * calculates application value from metrics
 * @param {object} applicationDoc - The list of parameters to validate
 * @return {string} empty string or formated application value
 */
function getAppValueString(applicationDoc){
    if(applicationDoc.metrics){
        var formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
            // These options are needed to round to whole numbers if that's what you want.
            //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
            //maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
        });

        if(applicationDoc.metrics?.appValue > 0){
            return formatter.format(applicationDoc.metrics.appValue);
        }
        else{
            let appValueDollars = 0;
            //update record so it is searchable.
            // eslint-disable-next-line no-unused-vars
            const productTypeList = ["WC", "GL", "BOP", "CYBER", "PL"];
            try{
                for(let i = 0; i < productTypeList.length; i++){
                    if(applicationDoc.metrics?.lowestBoundQuoteAmount[productTypeList[i]]){
                        appValueDollars += applicationDoc.metrics.lowestBoundQuoteAmount[productTypeList[i]]
                    }
                    else if (applicationDoc.metrics?.lowestQuoteAmount[productTypeList[i]]){
                        appValueDollars += applicationDoc.metrics.lowestQuoteAmount[productTypeList[i]]
                    }
                }
            }
            catch(err){
                log.error(`getAppValueString error AppId ${applicationDoc.applicationId} error: ${err}` + __location);
            }
            if(appValueDollars > 0){
                //do not await - write can take place in background.
                const appBO = new ApplicationBO();
                appBO.recalculateQuoteMetrics(applicationDoc.applicationId);
                return formatter.format(appValueDollars);
            }
            else {
                return "";
            }
        }
    }
    else {
        return "";
    }
}

/**
 * Generate a CSV file of exported application data
 *
 * @param {array} applicationList - The list of appplication to put in CSV
 * @param {boolean} isGlobalViewMode - true if in GlobalViewMode
 * @param {boolean} showAgencyTierColumns - show/hide AgencyTierColumns
 * @returns {Promise.<String, Error>} A promise that returns a string of CSV data on success, or an Error object if rejected
 */
function generateCSV(applicationList, isGlobalViewMode, showAgencyTierColumns){
    return new Promise(async(fulfill, reject) => {


        // Define the different statuses and their user-friendly values
        // const statusMap = {
        //     'acord_sent': 'ACORD form sent',
        //     'bound': 'Bound',
        //     'declined': 'Declined',
        //     'error': 'Error',
        //     'incomplete': 'Incomplete',
        //     'acord_emailed': 'Acord Emailed',
        //     'quoting': 'Quoting',
        //     'quoted': 'Quoted',
        //     'quoted_referred': 'Quoted (referred)',
        //     'questions_done': 'Questions Done',
        //     'referred': 'Referred',
        //     'request_to_bind': 'Request to bind',
        //     'request_to_bind_referred': 'Request to bind (referred)',
        //     'wholesale': 'Wholesale',
        //     'out_of_market': 'Out Of Market',
        //     'dead': 'Dead'
        // };

        // If no data was returned, stop and alert the user
        if(!applicationList){
            log.info('There are no applications to export');
            reject(serverHelper.requestError('There are no applications to export. Please try again when there are some applications in your account.'));
            return;
        }
        if(!applicationList || applicationList?.length === 0){
            log.info('There are no applications to export');
            reject(serverHelper.requestError('There are no applications to export. Please try again when there are some applications in your account.'));
            return;
        }

        // Process the returned data
        for(const applicationDoc of applicationList){
            try{

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
                for(const appStatusProp in applicationStatus){
                    if(applicationDoc.status === applicationStatus[appStatusProp].appStatusDesc){
                        applicationDoc.status = applicationStatus[appStatusProp].appStatusText;
                    }
                }
                // else{
                //     applicationDoc.status = 'Unknown';
                // }
                // if(applicationDoc.renewal === true){
                //     applicationDoc.renewal = "Yes";
                // }
                // applicationDoc.appValue = getAppValueString(applicationDoc);

                const createdAtMoment = moment(applicationDoc.createdAt)
                applicationDoc.createdString = createdAtMoment.format("YYYY-MM-DD hh:mm");

                if(applicationDoc.policyEffectiveDate){
                    const policyEffectiveDateMoment = moment(applicationDoc.policyEffectiveDate)
                    applicationDoc.policyDateString = policyEffectiveDateMoment.format("YYYY-MM-DD");
                }

                // get referrer information, if none then default to agency portal
                if(!applicationDoc.referrer){
                    applicationDoc.referrer = 'Agency Portal';
                }

                // Remove the EIN from the application doc.
                // With this change, the EIN column is removed
                if(applicationDoc.einClear){
                    delete applicationDoc.einClear;
                }
            }
            catch(err){
                log.error(`CSV App row processing error ${err}` + __location)
            }
        }

        // Define the columns (and column order) in the CSV file and their user friendly titles
        let columns = {}
        log.debug(`CSV isGlobalViewMode ${isGlobalViewMode}` + __location)
        if(isGlobalViewMode){
            columns = {
                'businessName': 'Business Name',
                'dba': 'DBA',
                'status': 'Application Status',
                'policyTypes': "Policy Types",
                'policyDateString': "Effective Date (UTC)",
                'appValue': 'Application Value',
                'agencyNetworkName': 'Network',
                'agencyName': 'Agency',
                'agencyId': 'Agency ID',
                'agencyState': 'Agency State',
                'agencyPortalCreatedUser': 'Agency Portal User',
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
                'website': 'Website',
                "industry": "Industry",
                "naics": "naics",
                'renewal': 'renewal',
                'tagString': "tag",
                'lastPage': "Last Page Saved",
                'marketingChannel': "Marketing Channel",
                'createdString' : 'Created (UTC)',
                'agencyCreatedAt' : 'Agency Added (UTC)'
            };

        }
        else {
            columns = {
                'businessName': 'Business Name',
                'dba': 'DBA',
                'status': 'Application Status',
                'policyTypes': "Policy Types",
                'policyDateString': "Effective Date",
                'appValue': 'Application Value',
                'agencyName': 'Agency',
                'agencyPortalCreatedUser': 'Agency Portal User',
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
                'website': 'Website',
                "industry": "Industry",
                "naics": "naics",
                'renewal': 'renewal',
                'tagString': "tag",
                'lastPage': "Last Page Saved",
                'createdString' : 'Created (UTC)',
                'agencyCreatedAt' : 'Agency Added (UTC)'
            };
        }

        // Add the AgencyTierFields in the columns
        if(showAgencyTierColumns) {
            columns.agencyTierName = 'Agency Tier Name';
        }

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
            log.info(`Finishing CSV output ` + __location)
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
            "name": 'searchApplicationStatusId',
            "type": 'number',
            "optional": true
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
                'dead'],
            "optional": true
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
        },
        {
            "name": 'tagString',
            "type": 'string',
            "optional": true
        },
        {
            "name": 'appValue',
            "type": 'number',
            "optional": true
        },
        {
            "name": 'agencyId',
            "type": 'number',
            "optional": true
        },
        {
            "name": 'agencyNetworkId',
            "type": 'number',
            "optional": true
        },
        {
            "name": 'state',
            "type": 'string',
            "optional": true
        },
        {
            "name": 'policyTypeCd',
            "type": 'string',
            "optional": true
        },
        {
            "name": 'insurerSlug',
            "type": 'string',
            "optional": true
        },
        {
            "name": 'insurerQuoteStatusId',
            "type": 'number',
            "optional": true
        }
    ];

    // Validate the parameters
    if (returnCSV === false && !validateParameters(req.params, expectedParameters)){
        return next(serverHelper.requestError('Bad Request: missing expected parameter'));
    }
    // All parameters and their values have been validated at this point -SFv

    let startDateMoment = null;
    let endDateMoment = null;

    //Fix bad dates coming in.
    if(req.params.startDate){
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

    if((req.params.insurerSlug && req.params.insurerSlug.length > 1) || req.params.insurerQuoteStatusId > -1
        || (req.params.quoteNumber && req.params.quoteNumber.length > 2)){
        noCacheUse = true;
        log.debug("Insurer Search")
        try{
            let insurerId = 0;
            let runQuoteQuery = false;
            const matchClause = {
                active: true
            }
            //if string (insure name)
            if(req.params.insurerSlug){
                const insurerText = req.params.insurerSlug
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
                    matchClause.insurerId = insurerId;
                    runQuoteQuery = true;
                }
            }

            if(req.params.insurerQuoteStatusId > -1){
                try{
                    const quoteStatusId = parseInt(req.params.insurerQuoteStatusId,10);
                    if(typeof quoteStatusId === 'number'){
                        matchClause.quoteStatusId = quoteStatusId
                        runQuoteQuery = true;
                    }
                }
                catch(err){
                    log.info(`bad iq parameter ${req.params.insurerQuoteStatusId} ` + __location);
                }
            }
            if(req.params.quoteNumber && req.params.quoteNumber.length > 2){
                matchClause.quoteNumber = req.params.quoteNumber;
                runQuoteQuery = true;
            }

            if(runQuoteQuery){

                //create match
                // eslint-disable-next-line prefer-const

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

    if(req.body.agencyId){
        noCacheUse = true;
        modifiedSearch = true;
        query.agencyId = req.body.agencyId;
    }

    if(req.body.state){
        noCacheUse = true;
        modifiedSearch = true;
        query.primaryState = req.body.state;
    }

    if(req.params.searchText.length === 1 && req.params.searchText.search(/\W/) > -1){
        req.params.searchText = '';
    }

    // ================================================================================
    // Build the Mongo $OR array
    // eslint-disable-next-line array-element-newline
    if(req.params.policyTypeCd && req.params.policyTypeCd.length > 1){
        query.policies = {};
        query.policies.policyType = req.params.policyTypeCd.toUpperCase();
    }

    const productTypeList = ["WC","GL", "BOP", "CYBER", "PL"];
    // Add a text search clause if requested
    if (req.params.searchText && req.params.searchText.length > 1){
        noCacheUse = true;
        if(productTypeList.indexOf(req.params.searchText.toUpperCase()) > -1 && !req.params.policyTypeCd){
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

    //Tag from advanced filter should not be an OR. It should act as a filter. therefore it is an AND. - BP
    //tag should be a hard match not a substring match. - BP
    if (req.params.tagString && req.params.tagString.length > 1) {
        //const tag = {tagString: `%${req.params.tagString}%`}
        //orClauseArray.push(tag);
        query.tagString = req.params.tagString;
    }

    if (req.params.appValue && req.params.appValue > 0) {
        //$GTE handled in BO.
        query.appValue = req.params.appValue;
    }

    //agency search has to be after insurer search

    // Filter out any agencies with do_not_report value set to true
    let agencyNetworkList = [];

    const agencyNetworkBO = new AgencyNetworkBO();
    agencyNetworkList = await agencyNetworkBO.getList({});

    let isGlobalViewMode = false;
    // show/hide AgencyTierFields (User Permission)
    let showAgencyTierColumns = false;
    try{
        if(req.authentication.isAgencyNetworkUser){
            if(req.authentication.isAgencyNetworkUser && agencyNetworkId === 1
                && req.authentication.permissions.talageStaff === true
                && req.authentication.enableGlobalView === true){
                isGlobalViewMode = true;

                // Show AgencyTierColumns by default for GlobalViewMode
                showAgencyTierColumns = true;
                //Global View Check for filtering on agencyNetwork
                if(req.body.agencyNetworkId){
                    noCacheUse = true;
                    modifiedSearch = true;
                    //make sure it is an integer or set it to -1 so there are no matches.
                    query.agencyNetworkId = parseInt(req.params.agencyNetworkId,10) ? parseInt(req.params.agencyNetworkId,10) : -1;
                }
            }

            if(isGlobalViewMode === false){
                query.agencyNetworkId = agencyNetworkId;
                if(req.authentication.permissions.talageStaff === true) {
                    // If not GlobalViewMode but is TalageSuperUser
                    try{
                        const agencyNetworkDoc = await agencyNetworkBO.getById(agencyNetworkId);
                        // Determine if the AgencyTierFields should be displayed based on the TalageSuperUser's Agency Network feature_json
                        showAgencyTierColumns = agencyNetworkDoc.feature_json && agencyNetworkDoc.feature_json.showAgencyTierFields === true;
                    }
                    catch(err){
                        log.error(`Get Applications getting agency network document error ${err}` + __location)
                    }
                }
            }
            const agencyBO = new AgencyBO();
            // eslint-disable-next-line prefer-const
            let agencyQuery = {
                doNotReport: true
            }
            if(!isGlobalViewMode){
                agencyQuery.agencyNetworkId = agencyNetworkId
            }
            // eslint-disable-next-line prefer-const
            let donotReportAgencyIdArray = []
            //use agencybo method that does redis caching.
            const noReportAgencyList = await agencyBO.getByAgencyNetworkDoNotReport(agencyNetworkId);
            if(noReportAgencyList && noReportAgencyList?.length > 0){
                for(const agencyJSON of noReportAgencyList){
                    donotReportAgencyIdArray.push(agencyJSON.systemId);
                }
                if (donotReportAgencyIdArray?.length > 0) {
                    // If there is already an agencyId on the request body it will add it as $eq
                    if(query.agencyId){
                        query.agencyId = {$nin: donotReportAgencyIdArray, $eq: query.agencyId}
                    }
                    else {
                        query.agencyId = {$nin: donotReportAgencyIdArray};
                    }
                }
            }
            if(req.params.searchText?.length > 2){
                agencyQuery.name = req.params.searchText + "%"
                agencyQuery.doNotReport = false;
                const noActiveCheck = true;
                const donotGetAGencyNetowork = false;
                const agencyList = await agencyBO.getList(agencyQuery,donotGetAGencyNetowork, noActiveCheck).catch(function(err) {
                    log.error("Agency List load error " + err + __location);
                    error = err;
                });
                if (agencyList && agencyList?.length > 0) {
                    // eslint-disable-next-line prefer-const
                    let agencyIdArray = [];
                    for (const agency of agencyList) {
                        agencyIdArray.push(agency.systemId);
                        //prevent in from being too big.
                        if(agencyIdArray?.length > 100){
                            log.debug(`Get Agency maxed out agency filter` + __location)
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
    }
    catch(err){
        log.error("AP get App list error " + err + __location);
    }

    //Add a application status search clause if requested
    // if (req.params.searchApplicationStatus && req.params.searchApplicationStatus.length > 0){
    //     const status = {status: req.params.searchApplicationStatus}
    //     orClauseArray.push(status);
    // }

    if(req.params.searchApplicationStatus){
        query.status = req.params.searchApplicationStatus;
    }

    if (req.params && Object.prototype.hasOwnProperty.call(req.params,'searchApplicationStatusId') && req.params.searchApplicationStatusId >= 0){
        query.appStatusId = parseInt(req.params.searchApplicationStatusId, 10);
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
        let noCacheUseForTotal = true
        if(query.agencyNetworkId){
            totalQueryJson.agencyNetworkId = query.agencyNetworkId
            noCacheUseForTotal = false
        }
        else if(query.agencyId){
            totalQueryJson.agencyId = query.agencyId
            noCacheUseForTotal = false
        }
        log.debug(`Get applications totalQueryJson ${JSON.stringify(totalQueryJson)}` + __location)
        const applicationsTotalCountJSON = await applicationBO.getAppListForAgencyPortalSearch(totalQueryJson,[],{count: 1}, 0, noCacheUseForTotal);
        applicationsTotalCount = applicationsTotalCountJSON.count;

        // query object is altered in getAppListForAgencyPortalSearch
        log.debug(`Get applications query ${JSON.stringify(query)}` + __location)
        if(returnCSV === true){
            log.info(`CSV Get applications query ${JSON.stringify(query)}` + __location)
        }
        const countQuery = JSON.parse(JSON.stringify(query))
        const applicationsSearchCountJSON = await applicationBO.getAppListForAgencyPortalSearch(countQuery, orClauseArray,{count: 1, page: requestParms.page}, applicationsTotalCount, noCacheUse)
        const agencyPortalUserBO = new AgencyPortalUserBO()

        applicationsSearchCount = applicationsSearchCountJSON.count;
        applicationList = await applicationBO.getAppListForAgencyPortalSearch(query,orClauseArray,requestParms, applicationsSearchCount, noCacheUse);


        for (const application of applicationList) {
            try{
                application.business = application.businessName;
                application.agency = application.agencyId;
                application.date = application.createdAt;
                if(application.mailingCity && application.mailingZipcode?.length > 4){

                    const zipcode = zipcodeHelper.formatZipcode(application.mailingZipcode);
                    application.location = `${application.mailingCity}, ${application.mailingState} ${zipcode} `
                }
                else if(application.mailingCity){
                    application.location = `${application.mailingCity}, ${application.mailingState} `
                }
                else {
                    application.location = "";
                }
                //TODO update when customizeable status description are done.
                const delimiter = ' '
                application.displayStatus = application.status.replace('_referred', '*').replace(/_/g, ' ')
                application.displayStatus = application.displayStatus.toLowerCase().split(delimiter).map((s) => `${s.charAt(0).toUpperCase()}${s.substring(1)}`).join(' ');
                application.displayStatus = application.displayStatus.replace('Uw', 'UW')

                // if(application.agencyNetworkId === 4 && (application.appStatusId === applicationStatus.requestToBind.appStatusId || application.appStatusId === applicationStatus.requestToBindReferred.appStatusId)){
                //     application.status = "submitted_to_uw";
                //     application.displayStatus = 'Submitted To UW';
                // }

                const agencyNetworkDoc = agencyNetworkList.find((an) => an.agencyNetworkId === application.agencyNetworkId)
                if(application.agencyNetworkId > 1 && (application.appStatusId === applicationStatus.requestToBind.appStatusId || application.appStatusId === applicationStatus.requestToBindReferred.appStatusId)){
                    if(application.agencyNetworkId === 4){
                        application.status = "submitted_to_uw";
                        // quoteJSON.status = "Submitted To UW";
                        application.displayStatus = 'Submitted To UW';
                    }
                    else if(agencyNetworkDoc?.featureJson?.requestToBindProcessedText.length > 3 && application.appStatusId === applicationStatus.requestToBind.appStatusId){
                        application.displayStatus = agencyNetworkDoc.featureJson.requestToBindProcessedText;
                    }
                    else if(agencyNetworkDoc?.featureJson?.requestToBindReferredProcessedText.length > 3 && application.appStatusId === applicationStatus.requestToBindReferred.appStatusId){
                        application.displayStatus = agencyNetworkDoc.featureJson.requestToBindReferredProcessedText;
                    }
                }
                if(isGlobalViewMode){
                    // Add AgencyNetworkName AND Show/Hide AgencyTierFields based on the Application's AgencyNetwork feature_json config of showAgencyTierFields
                    let showAgencyTierFields = false;
                    if(agencyNetworkDoc){
                        application.agencyNetworkName = agencyNetworkDoc.name;
                        application.marketingChannel = agencyNetworkDoc.marketingChannel;
                        showAgencyTierFields = agencyNetworkDoc.feature_json && agencyNetworkDoc.feature_json.showAgencyTierFields === true;
                    }
                    // If no AgencyNetworkDoc or the showAgencyTierFields is false, then remove AgencyTierFields from the list
                    if(!showAgencyTierFields && application.hasOwnProperty('agencyTierName')) {
                        delete application.agencyTierName;
                    }
                }
                // If not GlobalViewMode AND hide AgencyTierColumns (not TalageSuperUser OR TalageSuperUser's Agency Network showAgencyTierFields from feature_json is false), then remove AgencyTierFields from the list
                else if(!showAgencyTierColumns && application.hasOwnProperty('agencyTierName')){
                    delete application.agencyTierName;
                }

                application.renewal = application.renewal === true ? "Yes" : "";
                application.appValue = getAppValueString(application);

                // fill agency portal user data
                if(returnCSV && application.agencyPortalCreated && parseInt(application.agencyPortalCreatedUser,10)){
                    const agencyPortalUser = await agencyPortalUserBO.getById(parseInt(application.agencyPortalCreatedUser,10))

                    if(agencyPortalUser?.firstName && agencyPortalUser?.lastName){
                        application.agencyPortalCreatedUser = `${agencyPortalUser.firstName} ${agencyPortalUser.lastName}`
                    }
                    else{
                        application.agencyPortalCreatedUser = agencyPortalUser?.email
                    }
                }
            }
            catch(err){
                log.error(`Error Processing application doc ${application.applicationId} requestParms: ${JSON.stringify(requestParms)} query: ${JSON.stringify(query)} error:` + err + __location)
                return next(serverHelper.requestError(`Bad Request: check error ${err}`));
            }
        }
    }
    catch(err){
        log.error(`Error Getting application doc requestParms: ${JSON.stringify(requestParms)} query: ${JSON.stringify(query)} error:` + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(returnCSV === true){
        try{
            log.info(`Starting CSV output for ${applicationList.length} applications` + __location)
            const csvData = await generateCSV(applicationList, isGlobalViewMode, showAgencyTierColumns).catch(function(e){
                error = e;
            });
            if(error){
                return next(error);
            }

            // Set the headers so the browser knows we are sending a CSV file
            res.writeHead(200, {
                'Content-Disposition': 'attachment; filename=applications.csv',
                'Content-Length': csvData?.length,
                'Content-Type': 'text-csv'
            });

            // Send the CSV data
            res.end(csvData);
            log.info(`Finished CSV response for ${applicationList.length} applications` + __location)
            const endMongo = moment();
            const diff = endMongo.diff(start, 'milliseconds', true);
            log.info(`AP Get Application List CSV duration: ${diff} milliseconds for query ${JSON.stringify(query)} noCacheUse ${noCacheUse} ` + __location);
        }
        catch(err){
            log.error(`AP App Export error ${err}` + __location);
        }
        return next();

    }
    else {
        // Exit with default values if no applications were received
        if (!applicationList || !applicationList?.length){
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
    if(insurerDBJSONList?.length > 0){
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
        if(listOfPolicies?.length > 0){
            const productTypeSelections = [];
            // push policy type to the productTypeSelections if it isn't in the list, ensures no duplicate values
            for(let i = 0; i < listOfPolicies.length; i++){
                const policyType = listOfPolicies[i];
                if(productTypeSelections.indexOf(policyType) === -1){
                    productTypeSelections.push(policyType);
                }
            }
            if(productTypeSelections?.length > 0){
                resources.productTypeSelections = productTypeSelections;
            }
        }
    }
}

/**
 * Get the territories needed on the application filter resources
 *
 * @returns {array} List of all territories
 */
async function getTerritories(){
    const territoryBO = new TerritoryBO();
    try {
        const allTerritories = await territoryBO.getAbbrNameList();
        return allTerritories;
    }
    catch(error){
        log.error('DB query for territories list failed: ' + error.message + __location);
    }
}

/**
 * Get the agency network list for talageStaff and for Global View
 * @param {object} authentication - Authentication properties
 * @returns {array} List of all territories
 */
async function getAgencyNetworkList(authentication) {
    const agencyNetworkId = parseInt(authentication.agencyNetworkId, 10);
    let agencyNetworkList = [];
    if(authentication.isAgencyNetworkUser && agencyNetworkId === 1
			&& authentication.permissions.talageStaff
			&& authentication.enableGlobalView){
        try{
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetworks = await agencyNetworkBO.getList({});
            agencyNetworkList = agencyNetworks.map(agencyNetwork => ({
                'agencyNetworkId': agencyNetwork.agencyNetworkId,
                'brandName': agencyNetwork.brandName
            }));
        }
        catch(error){
            log.error(`Get Agency Network List Error ${error}` + __location)
        }
    }
    return agencyNetworkList;
}

/**
 * Populates the resources object with states and agency networks
 * @param {object} resources - Resources Object to be decorated
 * @param {object} authentication - Authentication properties
 * @returns {void}
 */
async function populateStatesAndAgencyNetwork(resources, authentication){
    try {
        resources.states = await getTerritories();
    }
    catch{
        // Log of getTerritories shows up
    }

    try{
        resources.agencyNetworkList = await getAgencyNetworkList(authentication);
    }
    catch {
        // Log of agencyNetworkList shows up
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
    const agencyNetworkBO = new AgencyNetworkBO();
    let agencyNetworkJSON = null;
    if(isAgencyNetworkUser === true){
        const agencyNetworkId = req.authentication.agencyNetworkId;
        try{
            // grab the agencyNetworkDB
            agencyNetworkJSON = await agencyNetworkBO.getById(agencyNetworkId).catch(function(err) {
                log.error(`agencyNetworkBO load error for agencyNetworkId ${agencyNetworkId} ${err} ${__location}`);
                error = err;
            });
            if (error) {
                return next(error);
            }
            // grab all the insurers for this agency network
            const insurerIdArray = agencyNetworkJSON.insurerIds;
            // add insurers and policies to the resources
            if(insurerIdArray?.length > 0){
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
                if(locationList?.length){
                    // iterate through each location and grab the insurerId
                    for(let i = 0; i < locationList?.length; i++){
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
        {label: "Errored", value:"10"},
        {label: "Auto Declined", value:"15"},
        {label: "Declined", value:"20"},
        {label: "Price Indication", value:"25"},
        {label: "Acord Emailed", value:"30"},
        {label: "Referred", value:"40"},
        {label: "Quoted", value:"50"},
        {label: "Referred Quoted", value:"55"},
        {label: "Bind Requested", value:"60"},
        {label: "Bind Requested For Referral", value:"65"},
        {label: "Bound", value:"100"}
    ]
    resources.quoteStatusSelections = quoteStatusSelections;
    const appStatusIdSearchOptions = [
        {
            text: "All Application Statuses",
            value: -1
        }
    ];

    for(const property in applicationStatus){
        if(property){
            const applicationStatusObj = applicationStatus[property];
            if(applicationStatusObj.hasOwnProperty("appStatusId") && applicationStatusObj.hasOwnProperty("appStatusText")){
                appStatusIdSearchOptions.push({text: applicationStatusObj.appStatusText, value: applicationStatusObj.appStatusId});
            }
        }
    }
    log.debug(`req.authentication.agencyNetworkId ${req.authentication.agencyNetworkId}`)
    if(req.authentication.agencyNetworkId > 1){
        // backward compatibility, can remove next sprint
        let request_to_bind_Text = "Submitted To UW";
        let request_to_bind_referred_Text = "Referred Submitted To UW";
        if(req.authentication.agencyNetworkId !== 4 && agencyNetworkJSON?.featureJson?.requestToBindProcessedText.length > 3){
            request_to_bind_Text = agencyNetworkJSON.featureJson.requestToBindProcessedText
        }

        if(req.authentication.agencyNetworkId !== 4 && agencyNetworkJSON?.featureJson?.requestToBindReferredProcessedSearchText.length > 3){
            request_to_bind_referred_Text = agencyNetworkJSON.featureJson.requestToBindReferredProcessedSearchText
        }

        resources.appStatusSearchOptions = [
            {
                value: '',
                text: 'All Application Statuses'
            },
            {
                value: 'bound',
                text: 'Bound'
            },
            {
                value: 'request_to_bind_referred',
                text: request_to_bind_Text
            },
            {
                value: 'request_to_bind',
                text: request_to_bind_referred_Text
            },
            {
                value: 'quoted',
                text: 'Quoted'
            },
            {
                value: 'quoted_referred',
                text: 'Quoted*'
            },
            {
                value: 'acord_emailed',
                text: 'Acord Emailed'
            },
            {
                value: 'referred',
                text: 'Referred'
            },
            {
                value: 'declined',
                text: 'Declined'
            },
            {
                value: 'error',
                text: 'Error'
            },
            {
                value: 'quoting',
                text: 'Quoting'
            },
            {
                value: 'questions_done',
                text: 'Questions Done'
            },
            {
                value: 'incomplete',
                text: 'Incomplete'
            },
            {
                value: 'dead',
                text: 'Dead'
            }
        ]
        // change request to bind and request to bind* to custom text
        const changeList = [{text: 'Submitted To UW', value: 70}, {text: "Referred Submitted To UW", value: 80}];
        for(let i = 0; i < changeList.length; i++){
            const appStatusId = changeList[i].value;
            const index = appStatusIdSearchOptions.findIndex(option => option.value === appStatusId);
            if(index > -1){
                appStatusIdSearchOptions[index].text = changeList[i].text;
            }
        }
        // remove wholesale
        const wholesaleStatusId = 5;
        const wholesaleIndex = appStatusIdSearchOptions.findIndex(option => option.value === wholesaleStatusId);
        if(wholesaleIndex > -1){
            appStatusIdSearchOptions.splice(wholesaleIndex, 1);
        }
    }
    try {
        await populateStatesAndAgencyNetwork(resources, req.authentication);
    }
    catch {
        log.error(`Error populating the states and agency networks ${error}` + __location)
    }
    resources.appStatusIdSearchOptions = appStatusIdSearchOptions;
    // return the resources
    res.send(200, resources);
    return next();

}

exports.registerEndpoint = (server, basePath) => {
    server.addPostAuth('Get applications', `${basePath}/applications`, getApplications, 'applications', 'view');
    server.addGetAuth('Get applications', `${basePath}/applications`, getApplications, 'applications', 'view');
    server.addGetAuth('Get applications list view resources', `${basePath}/applications/resources`, getApplicationsResources, 'applications', 'view');
};
