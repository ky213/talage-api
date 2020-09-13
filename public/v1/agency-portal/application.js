/* eslint-disable require-jsdoc */
'use strict';
const crypt = global.requireShared('./services/crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const auth = require('./helpers/auth.js');
const serverHelper = require('../../../server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');

/**
 * Responds to get requests for the certificate endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getApplication(req, res, next){
    let error = false;

    // Check for data
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0){
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    // Get the agents that we are permitted to view
    const agents = await auth.getAgents(req).catch(function(e){
        error = e;
    });
    if (error){
        log.error('Error get application getAgents ' + error + __location);
        return next(error);
    }

    // Make sure basic elements are present
    if (!req.query.id){
        log.error('Bad Request: Missing ID ' + __location);
        return next(serverHelper.requestError('Bad Request: You must supply an ID'));
    }

    // Validate the application ID
    if (!await validator.is_valid_id(req.query.id)){
        log.error('Bad Request: Invalid id ' + __location);
        return next(serverHelper.requestError('Invalid id'));
    }

    // Check if this is Solepro and grant them special access
    let where = `${db.quoteName('a.agency')} IN (${agents.join(',')})`;
    if (agents.length === 1 && agents[0] === 12){
        // This is Solepro (no restriction on agency ID, just applications tagged to them)
        where = `${db.quoteName('a.solepro')} = 1`;
    }

    // Define a query for retrieving basic application information
    const sql = `
        SELECT
            a.additional_insured as additionalInsured,
            a.agency,
            a.agency_location,
            a.status,
            a.id,
            a.last_step as lastStep,
            a.solepro,
            a.waiver_subrogation as waiverSubrogation,
            a.years_of_exp as yearsOfExp,
            b.website,
            a.wholesale,
            a.bop_effective_date as businessOwnersPolicyEffectiveDate,
            a.bop_expiration_date as businessOwnersPolicyExpirationDate,
            a.gl_effective_date as generalLiabilityEffectiveDate,
            a.gl_expiration_date as generalLiabilityExpirationDate,
            a.wc_effective_date as workersCompensationEffectiveDate,
            a.wc_expiration_date as workersCompensationExpirationDate,
            a.limits,
            a.wc_limits as wcLimits,
            a.deductible,
            a.coverage_lapse as coverageLapse,
            a.gross_sales_amt,
            a.created,
            ad.unemployment_num as unemploymentNum,
            ag.name as agencyName,
            b.id as businessID,
            b.name as businessName,
            b.dba,
            b.ein,
            b.mailing_address as address,
            b.mailing_address2 as address2,
            b.owners,
            b.founded,
            b.entity_type as entityType,
            b.mailing_city as city,
            b.mailing_state_abbr as territory,
            b.mailing_zipcode as zip,
            c.email,
            c.fname,
            c.lname,
            c.phone,
            ic.description as industryCodeName,
            icc.name as industryCodeCategory,
            a.opted_out_online, 
            a.opted_out_online_emailsent,
            GROUP_CONCAT(apt.policy_type) AS policy_types
        FROM clw_talage_applications as a
			LEFT JOIN clw_talage_application_policy_types as apt ON a.id = apt.application
			LEFT JOIN clw_talage_businesses as b ON a.business = b.id
			LEFT JOIN clw_talage_contacts as c ON c.business = b.id
			LEFT JOIN clw_talage_agencies as ag ON a.agency = ag.id
            LEFT JOIN clw_talage_addresses as ad ON a.business = ad.business AND ad.billing = 1
            LEFT JOIN clw_talage_industry_codes as ic ON ic.id = a.industry_code
            LEFT JOIN clw_talage_industry_code_categories icc on icc.id = ic.category
        WHERE  a.id = ${req.query.id} AND ${where}
        GROUP BY a.id
        LIMIT 1;
		`;

    // Query the database
    const applicationData = await db.query(sql).catch(function(err){
        log.error('Error get application database query ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Make sure an application was found
    if (applicationData.length !== 1){
        log.error('Error get application, application not found sql: ' + sql + __location);
        return next(serverHelper.notFoundError('The application could not be found.'));
    }

    // Get the application from the response
    const application = applicationData[0];

    // Decrypt any necessary fields
    await crypt.batchProcessObject(application, 'decrypt', ['address',
        'address2',
        'businessName',
        'dba',
        'ein',
        'email',
        'fname',
        'lname',
        'owners',
        'phone',
        'website']);

    // Decode the owners
    application.owners = JSON.parse(application.owners);

    // Get all addresses for this business
    const addressSQL = `
        SELECT
            id,
            address,
            address2,
            billing,
            ein,
            zipcode,
            full_time_employees,
            part_time_employees,
            square_footage,
            unemployment_num,
            city,
            state_abbr as territory
        FROM clw_talage_addresses
        WHERE business = ${application.businessID};
		`;

    // Query the database
    const addressData = await db.query(addressSQL).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Decrypt the encrypted fields
    await crypt.batchProcessObjectArray(addressData, 'decrypt', ['address',
        'address2',
        'ein']);

    // Only process addresses if some were returned
    application.locations = [];
    if (addressData.length > 0){
        // Get the activity codes for all addresses
        const codesSQL = `
				SELECT
					${db.quoteName('aac.address')},
					${db.quoteName('ac.description')},
					${db.quoteName('aac.payroll')}
				FROM ${db.quoteName('#__address_activity_codes', 'aac')}
				LEFT JOIN ${db.quoteName('#__activity_codes', 'ac')} ON ${db.quoteName('ac.id')} = ${db.quoteName('aac.ncci_code')}
				WHERE ${db.quoteName('aac.address')} IN (${addressData.map(function(address){
    return address.id;
})});
			`;

        // Query the database
        const codesData = await db.query(codesSQL).catch(function(err){
            log.error(err.message);
            return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
        });

        // Loop over each address and do a bit more work
        addressData.forEach(function(address){
            // Get all codes that are associated with this address and add them
            address.activityCodes = [];
            if (codesData.length > 0){
                codesData.forEach(function(code){
                    if (code.address === address.id){
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
                q.api_result,
                q.policy_type,
                pt.name as policyTypeName,
                pay.name as paymentPlan,
                q.insurer,
                q.amount,
                q.bound,
                q.reasons,
                i.logo,
                i.name as insurerName,
                q.quote_letter,
                q.number,
                q.status,
                q.log
            FROM clw_talage_quotes as q
            LEFT JOIN  clw_talage_policies as p ON p.quote = q.id
            LEFT JOIN  clw_talage_payment_plans as pay ON pay.id = q.payment_plan
            LEFT JOIN  clw_talage_insurers as i ON i.id = q.insurer
            LEFT JOIN  clw_talage_policy_types as pt ON pt.abbr = q.policy_type
            LEFT JOIN  clw_talage_applications as a ON q.application = a.id

            WHERE q.application = ${req.query.id} AND q.state = 1;
		`;


    const quotes = await db.query(quotesSQL).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });


    // Add the quotes to the return object and determine the application status
    application.quotes = [];
    if (quotes.length > 0){
        for(let i = 0; i < quotes.length; i++){
            // eslint-disable-next-line prefer-const
            let quote = quotes[i];
            if(!quote.status && quote.api_result){
                quote.status = quote.api_result;
            }

            // Change the name of autodeclined
            if(quote.status === 'autodeclined'){
                quote.status = 'Out of Market';
                quote.reasons = '';
            }
            if(quote.status === 'bind_requested'
                || quote.bound
                || quote.status === 'quoted'){

                quote.reasons = '';
            }
            // can see log?
            try{
                if(req.authentication.permissions.applications.viewlogs){
                    quote.log = await crypt.decrypt(quote.log);
                }
                else {
                    delete quote.log;
                }
            }
            catch(e){
                delete quote.log;
            }

        }


        // Add the quotes to the response
        application.quotes = quotes;
        if(req.authentication.permissions.applications.viewlogs){
            application.showLogs = true;
        }
    }

    // Get any existing claims for the application from the data base
    const claimsSQL = `
			SELECT
				${db.quoteName('c.amount_paid', 'amountPaid')},
				${db.quoteName('c.amount_reserved', 'amountReserved')},
				${db.quoteName('c.date')},
				${db.quoteName('c.missed_work', 'missedWork')},
				${db.quoteName('c.open')},
				${db.quoteName('c.policy_type', 'policyType')}
			FROM ${db.quoteName('#__claims', 'c')}
			
			WHERE ${db.quoteName('c.application')} = ${req.query.id};
		`;

    // Run query for claims
    const claims = await db.query(claimsSQL).catch(function(err){
        log.error('Error get application database query (claims) ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    application.claims = [];
    if (claims.length > 0){
        // Add the claims to the response if they exist
        application.claims = claims;
    }

    // Return the response
    res.send(200, application);
    return next();
}


async function deleteObject(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    //Deletes only by AgencyNetwork Users.

    const agencyNetwork = req.authentication.agencyNetwork;
    if (!agencyNetwork) {
        log.warn('App Delete not agency network user ' + __location)
        res.send(403);
        return next(serverHelper.forbiddenError('Do Not have Permissions'));
    }
    //check that application is agency network.
    let error = null;
    const applicationBO = new ApplicationBO();
    // Load the request data into it
    const appAgencyNetworkId = await applicationBO.getAgencyNewtorkIdById(id).catch(function(err) {
        log.error("Getting  appAgencyNetworkId error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    if(appAgencyNetworkId !== agencyNetwork){
        log.warn("Application Delete agencynetowrk miss match")
        res.send(403);
        return next(serverHelper.forbiddenError('Do Not have Permissions'));
    }


    await applicationBO.deleteSoftById(id).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, {"success": true});
    return next();

}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get application', `${basePath}/application`, getApplication, 'applications', 'view');
    server.addDeleteAuth('DELETE application', `${basePath}/application/:id`, deleteObject, 'applications', 'manage');
};