'use strict';

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// Mongoose Models
const ApplicationNotesCollectionMongooseModel = require('mongoose').model('ApplicationNotesCollection');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

module.exports = class ApplicationNotesCollectionBO{

    constructor(){
        this.id = 0;
    }
    /**
	 * Save Model
     *
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */
    saveModel(newObjectJSON, userId){
        return new Promise(async(resolve, reject) => {
            if(!newObjectJSON){
                reject(new Error(`empty applicationNotesCollection object given`));
            }
            if(!newObjectJSON.applicationId){
                reject(new Error(`No application id provided`));
            }
            if(!userId){
                reject(new Error(`No user id.`));
            }
            let applicationNotesCollectionDoc = null;
            
            if(newObjectJSON.applicationId){
                const dbDocJSON = await this.getById(newObjectJSON.applicationId).catch(function(err) {
                    log.error(`Error getting ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                if(dbDocJSON){
                    log.debug('Update application notes collection.');
                    newObjectJSON.agencyPortalModifiedUser = userId;
                    applicationNotesCollectionDoc = await this.updateMongo(dbDocJSON.applicationId,newObjectJSON);
                }else {
                    log.debug('Insert application notes collection.');
                    newObjectJSON.agencyPortalCreatedUser = userId;
                    applicationNotesCollectionDoc = await this.insertMongo(newObjectJSON);
                }
            }
            resolve(applicationNotesCollectionDoc);
        });
    }
    /**
	 * Insert Model
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application notes , or an Error if rejected
	 */
    async insertMongo(newObjectJSON){
        if (!newObjectJSON) {
            throw new Error("no data supplied");
        }
        const applicationNotesCollection = new ApplicationNotesCollectionMongooseModel(newObjectJSON);
        //Insert a doc
        await applicationNotesCollection.save().catch(function(err) {
            log.error('Mongo Application Save err ' + err + __location);
            throw err;
        });
        return mongoUtils.objCleanup(applicationNotesCollection);       
    }
    /**
	 * Update Model
     * @param {applicationId} -- applicationId
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application notes , or an Error if rejected
	 */
    async updateMongo(applicationId, newObjectJSON) {
        if (applicationId) {
            if (typeof newObjectJSON === "object") {

                const query = {"applicationId": applicationId};
                let newApplicationNotesCollection = null;
                try {
                    const changeNotUpdateList = [
                        "applicationId",
                        "agencyPortalCreatedUser",
                        ]
                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    await ApplicationNotesCollectionMongooseModel.updateOne(query, newObjectJSON);
                    const newAgencyLocationDoc = await ApplicationNotesCollectionMongooseModel.findOne(query);

                    newApplicationNotesCollection = mongoUtils.objCleanup(newAgencyLocationDoc);
                }
                catch (err) {
                    log.error(`Updating application notes error for id: ${applicationId}` + err + __location);
                    throw err;
                }

                return newApplicationNotesCollection;
            }
            else {
                throw new Error(`no newObjectJSON supplied applicationNotes: ${applicationId}`)
            }

        }
        else {
            throw new Error('no applicationNotesCollection id supplied')
        }

    }    
      /** Get Model By Application Id
         * @param {id} -- applicationId
         * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application notes , or an Error if rejected
       */
      getById(id) {
          return new Promise(async (resolve, reject) =>{
            if(id){
                const query = {
                    'applicationId': id
                };
                let applicationNotesCollectionDoc = null;
                try {
                    const docDB  = await  ApplicationNotesCollectionMongooseModel.findOne(query, '-__v');
                    if(docDB){
                        applicationNotesCollectionDoc = mongoUtils.objCleanup(docDB);
                    }
                } catch (err) {
                    log.error(`Getting Application Notes Collection ${id}` + err + __location)
                    reject(err);
                }
                resolve(applicationNotesCollectionDoc);
            }else {
                reject(new Error('no id supplied'));
            }

          });
      }

}