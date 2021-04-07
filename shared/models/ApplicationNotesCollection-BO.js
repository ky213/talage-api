'use strict';

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
var ApplicationNotesCollectionModel = require('mongoose').model('ApplicationNotesCollection');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

module.exports = class ApplicationNotesCollectionBO{
    #dbTableORM = null;

    constructor(){
        this.id = 0;
        this.#dbTableORM = new DbTableOrm(tableName);
    }
 /**
	 * Save Model
     *
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application notes , or an Error if rejected
	 */
    // Use SaveMessage
    saveModel(newObjectJSON){
        return new Promise(async(resolve, reject) => {
            if(!newObjectJSON){
                reject(new Error(`empty ${tableName} object given`));
            }
            await this.cleanupInput(newObjectJSON);
            if(newObjectJSON.id){
                await this.#dbTableORM.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
            }
            else{
                this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
            }

            //save
            await this.#dbTableORM.save().catch(function(err){
                reject(err);
            });
            this.updateProperty();
            this.id = this.#dbTableORM.id;
            resolve(true);

        });
    }
    cleanJSON(noNulls = true){
        return this.#dbTableORM.cleanJSON(noNulls);
    }

    async cleanupInput(inputJSON){
        for (const property in properties) {
            if(inputJSON[property]){
                // Convert to number
                try{
                    if (properties[property].type === "number" && typeof inputJSON[property] === "string"){
                        if (properties[property].dbType.indexOf("int") > -1){
                            inputJSON[property] = parseInt(inputJSON[property], 10);
                        }
                        else if (properties[property].dbType.indexOf("float") > -1){
                            inputJSON[property] = parseFloat(inputJSON[property]);
                        }
                    }
                }
                catch(e){
                    log.error(`Error converting property ${property} value: ` + inputJSON[property] + __location)
                }
            }
        }
    }
    updateProperty(){
        const dbJSON = this.#dbTableORM.cleanJSON()
        // eslint-disable-next-line guard-for-in
        for (const property in properties) {
            this[property] = dbJSON[property];
        }
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
                    const docDB  = await  ApplicationNotesCollectionModel.findOne(query, '-__v');
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
                    const docDB  = await  ApplicationNotesCollectionModel.findOne(query, '-__v');
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