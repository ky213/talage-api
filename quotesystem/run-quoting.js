const ApplicationBO = global.requireShared('./models/Application-BO.js');
const moment = require('moment');
const applicationStatus = global.requireShared('./models/status/applicationStatus.js');
const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');
const QuoteBO = global.requireShared('./models/Quote-BO.js');


function shouldProcessInsurer(insurerId, policyTypeCd, appDoc, agencyNetworkJson){
    let resp  = true
    log.info(`AppId:${appDoc.applicationId} shouldProcessInsurer: ${insurerId} ${policyTypeCd} CHECKING `)
    if(appDoc.insurerList?.length > 0 && agencyNetworkJson?.featureJson?.enableInsurerSelection === true){
        const insurerListPT = appDoc.insurerList.find((ilPt) => ilPt.policyTypeCd === policyTypeCd);
        if(insurerListPT){
            if(insurerListPT.insurerIdList?.length > 0){
                if(insurerListPT.insurerIdList.indexOf(insurerId) === -1){
                    resp = false
                    log.info(`AppId:${appDoc.applicationId} shouldProcessInsurer: ${insurerId} ${policyTypeCd} not insurer list NOT QUOTING `)
                }
                else {
                    log.info(`AppId:${appDoc.applicationId} shouldProcessInsurer: ${insurerId} ${policyTypeCd} insurer IN list `)
                }
            }
            else {
                log.info(`AppId:${appDoc.applicationId} shouldProcessInsurer:  ${insurerId} ${policyTypeCd} no insurerListed ${JSON.stringify(insurerListPT)} `)
            }
        }
        else {
            log.info(`AppId:${appDoc.applicationId} shouldProcessInsurer: ${insurerId} ${policyTypeCd} - no insurerListPT for PolicyType`)
        }
    }
    else {
        log.info(`AppId:${appDoc.applicationId} shouldProcessInsurer: ${insurerId} ${policyTypeCd} NO appdoc.insurerList or not turned on agencyNetworkJson?.featureJson?.enableInsurerSelection ${agencyNetworkJson?.featureJson?.enableInsurerSelection}`)
    }
    return resp;
}



/**
 * Begins the process of getting and returning quotes from insurers
 *
 * @param {object} appModel - Loaded application.
 * @returns {void}
 */
