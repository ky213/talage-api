'use strict';

// const WCStateIncomeLimitsBO = require('../models/WCStateIncomeLimits-BO');
const WCStateIncomeLimitsBO = global.requireShared('./models/WCStateIncomeLimits-BO');
const colors = require('colors');

/**
 *
 * @param {String} state - [required] Two letter state postal abbreviation
 * @param {String} entityType - [required] Talage entity type
 * @returns {object} - Object including effectiveDate and minimum income limit, maximum income limit, or both
 */
exports.getIncomeLimits = async function(state, entityType) {
    console.log(JSON.stringify(WCStateIncomeLimitsBO));
    let wcStateIncomeLimitsDoc = null;
    try {
        wcStateIncomeLimitsDoc = await WCStateIncomeLimitsBO.getWCStateIncomeLimitsDoc(state, entityType);
    }
    catch (err) {
        log.error(`WCStateIncomeLimitsSvc: Error: Failed to get document from WCStateIncomeLimitsBO: ${err}. ${__location}`);
        return null;
    }

    if (wcStateIncomeLimitsDoc) {
        return getEffectiveIncomeLimitsEntry(wcStateIncomeLimitsDoc.incomeLimits);
    }
    else {

        log.error(`WCStateIncomeLimitsSvc: Error: Database did not return a document ${__location}`);
        return null;
    }
}

/**
 *
 * @param {Array} incomeLimits - Array of income limits and their effective dates
 * @returns {object} - effectiveLimits
 */
function getEffectiveIncomeLimitsEntry(incomeLimits) {
    if (!Array.isArray(incomeLimits) || incomeLimits.length === 0) {
        const error = `WCStateIncomeLimitsSvc: Error: Invalid input supplied to getEffectiveIncomeLimitsEntry. ${__location}`;
        log.error(error);
        throw new Error(error);
    }
    console.log(JSON.stringify(incomeLimits).brightMagenta); // zy DEBUG Remove
    return incomeLimits.reduce((effectiveLimit, limit) => {
        if (limit.effectiveDate > effectiveLimit.effectiveDate && limit.effectiveDate < Date.now()) {
            return limit;
        }
        else {
            return effectiveLimit;
        }
    });
}