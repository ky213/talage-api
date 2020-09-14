'use strict';

// TODO This business logic shoud move to a service or the Application-BO.

/**
 * Ensures that a quote has a value for aggregated_status
 *
 * @param {Object} quote - the quote to update
 * @return {void}
 */
async function updateQuoteAggregatedStatus(quote) {
    const aggregatedStatus = getQuoteAggregatedStatus(quote.bound, quote.status, quote.api_result);
    if (aggregatedStatus !== quote.aggregated_status) {
        quote.aggregated_status = aggregatedStatus;
        const sql = `
			UPDATE clw_talage_quotes
			SET aggregated_status = ${db.escape(aggregatedStatus)}
			WHERE id = ${quote.id}
		`;
        try {
            await db.query(sql);
        }
        catch (error) {
            log.error(`Could not update quote ${quote.id} aggregated status: ${error} ${__location}`);
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
    let sql = `
		SELECT 
			application.last_step,
			application.solepro,
			application.wholesale,
			agency.agency_network
		FROM clw_talage_applications AS application
		LEFT JOIN clw_talage_agencies AS agency ON agency.id = application.agency
		WHERE application.id = ${applicationID};
	`;
    let result = null;
    try {
        result = await db.query(sql);
    }
    catch (error) {
        log.error(`Could not retrieve application ${applicationID} ${__location}`);
        return;
    }
    const application = result[0];

    // Get the quotes
    sql = `
		SELECT id, aggregated_status, status, api_result
		FROM clw_talage_quotes
		WHERE application = ${applicationID};
	`;
    try {
        result = await db.query(sql);
    }
    catch (error) {
        log.error(`Could not retrieve quotes for application ${applicationID} ${__location}`);
        return;
    }
    const quotes = result;

    // Get the new application status
    let applicationStatus = '';
    switch (application.agency_network) {
        default:
            applicationStatus = getGenericApplicationStatus(application, quotes);
            break;
            // Accident Fund
        case 2:
            applicationStatus = getAccidentFundApplicationStatus(application, quotes);
            break;
    }
    // console.log('application', application);
    // console.log('quotes', quotes);
    // console.log('status', applicationStatus);

    // Set the new application status
    sql = `
		UPDATE clw_talage_applications
		SET status = ${db.escape(applicationStatus.appStatusDesc)}, appStatusid = ${db.escape(applicationStatus.appStatusId)}
		WHERE id = ${applicationID};
	`;
    try {
        result = await db.query(sql);
    }
    catch (error) {
        log.error(`Could not retrieve quotes for application ${applicationID} ${__location}`);
    }
}

/**
 * Retrieves an aggregated quote status
 *
 * @param {Boolean} bound - whether or not the quote is bound
 * @param {String} status - quote status
 * @param {String} api_result - result from the api call
 * @return {void}
 */
function getQuoteAggregatedStatus(bound, status, api_result) {
    if (bound) {

        return 'bound';
    }
    else if (status === 'bind_requested' && api_result === 'referred_with_price') {
        return 'request_to_bind_referred';
    }
    else if (status === 'bind_requested') {
        return 'request_to_bind';
    }
    else if (api_result === 'quoted') {
        return 'quoted';
    }
    else if (api_result === 'referred_with_price') {
        return 'quoted_referred';
    }
    else if (api_result === 'referred') {
        return 'referred';
    }
    else if (api_result === 'declined' || api_result === 'autodeclined') {
        return 'declined';
    }
    return 'error';
}

/**
 * Returns the status of a generic application based on it's associated quotes. The status is a user-friendly string.
 *
 * @param {Object} application - An application record
 * @param {array} quotes - An array of quote objects
 * @return {string} - The status object {appStatusId, appStatusDesc} of the application
 */
function getGenericApplicationStatus(application, quotes) {
    // Ensure that each quote has an aggregated status (backwards compatibility)
    quotes.forEach((quote) => updateQuoteAggregatedStatus(quote));

    if (application.last_step < 8) {
        //appStatusId = 0
        return { appStatusId: 0, appStatusDesc:'incomplete'};
    }
    else if (application.solepro || application.wholesale) {
        //TODO separate status logic
        //appStatusId = 5

        return { appStatusId: 5, appStatusDesc:'wholesale'};
    }
    else if (quotes.some((quote) => quote.aggregated_status === 'bound')) {
        //appStatusId = 100
        //return 'bound';
        return { appStatusId: 90, appStatusDesc:'bound'};
    }
    else if (quotes.some((quote) => quote.aggregated_status === 'request_to_bind_referred')) {
        //appStatusId = 80
        //return 'request_to_bind_referred';
        return { appStatusId: 80, appStatusDesc:'request_to_bind_referred'};
    }
    else if (quotes.some((quote) => quote.aggregated_status === 'request_to_bind')) {
        //appStatusId = 70
        //return 'request_to_bind';
        return { appStatusId: 70, appStatusDesc:'request_to_bind'};
    }
    else if (quotes.some((quote) => quote.aggregated_status === 'quoted')) {
        //appStatusId = 60
       // return 'quoted';
        return { appStatusId: 60, appStatusDesc:'quoted'};
    }
    else if (quotes.some((quote) => quote.aggregated_status === 'quoted_referred')) {
        //appStatusId = 50
        //return 'quoted_referred';
        return { appStatusId: 50, appStatusDesc:'quoted_referred'};
    }
    else if (quotes.some((quote) => quote.aggregated_status === 'referred')) {
        //appStatusId = 40
        //return 'referred';
        return { appStatusId: 50, appStatusDesc:'referred'};
    }
    else if (quotes.some((quote) => quote.aggregated_status === 'declined')) {
        //appStatusId = 30
        return 'declined';
        return { appStatusId: 30, appStatusDesc:'declined'};
    }
    else if (quotes.some((quote) => quote.aggregated_status === 'error')) {
        //appStatusId = 20
      //  return 'error';
        return { appStatusId: 20, appStatusDesc:'error'};
    }
    else if(application.last_step === 8){
        //appStatusId = 10
       // return 'questions_done';
        return { appStatusId: 10, appStatusDesc:'questions_done'};
    }
    return { appStatusId: 0, appStatusDesc:'incomplete'};
}

/**
 * Returns the status of an agency network 2 application based on it's associated quotes. The status is a user-friendly string.
 *
 * @param {Object} application - An application record
 * @param {array} quotes - An array of quote objects
 * @return {string} - The status of the application
 */
function getAccidentFundApplicationStatus(application, quotes) {
    const status = getGenericApplicationStatus(application, quotes);
    // For accident fund, we only need to 'downgrade' the status if it is declined and there exists a quote with an 'error' status.
    if (status === 'declined') {
        if (quotes.filter((quote) => quote.aggregated_status === 'error').length > 0) {
            //return 'error';
            return { appStatusId: 20, appStatusDesc:'error'};
        }
    }
    return status;
}

module.exports = {
    updateApplicationStatus: updateApplicationStatus,
    getQuoteAggregatedStatus: getQuoteAggregatedStatus
};