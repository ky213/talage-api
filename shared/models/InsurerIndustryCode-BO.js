/* eslint-disable prefer-const */
'use strict';


const DatabaseObject = require('./DatabaseObject.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

var InsurerIndustryCode = require('mongoose').model('InsurerIndustryCode');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
const InsurerPolicyTypeBO = global.requireShared('models/InsurerPolicyType-BO.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const tableName = 'clw_talage_insurer_industry_codes';
const skipCheckRequired = false;
module.exports = class InsurerIndustryCodeBO{

    constructor(){
        this.id = 0;
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
                reject(new Error(`empty ${tableName} object given`));
            }

            let newDoc = true;
            if(newObjectJSON.id){
                const dbDocJSON = await this.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                if(dbDocJSON){
                    newObjectJSON.systemId = dbDocJSON.systemId;
                    newObjectJSON.insurerId = dbDocJSON.systemId;
                    this.id = dbDocJSON.systemId;
                    newDoc = false;
                    await this.updateMongo(dbDocJSON.insurerUuidId,newObjectJSON)
                }
                else {
                    log.error("Insurer PUT object not found " + newObjectJSON.id + __location)
                }
            }
            if(newDoc === true) {
                const newDoc = await this.insertMongo(newObjectJSON);
                this.id = newDoc.systemId;
                this.mongoDoc = newDoc;

            }
            else {
                this.mongoDoc = this.getById(this.id);
            }
            resolve(true);

        });
    }

    getList(queryJSON) {
        return new Promise(async(resolve, reject) => {
            if(!queryJSON){
                queryJSON = {};
            }
            const queryProjection = {"__v": 0}

            let findCount = false;

            let rejected = false;
            // eslint-disable-next-line prefer-const
            let query = {active: true};
            let error = null;

            var queryOptions = {};
            queryOptions.sort = {systemId: 1};
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

            if (queryJSON.count) {
                if (queryJSON.count === "1") {
                    findCount = true;
                }
                delete queryJSON.count;
            }

            if(queryJSON.systemId && Array.isArray(queryJSON.systemId)){
                query.systemId = {$in: queryJSON.systemId};
                delete queryJSON.systemId
            }
            else if(queryJSON.systemId){
                query.systemId = queryJSON.systemId;
                delete queryJSON.systemId
            }

            if(queryJSON.insurerId && Array.isArray(queryJSON.insurerId)){
                query.insurerId = {$in: queryJSON.insurerId};
                delete queryJSON.insurerId
            }
            else if(queryJSON.insurerId){
                query.insurerId = queryJSON.insurerId;
                delete queryJSON.insurerId
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

            if (findCount === false) {
                let docList = null;
                let queryRowCount = 0;
                try {
                    docList = await InsurerIndustryCode.find(query, queryProjection, queryOptions);
                    const countQuery = await InsurerIndustryCode.find(query, queryProjection, {});
                    if(countQuery && countQuery.length){
                        queryRowCount = countQuery.length;
                    }
                }
                catch (err) {
                    log.error(err + __location);
                    error = null;
                    rejected = true;
                }
                if(rejected){
                    reject(error);
                    return;
                }
                if(docList && docList.length > 0){
                    // pass back the count as well for api paging (so we know how many total rows are)
                    resolve({
                        data: mongoUtils.objListCleanup(docList),
                        count: queryRowCount
                    });
                }
                else {
                    resolve([]);
                }
                return;
            }
            else {
                const docCount = await InsurerIndustryCode.countDocuments(query).catch(err => {
                    log.error("InsurerIndustryCode.countDocuments error " + err + __location);
                    error = null;
                    rejected = true;
                })
                if(rejected){
                    reject(error);
                    return;
                }
                resolve({count: docCount});
                return;
            }


        });
    }

    getById(id) {
        return this.getMongoDocbyMysqlId(id);
    }

    async updateMongo(docId, newObjectJSON) {
        if (docId) {
            if (typeof newObjectJSON === "object") {

                const query = {"insurerUuidId": docId};
                let newAgencyJSON = null;
                try {
                    const changeNotUpdateList = ["active",
                        "id",
                        "mysqlId",
                        "systemId",
                        "insurerUuidId",
                        "insurerId"]
                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    await InsurerIndustryCode.updateOne(query, newObjectJSON);
                    const newAgencyDoc = await InsurerIndustryCode.findOne(query);
                    //const newAgencyDoc = await InsurerIndustryCode.findOneAndUpdate(query, newObjectJSON, {new: true});

                    newAgencyJSON = mongoUtils.objCleanup(newAgencyDoc);
                }
                catch (err) {
                    log.error(`Updating Application error appId: ${docId}` + err + __location);
                    throw err;
                }
                //

                return newAgencyJSON;
            }
            else {
                throw new Error(`no newObjectJSON supplied appId: ${docId}`)
            }

        }
        else {
            throw new Error('no id supplied')
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
        const newSystemId = await this.newMaxSystemId()
        newObjectJSON.systemId = newSystemId;
        newObjectJSON.insurerId = newSystemId;
        const insurer = new InsurerIndustryCode(newObjectJSON);
        //Insert a doc
        await insurer.save().catch(function(err) {
            log.error('Mongo insurer Save err ' + err + __location);
            throw err;
        });
        newObjectJSON.id = newSystemId;
        return mongoUtils.objCleanup(insurer);
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
            const docList = await InsurerIndustryCode.find(query, queryProjection, queryOptions)
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

    async getTerritories(insurerId){
        let territoryArray = [];
        let insurerPolicyTypeListJSON = {};
        try{
            const insurerPolicyTypeBO = new InsurerPolicyTypeBO();
            const query = {"insurerId": insurerId}
            insurerPolicyTypeListJSON = await insurerPolicyTypeBO.getList(query)
            if(insurerPolicyTypeListJSON){
                for(const insurerPolicyTypeJSON of insurerPolicyTypeListJSON){
                    if(insurerPolicyTypeJSON.territories && insurerPolicyTypeJSON.territories.length > 0){
                        for(let i = 0; i < insurerPolicyTypeJSON.territories.length; i++){
                            const ptTerritory = insurerPolicyTypeJSON.territories[i];
                            if (territoryArray.indexOf(ptTerritory) === -1) {
                                territoryArray.push(ptTerritory);
                            }
                        }
                    }
                }
            }
        }
        catch(err){
            log.error("Getting mongo clw_talage_insurer_policy_types error " + err + __location)
        }
        if(territoryArray && territoryArray.length > 0){
            return territoryArray.sort();
        }
        else {
            return [];
        }


    }

    // ***************************
    //    For administration site
    //
    // *************************

    async getSelectionList(){
        //TODO refactor to only return id, name and logo.
        let insurerList = [];
        try{
            insurerList = await this.getList({});
        }
        catch(err){
            log.error(`Insurer GetList error on select ` + err + __location);
        }
        return insurerList;
    }

}