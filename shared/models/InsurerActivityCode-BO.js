/* eslint-disable prefer-const */
'use strict';

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

var InsurerActivityCode = require('mongoose').model('InsurerActivityCode');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
const ActivityCodeSvc = global.requireShared('services/activitycodesvc.js');
//const InsurerPolicyTypeBO = global.requireShared('models/InsurerPolicyType-BO.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const moment = require('moment');

module.exports = class InsurerActivityCodeBO{

    constructor(){
        this.id = null;
        this.mongoDoc = null;
    }

    /**
	 * Save Model
     *
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */
    // Use SaveMessage
    saveModel(newObjectJSON){
        return new Promise(async(resolve, reject) => {
            if(!newObjectJSON){
                reject(new Error(`empty InsurerActivityCode object given`));
            }

            let newDoc = true;
            if(newObjectJSON.id){
                const dbDocJSON = await this.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting InsurerActivityCode from Database ` + err + __location);
                    reject(err);
                    return;
                });
                if(dbDocJSON){
                    this.id = dbDocJSON.insurerActivityCodeId;
                    newDoc = false;
                    await this.updateMongo(dbDocJSON.insurerUuidId,newObjectJSON);
                }
                else {
                    log.error("Insurer PUT object not found " + newObjectJSON.id + __location)
                }
            }
            if(newDoc === true) {
                const insertedDoc = await this.insertMongo(newObjectJSON);
                this.id = insertedDoc.insurerActivityCodeId;
                this.mongoDoc = insertedDoc;
            }
            else {
                this.mongoDoc = this.getById(this.id);
            }
            resolve(true);

        });
    }

    getList(requestQueryJSON) {
        return new Promise(async(resolve, reject) => {
            if(!requestQueryJSON){
                requestQueryJSON = {};
            }
            let queryJSON = JSON.parse(JSON.stringify(requestQueryJSON));

            const queryProjection = {"__v": 0}

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

            var queryOptions = {};
            queryOptions.sort = {createdAt: 1};
            if (queryJSON.sort) {
                var acs = 1;
                if (queryJSON.desc) {
                    acs = -1;
                    delete queryJSON.desc
                }
                queryOptions.sort[queryJSON.sort] = acs;
                delete queryJSON.sort
            }
            else {
                // default to DESC on sent
                queryOptions.sort.createdAt = -1;

            }
            const queryLimit = 500;
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

            if(queryJSON.insurerActivityCodeId && Array.isArray(queryJSON.insurerActivityCodeId)){
                query.insurerActivityCodeId = {$in: queryJSON.insurerActivityCodeId};
                delete queryJSON.insurerActivityCodeId;
            }
            else if(queryJSON.insurerActivityCodeId){
                query.insurerActivityCodeId = queryJSON.insurerActivityCodeId;
                delete queryJSON.insurerActivityCodeId;
            }

            if(queryJSON.talageActivityCodeIdList && Array.isArray(queryJSON.talageActivityCodeIdList)){
                query.talageActivityCodeIdList = {$in: queryJSON.talageActivityCodeIdList};
                delete queryJSON.talageActivityCodeIdList;
            }
            else if(queryJSON.talageActivityCodeIdList){
                query.talageActivityCodeIdList = queryJSON.talageActivityCodeIdList;
                delete queryJSON.talageActivityCodeIdList;
            }

            if(queryJSON.insurerQuestionIdList && Array.isArray(queryJSON.insurerQuestionIdList)){
                query.insurerQuestionIdList = {$in: queryJSON.insurerQuestionIdList};
                delete queryJSON.insurerQuestionIdList;
            }
            else if(queryJSON.insurerQuestionIdList){
                query.insurerQuestionIdList = queryJSON.insurerQuestionIdList;
                delete queryJSON.insurerQuestionIdList;
            }

            if(queryJSON.insurerId && Array.isArray(queryJSON.insurerId)){
                query.insurerId = {$in: queryJSON.insurerId};
                delete queryJSON.insurerId;
            }
            else if(queryJSON.insurerId){
                query.insurerId = queryJSON.insurerId;
                delete queryJSON.insurerId;
            }

            if(queryJSON.notalageactivitycode){
                query["talageActivityCodeIdList.0"] = {$exists: false};
                delete queryJSON.notalageactivitycode;
            }

            if(queryJSON.noquestions){
                //or with insurerTerritoryQuestionList
                query["insurerQuestionIdList.0"] = {$exists: false};
                query["insurerTerritoryQuestionList.0"] = {$exists: false};
                delete queryJSON.noquestions;
            }

            if(queryJSON.description){
                query.description = {
                    "$regex": queryJSON.description,
                    "$options": "i"
                };
                delete queryJSON.description;
            }

            if(queryJSON.createdAfter){
                // wrap it in a date to convert the date to iso if it isnt already
                const createdAfterDate = moment(new Date(queryJSON.createdAfter));
                if(createdAfterDate.isValid()){
                    query.createdAt = {$gte: createdAfterDate};
                }
                delete queryJSON.createdAfter;
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

            //log.debug(`InsurerActivityCode query ${JSON.stringify(query)}` + __location)
            if(findCount === false){
                let docList = null;
                try {
                    docList = await InsurerActivityCode.find(query, queryProjection, queryOptions);
                }
                catch (err) {
                    log.error(err + __location);
                    error = null;
                    reject(error);
                    return;
                }
                if(docList && docList.length > 0){
                    resolve(mongoUtils.objListCleanup(docList));
                }
                else {
                    resolve([]);
                }
            }
            else {
                let queryRowCount = 0;
                try {
                    queryRowCount = await InsurerActivityCode.countDocuments(query);
                }
                catch (err) {
                    log.error(err + __location);
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
                    "insurerActivityCodeId": id,
                    active: true
                };
                let docDB = null;
                try {
                    docDB = await InsurerActivityCode.findOne(query, '-__v');
                }
                catch (err) {
                    log.error("Getting Agency error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    const insurerActivityCodeDoc = mongoUtils.objCleanup(docDB);
                    resolve(insurerActivityCodeDoc);
                }
                else {
                    resolve(null);
                }
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    async updateMongo(docId, newObjectJSON) {
        if (docId) {
            if (typeof newObjectJSON === "object") {

                const query = {"insurerActivityCodeId": docId};
                let newinsurerActivityCodeJSON = null;
                try {
                    const changeNotUpdateList = [
                        "active",
                        "id",
                        "systemId",
                        "createdAt",
                        "insurerActivityCodeId"
                    ];

                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }

                    const oldinsurerActivityCode = await InsurerActivityCode.findOne(query);
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    await InsurerActivityCode.updateOne(query, newObjectJSON);

                    const newinsurerActivityCode = await InsurerActivityCode.findOne(query);
                    //const newAgencyDoc = await InsurerActivityCode.findOneAndUpdate(query, newObjectJSON, {new: true});

                    newinsurerActivityCodeJSON = mongoUtils.objCleanup(newinsurerActivityCode);

                    if(newinsurerActivityCode.talageActivityCodeIdList && newinsurerActivityCode.talageActivityCodeIdList.length > 0 && oldinsurerActivityCode.talageActivityCodeIdList){
                        if (newinsurerActivityCode.talageActivityCodeIdList.length !== oldinsurerActivityCode.talageActivityCodeIdList.length){

                            //const newACList = arrayOne.filter(({ value: id1 }) => !arrayTwo.some(({ value: id2 }) => id2 === id1));
                            const newACList = newinsurerActivityCode.talageActivityCodeIdList.filter(function(newAcId) {
                                return !oldinsurerActivityCode.talageActivityCodeIdList.some(function(oldAcId) {
                                    return newAcId === oldAcId;
                                });
                            });
                            if(newACList && newACList.length > 0){
                                ActivityCodeSvc.updateActivityCodeCacheByActivityCodeTerritoryList(newACList, newinsurerActivityCode.territoryList)
                            }
                            else {
                                const removedACList = oldinsurerActivityCode.talageActivityCodeIdList.filter(function(oldAcId) {
                                    return !newinsurerActivityCode.talageActivityCodeIdList.some(function(newAcId) {
                                        return newAcId === oldAcId;
                                    });
                                });
                                if(removedACList && removedACList.length > 0){
                                    ActivityCodeSvc.updateActivityCodeCacheByActivityCodeTerritoryList(removedACList, newinsurerActivityCode.territoryList)
                                }
                            }

                        }
                        else if(newinsurerActivityCode.territoryList && oldinsurerActivityCode.territoryList
                            && newinsurerActivityCode.territoryList.length !== oldinsurerActivityCode.territoryList.length){
                            const newTerritoryList = newinsurerActivityCode.territoryList.filter(function(newTerritory) {
                                return !oldinsurerActivityCode.territoryList.some(function(oldTerritory) {
                                    return newTerritory === oldTerritory;
                                });
                            });
                            if(newTerritoryList && newTerritoryList.length > 0){
                                ActivityCodeSvc.updateActivityCodeCacheByActivityCodeTerritoryList(newinsurerActivityCode.talageActivityCodeIdList, newTerritoryList)
                            }
                            else {
                                const removedTerritoryList = oldinsurerActivityCode.territoryList.filter(function(oldTerritory) {
                                    return !newinsurerActivityCode.territoryList.some(function(newTerritory) {
                                        return newTerritory === oldTerritory;
                                    });
                                });
                                if(removedTerritoryList && removedTerritoryList.length > 0){
                                    ActivityCodeSvc.updateActivityCodeCacheByActivityCodeTerritoryList(newinsurerActivityCode.talageActivityCodeIdList, removedTerritoryList)
                                }
                            }

                        }
                        else {
                            const newACList = newinsurerActivityCode.talageActivityCodeIdList.filter(function(newAcId) {
                                return !oldinsurerActivityCode.talageActivityCodeIdList.some(function(oldAcId) {
                                    return newAcId === oldAcId;
                                });
                            });
                            if(newACList && newACList.length > 0){
                                ActivityCodeSvc.updateActivityCodeCacheByActivityCodeTerritoryList(newACList, newinsurerActivityCode.territoryList)
                            }

                            const removedACList = oldinsurerActivityCode.talageActivityCodeIdList.filter(function(oldAcId) {
                                return !newinsurerActivityCode.talageActivityCodeIdList.some(function(newAcId) {
                                    return newAcId === oldAcId;
                                });
                            });
                            if(removedACList && removedACList.length > 0){
                                ActivityCodeSvc.updateActivityCodeCacheByActivityCodeTerritoryList(removedACList, newinsurerActivityCode.territoryList)
                            }


                            //get territory differences
                            const newTerritoryList = newinsurerActivityCode.territoryList.filter(function(newTerritory) {
                                return !oldinsurerActivityCode.territoryList.some(function(oldTerritory) {
                                    return newTerritory === oldTerritory;
                                });
                            });
                            if(newTerritoryList && newTerritoryList.length > 0){
                                ActivityCodeSvc.updateActivityCodeCacheByActivityCodeTerritoryList(newinsurerActivityCode.talageActivityCodeIdList, newTerritoryList)
                            }
                            const removedTerritoryList = oldinsurerActivityCode.territoryList.filter(function(oldTerritory) {
                                return !newinsurerActivityCode.territoryList.some(function(newTerritory) {
                                    return newTerritory === oldTerritory;
                                });
                            });
                            if(removedTerritoryList && removedTerritoryList.length > 0){
                                ActivityCodeSvc.updateActivityCodeCacheByActivityCodeTerritoryList(newinsurerActivityCode.talageActivityCodeIdList, removedTerritoryList)
                            }
                        }
                    }
                }
                catch (err) {
                    log.error(`Updating Application error appId: ${docId}` + err + __location);
                    throw err;
                }
                //

                return newinsurerActivityCodeJSON;
            }
            else {
                throw new Error(`no newObjectJSON supplied appId: ${docId}`)
            }

        }
        else {
            throw new Error('no id supplied');
        }
        // return true;

    }

    async insertMongo(newObjectJSON) {
        if (!newObjectJSON) {
            throw new Error("no data supplied");
        }
        //force mongo/mongoose insert
        if(newObjectJSON._id) {
            delete newObjectJSON._id
        }
        if(newObjectJSON.id) {
            delete newObjectJSON.id
        }

        const insurerActivityCode = new InsurerActivityCode(newObjectJSON);
        //Insert a doc
        await insurerActivityCode.save().catch(function(err) {
            log.error('Mongo insurer Save err ' + err + __location);
            throw err;
        });

        if(insurerActivityCode.talageActivityCodeIdList && insurerActivityCode.talageActivityCodeIdList.length > 0){
            ActivityCodeSvc.updateActivityCodeCacheByActivityCodeTerritoryList(insurerActivityCode.talageActivityCodeIdList, insurerActivityCode.territoryList)
        }


        return mongoUtils.objCleanup(insurerActivityCode);
    }

    async newMaxSystemId(){
        let maxId = 0;
        try{

            //small collection - get the collection and loop through it.
            // TODO refactor to use mongo aggretation.
            const query = {}
            const queryProjection = {"systemId": 1}
            var queryOptions = {};
            queryOptions.sort = {};
            queryOptions.sort.systemId = -1;
            queryOptions.limit = 1;
            const docList = await InsurerActivityCode.find(query, queryProjection, queryOptions)
            if(docList && docList.length > 0){
                for(let i = 0; i < docList.length; i++){
                    if(docList[i].systemId > maxId){
                        maxId = docList[i].systemId + 1;
                    }
                }
            }
        }
        catch(err){
            log.error("Get max system id " + err + __location)
            throw err;
        }
        log.debug("maxId: " + maxId + __location)
        return maxId;
    }


}