async function runPricing(appModel) {

    // appStatusId > 70 is finished.(request to bind)
    if(appModel.applicationDocData.appStatusId >= 70){
        log.warn("An attempt to priced application that is finished.")
        throw new Error("Finished Application cannot be priced")
    }

    // Generate quotes for each policy type
    const fs = require('fs');
    const price_promises = [];


     // need Agency Network Doc for insurer Selection.
     const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO');
     const agencyNetworkBO = new AgencyNetworkBO();
     const agencyNetworkDoc = await agencyNetworkBO.getById(appModel.applicationDocData.agencyNetworkId)

    if(appModel.policies && appModel.policies.length === 0){
        log.error(`AppId ${appModel.applicationDocData.applicationId} No policies for Application ${appModel.id} ` + __location)
    }

    // set the quoting started date right before we start looking for quotes
    appModel.policies.forEach((policy) => {
        // Generate quotes for each insurer for the given policy type
        appModel.insurers.forEach((insurer) => {
            let quoteInsurer = true;
            if(appModel.quoteInsurerId && appModel.quoteInsurerId > 0 && appModel.quoteInsurerId !== insurer.id){
                quoteInsurer = false;
            }
            if(quoteInsurer){
                quoteInsurer = shouldProcessInsurer(insurer.id, policy.type.toUpperCase(), appModel.applicationDocData, agencyNetworkDoc);
            }
            // Only run quotes against requested insurers (if present)
            // Check that the given policy type is enabled for this insurer
            if (insurer.policy_types.indexOf(policy.type) >= 0 && quoteInsurer) {

                // Get the agency_location_insurer data for this insurer from the agency location
                //log.debug(JSON.stringify(app.agencyLocation.insurers[insurer.id]))
                if (appModel.agencyLocation.insurers[insurer.id].policyTypeInfo) {

                    //Retrieve the data for this policy type
                    const agency_location_insurer_data = appModel.agencyLocation.insurers[insurer.id].policyTypeInfo[policy.type];
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
                                    log.error(`AppId ${appModel.applicationDocData.applicationId} Policy Type info not found for agency location: ${appModel.agencyLocation.id} Insurer: ${insurer.id} Policy ${JSON.stringify(policy)}` + __location);
                                }
                            }
                            catch(err){
                                log.error(`AppId ${appModel.applicationDocData.applicationId} SLUG ERROR ` + err + __location);
                            }

                            const normalizedPath = `${__dirname}/integrations/${slug}/${policyTypeAbbr}.js`;
                            try{
                                if (slug.length > 0 && fs.existsSync(normalizedPath)) {
                                    // Require the integration file and add the response to our promises
                                    const IntegrationClass = require(normalizedPath);
                                    const integration = new IntegrationClass(appModel, insurer, policy);
                                    price_promises.push(integration.price());
                                }
                                else {
                                    log.error(`AppId ${appModel.applicationDocData.applicationId} Database and Implementation mismatch: Integration confirmed in the database but implementation file was not found. Agency location ID: ${appModel.agencyLocation.id} insurer ${insurer.name} policyType ${policy.type} slug: ${slug} path: ${normalizedPath} app ${appModel.id} ` + __location);
                                }
                            }
                            catch(err){
                                log.error(`AppId ${appModel.applicationDocData.applicationId} Error getting Insurer integration file ${normalizedPath} ${err} ` + __location)
                            }
                        }
                        else {
                            log.info(`AppId ${appModel.applicationDocData.applicationId} ${policy.type} is not enabled for insurer ${insurer.id} for Agency location ${appModel.agencyLocation.id} app ${appModel.id}` + __location);
                        }
                    }
                    else {
                        log.info(`AppId ${appModel.applicationDocData.applicationId} Info for policy type ${policy.type} not found for agency location: ${appModel.agencyLocation.id} Insurer: ${insurer.id} app ${appModel.id}` + __location);
                    }
                }
                else {
                    log.error(`AppId ${appModel.applicationDocData.applicationId} Policy info not found for agency location: ${appModel.agencyLocation.id} Insurer: ${insurer.id} app ${appModel.id}` + __location);
                }
            }
        });
    });

    // Wait for all quotes to finish
    let pricingResults = null;
    //pricingResult JSON
    // const pricingResult =  {
    //     gotPricing: true,
    //     price: 1200,
    //     lowPrice: 800,
    //     highPrice: 1500,
    //     outOfAppetite: false,
    //     pricingError: false
    // }
    try {
        pricingResults = await Promise.all(price_promises);
    }
    catch (error) {
        log.error(`Pricing did not complete successfully for application ${appModel.id}: ${error} ${__location}`);
        const appPricingResultJSON = {
            gotPricing: false,
            outOfAppetite: false,
            pricingError: true
        }
        return appPricingResultJSON;
    }

    //log.info(`${quoteIDs.length} quotes returned for application ${app.id}`);
    let appPricingResultJSON = {}
    // Check for no quotes
    let gotPricing = false;
    let outOfAppetite = false;
    let pricingError = false;
    let lowPrice = 9999999;
    let highPrice = -1;
    let totalPrice = 0;
    let priceCount = 0;
    for(const priceResult of pricingResults){
        if(priceResult.gotPricing){
            gotPricing = true;
            if(lowPrice > priceResult.price){
                lowPrice = priceResult.price
            }
            if(highPrice < priceResult.price){
                highPrice = priceResult.price
            }
            priceCount++;
            totalPrice += priceResult.price
        }
        if(priceResult.outOfAppetite){
            outOfAppetite = true;
        }
        if(priceResult.pricingError){
            pricingError = true;
        }
    }
    if(lowPrice === 9999999){
        lowPrice = null
        highPrice = null
    }
    appPricingResultJSON = {
        gotPricing: gotPricing,
        outOfAppetite: outOfAppetite,
        pricingError: pricingError,
        lowPrice: lowPrice,
        highPrice: highPrice
    }

    if (pricingResults.length === 1 && typeof pricingResults[0] === 'object' && priceCount > 0) {
        appPricingResultJSON = pricingResults[0]
    }
    else if(pricingResults.length > 1 && priceCount > 0){
        appPricingResultJSON.price = parseInt(totalPrice / priceCount, 10);
    }
    else if (pricingResults.length < 1) {
        appPricingResultJSON = {
            gotPricing: false,
            outOfAppetite: false,
            pricingError: true
        }

    }
    // else {
    //     //LOOP result for creating range.
    // }
    const appUpdateJSON = {
        pricingInfo: appPricingResultJSON,
        lastPage: "Pricing"
    };
    const applicationBO = new ApplicationBO();
    await applicationBO.updateMongo(appModel.applicationDocData.applicationId, appUpdateJSON);
    if(appPricingResultJSON.gotPricing === true){
        //Update app status
        await applicationStatus.updateApplicationStatus(appModel.applicationDocData.applicationId);
        // Update Application-level quote metrics
        await applicationBO.recalculateQuoteMetrics(appModel.applicationDocData.applicationId);
    }


    return appPricingResultJSON
}


