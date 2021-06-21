/* eslint-disable prefer-const */
'use strict';


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

var QuestionModel = require('mongoose').model('Question');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const collectionName = 'Questions'
module.exports = class QuestionBO{


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
                reject(new Error(`empty ${collectionName} object given`));
            }
            if(!newObjectJSON.id && newObjectJSON.talageQuestionId){
                newObjectJSON.id = newObjectJSON.talageQuestionId
            }
            let newDoc = true;
            if(newObjectJSON.id){
                const dbDocJSON = await this.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${collectionName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                if(dbDocJSON){
                    newObjectJSON.talageQuestionUuid = dbDocJSON.talageQuestionUuid;
                    newObjectJSON.talageQuestionId = dbDocJSON.talageQuestionId;
                    this.id = dbDocJSON.talageQuestionId;
                    newDoc = false;
                    await this.updateMongo(dbDocJSON.talageQuestionUuid,newObjectJSON)
                }
                else {
                    log.error("Question PUT object not found " + newObjectJSON.id + __location)
                }
            }
            if(newDoc === true) {
                newDoc = await this.insertMongo(newObjectJSON).catch((err) => {
                    log.error("Question POST object error " + err + __location);
                    reject(err);
                });
                this.id = newDoc.talageQuestionId;
                this.mongoDoc = newDoc;

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
            // eslint-disable-next-line prefer-const
            let queryJSON = JSON.parse(JSON.stringify(requestQueryJSON));
            const queryProjection = {"__v": 0}

            let findCount = false;

            let rejected = false;
            // eslint-disable-next-line prefer-const
            let query = {};
            let error = null;


            var queryOptions = {};
            queryOptions.sort = {talageQuestionId: 1};
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
                if(queryJSON.count === 1 || queryJSON.count === true || queryJSON.count === "1" || queryJSON.count === "true"){
                    findCount = true;
                }
                delete queryJSON.count;
            }

            if(queryJSON.talageQuestionId && Array.isArray(queryJSON.talageQuestionId)){
                query.talageQuestionId = {$in: queryJSON.talageQuestionId};
                delete queryJSON.talageQuestionId
            }
            else if(queryJSON.talageQuestionId){
                query.talageQuestionId = queryJSON.talageQuestionId;
                delete queryJSON.talageQuestionId
            }


            // Old Mysql reference
            if(queryJSON.question && Array.isArray(queryJSON.question)){
                query.talageQuestionId = {$in: queryJSON.question};
                delete queryJSON.question
            }
            else if(queryJSON.question){
                query.talageQuestionId = queryJSON.question;
                delete queryJSON.question
            }
            if(queryJSON.text && queryJSON.text.includes('%') === false){
                queryJSON.text += "%";
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
                    else {
                        query[key] = queryJSON[key];
                    }
                }
            }


            if (findCount === false) {
                let docList = null;
                // eslint-disable-next-line prefer-const
                try {
                    //log.debug("QuestionModel GetList query " + JSON.stringify(query) + __location)
                    docList = await QuestionModel.find(query,queryProjection, queryOptions);
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
                    resolve(mongoUtils.objListCleanup(docList));
                }
                else {
                    resolve([]);
                }
                return;
            }
            else {
                const docCount = await QuestionModel.countDocuments(query).catch(err => {
                    log.error("QuestionModel.countDocuments error " + err + __location);
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


    async getMongoDocbyTalageQuestionId(tqId, returnMongooseModel = false) {
        return new Promise(async(resolve, reject) => {
            if (tqId) {
                const id = parseInt(tqId, 10);
                const query = {"talageQuestionId": id};
                let docDB = null;
                try {
                    docDB = await QuestionModel.findOne(query, '-__v');
                    if(docDB){
                        docDB.id = docDB.talageQuestionId;
                    }
                }
                catch (err) {
                    log.error("Getting question error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    const questionDoc = mongoUtils.objCleanup(docDB);
                    resolve(questionDoc);
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

    getById(id) {
        return this.getMongoDocbyTalageQuestionId(id);
    }


    async updateMongo(docId, newObjectJSON) {
        if (docId) {
            if (typeof newObjectJSON === "object") {

                const query = {"talageQuestionUuid": docId};
                let newAgencyJSON = null;
                try {
                    const changeNotUpdateList = ["active",
                        "id",
                        "talageQuestionId",
                        "talageQuestionUuid"]
                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    await QuestionModel.updateOne(query, newObjectJSON);
                    const newQuestionDoc = await QuestionModel.findOne(query);

                    newAgencyJSON = mongoUtils.objCleanup(newQuestionDoc);
                }
                catch (err) {
                    log.error(`Updating Question error appId: ${docId}` + err + __location);
                    throw err;
                }
                //

                return newAgencyJSON;
            }
            else {
                throw new Error(`no newObjectJSON supplied docId: ${docId}`)
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
        const talageQuestionId = await this.newMaxSystemId()
        newObjectJSON.talageQuestionId = talageQuestionId;
        const question = new QuestionModel(newObjectJSON);
        //Insert a doc
        await question.save().catch(function(err) {
            log.error('Mongo question Save err ' + err + __location);
            throw err;
        });
        newObjectJSON.id = talageQuestionId;
        return mongoUtils.objCleanup(question);
    }

    async newMaxSystemId(){
        let maxId = 0;
        try{

            //small collection - get the collection and loop through it.
            // TODO refactor to use mongo aggretation.
            const query = {}
            const queryProjection = {"talageQuestionId": 1}
            var queryOptions = {lean:true};
            queryOptions.sort = {};
            queryOptions.sort.talageQuestionId = -1;
            queryOptions.limit = 1;
            const docList = await QuestionModel.find(query, queryProjection, queryOptions)
            if(docList && docList.length > 0){
                for(let i = 0; i < docList.length; i++){
                    if(docList[i].talageQuestionId > maxId){
                        maxId = docList[i].talageQuestionId + 1;
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