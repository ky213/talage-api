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
	 * Insert Model
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application notes , or an Error if rejected
	 */
    async insertMongo(newObjectJSON){
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
        const applicationNotesCollection = new ApplicationNotesCollectionMongooseModel(newObjectJSON);
        //Insert a doc
        await applicationNotesCollection.save().catch(function(err) {
            log.error('Mongo Application Save err ' + err + __location);
            throw err;
        });
        this.id = applicationNotesCollection.applicationNotesCollectionId;
        return mongoUtils.objCleanup(applicationNotesCollection);       
    }
    /**
	 * Update Model
     * @param {docId} -- applicationNotesCollectionId
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application notes , or an Error if rejected
	 */
    async updateMongo(docId, newObjectJSON) {
        if (docId) {
            if (typeof newObjectJSON === "object") {

                const query = {"applicationNotesCollectionId": docId};
                let newApplicationNotesCollection = null;
                try {
                    const changeNotUpdateList = [
                        "applicationNotesCollectionId",
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
                    log.error(`Updating application notes error for id: ${docId}` + err + __location);
                    throw err;
                }

                return newApplicationNotesCollection;
            }
            else {
                throw new Error(`no newObjectJSON supplied applicationNotes: ${docId}`)
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
      getByAppId(id) {
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

      /** Get By ApplicationCollectionId
         * @param {id} -- ApplicationCollectionId
         * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application notes , or an Error if rejected
       */
      getById(id){
        return new Promise(async (resolve, reject) =>{
            if(id){
                const query = {
                    'applicationNotesCollectionId': id
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