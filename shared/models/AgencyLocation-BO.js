'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const AgencyLocationInsurer = require('./AgencyLocationInsurer-BO.js');
const AgencyLocationTerritory = require('./AgencyLocationTerritory-BO.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const crypt = global.requireShared('./services/crypt.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');



const tableName = 'clw_talage_agency_locations'
const skipCheckRequired = false;
module.exports = class AgencyLocationBO{

    #dbTableORM = null;

	constructor(){
        this.id = 0;
        this.#dbTableORM = new DbTableOrm(tableName);
    }


    /**
	 * Save Model 
     *
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */
    saveModel(newObjectJSON){
        return new Promise(async(resolve, reject) => {
            if(!newObjectJSON){
                reject(new Error(`empty ${tableName} object given`));
            }
            await this.cleanupInput(newObjectJSON);
            if(newObjectJSON.id){
                await this.#dbTableORM.getById(newObjectJSON.id).catch(function (err) {
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

    /**
	 * saves businessContact.
     *
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */

    save(asNew = false){
        return new Promise(async(resolve, reject) => {
        //validate

            resolve(true);
        });
    }

    loadFromId(id) {
        return new Promise(async (resolve, reject) => {
            //validate
            if(id && id >0 ){
                await this.#dbTableORM.getById(id).catch(function (err) {
                    log.error(`Error getting  ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                resolve(true);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    async cleanupInput(inputJSON){
        for (const property in properties) {
            if(inputJSON[property]){
                // Convert to number
                try{
                    if (properties[property].type === "number" && "string" === typeof inputJSON[property]){
                        if (properties[property].dbType.indexOf("int")  > -1){
                            inputJSON[property] = parseInt(inputJSON[property], 10);
                        }
                        else if (properties[property].dbType.indexOf("float")  > -1){
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
    async getSelectionList(agencyId){
        if(agencyId){
            let rejected = false;
                let responseLandingPageJSON = {};
                let reject  = false;
                const sql = `select al.id, al.address, z.city, z.territory, al.zip  
                    from clw_talage_agency_locations al
                    left outer join clw_talage_zip_codes z on z.zip = al.zip
                
                    where agency = ${agencyId}`
                const result = await db.query(sql).catch(function (error) {
                    // Check if this was
                    rejected = true;
                    log.error(`clw_talage_agency_locations error on select ` + error + __location);
                });
                if (!rejected && result && result.length >0) {
                    //created encrypt and format
                    for(var i = 0; i < result.length; i++){
                        let location = result[i];
                        location.address = await crypt.decrypt(location.address);
                        location.address = location.address + " " + location.city + " " + location.territory + " " +  location.zip;
                    }
                    return result;
                }
                else {
                    return [];
                }
        }
        else {
            throw new Error("No agency id");
        }
    }


    async getByIdAndAgencyListForAgencyPortal(id,agencyList, children=true ){
        
        if(agencyList && id){
            //agencyId = stringFunctions.santizeNumber(agencyId, true);
            id = stringFunctions.santizeNumber(id, true);
            //santize id.
            let rejected = false;
                
            //what agencyportal client expects.
            const sql = `SELECT
                    l.id,
                    l.state,
                    l.email,
                    l.fname,
                    l.lname,
                    l.phone,
                    l.address,
                    l.address2,
                    z.city,
                    z.territory,
                    LPAD(CONVERT(l.zip,char), 5, '0') AS zip,
                    l.open_time as openTime,
                    l.close_time as closeTime,
                    l.primary
                FROM clw_talage_agency_locations l
                LEFT OUTER JOIN clw_talage_zip_codes z ON z.zip = l.zip
                WHERE l.id = ? AND l.agency in (?) AND l.state > 0;`

            //WHERE l.id = ${id} AND l.agency = ${agencyId} AND l.state > 0;`
            const parmList = [id, agencyList];
            const result = await db.queryParam(sql, parmList).catch(function (error) {
                // Check if this was
                rejected = true;
                log.error(`clw_talage_agency_locations error on select ` + error + __location);
            });
            if(result && result.length>0) {
                let locationJSON = result[0];
                if (!rejected && result && result.length >0) {
                    //created encrypt and format
                    let location = locationJSON;
                    location.address = await crypt.decrypt(location.address);
                    if(location.address2){
                        location.address2 = await crypt.decrypt(location.address2);
                    }
                    
                    location.email = await crypt.decrypt(location.email);
                    location.fname = await crypt.decrypt(location.fname);
                    location.lname = await crypt.decrypt(location.lname);
                    location.phone = await crypt.decrypt(location.phone);
                    
                    if(children === true ){
                        const agencyLocationInsurer = new AgencyLocationInsurer
                        const insurerList = await agencyLocationInsurer.getListByAgencyLoationForAgencyPortal(id).catch(function (error) {
                            // Check if this was
                            rejected = true;
                            log.error(`agencyLocationInsurer.getListByAgencyLoationForAgencyPortal error on select ` + error + __location);
                        });
                        location.insurers = insurerList;

                        // Territories 
                        const agencyLocationTerritory = new AgencyLocationTerritory
                        const territoryList = await agencyLocationTerritory.getListByAgencyLoationForAgencyPortal(id).catch(function (error) {
                            // Check if this was
                            rejected = true;
                            log.error(`agencyLocationTerritory.getListByAgencyLoationForAgencyPortal error on select ` + error + __location);
                        });
                        location.territories = territoryList;

                    }
                    return locationJSON;
                }
                else {
                    return null;
                }
            }
            else {
                return null;
            }
        }
        else {
            throw new Error("No id or agencyList");
        }
    }

    async getByIdAndAgency(id,agencyId, children=true ){
        
        if(agencyId && id){
            agencyId = stringFunctions.santizeNumber(agencyId, true);
            id = stringFunctions.santizeNumber(id, true);
            //santize id.
            
            let rejected  = false;
            //what agencyportal client expects.
            //TODO parameterize query....
            const sql = `select *
                from clw_talage_agency_locations 
                where agency = ${agencyId} and l.id = ${id} AND state > 0`

            const result = await db.query(sql).catch(function (error) {
                // Check if this was
                rejected = true;
                log.error(`clw_talage_agency_locations error on select ` + error + __location);
            });
            if(result && result.length>0) {
                let locationJSON = result[0];
                if (!rejected && result && result.length >0) {
                    //created encrypt and format
                    
                    let location = locationJSON;
                    location.address = await crypt.decrypt(location.address);
                    if(location.address2){
                        location.address2 = await crypt.decrypt(location.address2);
                    }
                    
                    location.email = await crypt.decrypt(location.email);
                    location.fname = await crypt.decrypt(location.fname);
                    location.phone = await crypt.decrypt(location.phone);    
                    
                    if(children === true ){

                    }
                    return result;
                }
                else {
                    return locationJSON;
                }
            }
            else {
                return null;
            }
        }
        else {
            throw new Error("No id or agency id");
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
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "state": {
      "default": "1",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(1)"
    },
    "address": {
      "default": null,
      "encrypted": true,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "address2": {
      "default": null,
      "encrypted": true,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "agency": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "close_time": {
      "default": "5",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(2)"
    },
    "email": {
      "default": null,
      "encrypted": true,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "fname": {
      "default": null,
      "encrypted": true,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "lname": {
      "default": null,
      "encrypted": true,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "open_time": {
      "default": "9",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(2)"
    },
    "phone": {
      "default": null,
      "encrypted": true,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "primary": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(1)"
    },
    "zip": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "mediumint(5) unsigned"
    },
    "created": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "timestamp",
      "dbType": "timestamp"
    },
    "created_by": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "modified": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "timestamp",
      "dbType": "timestamp"
    },
    "modified_by": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "deleted": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "timestamp",
      "dbType": "timestamp"
    },
    "deleted_by": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "checked_out": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "int(11)"
    },
    "checked_out_time": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "datetime",
      "dbType": "datetime"
    }
  }

class DbTableOrm extends DatabaseObject {

	constructor(tableName){
		super(tableName, properties);
	}

}