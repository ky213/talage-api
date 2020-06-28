'use strict';

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

// } else if (quotes.some((quote) => quote.bound)) {
// 	return 'bound';
// } else if (quotes.some((quote) => quote.status === 'bind_requested' && quote.api_result === 'referred_with_price')) {
// 	return 'request_to_bind_referred';
// } else if (quotes.some((quote) => quote.status === 'bind_requested')) {
// 	return 'request_to_bind';
// } else if (quotes.some((quote) => quote.api_result === 'quoted')) {
// 	return 'quoted';
// } else if (quotes.some((quote) => quote.api_result === 'referred_with_price')) {
// 	return 'quoted_referred';
// } else if (quotes.some((quote) => quote.api_result === 'referred')) {
// 	return 'referred';
// } else if (quotes.some((quote) => quote.api_result === 'declined' || quote.api_result === 'autodeclined')) {
// 	return 'declined';
// } else if (quotes.some((quote) => quote.api_result === 'error' || quote.api_result === 'outage')) {
// 	return 'error';
// }

function getApplicationStatus(agencyNetwork, application, quotes, statusList, currentStatusSlug) {
	switch (agencyNetwork) {
		case 1:
		default:
			quotes.forEach((quote) => {
				currentStatusSlug = getApplicationGenericStatus(application, quote, statusList, currentStatusSlug);
			});
		case 2:
			quotes.forEach((quote) => {
				currentStatusSlug = getApplicationAccidentFundStatus(application, quote, statusList, currentStatusSlug);
			});
	}
	return currentStatusSlug;
}

function getApplicationIncrementalStatus(agencyNetwork, application, quote, statusList, currentStatusSlug) {
	switch (agencyNetwork) {
		case 1:
		default:
			return getApplicationGenericStatus(application, quote, statusList, currentStatusSlug);
		case 2:
			return getApplicationAccidentFundStatus(application, quote, statusList, currentStatusSlug);
	}
	// We will never get here due to default: handling
	return null;
}

/** Compares two statuses
 *
 * @param {String} statusSlug1 - application status slug 1
 * @param {String} statusSlug2 - application status slug 2
 * @return {Number} - -1 if statusSlug1 rank < statusSlug2 rank, 0 if equal, 1 if statusSlug1 rank > statusSlug2 rank
 */
function compareStatuses(statusList, statusSlug1, statusSlug2) {
	if (statusSlug1 === statusSlug2) {
		return 0;
	}
	try {
		const rank1 = statusList.find((status) => status.slug === statusSlug1).rank;
		const rank2 = statusList.find((status) => status.slug === statusSlug2).rank;
	} catch (error) {
		// We can't continue
		log.error(`Error comparing application statuses: ${error}`);
		throw `Error comparing application statuses: ${error}`;
	}
}

function getApplicationGenericStatus(application, quote, statusList, currentStatusSlug) {
	// If the application was never completed, we always return "incomplete".
	if (application.last_step < 8) {
		return 'incomplete';
	}
	// If the application is wholesale, that's it.
	if (application.solepro || application.wholesale) {
		return 'wholesale';
	}

	// Get the rank of the existing status
	const currentStatusEntry = statusList.find((status) => status.slug === currentStatusSlug);
	if (!currentStatusEntry) {
		log.error(`getGenericStatusSlug encountered an unknown status slug '${currentStatusSlug}'`);
		throw `getGenericStatusSlug encountered an unknown status slug '${currentStatusSlug}'`;
	}
	const applicationStatusRank = currentStatusEntry.rank;
	console.log('applicationStatusRank', applicationStatusRank);

	// Get the quote status
	let quoteStatus = '';

	// } else if (application.solepro || application.wholesale) {
	// 	return 'wholesale';
	return 'incomplete';
}

function getApplicationAccidentFundStatus(application, quote, statusList, currentStatus) {
	// if the application was never completed, we always return "incomplete".
	if (application.last_step < 8) {
		return 'incomplete';
	}
}

