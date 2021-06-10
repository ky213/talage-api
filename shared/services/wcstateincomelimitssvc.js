'use strict';

const WCStateIncomeLimitsBO = global.requireShared('./models/WCStateIncomeLimits-BO');

/**
 *
 * @param {String} state - [required] Two letter state postal abbreviation
 * @param {String} entityType - [required] Talage entity type
 * @returns {object} - Object including effectiveDate and minimum income limit, maximum income limit, or both
 */
exports.getIncomeLimits = async function(state, entityType) {
    const wcStateIncomeLimitsBO = new WCStateIncomeLimitsBO();
    let wcStateIncomeLimitsDoc = null;
    try {
        wcStateIncomeLimitsDoc = await wcStateIncomeLimitsBO.getWCStateIncomeLimitsDoc(state, entityType);
    }
    catch (err) {
        log.error(`WCStateIncomeLimitsSvc: Error: Failed to get document from wcStateIncomeLimitsBO: ${err}. ${__location}`);
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
 * @param {Array} incomeLimits - Array of effective min/max income limits
 * @returns {object} - effectiveLimits
 */
function getEffectiveIncomeLimitsEntry(incomeLimits) {
    if (!Array.isArray(incomeLimits) || incomeLimits.length === 0) {
        const error = `WCStateIncomeLimitsSvc: Error: Invalid input supplied to getEffectiveIncomeLimitsEntry. ${__location}`;
        log.error(error);
        throw new Error(error);
    }

    // Find the latest effective date that is not in the future
    return incomeLimits.reduce((effectiveLimit, limit) => {
        if (limit.effectiveDate > effectiveLimit.effectiveDate && limit.effectiveDate < Date.now()) {
            return limit;
        }
        else {
            return effectiveLimit;
        }
    });
}