/* eslint-disable object-property-newline */
/* eslint-disable object-curly-spacing */
/* eslint-disable object-curly-newline */
'use strict';

const quoteStatus = {
    initiated: {
        id: 0,
        description: "Initiated"
    },
    // generic error, can be broken down into specifics within the range 11-19
    error: {
        id: 10,
        description: "Error"
    },
    // may want to include auto declined deliniation? 
    declined: {
        id: 11,
        description: "Declined"
    },
    ACORDEmailed: {
        id: 20,
        description: "ACORD Emailed"
    },
    referred: {
        id: 30,
        description: "Referred"
    },
    quoted: {
        id: 40,
        description: "Quoted"
    },
    quoted_referred: {
        id: 41,
        description: "Referred Quote"
    },
    bind_requested: {
        id: 50,
        description: "Bind Requested"
    },
    bind_requested_referred: {
        id: 51,
        description: "Bind Requested for Referral"
    },
    bound: {
        id: 60,
        description: "Bound"
    },
    bound_external: {
        id: 61,
        description: "Externally Bound"
    }
};

/**
 * Ensures that a quote has a value for aggregated_status
 *
 * @param {Object} quoteDocJson - the quote to update
 * @return {void}
 */
// TODO: Rename this to updateQuoteStatus once we deprecate quote.aggregatedStatus
async function updateQuoteStatus(quoteDocJson) {
    const QuoteBO = global.requireShared('./models/Quote-BO.js');
    const status = getQuoteStatus(quoteDocJson.bound, quoteDocJson.status, quoteDocJson.apiResult);
    // have both checks just for backwards compatibility, in case there is misalignment, to force an update
    if (status.id !== quoteDocJson.quoteStatusId || status.description !== quoteDocJson.quoteStatusDescription) {
        const quoteBO = new QuoteBO();
        try {
            await quoteBO.updateQuoteStatus(quoteDocJson.id, status);
        }
        catch (error) {
            log.error(`Could not update quote ${quoteDocJson.id} status: ${error} ${__location}`);
            return false;
        }
    }
    return true;
}

/**
 * Retrieves an aggregated quote status
 *
 * @param {Boolean} bound - whether or not the quote is bound
 * @param {String} status - quote status
 * @param {String} apiResult - result from the api call
 * @return {void}
 */
 function getQuoteStatus(bound, status, apiResult) {
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

    // return 'error';
    return quoteStatus.error;
}

module.exports = {
    getQuoteStatus,
    updateQuoteStatus,
    quoteStatus
};