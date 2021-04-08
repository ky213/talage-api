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
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application notes , or an Error if rejected
	 */
    // Use SaveMessage
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
       * Get By AppId
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

      /**
       * Get By ApplicationCollectionId
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