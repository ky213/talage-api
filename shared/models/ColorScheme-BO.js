/* eslint-disable prefer-const */
'use strict';


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

var ColorSchemeModel = require('mongoose').model('ColorScheme');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');


const collectionName = 'ColorScheme'
module.exports = class ColorSchemeBO{


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

            let newDoc = true;
            if(newObjectJSON.id){
                const dbDocJSON = await this.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${collectionName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                if(dbDocJSON){
                    newObjectJSON.colorSchemeId = dbDocJSON.colorSchemeId;
                    this.id = dbDocJSON.colorSchemeId;
                    newDoc = false;
                    await this.updateMongo(dbDocJSON.colorSchemeUuidId,newObjectJSON)
                }
                else {
                    log.error("ColorScheme PUT object not found " + newObjectJSON.id + __location)
                }
            }
            if(newDoc === true) {
                newDoc = await this.insertMongo(newObjectJSON).catch((err) => {
                    log.error("ColorScheme POST object error " + err + __location);
                    reject(err);
                });
                this.id = newDoc.colorSchemeId;
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
            let query = {active: true};
            let error = null;


            var queryOptions = {};
            queryOptions.sort = {colorSchemeId: 1};
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
            if (queryJSON.count) {
                if(queryJSON.count === 1 || queryJSON.count === true || queryJSON.count === "1" || queryJSON.count === "true"){
                    findCount = true;
                }
                delete queryJSON.count;
            }

            if(queryJSON.colorSchemeId && Array.isArray(queryJSON.colorSchemeId)){
                query.colorSchemeId = {$in: queryJSON.colorSchemeId};
                delete queryJSON.colorSchemeId
            }
            else if(queryJSON.colorSchemeId){
                query.colorSchemeId = queryJSON.colorSchemeId;
                delete queryJSON.colorSchemeId
            }

            if(queryJSON.colorSchemeId && Array.isArray(queryJSON.colorSchemeId)){
                query.colorSchemeId = {$in: queryJSON.colorSchemeId};
                delete queryJSON.colorSchemeId
            }
            else if(queryJSON.colorSchemeId){
                query.colorSchemeId = queryJSON.colorSchemeId;
                delete queryJSON.colorSchemeId
            }

            // Old Mysql reference
            if(queryJSON.id && Array.isArray(queryJSON.id)){
                query.colorSchemeId = {$in: queryJSON.id};
                delete queryJSON.id
            }
            else if(queryJSON.id){
                query.colorSchemeId = queryJSON.id;
                delete queryJSON.id
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
                    // log.debug("ColorSchemeModel GetList query " + JSON.stringify(query) + __location)
                    docList = await ColorSchemeModel.find(query,queryProjection, queryOptions);
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
                    docList.forEach(doc => {
                        doc.id = doc.colorSchemeId
                        if(doc._id){
                            delete doc._id;
                        }
                    });
                    resolve(docList);
                }
                else {
                    resolve([]);
                }
                return;
            }
            else {
                const docCount = await ColorSchemeModel.countDocuments(query).catch(err => {
                    log.error("ColorSchemeModel.countDocuments error " + err + __location);
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


    getListStandard() {
        return new Promise(async(resolve, reject) => {

            // eslint-disable-next-line prefer-const

            const queryProjection = {"__v": 0}

            let findCount = false;

            let rejected = false;
            // eslint-disable-next-line prefer-const
            let query = {
                active: true,
                name: {$ne: "Custom"}
            };

            var queryOptions = {};
            queryOptions.sort = {name: 1};
            let error = null;


            if (findCount === false) {
                let docList = null;
                // eslint-disable-next-line prefer-const
                try {
                    // log.debug("ColorSchemeModel GetList query " + JSON.stringify(query) + __location)
                    docList = await ColorSchemeModel.find(query,queryProjection, queryOptions).lean();
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
                    docList.forEach(doc => {
                        doc.id = doc.colorSchemeId
                        if(doc._id){
                            delete doc._id;
                        }
                    });
                    resolve(docList);
                }
                else {
                    resolve([]);
                }
                return;
            }
            else {
                const docCount = await ColorSchemeModel.countDocuments(query).catch(err => {
                    log.error("ColorSchemeModel.countDocuments error " + err + __location);
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


    async getMongoDocbyMysqlId(mysqlId, returnMongooseModel = false) {
        return new Promise(async(resolve, reject) => {
            if (mysqlId) {
                const query = {
                    "colorSchemeId": mysqlId,
                    active: true
                };
                let docDB = null;
                try {
                    docDB = await ColorSchemeModel.findOne(query, '-__v');
                    docDB.id = docDB.colorSchemeId;
                }
                catch (err) {
                    log.error("Getting Agency error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    docDB.id = docDB.colorSchemeId
                    if(docDB._id){
                        delete docDB._id;
                    }
                    resolve(docDB);
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
        return this.getMongoDocbyMysqlId(id);
    }

    async updateMongo(docId, newObjectJSON) {
        if (docId) {
            if (typeof newObjectJSON === "object") {

                const query = {"colorSchemeUuidId": docId};
                let newDocSON = null;
                try {
                    const changeNotUpdateList = ["active",
                        "id",
                        "mysqlId",
                        "colorSchemeId",
                        "colorSchemeUuidId",
                        "colorSchemeId"]
                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    await ColorSchemeModel.updateOne(query, newObjectJSON);
                    const newDoc = await ColorSchemeModel.findOne(query);
                    newDoc.id = newDoc.colorSchemeId
                    newDocSON = mongoUtils.objCleanup(newDoc);
                }
                catch (err) {
                    log.error(`Updating Application error appId: ${docId}` + err + __location);
                    throw err;
                }
                //

                return newDocSON;
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
        newObjectJSON.colorSchemeId = newSystemId;
        const colorScheme = new ColorSchemeModel(newObjectJSON);
        //Insert a doc
        await colorScheme.save().catch(function(err) {
            log.error('Mongo colorScheme Save err ' + err + __location);
            throw err;
        });
        newObjectJSON.id = newSystemId;
        return mongoUtils.objCleanup(colorScheme);
    }

    async newMaxSystemId(){
        let maxId = 0;
        try{

            //small collection - get the collection and loop through it.
            // TODO refactor to use mongo aggretation.
            const query = {}
            const queryProjection = {"colorSchemeId": 1}
            var queryOptions = {};
            queryOptions.sort = {};
            queryOptions.sort.colorSchemeId = -1;
            queryOptions.limit = 1;
            const docList = await ColorSchemeModel.find(query, queryProjection, queryOptions)
            if(docList && docList.length > 0){
                for(let i = 0; i < docList.length; i++){
                    if(docList[i].colorSchemeId > maxId){
                        maxId = docList[i].colorSchemeId + 1;
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