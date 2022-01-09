'use strict';

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
var QuestionGroup = global.insurerMongodb.model('QuestionGroup');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

module.exports = class CodeGroupBO{

    constructor(){
        this.id = 0;
    }


    /**
	 * Save Model
     *
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */
    saveModel(newObjectJSON){
        return new Promise(async(resolve, reject) => {
            let updatedDoc = null;
            try{
                if(newObjectJSON.questionGroupId){
                    updatedDoc = await this.updateMongo(newObjectJSON.questionGroupId, newObjectJSON);
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


    async updateMongo(id, newObjectJSON){
        if(id){
            if(typeof newObjectJSON === "object"){
                const changeNotUpdateList = ["active",
                    "questionGroupId",
                    "id"]
                for(let i = 0; i < changeNotUpdateList.length; i++){
                    if(newObjectJSON[changeNotUpdateList[i]]){
                        delete newObjectJSON[changeNotUpdateList[i]];
                    }
                }
                const query = {"questionGroupId": id};
                let newMappingJSON = null;
                try {
                    await QuestionGroup.updateOne(query, newObjectJSON);

                    const mappingDocDB = await QuestionGroup.findOne(query);
                    newMappingJSON = mongoUtils.objCleanup(mappingDocDB);
                }
                catch (err) {
                    log.error("Updating Mapping error " + err + __location);
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


        const mapping = new QuestionGroup(newObjecJSON);
        //Insert a doc
        await mapping.save().catch(function(err){
            log.error('Mongo Mapping Save err ' + err + __location);
            throw err;
        });
        const docDB = mongoUtils.objCleanup(mapping);
        return docDB;
    }


    getList(queryJSON) {
        return new Promise(async(resolve, reject) => {
            // Create the update query
            const query = {active: true};
            if(queryJSON){

                if(queryJSON.active === false){
                    query.active = queryJSON.active
                }
                if(queryJSON.name){
                    query.name = queryJSON.name
                }
            }

            // Run the query
            let docCleanList = null;
            try {
                const doclist = await QuestionGroup.find(query, '-__v');
                docCleanList = mongoUtils.objListCleanup(doclist);
            }
            catch (err) {
                log.error("Getting Mapping error " + err + __location);
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
                    "questionGroupId": id,
                    active: true
                };
                let docCleanDB = null;
                try {
                    const docDB = await QuestionGroup.findOne(query, '-__v');
                    if(docDB){
                        docCleanDB = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error("Getting Mapping error " + err + __location);
                    reject(err);
                }
                resolve(docCleanDB);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    getByName(name) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(name){
                const query = {
                    "name": name,
                    active: true
                };
                let docCleanDB = null;
                try {
                    const docDB = await QuestionGroup.findOne(query, '-__v');
                    if(docDB){
                        docCleanDB = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error("Getting Mapping error " + err + __location);
                    reject(err);
                }
                resolve(docCleanDB);
            }
            else {
                reject(new Error('no name supplied'))
            }
        });
    }

    deleteSoftById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id){
                const activeJson = {active: false};
                const query = {"questionGroupId": id};
                try {
                    await QuestionGroup.updateOne(query, activeJson);
                }
                catch (err) {
                    log.error("Soft Deleting Mapping error " + err + __location);
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