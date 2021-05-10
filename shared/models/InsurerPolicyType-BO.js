
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

var InsurerPolicyTypeModel = require('mongoose').model('InsurerPolicyType');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');


const collectionName = 'insurerPolicyTypes'

module.exports = class InsurerPolicyTypeBO{

    #dbTableORM = null;

    constructor(){
        this.id = '';

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
            await this.cleanupInput(newObjectJSON);

            let newDoc = true;
            if(newObjectJSON.id){
                const dbDocJSON = await this.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${collectionName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                if(dbDocJSON){
                    this.id = dbDocJSON.systemId;
                    newDoc = false;
                    await this.updateMongo(dbDocJSON.insurerPolicyTypeId,newObjectJSON)
                }
                else {
                    log.error("Insurer PUT object not found " + newObjectJSON.id + __location)
                }
            }
            if(newDoc === true) {
                const newAgencyDoc = await this.insertMongo(newObjectJSON);
                this.id = newAgencyDoc.systemId;
            }


            resolve(true);

        });
    }

    loadFromIdMysql(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id && id > 0){
                await this.#dbTableORM.getById(id).catch(function(err) {
                    log.error(`Error getting  ${collectionName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                resolve(true);
            }
            else {
                reject(new Error('no id supplied'))
            }
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
            if (queryJSON.count) {
                if(queryJSON.count === 1 || queryJSON.count === true || queryJSON.count === "1" || queryJSON.count === "true"){
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

            // // Old Mysql reference
            if(queryJSON.insurer && Array.isArray(queryJSON.insurer)){
                query.insurerId = {$in: queryJSON.insurer};
                delete queryJSON.insurer
            }
            else if(queryJSON.insurer){
                query.insurerId = queryJSON.insurer;
                delete queryJSON.insurer
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
                    //log.debug("InsurerPolicyTypeModel GetList query " + JSON.stringify(query) + __location)
                    docList = await InsurerPolicyTypeModel.find(query,queryProjection, queryOptions);
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
                resolve(mongoUtils.objListCleanup(docList));
                return;
            }
            else {
                const docCount = await InsurerPolicyTypeModel.countDocuments(query).catch(err => {
                    log.error("InsurerPolicyTypeModel.countDocuments error " + err + __location);
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
                    "systemId": mysqlId,
                    active: true
                };
                let docDB = null;
                try {
                    docDB = await InsurerPolicyTypeModel.findOne(query, '-__v');
                }
                catch (err) {
                    log.error("Getting Agency error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    const insurerPolicyTypeDoc = mongoUtils.objCleanup(docDB);
                    resolve(insurerPolicyTypeDoc);
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

                const query = {"insurerPolicyTypeId": docId};
                let newAgencyJSON = null;
                try {
                    const changeNotUpdateList = ["active",
                        "id",
                        "mysqlId",
                        "systemId",
                        "insurerPolicyTypeId",
                        "insurerId"]
                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    await InsurerPolicyTypeModel.updateOne(query, newObjectJSON);
                    const newDoc = await InsurerPolicyTypeModel.findOne(query);

                    newAgencyJSON = mongoUtils.objCleanup(newDoc);
                }
                catch (err) {
                    log.error(`Updating InsurerPolicyTypeModel error appId: ${docId}` + err + __location);
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
        const insurerPolicyType = new InsurerPolicyTypeModel(newObjectJSON);
        //Insert a doc
        await insurerPolicyType.save().catch(function(err) {
            log.error('Mongo InsurerPolicyTypeModel Save err ' + err + __location);
            throw err;
        });
        newObjectJSON.id = newSystemId;
        return mongoUtils.objCleanup(insurerPolicyType);
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
            const docList = await InsurerPolicyTypeModel.find(query, queryProjection, queryOptions)
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

    deleteById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id && id > 0){
                let doc = null;
                try {
                    const returnDoc = true;
                    doc = await this.getMongoDocbyMysqlId(id, returnDoc);
                    if(doc && doc.systemId){
                        doc.active = false;
                        await doc.save();
                    }
                }
                catch (err) {
                    log.error(`Error marking deleted Doc from mysqlId ${id}` + err + __location);
                    reject(err);
                }

                resolve(true);

            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

}