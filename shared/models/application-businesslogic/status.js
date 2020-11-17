/* eslint-disable object-property-newline */
/* eslint-disable object-curly-spacing */
/* eslint-disable object-curly-newline */
'use strict';
const ApplicationBO = global.requireShared('./models/Application-BO.js');
const QuoteBO = global.requireShared('./models/Quote-BO.js');


/**
 * Ensures that a quote has a value for aggregated_status
 *
 * @param {Object} quoteDocJson - the quote to update
 * @return {void}
 */
async function updateQuoteAggregatedStatus(quoteDocJson) {
    const aggregatedStatus = getQuoteAggregatedStatus(quoteDocJson.bound, quoteDocJson.status, quoteDocJson.apiResult);
    if (aggregatedStatus !== quoteDocJson.aggregatedStatus) {
        quoteDocJson.aggregatedStatus = aggregatedStatus;
        const quoteBO = new QuoteBO();
        try {
            await quoteBO.updateQuoteAggregatedStatus(quoteDocJson.id, aggregatedStatus);
        }
        catch (error) {
            log.error(`Could not update quote ${quoteDocJson.id} aggregated status: ${error} ${__location}`);
            return false;
        }
    }
    return true;
}

/**
 * Ensures that a quote has a value for aggregated_status
 *
 * @param {Number} applicationID - ID of the application to update
 * @return {void}
 */
async function updateApplicationStatus(applicationID) {
    // Get the application
    const applicationBO = new ApplicationBO();
    let ApplicationDoc = null;
    try{
        ApplicationDoc = await applicationBO.loadfromMongoBymysqlId(applicationID)
    }
    catch(err){
        log.error(`Could not retrieve application ${applicationID} ${__location}`);
        return;
    }

    // Get the quotes


    const quoteBO = new QuoteBO();
    let quoteDocJsonList = null;
    try {
        quoteDocJsonList = await quoteBO.getByApplicationId(ApplicationDoc.applicationId);
    }
    catch (error) {
        log.error(`Could not get quotes for application  ${ApplicationDoc.applicationId} ${__location}`);
        return;
    }

    // Get the new application status
    let applicationStatus = '';
    switch (ApplicationDoc.agencyNetworkId) {
        default:
            applicationStatus = getGenericApplicationStatus(ApplicationDoc, quoteDocJsonList);
            break;
        // Accident Fund
        case 2:
            applicationStatus = getAccidentFundApplicationStatus(ApplicationDoc, quoteDocJsonList);
            break;
    }

    // Set the new application status

    try {
        await applicationBO.updateStatus(applicationID, applicationStatus.appStatusDesc, applicationStatus.appStatusId);
    }
    catch (err) {
        log.error(`Error update appication status appId = ${applicationID}  ${db.escape(applicationStatus.appStatusDesc)} ` + err + __location);
    }
}

/**
 * Retrieves an aggregated quote status
 *
 * @param {Boolean} bound - whether or not the quote is bound
 * @param {String} status - quote status
 * @param {String} apiResult - result from the api call
 * @return {void}
 */
function getQuoteAggregatedStatus(bound, status, apiResult) {
    if (bound) {

        return 'bound';
    }
    else if (status === 'bind_requested' && apiResult === 'referred_with_price') {
        return 'request_to_bind_referred';
    }
    else if (status === 'bind_requested') {
        return 'request_to_bind';
    }
    else if (apiResult === 'quoted') {
        return 'quoted';
    }
    else if (apiResult === 'referred_with_price') {
        return 'quoted_referred';
    }
    else if (apiResult === 'referred') {
        return 'referred';
    }
    else if (apiResult === 'acord_emailed') {
        return 'acord_emailed';
    }
    else if (apiResult === 'declined' || apiResult === 'autodeclined') {
        return 'declined';
    }
    return 'error';
}

/**
 * Returns the status of a generic application based on it's associated quotes. The status is a user-friendly string.
 *
 * @param {Object} applicationDoc - An application record
 * @param {array} quoteDocJsonList - An array of quote objects
 * @return {string} - The status object {appStatusId, appStatusDesc} of the application
 */
function getGenericApplicationStatus(applicationDoc, quoteDocJsonList) {
    // Ensure that each quote has an aggregated status (backwards compatibility)
    quoteDocJsonList.forEach((quoteDocJson) => updateQuoteAggregatedStatus(quoteDocJson));

    if (applicationDoc.lastStep < 8) {
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
    else if (applicationDoc.lastStep === 8) {
        //appStatusId = 10
        // return 'questions_done';
        return { appStatusId: 10, appStatusDesc: 'questions_done' };
    }
    return { appStatusId: 0, appStatusDesc: 'incomplete' };
}

/**
 * Returns the status of an agency network 2 application based on it's associated quotes. The status is a user-friendly string.
 *
 * @param {Object} applicationDoc - An application record
 * @param {array} quoteDocJsonList - An array of quote objects
 * @return {string} - The status of the application
 */
function getAccidentFundApplicationStatus(applicationDoc, quoteDocJsonList) {
    const status = getGenericApplicationStatus(applicationDoc, quoteDocJsonList);
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
    updateApplicationStatus: updateApplicationStatus,
    getQuoteAggregatedStatus: getQuoteAggregatedStatus
};