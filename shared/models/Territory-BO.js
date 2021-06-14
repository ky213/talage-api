

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
var TerritoryModel = require('mongoose').model('Territory');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');


const collectionName = 'Territory'
module.exports = class TerritoryBO{

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
            let updatedDoc = null;
            try{
                if(newObjectJSON.abbr){
                    updatedDoc = await this.updateMongoAbbr(newObjectJSON.abbr, newObjectJSON);
                }
                else{
                    updatedDoc = await this.insertMongo(newObjectJSON);
                }
            }
            catch(err){
                reject(err);
            }
            resolve(updatedDoc);
        });
    }

    async updateMongoAbbr(abbr, newObjectJSON){
        if(abbr){
            if(typeof newObjectJSON === "object"){
                const changeNotUpdateList = ["active",
                    "abbr",
                    "id"]
                for(let i = 0; i < changeNotUpdateList.length; i++){
                    if(newObjectJSON[changeNotUpdateList[i]]){
                        delete newObjectJSON[changeNotUpdateList[i]];
                    }
                }
                const query = {"abbr": abbr};
                let newMappingJSON = null;
                try {
                    await TerritoryModel.updateOne(query, newObjectJSON);

                    const mappingDocDB = await TerritoryModel.findOne(query);
                    newMappingJSON = mongoUtils.objCleanup(mappingDocDB);
                }
                catch (err) {
                    log.error(`Updating ${collectionName} error ` + err + __location);
                    throw err;
                }
                return newMappingJSON;
            }
            else {
                throw new Error('no newObjectJSON supplied')
            }

        }
        else {
            throw new Error('no id supplied')
        }

    }

    async updateMongo(id, newObjectJSON){
        if(id){
            if(typeof newObjectJSON === "object"){
                const changeNotUpdateList = ["active",
                    "abbr",
                    "id"]
                for(let i = 0; i < changeNotUpdateList.length; i++){
                    if(newObjectJSON[changeNotUpdateList[i]]){
                        delete newObjectJSON[changeNotUpdateList[i]];
                    }
                }
                const query = {"territoryId": id};
                let newMappingJSON = null;
                try {
                    await TerritoryModel.updateOne(query, newObjectJSON);

                    const mappingDocDB = await TerritoryModel.findOne(query);
                    newMappingJSON = mongoUtils.objCleanup(mappingDocDB);
                }
                catch (err) {
                    log.error(`Updating ${collectionName} error ` + err + __location);
                    throw err;
                }
                return newMappingJSON;
            }
            else {
                throw new Error('no newObjectJSON supplied')
            }

        }
        else {
            throw new Error('no id supplied')
        }

    }

    async insertMongo(newObjecJSON){


        const Territory = new TerritoryModel(newObjecJSON);
        //Insert a doc
        await Territory.save().catch(function(err){
            log.error(`Mongo ${collectionName} Save err ` + err + __location);
            throw err;
        });
        const docDB = mongoUtils.objCleanup(Territory);
        return docDB;
    }


    getAbbrNameList(){
        return new Promise(async(resolve, reject) => {
        //check redis


            const query = {active: true};
            const queryProjection = {
                abbr: 1,
                name: 1,
                "_id": 0
            };
            var queryOptions = {lean:true};
            queryOptions.sort = {};
            queryOptions.sort.name = 1;
            let doclist = null;
            try {
                doclist = await TerritoryModel.find(query, queryProjection,queryOptions)

                //save to redis


            }
            catch (err) {
                log.error(`Getting ${collectionName} error ` + err + __location);
                reject(err);
            }

            if(doclist && doclist.length > 0){
                resolve(doclist);
            }
            else {
                //Search so no hits ok.
                resolve([]);
            }


        });

    }


    getList(queryJSON) {
        return new Promise(async(resolve, reject) => {
            // Create the update query
            const query = {active: true};
            if(queryJSON){

                if(queryJSON.active === false || queryJSON.active === 'false'){
                    query.active = queryJSON.active
                }
                if(queryJSON.name){
                    query.name = queryJSON.name
                }
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

            // Run the query
            let docCleanList = null;
            try {
                const doclist = await TerritoryModel.find(query, '-__v');
                docCleanList = mongoUtils.objListCleanup(doclist);
            }
            catch (err) {
                log.error(`Getting ${collectionName} error ` + err + __location);
                reject(err);
            }

            if(docCleanList && docCleanList.length > 0){
                resolve(docCleanList);
            }
            else {
                //Search so no hits ok.
                resolve([]);
            }


        });
    }


    getById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id){
                const query = {
                    "territoryId": id,
                    active: true
                };
                let docCleanDB = null;
                try {
                    const docDB = await TerritoryModel.findOne(query, '-__v');
                    if(docDB){
                        docCleanDB = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error(`Getting ${collectionName} error ` + err + __location);
                    reject(err);
                }
                resolve(docCleanDB);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    getByAbbr(abbr) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(abbr){
                const query = {
                    "abbr": abbr,
                    active: true
                };
                let docCleanDB = null;
                try {
                    const docDB = await TerritoryModel.findOne(query, '-__v');
                    if(docDB){
                        docCleanDB = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error(`Getting ${collectionName} error ` + err + __location);
                    reject(err);
                }
                resolve(docCleanDB);
            }
            else {
                reject(new Error('no abbr supplied'))
            }
        });
    }

    deleteSoftById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id){
                const activeJson = {active: false};
                const query = {"territoryId": id};
                try {
                    await TerritoryModel.updateOne(query, activeJson);
                }
                catch (err) {
                    log.error(`Soft Deleting ${collectionName} error ` + err + __location);
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