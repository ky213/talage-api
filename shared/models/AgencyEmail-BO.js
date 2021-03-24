'use strict';

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
var AgencyEmail = require('mongoose').model('AgencyEmail');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const uuidValiditor = global.requireShared(`helpers/validators/uuid.js`);
const integerValiditor = global.requireShared(`helpers/validators/integer.js`);
module.exports = class AgencyEmailBO{

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
                if(newObjectJSON.agencyEmailId){
                    updatedDoc = await this.update(newObjectJSON.agencyEmailId, newObjectJSON);
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
                const changeNotUpdateList = ["active","agencyEmailId", "id","systemId", "AgencyEmailId"]
                for(let i = 0;i < changeNotUpdateList.length; i++ ){
                    if(newObjectJSON[changeNotUpdateList[i]]){
                        delete newObjectJSON[changeNotUpdateList[i]];
                    }
                }
                const query = {"agencyEmailId": id};
                let newAgencyEmailJSON = null;
                try {
                    await AgencyEmail.updateOne(query, newObjectJSON);

                    const agencyEmailDocDB = await AgencyEmail.findOne(query);
                    newAgencyEmailJSON = mongoUtils.objCleanup(agencyEmailDocDB);
                }
                catch (err) {
                    log.error("Updating AgencyEmail error " + err + __location);
                    throw err;
                }
                return newAgencyEmailJSON;
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
       
          
            let agencyEmail = new AgencyEmail(newObjecJSON);
            //Insert a doc
            await agencyEmail.save().catch(function(err){
                log.error('Mongo AgencyEmail Save err ' + err + __location);
                throw err;
            });
            let docDB = mongoUtils.objCleanup(agencyEmail);
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
                    let doclist = await AgencyEmail.find(query, '-__v');
                    docCleanList = mongoUtils.objListCleanup(doclist);
                }
                catch (err) {
                    log.error("Getting AgencyEmail error " + err + __location);
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
            let isMysqlId = false;
            try {
                const test = parseInt(isMysqlId, 10);
                isMysqlId = true;
            }
            catch(err){
                sMysqlId = false;
            }
            if(id ){
                let query = {active: true};
                if (isMysqlId === true) {
                    query.agencyMySqlId = id
                } else if(uuidValiditor(id)){
                   query.agencyEmailId =id
                }  else {
                    reject(new Error('no valid id supplied'))
                    return;
                }
                let docCleanDB = null;
                try {
                    let docDB = await AgencyEmail.findOne(query, '-__v');
                    if(docDB){
                        docCleanDB = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error("Getting AgencyEmail error " + err + __location);
                    reject(err);
                }
                resolve(docCleanDB);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    deleteSoftById(id) {
        return new Promise(async (resolve, reject) => {
            //validate
            if(id ){
                const activeJson = {active: false};
                const query = {"agencyEmailId": id};
                try {
                    await AgencyEmail.updateOne(query, activeJson);
                }
                catch (err) {
                    log.error("Soft Deleting AgencyEmail error " + err + __location);
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



