/* eslint-disable object-property-newline */
/* eslint-disable object-curly-spacing */
/* eslint-disable object-curly-newline */
'use strict';

const { updateQuoteStatus } = require('./quoteStatus.js');

const applicationStatus = {
    incomplete: { appStatusId: 0, appStatusDesc: 'incomplete' },
    outOfMarket: { appStatusId: 4, appStatusDesc: "out_of_market" },
    wholesale: { appStatusId: 5, appStatusDesc: 'wholesale'},
    questionsDone: { appStatusId: 10, appStatusDesc: 'questions_done' },
    error: { appStatusId: 20, appStatusDesc: 'error' },
    declined: { appStatusId: 30, appStatusDesc: 'declined' },
    referred: { appStatusId: 40, appStatusDesc: 'referred' },
    acordEmailed: { appStatusId: 45, appStatusDesc: 'acord_emailed' },
    quotedReferred: { appStatusId: 50, appStatusDesc: 'quoted_referred' },
    quoted: { appStatusId: 60, appStatusDesc: 'quoted' },
    dead: { appStatusId: 65, appStatusDesc: 'dead' },
    requestToBind: { appStatusId: 70, appStatusDesc: 'request_to_bind' },
    requestToBindReferred: { appStatusId: 80, appStatusDesc: 'request_to_bind_referred' },
    bound: { appStatusId: 90, appStatusDesc: 'bound' }
}

/**
 * Ensures that a quote has a value for aggregated_status
 *
 * @param {Number|Object} application - ID of the application to update, or application object
 * @param {Boolean} timeout - optional parameter to specify the status should timeout if no other status is satisfactory
 * @return {void}
 */
async function updateApplicationStatus(application, timeout) {
    const ApplicationBO = global.requireShared('./models/Application-BO.js');
    const QuoteBO = global.requireShared('./models/Quote-BO.js');
    const applicationBO = new ApplicationBO();
    let applicationDocJson = null;
    if(typeof application === "object"){
        // if the doc is passed just use it as is
        applicationDocJson = application;
    }
    else{
        // Get the application
        try{
            applicationDocJson = await applicationBO.getById(application)
        }
        catch(err){
            log.error(`Could not retrieve application ${application} ${__location}`);
            return;
        }
    }

    // Get the quotes
    const quoteBO = new QuoteBO();
    let quoteDocJsonList = null;
    try {
        quoteDocJsonList = await quoteBO.getByApplicationId(applicationDocJson.applicationId);

        // if we get undefined back, set it to empty
        if(!quoteDocJsonList){
            quoteDocJsonList = [];
        }
    }
    catch (error) {
        log.error(`Could not get quotes for application ${applicationDocJson.applicationId} ${__location}`);
        return;
    }

    // Get the new application status
    let appStatus = '';
    switch (applicationDocJson.agencyNetworkId) {
        default:
            appStatus = getGenericApplicationStatus(applicationDocJson, quoteDocJsonList, timeout);
            break;
        // Accident Fund
        case 2:
            appStatus = getAccidentFundApplicationStatus(applicationDocJson, quoteDocJsonList, timeout);
            break;
    }

    // Set the new application status
    try {
        //TODO change to applicationId
        await applicationBO.updateStatus(applicationDocJson.applicationId, appStatus.appStatusDesc, appStatus.appStatusId);
    }
    catch (err) {
        log.error(`Error update appication status appId = ${applicationDocJson.applicationId}  ${db.escape(appStatus.appStatusDesc)} ` + err + __location);
    }
    return appStatus;
}

/**
 * Returns the status of a generic application based on it's associated quotes. The status is a user-friendly string.
 *
 * @param {Object} applicationDoc - An application record
 * @param {array} quoteDocJsonList - An array of quote objects
 * @param {Boolean} timeout - optional parameter to specify the status should timeout if no other status is satisfactory
 * @return {string} - The status object {appStatusId, appStatusDesc} of the application
 */
