/* eslint-disable prefer-const */
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

var InsurerQuestion = require('mongoose').model('InsurerQuestion');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
//const InsurerPolicyTypeBO = global.requireShared('models/InsurerPolicyType-BO.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const tableName = 'InsurerQuestion';
module.exports = class InsurerQuestionBO{

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

            let isNewDoc = true;
            if(newObjectJSON.id){
                const dbDocJSON = await this.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                if(dbDocJSON){
                    this.id = dbDocJSON.insurerQuestionId;
                    isNewDoc = false;
                    await this.updateMongo(dbDocJSON.insurerUuidId,newObjectJSON)
                }
                else {
                    log.error("Insurer PUT object not found " + newObjectJSON.id + __location)
                }
            }
            if(isNewDoc === true) {
                const insertedDoc = await this.insertMongo(newObjectJSON);
                this.id = insertedDoc.insurerQuestionId;
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

            const queryProjection = {"__v": 0};

            let findCount = false;
            let rejected = false;
            let error = null;

            const query = {active: true};

            // if a valid active was provided, use it.
            if(queryJSON.hasOwnProperty("active") && typeof queryJSON.active === "boolean"){
                query.active = queryJSON.active;
            }

            var queryOptions = {};
            queryOptions.sort = {createdAt: 1};
            if (queryJSON.sort) {
                var acs = 1;
                if (queryJSON.desc) {
                    acs = -1;
                    delete queryJSON.desc;
                }
                queryOptions.sort[queryJSON.sort] = acs;
                delete queryJSON.sort;
            }
            else {
                // default to DESC on sent
                queryOptions.sort.createdAt = -1;
            }
            const queryLimit = 500;
            if (queryJSON.limit) {
                var limitNum = parseInt(queryJSON.limit, 10);
                delete queryJSON.limit;
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

            // insurerQuestionId
            if(queryJSON.insurerQuestionId && Array.isArray(queryJSON.insurerQuestionId)){
                query.insurerQuestionId = {$in: queryJSON.insurerQuestionId};
                delete queryJSON.insurerQuestionId;
            }
            else if(queryJSON.insurerQuestionId && typeof queryJSON.insurerQuestionId === "string"){
                const idList = queryJSON.insurerQuestionId.split(",");
                if(idList.length > 1){
                    query.insurerQuestionId = {$in: idList};
                }
                else{
                    query.insurerQuestionId = queryJSON.insurerQuestionId;
                }
                delete queryJSON.insurerQuestionId;
            }

            // insurerId
            if(queryJSON.insurerId && Array.isArray(queryJSON.insurerId)){
                query.insurerId = {$in: queryJSON.insurerId};
                delete queryJSON.insurerId;
            }
            else if(queryJSON.insurerId){
                query.insurerId = queryJSON.insurerId;
                delete queryJSON.insurerId;
            }

            // talageQuestionId
            if(queryJSON.talageQuestionId && Array.isArray(queryJSON.talageQuestionId)){
                query.talageQuestionId = {$in: queryJSON.talageQuestionId};
                delete queryJSON.talageQuestionId;
            }
            else if(queryJSON.talageQuestionId && typeof queryJSON.talageQuestionId === "string"){
                const idList = queryJSON.talageQuestionId.split(",");
                if(idList.length > 1){
                    query.talageQuestionId = {$in: idList};
                }
                else{
                    query.talageQuestionId = queryJSON.talageQuestionId;
                }
                delete queryJSON.talageQuestionId;
            }

            if(queryJSON.text){
                query.text = {
                    "$regex": queryJSON.text,
                    "$options": "i"
                };
                delete queryJSON.text;
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
                docList = await InsurerQuestion.find(query, queryProjection, queryOptions);
                if (findCount){
                    queryRowCount = await InsurerQuestion.countDocuments(query);
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
                    "insurerQuestionId": id,
                    active: true
                };
                let docDB = null;
                try {
                    docDB = await InsurerQuestion.findOne(query, '-__v');
                }
                catch (err) {
                    log.error("Getting Agency error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    const insurerQuestionDoc = mongoUtils.objCleanup(docDB);
                    resolve(insurerQuestionDoc);
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

                const query = {"insurerQuestionId": docId};
                let newInsurerQuestionJSON = null;
                try {
                    const changeNotUpdateList = [
                        "active",
                        "id",
                        "systemId",
                        "insurerQuestionId"
                    ];

                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();
                    await InsurerQuestion.updateOne(query, newObjectJSON);
                    const newInsurerQuestion = await InsurerQuestion.findOne(query);
                    //const newAgencyDoc = await InsurerIndustryCode.findOneAndUpdate(query, newObjectJSON, {new: true});

                    newInsurerQuestionJSON = mongoUtils.objCleanup(newInsurerQuestion);
                }
                catch (err) {
                    log.error(`Updating Application error appId: ${docId}` + err + __location);
                    throw err;
                }
                //

                return newInsurerQuestionJSON;
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
        const insurerQuestion = new InsurerQuestion(newObjectJSON);
        //Insert a doc
        await insurerQuestion.save().catch(function(err) {
            log.error('Mongo insurer Save err ' + err + __location);
            throw err;
        });
        return mongoUtils.objCleanup(insurerQuestion);
    }


}