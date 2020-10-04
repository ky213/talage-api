'use strict';

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
var Mapping = require('mongoose').model('Mapping');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

module.exports = class MappingBO{

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
                if(newObjectJSON.mappingId){
                    updatedDoc = await this.update(newObjectJSON.mappingId, newObjectJSON);
                }
                else{
                    updatedDoc = await this.insert(newObjectJSON);
                }
            }
            catch(err){
                reject(err);
            }
            resolve(updatedDoc);
        });
    }

    // /**
	//  * saves model.
    //  *
	//  * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved model , or an Error if rejected
	//  */

    // save(asNew = false){
    //     return new Promise(async(resolve, reject) => {
    //     //validate

    //         resolve(true);
    //     });
    // }

    async update(id, newObjectJSON){
        if(id ){
            if(typeof newObjectJSON === "object"){
                const changeNotUpdateList = ["active","mappingId", "id","systemId", "MappingId"]
                for(let i = 0;i < changeNotUpdateList.length; i++ ){
                    if(newObjectJSON[changeNotUpdateList[i]]){
                        delete newObjectJSON[changeNotUpdateList[i]];
                    }
                }
                const query = {"mappingId": id};
                let newMappingJSON = null;
                try {
                    await Mapping.updateOne(query, newObjectJSON);

                    const mappingDocDB = await Mapping.findOne(query);
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
        return true;

    }

    async insert(newObjecJSON){
       
          
            let mapping = new Mapping(newObjecJSON);
            //Insert a doc
            await mapping.save().catch(function(err){
                log.error('Mongo Mapping Save err ' + err + __location);
                throw err;
            });
            let docDB = mongoUtils.objCleanup(mapping);
            return docDB;
    }
    

    getList(queryJSON) {
        return new Promise(async (resolve, reject) => {
                let rejected = false;
                // Create the update query
                let query = {active: true};
                if(queryJSON){
                  
                    if(queryJSON.active){
                       query.active = queryJSON.active
                    }
                    if(queryJSON.name){
                        query.name = queryJSON.name
                     } 
                }
               
                // Run the query
                let docCleanList = null;
                try {
                    let doclist = await Mapping.find(query, '-__v');
                    docCleanList = mongoUtils.objListCleanup(doclist);
                }
                catch (err) {
                    log.error("Getting Mapping error " + err + __location);
                    reject(err);
                }
                
                if(docCleanList && docCleanList.length > 0 ){
                    resolve(docCleanList);
                }
                else {
                    //Search so no hits ok.
                    resolve([]);
                }
               
            
        });
    }


    getById(id) {
        return new Promise(async (resolve, reject) => {
            //validate
            if(id ){
                const query = {"mappingId": id, active: true};
                let docCleanDB = null;
                try {
                    let docDB = await Mapping.findOne(query, '-__v');
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
        return new Promise(async (resolve, reject) => {
            //validate
            if(name ){
                const query = {"name": name, active: true};
                let docCleanDB = null;
                try {
                    let docDB = await Mapping.findOne(query, '-__v');
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
        return new Promise(async (resolve, reject) => {
            //validate
            if(id ){
                const activeJson = {active: false};
                const query = {"mappingId": id};
                try {
                    await Mapping.updateOne(query, activeJson);
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



