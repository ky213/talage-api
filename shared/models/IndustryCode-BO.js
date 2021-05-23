
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

var IndustryCode = require('mongoose').model('IndustryCode');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

const collectionName = 'IndustryCodes'
module.exports = class IndustryCodeBO{


    constructor(){
        this.id = 0;
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

            if(newObjectJSON.industryCodeId){
                newObjectJSON.id = newObjectJSON.industryCodeId;
            }

            if(newObjectJSON.id){
                const dbDocJSON = await this.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${collectionName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                if(dbDocJSON){
                    this.id = dbDocJSON.industryCodeId;
                    newDoc = false;
                    await this.updateMongo(dbDocJSON.industryCodeId,newObjectJSON);
                }
                else {
                    log.error(`${collectionName} PUT object not found ` + newObjectJSON.id + __location);
                }
            }
            if(newDoc === true) {
                const insertedDoc = await this.insertMongo(newObjectJSON);
                this.id = insertedDoc.industryCodeId;
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
            queryOptions.sort = {industryCodeId: 1};
            if (queryJSON.sort) {
                var acs = 1;
                if (queryJSON.desc) {
                    acs = -1;
                    delete queryJSON.desc
                }
                queryOptions.sort[queryJSON.sort] = acs;
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

            if(queryJSON.industryCodeId && Array.isArray(queryJSON.industryCodeId)){
                query.industryCodeId = {$in: queryJSON.industryCodeId};
                delete queryJSON.insurerIndustryCodeId;
            }
            else if(queryJSON.industryCodeId){
                query.industryCodeId = queryJSON.industryCodeId;
                delete queryJSON.industryCodeId;
            }

            if(queryJSON.id && Array.isArray(queryJSON.id)){
                query.industryCodeId = {$in: queryJSON.id};
                delete queryJSON.id;
            }
            else if(queryJSON.id){
                query.industryCodeId = queryJSON.id;
                delete queryJSON.industryCodeId;
            }

            if(queryJSON.industryCodeCategoryId && Array.isArray(queryJSON.industryCodeCategoryId)){
                query.industryCodeCategoryId = {$in: queryJSON.industryCodeCategoryId};
                delete queryJSON.industryCodeCategoryId;
            }
            else if(queryJSON.industryCodeCategoryId){
                query.industryCodeCategoryId = queryJSON.industryCodeCategoryId;
                delete queryJSON.industryCodeCategoryId;
            }

            if(queryJSON.codeGroupList && Array.isArray(queryJSON.codeGroupList)){
                query.codeGroupList = {$in: queryJSON.codeGroupList};
                delete queryJSON.codeGroupList;
            }
            else if(queryJSON.codeGroupList){
                query.codeGroupList = queryJSON.codeGroupList;
                delete queryJSON.codeGroupList;
            }

            if(queryJSON.activityCodeIdList && Array.isArray(queryJSON.activityCodeIdList)){
                query.activityCodeIdList = {$in: queryJSON.activityCodeIdList};
                delete queryJSON.activityCodeIdList;
            }
            else if(queryJSON.activityCodeIdList){
                query.activityCodeIdList = queryJSON.activityCodeIdList;
                delete queryJSON.activityCodeIdList;
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

            //log.debug(`${collectionName} getList query ${JSON.stringify(query)}` + __location)
            if(findCount === false){
                let docList = null;
                try {
                    docList = await IndustryCode.find(query, queryProjection, queryOptions);
                }
                catch (err) {
                    log.error(err + __location);
                    error = null;
                    reject(error);
                    return;
                }
                if(docList && docList.length > 0){
                    docList.forEach((doc) => {
                        doc.id = doc.industryCodeId
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
                    queryRowCount = await IndustryCode.countDocuments(query);
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
            if (id > 0) {
                const query = {
                    "industryCodeId": id,
                    active: true
                };
                let docDB = null;
                try {
                    docDB = await IndustryCode.findOne(query, '-__v');
                }
                catch (err) {
                    log.error("Getting Agency error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    const industryCodeDoc = mongoUtils.objCleanup(docDB);
                    resolve(industryCodeDoc);
                }
                else {
                    resolve(null);
                }
            }
            else {
                reject(new Error('no or invalid id supplied'))
            }
        });
    }

    async updateMongo(industryCodeId, newObjectJSON) {
        if (industryCodeId) {
            if (typeof newObjectJSON === "object") {

                const query = {"industryCodeId": industryCodeId};
                let newindustryCodeJSON = null;
                try {
                    const changeNotUpdateList = [
                        "active",
                        "id",
                        "createdAt",
                        "industryCodeId",
                        "talageIndustryCodeUuid"
                    ];

                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    await IndustryCode.updateOne(query, newObjectJSON);
                    const newindustryCode = await IndustryCode.findOne(query);

                    newindustryCodeJSON = mongoUtils.objCleanup(newindustryCode);
                }
                catch (err) {
                    log.error(`Updating ${collectionName} error appId: ${industryCodeId}` + err + __location);
                    throw err;
                }
                //

                return newindustryCodeJSON;
            }
            else {
                throw new Error(`no newObjectJSON supplied appId: ${industryCodeId}`)
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
        //maxid
        const newSystemId = await this.newMaxSystemId()
        newObjectJSON.industryCodeId = newSystemId;

        const industryCode = new IndustryCode(newObjectJSON);
        //Insert a doc
        await industryCode.save().catch(function(err) {
            log.error(`Mongo ${collectionName} Save err ` + err + __location);
            throw err;
        });
        return mongoUtils.objCleanup(industryCode);
    }

    async newMaxSystemId(){
        let maxId = 0;
        try{

            //small collection - get the collection and loop through it.
            // TODO refactor to use mongo aggretation.
            const query = {}
            const queryProjection = {"industryCodeId": 1}
            var queryOptions = {lean:true};
            queryOptions.sort = {};
            queryOptions.sort.industryCodeId = -1;
            queryOptions.limit = 1;
            const docList = await IndustryCode.find(query, queryProjection, queryOptions)
            if(docList && docList.length > 0){
                for(let i = 0; i < docList.length; i++){
                    if(docList[i].industryCodeId > maxId){
                        maxId = docList[i].industryCodeId + 1;
                    }
                }
            }

        }
        catch(err){
            log.error(`${collectionName} Get max system id ` + err + __location)
            throw err;
        }
        //log.debug("maxId: " + maxId + __location)
        return maxId;
    }


}