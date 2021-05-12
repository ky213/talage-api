/* eslint-disable object-property-newline */
/* eslint-disable object-curly-spacing */
/* eslint-disable object-curly-newline */
'use strict';

const { updateQuoteStatus } = require('./quoteStatus.js');

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
    let applicationStatus = '';
    switch (applicationDocJson.agencyNetworkId) {
        default:
            applicationStatus = getGenericApplicationStatus(applicationDocJson, quoteDocJsonList, timeout);
            break;
        // Accident Fund
        case 2:
            applicationStatus = getAccidentFundApplicationStatus(applicationDocJson, quoteDocJsonList, timeout);
            break;
    }

    // Set the new application status
    try {
        //TODO change to applicationId
        await applicationBO.updateStatus(applicationDocJson.applicationId, applicationStatus.appStatusDesc, applicationStatus.appStatusId);
    }
    catch (err) {
        log.error(`Error update appication status appId = ${applicationDocJson.applicationId}  ${db.escape(applicationStatus.appStatusDesc)} ` + err + __location);
    }
    return applicationStatus;
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
    quoteDocJsonList.forEach((quoteDocJson) => updateQuoteStatus(quoteDocJson));
    if (applicationDoc.appStatusId < 10) {
        //appStatusId = 0
        return { appStatusId: 0, appStatusDesc: 'incomplete' };
    }
    else if (applicationDoc.solepro || applicationDoc.wholesale) {
        //TODO separate status logic
        //appStatusId = 5

        return { appStatusId: 5, appStatusDesc: 'wholesale' };
    }
    else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'bound')) {
        //appStatusId = 100
        //return 'bound';
        return { appStatusId: 90, appStatusDesc: 'bound' };
    }
    else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'request_to_bind_referred')) {
        //appStatusId = 80
        //return 'request_to_bind_referred';
        return { appStatusId: 80, appStatusDesc: 'request_to_bind_referred' };
    }
    else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'request_to_bind')) {
        //appStatusId = 70
        //return 'request_to_bind';
        return { appStatusId: 70, appStatusDesc: 'request_to_bind' };
    }
    else if (quoteDocJsonList.every(quote => quote.aggregatedStatus === 'dead')) {
        return { appStatusId: 65, appStatusDesc: 'dead' };
    }
    else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'quoted')) {
        //appStatusId = 60
        // return 'quoted';
        return { appStatusId: 60, appStatusDesc: 'quoted' };
    }
    else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'quoted_referred')) {
        //appStatusId = 50
        //return 'quoted_referred';
        return { appStatusId: 50, appStatusDesc: 'quoted_referred' };
    }
    else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'acord_emailed')) {
        //appStatusId = 45
        //return 'acord_emailed';
        return { appStatusId: 45, appStatusDesc: 'acord_emailed' };
    }
    else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'referred')) {
        //appStatusId = 40
        //return 'referred';
        return { appStatusId: 40, appStatusDesc: 'referred' };
    }
    else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'declined')) {
        //appStatusId = 30
        // return 'declined';
        return { appStatusId: 30, appStatusDesc: 'declined' };
    }
    else if (quoteDocJsonList.some((quote) => quote.aggregatedStatus === 'error')) {
        //appStatusId = 20
        //  return 'error';
        return { appStatusId: 20, appStatusDesc: 'error' };
    }
    else if (applicationDoc.lastStep === 8 || applicationDoc.appStatusId === 10) {
        //appStatusId = 10
        // return 'questions_done';
        return { appStatusId: 10, appStatusDesc: 'questions_done' };
    }
    else if(timeout) {
        // if timeout is specified then return error if nothing above is chosen
        return { appStatusId: 20, appStatusDesc: 'error' };
    }
    else{
        return { appStatusId: 0, appStatusDesc: 'incomplete' };
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
            return { appStatusId: 20, appStatusDesc: 'error' };
        }
    }
    return status;
}

module.exports = {
    // eslint-disable-next-line object-shorthand
    updateApplicationStatus
};