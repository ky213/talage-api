/* eslint-disable prefer-const */
'use strict';

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

var InsurerActivityCode = require('mongoose').model('InsurerActivityCode');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
//const InsurerPolicyTypeBO = global.requireShared('models/InsurerPolicyType-BO.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

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

            var queryOptions = {lean:true};
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
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    await InsurerActivityCode.updateOne(query, newObjectJSON);
                    const newinsurerActivityCode = await InsurerActivityCode.findOne(query);
                    //const newAgencyDoc = await InsurerActivityCode.findOneAndUpdate(query, newObjectJSON, {new: true});

                    newinsurerActivityCodeJSON = mongoUtils.objCleanup(newinsurerActivityCode);
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
        return mongoUtils.objCleanup(insurerActivityCode);
    }

    async newMaxSystemId(){
        let maxId = 0;
        try{

            //small collection - get the collection and loop through it.
            // TODO refactor to use mongo aggretation.
            const query = {}
            const queryProjection = {"systemId": 1}
            var queryOptions = {lean:true};
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