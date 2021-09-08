const ApplicationBO = global.requireShared('./models/Application-BO.js');
const moment = require('moment');
const applicationStatus = global.requireShared('./models/status/applicationStatus.js');
const QuoteBO = global.requireShared('./models/Quote-BO.js');

/**
 * Begins the process of getting and returning quotes from insurers
 *
 * @returns {void}
 */
module.exports = async (app) => {
    // appStatusId > 70 is finished.(request to bind)
    if(app.applicationDocData.appStatusId >= 70){
        log.warn("An attempt to quote application that is finished.")
        throw new Error("Finished Application cannot be quoted")
    }

    // Generate quotes for each policy type
    const fs = require('fs');
    const quote_promises = [];

    if(app.policies && app.policies.length === 0){
        log.error(`No policies for Application ${app.id} ` + __location)
    }

    // set the quoting started date right before we start looking for quotes
    let applicationBO = new ApplicationBO();
    await applicationBO.updateMongo(app.applicationDocData.uuid, {quotingStartedDate: moment.utc()});
    app.policies.forEach((policy) => {
        // Generate quotes for each insurer for the given policy type
        app.insurers.forEach((insurer) => {
            let quoteInsurer = true;
            if(app.quoteInsurerId && app.quoteInsurerId > 0 && app.quoteInsurerId !== insurer.id){
                quoteInsurer = false;
            }
            // Only run quotes against requested insurers (if present)
            // Check that the given policy type is enabled for this insurer
            if (insurer.policy_types.indexOf(policy.type) >= 0 && quoteInsurer) {

                // Get the agency_location_insurer data for this insurer from the agency location
                //log.debug(JSON.stringify(app.agencyLocation.insurers[insurer.id]))
                if (app.agencyLocation.insurers[insurer.id].policyTypeInfo) {

                    //Retrieve the data for this policy type
                    const agency_location_insurer_data = app.agencyLocation.insurers[insurer.id].policyTypeInfo[policy.type];
                    if (agency_location_insurer_data) {

                        if (agency_location_insurer_data.enabled) {
                            let policyTypeAbbr = '';
                            let slug = '';
                            try{
                                // If agency wants to send acord, send acord
                                if (agency_location_insurer_data.useAcord === true && insurer.policy_type_details[policy.type].acord_support === true) {
                                    slug = 'acord';
                                }
                                else if (insurer.policy_type_details[policy.type.toUpperCase()].api_support) {
                                    // Otherwise use the api
                                    slug = insurer.slug;
                                }
                                if(policy && policy.type){
                                    policyTypeAbbr = policy.type.toLowerCase()
                                }
                                else {
                                    log.error(`Policy Type info not found for agency location: ${app.agencyLocation.id} Insurer: ${insurer.id} Policy ${JSON.stringify(policy)}` + __location);
                                }
                            }
                            catch(err){
                                log.error('SLUG ERROR ' + err + __location);
                            }

                            const normalizedPath = `${__dirname}/integrations/${slug}/${policyTypeAbbr}.js`;
                            log.debug(`normalizedPathnormalizedPath}`)
                            try{
                                if (slug.length > 0 && fs.existsSync(normalizedPath)) {
                                    // Require the integration file and add the response to our promises
                                    const IntegrationClass = require(normalizedPath);
                                    const integration = new IntegrationClass(app, insurer, policy);
                                    quote_promises.push(integration.quote());
                                }
                                else {
                                    log.error(`Database and Implementation mismatch: Integration confirmed in the database but implementation file was not found. Agency location ID: ${app.agencyLocation.id} insurer ${insurer.name} policyType ${policy.type} slug: ${slug} path: ${normalizedPath} app ${app.id} ` + __location);
                                }
                            }
                            catch(err){
                                log.error(`Error getting Insurer integration file ${normalizedPath} ${err} ` + __location)
                            }
                        }
                        else {
                            log.info(`${policy.type} is not enabled for insurer ${insurer.id} for Agency location ${app.agencyLocation.id} app ${app.id}` + __location);
                        }
                    }
                    else {
                        log.warn(`Info for policy type ${policy.type} not found for agency location: ${app.agencyLocation.id} Insurer: ${insurer.id} app ${app.id}` + __location);
                    }
                }
                else {
                    log.error(`Policy info not found for agency location: ${app.agencyLocation.id} Insurer: ${insurer.id} app ${app.id}` + __location);
                }
            }
        });
    });

    // Wait for all quotes to finish
    let quoteIDs = null;
    try {
        quoteIDs = await Promise.all(quote_promises);
    }
    catch (error) {
        log.error(`Quoting did not complete successfully for application ${app.id}: ${error} ${__location}`);
        return;
    }

    //log.info(`${quoteIDs.length} quotes returned for application ${app.id}`);

    // Check for no quotes
    if (quoteIDs.length < 1) {
        log.warn(`No quotes returned for application ${app.id}` + __location);
        return;
    }


    // Update the application quote metrics
    await applicationBO.recalculateQuoteMetrics(app.applicationDocData.applicationId);

    // Update the application Status
    // Update the application quote progress to "complete"
    try{
        await applicationBO.updateProgress(app.applicationDocData.applicationId, "complete");
    }
    catch(err){
        log.error(`Error update appication progress appId = ${app.applicationDocData.applicationId}  for complete. ` + err + __location);
    }

    // Update the application status
    await applicationStatus.updateApplicationStatus(app.applicationDocData.applicationId);

    // Get the quotes from the database
    const quoteBO = new QuoteBO();
    let quoteList = null;
    try {
        const query = {"applicationId": app.applicationDocData.applicationId}
        quoteList = await quoteBO.getList(query);
        //if a quote is marked handedByTalage  mark the application as handedByTalage and wholesale = true
        let isHandledByTalage = false
        quoteList.forEach((quoteDoc) => {
            if(quoteDoc.handledByTalage){
                isHandledByTalage = quoteDoc.handledByTalage;
            }
        });
        if(isHandledByTalage){
            // eslint-disable-next-line object-curly-newline
            const appUpdateJSON = {handledByTalage: true};
            try{
                await applicationBO.updateMongo(app.applicationDocData.applicationId, appUpdateJSON);
            }
            catch(err){
                log.error(`Error update appication progress appId = ${app.applicationDocData.applicationId}  for complete. ` + err + __location);
            }
        }
    }
    catch (error) {
        log.error(`Could not retrieve quotes from the database for application ${app.applicationDocData.applicationId} ${__location}`);
    }

    // Send a notification to Slack about this application
    try{
        await app.send_notifications(quoteList);
    }
    catch(err){
        log.error(`Quote Application ${app.id} error sending notifications ` + err + __location);
    }
}