/**
 * Begins the process of getting and returning quotes from insurers
 *
 * @param {object} appModel - Loaded application Model.
 * @returns {void}
 */
async function runQuoting(appModel) {
    const integrationList = [];
    const policyTypeQuotedStatus = {}
    const policyTypeList = []

    // appStatusId > 70 is finished.(request to bind)
    if(appModel.applicationDocData.appStatusId >= 70){
        log.warn("An attempt to quote application that is finished.")
        throw new Error("Finished Application cannot be quoted")
    }
    // need Agency Network Doc for tiering.
    const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO');
    const agencyNetworkBO = new AgencyNetworkBO();
    const agencyNetworkDoc = await agencyNetworkBO.getById(appModel.applicationDocData.agencyNetworkId)


    // Generate quotes for each policy type
    const fs = require('fs');
    if(appModel.policies && appModel.policies.length === 0){
        log.error(`AppId ${appModel.applicationDocData.applicationId} No policies for Application ${appModel.id} ` + __location)
    }

    // set the quoting started date right before we start looking for quotes
    const applicationBO = new ApplicationBO();
    await applicationBO.updateMongo(appModel.applicationDocData.uuid, {quotingStartedDate: moment.utc()});
    appModel.policies.forEach((policy) => {
        if (!Object.prototype.hasOwnProperty.call(policyTypeQuotedStatus, policy.type)) {
            policyTypeQuotedStatus[policy.type] = false;
            policyTypeList.push(policy.type);
        }
        // Generate quotes for each insurer for the given policy type
        appModel.insurers.forEach((insurer) => {
            let quoteInsurer = true;
            if(appModel.quoteInsurerId && appModel.quoteInsurerId > 0 && appModel.quoteInsurerId !== insurer.id){
                quoteInsurer = false;
            }
            if(quoteInsurer){
                quoteInsurer = shouldProcessInsurer(insurer.id, policy.type.toUpperCase(), appModel.applicationDocData, agencyNetworkDoc);
            }
            // Only run quotes against requested insurers (if present)
            // Check that the given policy type is enabled for this insurer
            if (insurer.policy_types.indexOf(policy.type) >= 0 && quoteInsurer) {

                // Get the agency_location_insurer data for this insurer from the agency location
                //log.debug(JSON.stringify(app.agencyLocation.insurers[insurer.id]))
                if (appModel.agencyLocation.insurers[insurer.id] && appModel.agencyLocation.insurers[insurer.id].policyTypeInfo) {

                    //Retrieve the data for this policy type
                    const agency_location_insurer_data = appModel.agencyLocation.insurers[insurer.id].policyTypeInfo[policy.type];
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
                                    log.error(`AppId ${appModel.applicationDocData.applicationId} Policy Type info not found for agency location: ${appModel.agencyLocation.id} Insurer: ${insurer.id} Policy ${JSON.stringify(policy)}` + __location);
                                }
                            }
                            catch(err){
                                log.error(`AppId ${appModel.applicationDocData.applicationId} SLUG ERROR ` + err + __location);
                            }

                            const normalizedPath = `${__dirname}/integrations/${slug}/${policyTypeAbbr}.js`;
                            try{
                                if (slug.length > 0 && fs.existsSync(normalizedPath)) {
                                    // Require the integration file and add the response to our promises
                                    const IntegrationClass = require(normalizedPath);
                                    const integration = new IntegrationClass(appModel, insurer, policy);
                                    //Determine Tier Level. Agency vs Wholesaler tier level is determined in
                                    if(agencyNetworkDoc?.featureJson?.enableTieredQuoting && agency_location_insurer_data.quotingTierLevel > 0){
                                        integration.quoteTierLevel = agency_location_insurer_data.quotingTierLevel;
                                        log.info(`AppId ${appModel.applicationDocData.applicationId} RUN QUOTING Agency Network ${agencyNetworkDoc.agencyNetworkId} application ${appModel.id}  Setting to Tier to ${agency_location_insurer_data.quotingTierLevel} for  ${integration.insurer.name}` + __location)
                                    }
                                    else {
                                        //No tiering
                                        log.info(`AppId ${appModel.applicationDocData.applicationId} RUN QUOTING Agency Network ${agencyNetworkDoc.agencyNetworkId} application ${appModel.id}  Default to Tier 1 for ${integration.insurer.name}` + __location)
                                        integration.quoteTierLevel = 1;
                                    }
                                    integrationList.push(integration)
                                }
                                else {
                                    log.error(`AppId ${appModel.applicationDocData.applicationId} Database and Implementation mismatch: Integration confirmed in the database but implementation file was not found. Agency location ID: ${appModel.agencyLocation.id} insurer ${insurer.name} policyType ${policy.type} slug: ${slug} path: ${normalizedPath} app ${appModel.id} ` + __location);
                                }
                            }
                            catch(err){
                                log.error(`AppId ${appModel.applicationDocData.applicationId} Error getting Insurer integration file ${normalizedPath} ${err} ` + __location)
                            }
                        }
                        else {
                            log.info(`AppId ${appModel.applicationDocData.applicationId} ${policy.type} is not enabled for insurer ${insurer.id} for Agency location ${appModel.agencyLocation.id} app ${appModel.id}` + __location);
                        }
                    }
                    else {
                        log.info(`AppId ${appModel.applicationDocData.applicationId} Info for policy type ${policy.type} not found for agency location: ${appModel.agencyLocation.id} Insurer: ${insurer.id} app ${appModel.id}` + __location);
                    }
                }
                else {
                    log.error(`AppId ${appModel.applicationDocData.applicationId} Policy info not found for agency location: ${appModel.agencyLocation.id} Insurer: ${insurer.id} app ${appModel.id}` + __location);
                }
            }
        });
    });

    let attemptedQuoting = false;
    if(integrationList.length > 0){
        //loop their quoting tiers
        let tierLevel = 0
        let stillQuoting = true;
        do{
            tierLevel++;
            //integrations quoting this tier
            const tierIntegrationList = []
            const quote_promises = [];
            // Wait for all quotes to finish
            for(const integration of integrationList){
                if(integration.quoteTierLevel === tierLevel && policyTypeQuotedStatus[integration.policy.type] === false){
                    tierIntegrationList.push(integration)
                    quote_promises.push(integration.quote());
                }
            }
            if(tierIntegrationList.length === 0 && (attemptedQuoting === true || tierLevel > 9)){
                stillQuoting = false;
            }

            if(stillQuoting && tierIntegrationList.length > 0){
                attemptedQuoting = true;
                log.info(`AppId ${appModel.applicationDocData.applicationId} RUN QUOTING Agency Network ${agencyNetworkDoc.agencyNetworkId} application ${appModel.id} quoting tier ${tierLevel}` + __location)
                let quoteIDs = null;
                try {
                    quoteIDs = await Promise.all(quote_promises);
                    log.info(`AppId ${appModel.applicationDocData.applicationId} RUN QUOTING Agency Network ${agencyNetworkDoc.agencyNetworkId} application ${appModel.id} quoting tier ${tierLevel} processed ${quoteIDs.length} quote attempts` + __location)
                }
                catch (error) {
                    log.error(`AppId ${appModel.applicationDocData.applicationId} Quoting did not complete successfully for application ${appModel.id}: ${error} ${__location}`);
                    //return;
                }
                for(const integration of tierIntegrationList){
                    if(integration.quoteStatusId > quoteStatus.referred.id || integration.amount > 0){
                        log.info(`AppId ${appModel.applicationDocData.applicationId} RUN QUOTING Agency Network ${agencyNetworkDoc.agencyNetworkId} application ${appModel.id} got ${integration.policy.type} quote from ${integration.insurer.name} in quoting tier ${tierLevel}` + __location)
                        policyTypeQuotedStatus[integration.policy.type] = true;
                        stillQuoting = false
                    }
                    else if (!integration.quoteStatusId){
                        log.error(`AppId ${appModel.applicationDocData.applicationId} RUN QUOTING Agency Network ${agencyNetworkDoc.agencyNetworkId} application ${appModel.id}  ${integration.policy.type} unexpected quoteStatusId from ${integration.insurer.name} in quoting tier ${tierLevel}` + __location)
                    }
                }
                for(const pt of policyTypeList){
                    if(policyTypeQuotedStatus[pt] === false){
                        stillQuoting = true
                    }
                }
            }

        }while(stillQuoting)
    }

    // Update the application Status
    // Update the application quote progress to "complete"
    try{
        await applicationBO.updateProgress(appModel.applicationDocData.applicationId, "complete");
    }
    catch(err){
        log.error(`Error update appication progress appId = ${appModel.applicationDocData.applicationId}  for complete. ` + err + __location);
    }

    if(integrationList.length === 0 || attemptedQuoting === false){
        try{

            await applicationBO.updateStatus(appModel.applicationDocData.applicationId,applicationStatus.applicationStatus.error.appStatusDesc, applicationStatus.applicationStatus.error.appStatusId);
        }
        catch(err){
            log.error(`AppId ${appModel.applicationDocData.applicationId} Error update appication status appId = ${appModel.applicationDocData.applicationId} for error. ` + err + __location);
        }

        log.error(`AppId ${appModel.applicationDocData.applicationId} Error appId = ${appModel.applicationDocData.applicationId} had no insurer setup for quoting. ` + __location);
        return;
    }

    // Update the application quote metrics
    const newMetrics = await applicationBO.recalculateQuoteMetrics(appModel.applicationDocData.applicationId);
    appModel.applicationDocData.metrics = newMetrics;


    // Update the application status
    // response {appStatusId: applicationDocJson.appStatusId, appStatusDesc: applicationDocJson.status};
    const statusReponse = await applicationStatus.updateApplicationStatus(appModel.applicationDocData.applicationId);
    //update for notifications.
    appModel.applicationDocData.status = statusReponse?.appStatusDesc;
    appModel.applicationDocData.appStatusId = statusReponse?.appStatusId;

    // Get the quotes from the database
    const quoteBO = new QuoteBO();
    let quoteList = null;
    try {
        const query = {"applicationId": appModel.applicationDocData.applicationId}
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
                await applicationBO.updateMongo(appModel.applicationDocData.applicationId, appUpdateJSON);
            }
            catch(err){
                log.error(`AppId ${appModel.applicationDocData.applicationId} Error update appication progress to complete. ` + err + __location);
            }
        }
    }
    catch (error) {
        log.error(`AppId ${appModel.applicationDocData.applicationId} Could not retrieve quotes from the database for application ${appModel.applicationDocData.applicationId} ${__location}`);
    }

    // Send a notification to Slack about this application
    try{
        await appModel.send_notifications(quoteList);
    }
    catch(err){
        log.error(`AppId ${appModel.applicationDocData.applicationId} Quote Application ${appModel.id} error sending notifications ` + err + __location);
    }
}


module.exports = {
    runQuoting: runQuoting,
    runPricing: runPricing
}