function getGenericApplicationStatus(applicationDoc, quoteDocJsonList, timeout) {
    // Ensure that each quote has a quote status and ID
    // TODO: This should not be part of this function's responsibilities...
    // if the application status is already bound or application is dead, don't look at quotes to determine application status
    const deadApplicationStatusId = 65;
    const boundApplicationStatusId = 90;
    if(applicationDoc.appStatusId === deadApplicationStatusId || applicationDoc.appStatusId === boundApplicationStatusId){
        return {appStatusId: applicationDoc.appStatusId, appStatusDesc: applicationDoc.appStatusDesc};
    }
    else {
        quoteDocJsonList.forEach((quoteDocJson) => updateQuoteStatus(quoteDocJson));
        if (applicationDoc.appStatusId < 10) {
            // return the current app status if it is less than 10
            return { appStatusId: applicationDoc.appStatusId, appStatusDesc: applicationDoc.appStatusDesc };
        }
        // TODO
        // out of market should be somewhere between incomplete and questions done, but what about wholesale?
        // do we need to prevent status change if we are out of market?
        else if (applicationDoc.solepro || applicationDoc.wholesale) {
            //TODO separate status logic
            //appStatusId = 5
            return applicationStatus.wholesale;
        }
        else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'bound')) {
            //appStatusId = 100
            //return 'bound';
            return applicationStatus.bound;
        }
        else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'request_to_bind_referred')) {
            //appStatusId = 80
            //return 'request_to_bind_referred';
            return applicationStatus.requestToBindReferred;
        }
        else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'request_to_bind')) {
            //appStatusId = 70
            //return 'request_to_bind';
            return applicationStatus.requestToBind;
        }
        else if (quoteDocJsonList.every(quote => quote.aggregatedStatus === 'dead')) {
            return applicationStatus.dead;
        }
        else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'quoted')) {
            //appStatusId = 60
            // return 'quoted';
            return applicationStatus.quoted;
        }
        else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'quoted_referred')) {
            //appStatusId = 50
            //return 'quoted_referred';
            return applicationStatus.quotedReferred;
        }
        else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'acord_emailed')) {
            //appStatusId = 45
            //return 'acord_emailed';
            return applicationStatus.acordEmailed;
        }
        else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'referred')) {
            //appStatusId = 40
            //return 'referred';
            return applicationStatus.referred;
        }
        else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'declined')) {
            //appStatusId = 30
            // return 'declined';
            return applicationStatus.declined;
        }
        else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'error')) {
            //appStatusId = 20
            //  return 'error';
            return applicationStatus.error;
        }
        else if (applicationDoc.lastStep === 8 || applicationDoc.appStatusId === 10) {
            //appStatusId = 10
            // return 'questions_done';
            return applicationStatus.questionsDone;
        }
        else if(timeout) {
            // if timeout is specified then return error if nothing above is chosen
            return applicationStatus.error;
        }
        else{
            return applicationStatus.incomplete;
        }
    }
}

/**
 * Returns the status of an agency network 2 application based on it's associated quotes. The status is a user-friendly string.
 *
 * @param {Object} applicationDoc - An application record
 * @param {array} quoteDocJsonList - An array of quote objects
 * @param {Boolean} timeout - optional parameter to specify the status should timeout if no other status is satisfactory
 * @return {string} - The status of the application
 */
function getAccidentFundApplicationStatus(applicationDoc, quoteDocJsonList, timeout) {
    const status = getGenericApplicationStatus(applicationDoc, quoteDocJsonList, timeout);
    // For accident fund, we only need to 'downgrade' the status if it is declined and there exists a quote with an 'error' status.
    if (status === 'declined') {
        if (quoteDocJsonList.filter((quote) => quote.aggregatedStatus === 'error').length > 0) {
            //return 'error';
            return applicationStatus.error;
        }
    }
    return status;
}

module.exports = {
    // eslint-disable-next-line object-shorthand
    updateApplicationStatus,
    // eslint-disable-next-line object-shorthand
    applicationStatus
};