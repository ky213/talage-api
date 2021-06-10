'use strict';

global.requireShared('./helpers/tracker.js');
const WCStateIncomeLimitsModel = require('mongoose').model('WCStateIncomeLimits');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

module.exports = class WCStateIncomeLimitsBO {

    /**
     * Save Model
     *
     * @param {object} newObjectJSON - JSON Model to be saved
     * @returns {Boolean} - true if document save was successful
     */
    async saveModel(newObjectJSON) {
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
                    mongoWCStateIncomeLimitsDoc = await WCStateIncomeLimitsModel.findOne(query);
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

    getList(requestQueryJSON) {
        return new Promise(async(resolve, reject) => {

            if(!requestQueryJSON){
                requestQueryJSON = {};
            }
            const queryJSON = JSON.parse(JSON.stringify(requestQueryJSON));

            const queryProjection = {
                "__v": 0,
                "_id": 0,
                "id": 0
            }

            let findCount = false;
            if(queryJSON.count){
                if(queryJSON.count === 1 || queryJSON.count === true || queryJSON.count === "1" || queryJSON.count === "true"){
                    findCount = true;
                }
                delete queryJSON.count;
            }

            // eslint-disable-next-line prefer-const
            let query = {active: true};
            let error = null;

            var queryOptions = {lean:true};
            queryOptions.sort = {wcStateIncomeLimitsId: 1};
            if (queryJSON.sort) {
                var wcls = 1;
                if (queryJSON.desc) {
                    wcls = -1;
                    delete queryJSON.desc
                }
                queryOptions.sort[queryJSON.sort] = wcls;
                delete queryJSON.sort
            }

            const queryLimit = 5000;
            if (queryJSON.limit) {
                var limitNum = parseInt(queryJSON.limit, 10);
                delete queryJSON.limit
                if (limitNum < queryLimit) {
                    queryOptions.limit = limitNum;
                }
                else {
                    queryOptions.limit = queryLimit;
                }
            }
            else {
                queryOptions.limit = queryLimit;
            }
            if(queryJSON.page){
                const page = queryJSON.page ? stringFunctions.santizeNumber(queryJSON.page, true) : 1;
                // offset by page number * max rows, so we go that many rows
                queryOptions.skip = (page - 1) * queryOptions.limit;
                delete queryJSON.page;
            }

            if(queryJSON.wcStateIncomeLimitsId && Array.isArray(queryJSON.wcStateIncomeLimitsId)){
                query.wcStateIncomeLimitsId = {$in: queryJSON.wcStateIncomeLimitsId};
                delete queryJSON.insurerIndustryCodeId;
            }
            else if(queryJSON.wcStateIncomeLimitsId){
                query.wcStateIncomeLimitsId = queryJSON.wcStateIncomeLimitsId;
                delete queryJSON.wcStateIncomeLimitsId;
            }

            if(queryJSON.id && Array.isArray(queryJSON.id)){
                query.wcStateIncomeLimitsId = {$in: queryJSON.id};
                delete queryJSON.id;
            }
            else if(queryJSON.id){
                query.wcStateIncomeLimitsId = queryJSON.id;
                delete queryJSON.wcStateIncomeLimitsId;
            }

            if (queryJSON) {
                for (var key in queryJSON) {
                    if (typeof queryJSON[key] === 'string' && queryJSON[key].includes('%')) {
                        let clearString = queryJSON[key].replace("%", "");
                        clearString = clearString.replace("%", "");
                        query[key] = {
                            "$regex": clearString,
                            "$options": "i"
                        };
                    }
                    else{
                        query[key] = queryJSON[key];
                    }
                }
            }
            if(findCount === false){
                let docList = null;
                try {
                    docList = await WCStateIncomeLimitsModel.find(query, queryProjection, queryOptions);
                }
                catch (err) {
                    log.error('WCStateIncomeLimits-BO: error: ' + err + __location);
                    error = null;
                    reject(error);
                    return;
                }
                if(docList && docList.length > 0){
                    docList.forEach((doc) => {
                        doc.id = doc.wcStateIncomeLimitsId
                    })
                    resolve(docList);
                }
                else {
                    resolve([]);
                }
            }
            else {
                let queryRowCount = 0;
                try {
                    queryRowCount = await WCStateIncomeLimitsModel.countDocuments(query);
                }
                catch (err) {
                    log.error('WCStateIncomeLimits-BO: error: ' + err + __location);
                    error = null;
                    reject(error);
                    return;
                }
                resolve({count: queryRowCount});
            }
        });
    }

    getById(id, returnMongooseModel = false) {
        return new Promise(async(resolve, reject) => {
            if (id) {
                const query = {
                    "wcStateIncomeLimitsId": id,
                    active: true
                };
                let docDB = null;
                try {
                    docDB = await WCStateIncomeLimitsModel.findOne(query, '-__v');
                }
                catch (err) {
                    log.error('WCStateIncomeLimits-BO: error: ' + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    const wcStateIncomeLimitsDoc = mongoUtils.objCleanup(docDB);
                    resolve(wcStateIncomeLimitsDoc);
                }
                else {
                    resolve(null);
                }
            }
            else {
                reject(new Error('WCStateIncomeLimits-BO: error: no or invalid id supplied'))
            }
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
            const newWCStateIncomeLimitsDoc = await WCStateIncomeLimitsModel.findOne(query);
            return mongoUtils.objCleanup(newWCStateIncomeLimitsDoc);
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
            entityType: entityType,
            active: true
        };
        let wcStateIncomeLimitsDoc = null;
        try {
            wcStateIncomeLimitsDoc = await WCStateIncomeLimitsModel.findOne(query);
        }
        catch (err) {
            const error = `WCStateIncomeLimits-BO: Error: Could not find WCStateIncomeLimits document in database: ${err}. ${__location}`;
            log.error(error);
            throw new Error(error);
        }

        return wcStateIncomeLimitsDoc;
    }
}