/* eslint-disable prefer-const */

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

var InsurerIndustryCode = require('mongoose').model('InsurerIndustryCode');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const tableName = 'InsurerIndustryCode';
module.exports = class InsurerIndustryCodeBO{

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
                    this.id = dbDocJSON.insurerIndustryCodeId;
                    newDoc = false;
                    await this.updateMongo(dbDocJSON.insurerIndustryCodeId,newObjectJSON);
                }
                else {
                    log.error("Insurer PUT object not found " + newObjectJSON.id + __location);
                }
            }
            if(newDoc === true) {
                const insertedDoc = await this.insertMongo(newObjectJSON);
                this.id = insertedDoc.insurerIndustryCodeId;
                this.mongoDoc = insertedDoc;
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

            if (queryJSON.count) {
                if (queryJSON.count === "1" || queryJSON.count === "true") {
                    findCount = true;
                }
                delete queryJSON.count;
            }

            if(queryJSON.insurerIndustryCodeId && Array.isArray(queryJSON.insurerIndustryCodeId)){
                query.insurerIndustryCodeId = {$in: queryJSON.insurerIndustryCodeId};
                delete queryJSON.insurerIndustryCodeId;
            }
            else if(queryJSON.insurerIndustryCodeId){
                query.insurerIndustryCodeId = queryJSON.insurerIndustryCodeId;
                delete queryJSON.insurerIndustryCodeId;
            }

            if(queryJSON.talageIndustryCodeIdList && Array.isArray(queryJSON.talageIndustryCodeIdList)){
                query.talageIndustryCodeIdList = {$in: queryJSON.talageIndustryCodeIdList};
                delete queryJSON.talageIndustryCodeIdList;
            }
            else if(queryJSON.talageIndustryCodeIdList){
                query.talageIndustryCodeIdList = queryJSON.talageIndustryCodeIdList;
                delete queryJSON.talageIndustryCodeIdList;
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

            let docList = null;
            let queryRowCount = 0;
            try {
                docList = await InsurerIndustryCode.find(query, queryProjection, queryOptions);
                if (findCount){
                    queryRowCount = await InsurerIndustryCode.countDocuments(query);
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
                // BAD - BREAK PATTERN TODO REVERT BACK TO PATTERN of the other BOs pass back the count as well for api paging (so we know how many total rows are)
                if (findCount){
                    resolve({
                        rows: mongoUtils.objListCleanup(docList),
                        count: queryRowCount
                    });
                }
                else{
                    resolve(mongoUtils.objListCleanup(docList));
                }
            }
            else {
                resolve([]);
            }
            return;
        });
    }

    getById(id, returnMongooseModel = false) {
        return new Promise(async(resolve, reject) => {
            if (id) {
                const query = {
                    "insurerIndustryCodeId": id,
                    active: true
                };
                let docDB = null;
                try {
                    docDB = await InsurerIndustryCode.findOne(query, '-__v');
                }
                catch (err) {
                    log.error("Getting Agency error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    const insurerIndustryCodeDoc = mongoUtils.objCleanup(docDB);
                    resolve(insurerIndustryCodeDoc);
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

                const query = {"insurerIndustryCodeId": docId};
                let newinsurerIndustryCodeJSON = null;
                try {
                    const changeNotUpdateList = [
                        "active",
                        "id",
                        "systemId",
                        "createdAt",
                        "insurerIndustryCodeId"
                    ];

                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    await InsurerIndustryCode.updateOne(query, newObjectJSON);
                    const newinsurerIndustryCode = await InsurerIndustryCode.findOne(query);
                    //const newAgencyDoc = await InsurerIndustryCode.findOneAndUpdate(query, newObjectJSON, {new: true});

                    newinsurerIndustryCodeJSON = mongoUtils.objCleanup(newinsurerIndustryCode);
                }
                catch (err) {
                    log.error(`Updating Application error appId: ${docId}` + err + __location);
                    throw err;
                }
                //

                return newinsurerIndustryCodeJSON;
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
        
        const insurerIndustryCode = new InsurerIndustryCode(newObjectJSON);
        //Insert a doc
        await insurerIndustryCode.save().catch(function(err) {
            log.error('Mongo insurer Save err ' + err + __location);
            throw err;
        });
        return mongoUtils.objCleanup(insurerIndustryCode);
    }

}