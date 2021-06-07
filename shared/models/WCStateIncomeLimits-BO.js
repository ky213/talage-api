'use strict';

global.requireShared('./helpers/tracker.js');
const WCStateIncomeLimitsModel = require('mongoose').model('WCStateIncomeLimits');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

module.exports = class WCStateIncomeLimitsBO {

    /**
     * Save Model
     *
     * @param {object} newObjectJSON - JSON Model to be saved
     * @returns {Boolean} - true if document save was successful
     */
    saveModel(newObjectJSON) {
        return new Promise(async(resolve, reject) => {
            if (!newObjectJSON || typeof newObjectJSON !== "object" || newObjectJSON === {}) {
                const error = `WCStateIncomeLimits-BO: Error: Empty WCStateIncomeLimits object given. ${__location}`;
                log.error(error);
                return reject(new Error(error));
            }

            let insert = true;
            let mongoWCStateIncomeLimitsDoc = null;
            if (newObjectJSON.wcStateIncomeLimitsId) {
                insert = false;
                const query = {wcStateIncomeLimitsId: newObjectJSON.wcStateIncomeLimitsId};
                try {
                    mongoWCStateIncomeLimitsDoc = WCStateIncomeLimitsModel.findOne(query);
                }
                catch (err) {
                    const error = `WCStateIncomeLimits-BO: Error: Could not find exisitng WCStateIncomeLimits document from id in saveModel: ${err}. ${__location}`;
                    log.error(error);
                    return reject(new Error(error));
                }
            }

            try {
                if (insert) {
                    await this.insertMongo(newObjectJSON);
                }
                else {
                    await this.updateMongo(mongoWCStateIncomeLimitsDoc.wcStateIncomeLimitsId, newObjectJSON);
                }
            }
            catch (err) {
                const error = `WCStateIncomeLimits-BO: Error: Failed to save WCStateIncomeLimits document: ${err}. ${__location}`;
                log.error(error);
                return reject(new Error(error));
            }

            return resolve(true);
        });
    }

    async insertMongo(newObjectJSON) {
        if (!newObjectJSON || typeof newObjectJSON !== "object" || newObjectJSON === {}) {
            const error = `WCStateIncomeLimits-BO: Error: No data supplied to insertMongo function. ${__location}`;
            log.error(error);
            throw new Error(error);
        }

        const wcStateIncomeLimitsDoc = new WCStateIncomeLimitsModel(newObjectJSON);

        try {
            await wcStateIncomeLimitsDoc.save();
        }
        catch (err) {
            const error = `WCStateIncomeLimits-BO: Error: Could not insert new WCStateIncomeLimits document into database: ${err}. ${__location}`;
            log.error(error);
            throw new Error(error);
        }

        return mongoUtils.objCleanup(wcStateIncomeLimitsDoc);
    }

    async updateMongo(wcStateIncomeLimitsId, newObjectJSON) {
        if (!wcStateIncomeLimitsId) {
            const error = `WCStateIncomeLimits-BO: Error: No id supplied to updateMongo. ${__location}`;
            log.error(error);
            throw new Error(error);
        }

        if (!newObjectJSON || typeof newObjectJSON !== "object" || newObjectJSON === {}) {
            const error = `WCStateIncomeLimits-BO: Error: Invalid object data supplied to updateMongo. ${__location}`;
            log.error(error);
            throw new Error(error);
        }

        const updateableProps = [
            "officerTitleInclusionStatuses",
            "isCustom",
            "attributes",
            "incomeLimits"
        ];

        Object.keys(newObjectJSON).forEach(prop => {
            if (!updateableProps.includes(prop)) {
                delete newObjectJSON[prop];
            }
        });

        // Add updatedAt
        newObjectJSON.updatedAt = new Date();

        const query = {wcStateIncomeLimitsId: wcStateIncomeLimitsId};
        try {
            await WCStateIncomeLimitsModel.updateOne(query, newObjectJSON);
            return mongoUtils.objCleanup(newObjectJSON);
        }
        catch (err) {
            const error = `WCStateIncomeLimits-BO: Error: Unable to update WCStateIncomeLimits document: ${err}. ${__location}`;
            log.error(error);
            throw new Error(error);
        }
    }

    async getWCStateIncomeLimitsDoc(state, entityType) {
        if (!state || typeof state !== 'string') {
            const error = `WCStateIncomeLimits-BO: Error: Invalid key "state" passed to getIncomeLimits. ${__location}`;
            log.error(error);
            throw new Error(error);
        }
        if (!entityType || typeof entityType !== 'string') {
            const error = `WCStateIncomeLimits-BO: Error: Invalid key "entityType" passed to getIncomeLimits. ${__location}`;
            log.error(error);
            throw new Error(error);
        }

        const query = {
            state: state,
            entityType: entityType
        };
        let wcStateIncomeLimitsDoc = null;
        try {
            wcStateIncomeLimitsDoc = WCStateIncomeLimitsModel.findOne(query);
        }
        catch (err) {
            const error = `WCStateIncomeLimits-BO: Error: Could not find WCStateIncomeLimits document in database: ${err}. ${__location}`;
            log.error(error);
            throw new Error(error);
        }

        return wcStateIncomeLimitsDoc;
    }
}