// /**
//  * Returns the status of a generic application based on it's associated quotes. The status is a user-friendly string.
//  *
//  * @param {Object} application - An application record
//  * @param {array} quotes - An array of quote objects
//  * @return {string} - The status of the application
//  */
// function getGenericApplicationStatus(application, quotes){
// 	if(application.last_step < 8){
// 		return 'incomplete';
// 	}else if(application.solepro || application.wholesale){
// 		return 'wholesale';
// 	}else if(quotes.some((quote) => quote.bound)){
// 		return 'bound';
// 	}else if(quotes.some((quote) => quote.status === 'bind_requested' && quote.api_result === 'referred_with_price')){
// 		return 'request_to_bind_referred';
// 	}else if(quotes.some((quote) => quote.status === 'bind_requested')){
// 		return 'request_to_bind';
// 	}else if(quotes.some((quote) => quote.api_result === 'quoted')){
// 		return 'quoted';
// 	}else if(quotes.some((quote) => quote.api_result === 'referred_with_price')){
// 		return 'quoted_referred';
// 	}else if(quotes.some((quote) => quote.api_result === 'referred')){
// 		return 'referred';
// 	}else if(quotes.some((quote) => quote.api_result === 'declined' || quote.api_result === 'autodeclined')){
// 		return 'declined';
// 	}else if(quotes.some((quote) => quote.api_result === 'error' || quote.api_result === 'outage')){
// 		return 'error';
// 	}
// 	return 'incomplete';
// }

// /**
//  * Returns the status of an agency network 2 application based on it's associated quotes. The status is a user-friendly string.
//  *
//  * @param {Object} application - An application record
//  * @param {array} quotes - An array of quote objects
//  * @return {string} - The status of the application
//  */
// function getAccidentFundApplicationStatue(application, quotes){
// 	if(application.last_step < 8){
// 		return 'incomplete';
// 	}else if(application.solepro || application.wholesale){
// 		return 'wholesale';
// 	}else if(quotes.some((quote) => quote.bound)){
// 		return 'bound';
// 	}else if(quotes.some((quote) => quote.status === 'bind_requested' && quote.api_result === 'referred_with_price')){
// 		return 'request_to_bind_referred';
// 	}else if(quotes.some((quote) => quote.status === 'bind_requested')){
// 		return 'request_to_bind';
// 	}else if(quotes.some((quote) => quote.api_result === 'quoted')){
// 		return 'quoted';
// 	}else if(quotes.some((quote) => quote.api_result === 'referred_with_price')){
// 		return 'quoted_referred';
// 	}else if(quotes.some((quote) => quote.api_result === 'referred')){
// 		return 'referred';
// 	}else if(quotes.every((quote) => quote.api_result === 'error' || quote.api_result === 'outage')){
// 		// If all are ERROR, then status is ERROR
// 		return 'error';
// 	}else if(quotes.every((quote) => quote.api_result === 'autodeclined')){
// 		// If all are AUTODECLINED, then status is AUTODECLINED
// 		return 'declined';
// 	}else if(quotes.some((quote) => quote.api_result === 'declined')){
// 		// If at least one is DECLINED, then status is DECLINED
// 		return 'declined';
// 	}
// 	// If one is ERROR and all the others are AUTODECLINED, then status is ERROR
// 	const errorCount = quotes.filter((quote) => quote.api_result === 'error' || quote.api_result === 'outage').length;
// 	const autodeclinedCount = quotes.filter((quote) => quote.api_result === 'autodeclined').length;
// 	if(errorCount === 1 && errorCount + autodeclinedCount === quotes.length){
// 		return 'error';
// 	}

// 	return 'incomplete';
// }

module.exports = {
	getApplicationStatus,
	getApplicationIncrementalStatus,
	getQuoteAggregatedStatus
};
