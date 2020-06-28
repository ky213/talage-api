'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const crypt = global.requireShared('./services/crypt.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// const util = require('util');
// const email = global.requireShared('./services/emailsvc.js');
// const slack = global.requireShared('./services/slacksvc.js');
// const formatPhone = global.requireShared('./helpers/formatPhone.js');
// const get_questions = global.requireShared('./helpers/getQuestions.js');

const validator = global.requireShared('./helpers/validator.js');



module.exports = class SearchStringModel{

  #dbTableORM = null;

	constructor(){
		this.id = 0;
        this.#dbTableORM = new SearchStringOrm();
    }


    /**
	 * Load new business JSON with optional save.
     *
	 * @param {object} searchStringJSON - business JSON
     * @param {boolean} save - Saves business if true
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved business , or an Error if rejected
	 */
    AddStrings(searchStringJSON){
        return new Promise(async(resolve, reject) => {
            if(!searchStringJSON){
                reject(new Error("empty searchStringJSON object given"));
            }
            if(searchStringJSON.fields && searchStringJSON.fields.length > 0 && searchStringJSON.table && searchStringJSON.item_id){
                 
                 //loop through fields 
                for(var i =0 ; i < searchStringJSON.fields.length; i++ ){
                    //Remove old records.
                    const fieldJSON = searchStringJSON.fields[i];
                    if(fieldJSON.field && fieldJSON.value){
                        await this.removeField(searchStringJSON.table, fieldJSON.field, searchStringJSON.item_id ).catch(function(err){
                            log.error(`error removing search string  ${searchStringJSON.table} id ${searchStringJSON.item_id} error: ` + err)
                        });
                        
                        //get hasharray 
                        const hashArray = await this.generateSearchStrings(fieldJSON.value); 
                        for(var j=0 ; j < hashArray.length; j++){
                            const searchStringRecordJson = { "table" : searchStringJSON.table,
                                                             "item_id": searchStringJSON.item_id,
                                                             "hash": hashArray[j],
                                                             "field": fieldJSON.field };
                            // Make clean ORM
                            let searchStringItemORM = new SearchStringOrm();
                            searchStringItemORM.load(searchStringRecordJson);
                            //save                    
                            await searchStringItemORM.save().catch(function(err){
                                log.error(`error save search string  ${searchStringJSON.table} id ${searchStringJSON.item_id} error: ` + err)
                            });
                        }
                    }
                }
                resolve(true);
            }
            else {
                reject(new Error("empty searchStringJSON has no fields"));
            }
        });
    }


    RemoveStrings(searchStringJSON, save = false){
        return new Promise(async(resolve) => {
             //Remove old records.
		        //clw_talage_search_strings'
             resolve(true);

        });


    }
    removeField(tablename,fieldName, item_id){
        return new Promise(async(resolve, reject) => {
            //Remove old records.
            const sql =`DELETE FROM clw_talage_search_strings
                   WHERE \`field\`= "${fieldName}"
                        AND \`table\`= "${tablename}"
                        AND \`item_id\`= ${item_id}
            `;
            let rejected = false;
			const result = await db.query(sql).catch(function (error) {
				// Check if this was
				log.error("Database Object clw_talage_search_strings DELETE error :" + error + __location);
				rejected = true;
				reject(error);
			});
			if (rejected) {
				return false;
			}
            resolve(true);

       });

    }

    async generateSearchStrings(sourceStr){
        let hashValueArray = [];
        if(sourceStr.length>3){
            // Convert special HTML characters back to regular characters
            sourceStr = stringFunctions.htmlspecialchars_decode(sourceStr, 'ENT_QUOTES');

            // Convert to lower case to reduce the number of hashes we need to store
            sourceStr = sourceStr.toLowerCase();

            // Three characters is the minimum we allow in a search, loop through three times removing the first i character(s) each time so we have different starting points in the string
           // for(var i = 0; i < 3; i++){
                const sstr = sourceStr;
                log.debug('sstr: ' + sstr)
                for(var j=3; j < sstr.length; j++){
                    for(var k=0; k < sstr.length - j; k++){
                        const sstr2 = sstr.substring(k,j)
                        //Remove any results that are shorter than 3 characters
                        if(sstr2.length > 2){
                            hashValueArray.push(sstr2);
                        }
                    }
                    
                }
                
            //}

            // Remove duplicates
            hashValueArray = stringFunctions.remove_array_duplicates(hashValueArray);
            //hash values
            for(var i = 0; i < hashValueArray.length; i++){
                hashValueArray[i] = await crypt.hash(hashValueArray[i]);
            }
        }
        return hashValueArray;
    }
    
    
    

    updateProperty(){
      const dbJSON = this.#dbTableORM.cleanJSON()
      // eslint-disable-next-line guard-for-in
      for (const property in properties) {
          this[property] = dbJSON[property];
      }
    }
}

const properties = {
    "id": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number"
    },
    "field": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string"
    },
    "hash": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string"
    },
    "item_id": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number"
    },
    "table": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string"
    }
  }

class SearchStringOrm extends DatabaseObject {

	constructor(){
		super('clw_talage_search_strings', properties);
	}

}