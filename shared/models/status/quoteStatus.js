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
    piError: {
        id: 5,
        description: "PI Error"
    },
    error: {
        id: 10,
        description: "Error"
    }, 
    outage: {
        id: 12,
        description: "Outage"
    },
    autodeclined: {
        id: 15,
        description: "Auto Declined"
    },
    piOutOfAppetite: {
        id: 17,
        description: "PI Out of Appetite"
    },
    declined: {
        id: 20,
        description: "Declined"
    },
    priceIndication: {
        id: 25,
        description: "Price Indication"
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
        id: 58,
        description: "Dead"
    },
    bind_requested: {
        id: 60,
        description: "Bind Requested"
    },
    bind_requested_referred: {
        id: 65,
        description: "Bind Requested for Referral"
    },
    bound: {
        id: 100,
        description: "Bound"
    }
};

/**
 * Retrieves a quote status
 *
 * @param {Boolean} bound - whether or not the quote is bound
 * @param {String} status - quote status
 * @param {String} apiResult - result from the api call
 * @param {boolean} timeout - Whether or not the quote timed out
 * @return {void}
 * 
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
    else if (apiResult === 'price_indication') {
        // return 'priceIndication';
        return quoteStatus.priceIndication;
    }
    else if (apiResult === 'acord_emailed') {
        // return 'acord_emailed';
        return quoteStatus.ACORDEmailed;
    }
    else if (apiResult === 'declined') {
        // return 'declined';
        return quoteStatus.declined;
    }
    else if (apiResult === 'pi_outofappetite') {
        // return 'piOutOfAppetite';
        return quoteStatus.piOutOfAppetite;
    }
    else if (apiResult === 'autodeclined') {
        return quoteStatus.autodeclined;
    }
    else if (apiResult === 'outage') {
        return quoteStatus.outage;
    }
    else if (apiResult === quoteStatus.initiated.description && !timeout) {
        return quoteStatus.initiated;
    }
    else if (timeout) {
        // Making this explicit, even though a fall-through would result in the same error result, in case we change this in the future...
        return quoteStatus.error;
    }

    return quoteStatus.error;
}

module.exports = {
    getQuoteStatus,
    quoteStatus
};