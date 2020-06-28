'use strict';

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
	} else if (status === 'bind_requested' && api_result === 'referred_with_price') {
		return 'request_to_bind_referred';
	} else if (status === 'bind_requested') {
		return 'request_to_bind';
	} else if (api_result === 'quoted') {
		return 'quoted';
	} else if (api_result === 'referred_with_price') {
		return 'quoted_referred';
	} else if (api_result === 'referred') {
		return 'referred';
	} else if (api_result === 'declined' || api_result === 'autodeclined') {
		return 'declined';
	}
	return 'error';
}

/**
 * Ensures that a quote has a value for aggregated_status
 *
 * @return {void}
 */
async function checkQuoteAggregatedStatus(quote) {
	if (!quote.aggregated_status || quote.aggregated_status.length === 0) {
		quote.aggregated_status = getQuoteAggregatedStatus(quote.bound, quote.status, quote.api_result);
	}
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
	} catch (error) {
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
	} catch (error) {
		log.error(`Could not retrieve quotes for application ${applicationID} ${location}`);
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
		SET status = ${db.escape(applicationStatus)}
		WHERE id = ${applicationID};
	`;
	try {
		result = await db.query(sql);
	} catch (error) {
		log.error(`Could not retrieve quotes for application ${applicationID} ${location}`);
	}
}

/**
 * Returns the status of a generic application based on it's associated quotes. The status is a user-friendly string.
 *
 * @param {Object} application - An application record
 * @param {array} quotes - An array of quote objects
 * @return {string} - The status of the application
 */
function getGenericApplicationStatus(application, quotes) {
	// Ensure that each quote has an aggregated status (backwards compatibility)
	quotes.forEach((quote) => checkQuoteAggregatedStatus(quote));

	if (application.last_step < 8) {
		return 'incomplete';
	} else if (application.solepro || application.wholesale) {
		return 'wholesale';
	} else if (quotes.some((quote) => quote.aggregated_status === 'bound')) {
		return 'bound';
	} else if (quotes.some((quote) => quote.aggregated_status === 'request_to_bind_referred')) {
		return 'request_to_bind_referred';
	} else if (quotes.some((quote) => quote.aggregated_status === 'request_to_bind')) {
		return 'request_to_bind';
	} else if (quotes.some((quote) => quote.aggregated_status === 'quoted')) {
		return 'quoted';
	} else if (quotes.some((quote) => quote.aggregated_status === 'quoted_referred')) {
		return 'quoted_referred';
	} else if (quotes.some((quote) => quote.aggregated_status === 'referred')) {
		return 'referred';
	} else if (quotes.some((quote) => quote.aggregated_status === 'declined')) {
		return 'declined';
	} else if (quotes.some((quote) => quote.aggregated_status === 'error')) {
		return 'error';
	}
	return 'incomplete';
}

/**
 * Returns the status of an agency network 2 application based on it's associated quotes. The status is a user-friendly string.
 *
 * @param {Object} application - An application record
 * @param {array} quotes - An array of quote objects
 * @return {string} - The status of the application
 */
function getAccidentFundApplicationStatus(application, quotes) {
	let status = getGenericApplicationStatus(applicatin, quotes);
	if (status === 'declined') {
		// Ensure there aren't any errors and autodeclines. If yes, it should be 'error'.
		const errorCount = quotes.filter((quote) => quote.aggregated_status === 'error').length;
		const autodeclinedCount = quotes.filter((quote) => quote.api_result === 'autodeclined').length;
		// If 1 error and the rest are auto-declined, it should just be 'error'.
		if (errorCount === 1 && errorCount + autodeclinedCount === quotes.length) {
			return 'error';
		}
	}
	return status;
}

module.exports = {
	updateApplicationStatus,
	getQuoteAggregatedStatus
};
