/* eslint-disable object-shorthand */
/* eslint-disable no-trailing-spaces */
/* eslint-disable object-property-newline */
/* eslint-disable object-curly-spacing */
/* eslint-disable object-curly-newline */
'use strict';

const quoteStatus = {
    initiated: {
        id: 0,
        description: "Initiated"
    },
    error: {
        id: 10,
        description: "Error"
    },
    // may want to include auto declined delineation? 
    declined: {
        id: 20,
        description: "Declined"
    },
    ACORDEmailed: {
        id: 30,
        description: "ACORD Emailed"
    },
    referred: {
        id: 40,
        description: "Referred"
    },
    quoted: {
        id: 50,
        description: "Quoted"
    },
    quoted_referred: {
        id: 55,
        description: "Referred Quote"
    },
    dead: {
        id: 60,
        description: "Dead"
    },
    bind_requested: {
        id: 70,
        description: "Bind Requested"
    },
    bind_requested_referred: {
        id: 75,
        description: "Bind Requested for Referral"
    },
    bound: {
        id: 100,
        description: "Bound"
    }
};

/**
 * Ensures that a quote has a value for aggregated_status
 *
 * @param {Object} quoteDocJson - the quote to update
 * @param {boolean} timeout - optional (defaulted to false), whether or not the quote timed out
 * @return {void}
 */
async function updateQuoteStatus(quoteDocJson, timeout = false) {
    const QuoteBO = global.requireShared('./models/Quote-BO.js');
    const status = getQuoteStatus(quoteDocJson.bound, quoteDocJson.status, quoteDocJson.apiResult, timeout);

    // have both checks just for backwards compatibility, in case there is misalignment, to force an update
    if (status.id !== quoteDocJson.quoteStatusId || status.description !== quoteDocJson.quoteStatusDescription) {
        // note: this is done purely because the function that calls this expects aggregatedStatus to exist
        //       this will be removed once aggregatedStatus is fully removed
        quoteDocJson.aggregatedStatus = convertToAggregatedStatus(status);
        const quoteBO = new QuoteBO();
        try {
            await quoteBO.updateQuoteAggregatedStatus(quoteDocJson, status);
        }
        catch (error) {
            log.error(`Could not update quote ${quoteDocJson.id} status: ${error} ${__location}`);
            return false;
        }
    }
    return true;
}

/**
 * Retrieves a quote status
 *
 * @param {Boolean} bound - whether or not the quote is bound
 * @param {String} status - quote status
 * @param {String} apiResult - result from the api call
 * @param {boolean} timeout - Whether or not the quote timed out
 * @return {void}
 * 
 * NOTE: This whole function will change once we get rid of aggregatedStatus and rework what is passed in by apiResult
 */
function getQuoteStatus(bound, status, apiResult, timeout) {
    if (bound) {
        // return 'bound';
        return quoteStatus.bound;
    }
    else if (status === 'bind_requested' && apiResult === 'referred_with_price') {
        // return 'request_to_bind_referred';
        return quoteStatus.bind_requested_referred;
    }
    else if (status === 'bind_requested') {
        // return 'request_to_bind';
        return quoteStatus.bind_requested;
    }
    else if (apiResult === 'quoted') {
        // return 'quoted';
        return quoteStatus.quoted;
    }
    else if (apiResult === 'referred_with_price') {
        // return 'quoted_referred';
        return quoteStatus.quoted_referred;
    }
    else if (apiResult === 'referred') {
        // return 'referred';
        return quoteStatus.referred;
    }
    else if (apiResult === 'acord_emailed') {
        // return 'acord_emailed';
        return quoteStatus.ACORDEmailed;
    }
    else if (apiResult === 'declined' || apiResult === 'autodeclined') {
        // return 'declined';
        return quoteStatus.declined;
    }
    else if (apiResult === quoteStatus.initiated.description && !timeout) {
        return quoteStatus.initiated;
    }
    else if (timeout) {
        // Making this explicit, even though a fall-through would result in the same error result, in case we change this in the future...
        return quoteStatus.error;
    }

    // return 'error';
    return quoteStatus.error;
}

/**
 * This function's sole purpose is to facilitate keeping the current aggregatedStatus logic in place
 * Once we remove all notions of aggregatedStatus from the code, this function can be removed. 
 * 
 * Use: Wherever we assign aggregatedStatus on the quote, just use the return value of this function
 */

// eslint-disable-next-line no-unused-vars
const convertToAggregatedStatus = ({id, description}) => {
    // NOTE: There is no aggregate case for new status "initiated"
    switch (id) {
        case quoteStatus.bound.id:
            return 'bound';
        case quoteStatus.bind_requested_referred.id:
            return 'request_to_bind_referred';
        case quoteStatus.bind_requested.id:
            return 'request_to_bind';
        case quoteStatus.quoted.id:
            return 'quoted';
        case quoteStatus.quoted_referred.id:
            return 'quoted_referred';
        case quoteStatus.referred.id:
            return 'referred';
        case quoteStatus.ACORDEmailed.id:
            return 'acord_emailed';
        case quoteStatus.declined.id:
            return 'declined';
        case quoteStatus.error.id:
            return 'error';
        default:
            // This will generally hit in cases where it's a new quote, which is considered initiated, but we used to not record this early, 
            // so there's no aggregatedStatus for the quote at this stage. 
            // log.warn(`Cannot convert to aggregate, unknown status: [${id}: ${description}]`);
            return '';
    }
}

module.exports = {
    getQuoteStatus,
    updateQuoteStatus,
    convertToAggregatedStatus,
    quoteStatus
};