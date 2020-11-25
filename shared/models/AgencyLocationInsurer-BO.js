/* eslint-disable no-shadow */
'use strict';

const DatabaseObject = require('./DatabaseObject.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const crypt = global.requireShared('./services/crypt.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


const tableName = 'clw_talage_agency_location_insurers'
const skipCheckRequired = false;

// **
//
//
//   NOTE:  clw_talage_agency_location_insurers is being phased out
//          after 2020-09-23 any write of AgencyLocation Insurer
//          should got into the agency_locations.insurer column
//          NOT the clw_talage_agency_location_insurers table.
//
//

module.exports = class AgencyLocationInsurerBO{

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
                await this.#dbTableORM.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
            }
            else if(newObjectJSON.agency_location && newObjectJSON.insurer){
                try{
                    const currentDBrec = await this.getByAgencyLocationAndInsurer(newObjectJSON.agency_location,newObjectJSON.insurer);
                    if(currentDBrec){
                        await this.#dbTableORM.getById(currentDBrec.id).catch(function(err) {
                            log.error(`Error getting ${tableName} from Database ` + err + __location);
                            reject(err);
                            return;
                        });
                    }
                }
                catch(e){
                    log.error(`Error: ${tableName} getting by alId, and insurerid ` + e + __location);
                }
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

    loadFromId(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id && id > 0){
                await this.#dbTableORM.getById(id).catch(function(err) {
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

    getList(queryJSON) {
        return new Promise(async(resolve, reject) => {

            let rejected = false;
            // Create the update query
            let sql = `
                    select * from ${tableName}  
                `;
            if(queryJSON){
                let hasWhere = false;
                if(queryJSON.id){
                    sql += hasWhere ? " AND " : " WHERE ";
                    sql += ` id = ${db.escape(queryJSON.id)} `
                    hasWhere = true;
                }
                if(queryJSON.agency_location){
                    sql += hasWhere ? " AND " : " WHERE ";
                    sql += ` agency_location = ${db.escape(queryJSON.agency_location)} `
                    hasWhere = true;
                }
                if(queryJSON.insurer){
                    sql += hasWhere ? " AND " : " WHERE ";
                    sql += ` insurer = ${db.escape(queryJSON.insurer)} `
                    hasWhere = true;
                }
            }
            // Run the query
            //log.debug("AgencyLocationInsurerBO getlist sql: " + sql);
            const result = await db.query(sql).catch(function(error) {
                // Check if this was

                rejected = true;
                log.error(`getList ${tableName} sql: ${sql}  error ` + error + __location)
                reject(error);
            });
            if (rejected) {
                return;
            }
            const boList = [];
            if(result && result.length > 0){
                for(let i = 0; i < result.length; i++){
                    const agencyLocationInsurerBO = new AgencyLocationInsurerBO();
                    await agencyLocationInsurerBO.#dbTableORM.decryptFields(result[i]);
                    await agencyLocationInsurerBO.#dbTableORM.convertJSONColumns(result[i]);
                    const resp = await agencyLocationInsurerBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                        log.error(`getList error loading object: ` + err + __location);
                    })
                    if(!resp){
                        log.debug("Bad BO load" + __location)
                    }
                    boList.push(agencyLocationInsurerBO);
                }
                resolve(boList);
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
            if(id && id > 0){
                await this.#dbTableORM.getById(id).catch(function(err) {
                    log.error(`Error getting  ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                resolve(this.cleanJSON());
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    async getByAgencyLocationandInsurer(agencyLocationid, insurerId) {
        const query = {
            "agency_location": agencyLocationid ,
            "insurer" : insurerId
        };
        let recordSet = null
        try{
            recordSet = await this.getList(query)
        }
        catch(err){
            log.error(`${tableName} getByIdandInsurer error ` + err + __location);
            throw err;
        }
        if(recordSet){
            return recordSet[0]
        }
        else {
            return null;
        }
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

    async getByAgencyLocationAndInsurer(agencyLocId, insurerId){

        if(agencyLocId && insurerId){
            agencyLocId = stringFunctions.santizeNumber(agencyLocId, true);
            agencyLocId = stringFunctions.santizeNumber(agencyLocId, true);
            let rejected = false;
            const sql = `select *
                from ${tableName}
                where agency_location = ${db.escape(agencyLocId)} 
                    AND insurer = ${db.escape(insurerId)} 
            `;

            const result = await db.query(sql).catch(function(error) {
                // Check if this was
                rejected = true;
                log.error(`${tableName} error on select ` + error + __location);
            });

            if (!rejected && result && result.length > 0) {
                const locationInsurerJSON = result[0];
                //created encrypt and format
                const agencyLocationBO = new AgencyLocationInsurerBO();
                await agencyLocationBO.#dbTableORM.decryptFields(locationInsurerJSON);
                await agencyLocationBO.#dbTableORM.convertJSONColumns(locationInsurerJSON);
                return locationInsurerJSON;
            }
            else {
                return null;
            }

        }
        else {
            throw new Error("No id or agency id");
        }
    }


    async getListByAgencyLocationForAgencyPortal(agencyLocationId){

        if(agencyLocationId){
            //santize id.
            agencyLocationId = stringFunctions.santizeNumber(agencyLocationId, true);
            let rejected = false;
            //what agencyportal client expects.
            const sql = `SELECT 
                i.id as insurer,
                i.logo,
                i.name,
                i.agency_id_label as agency_id_label,
                i.agent_id_label as agent_id_label,
                i.enable_agent_id as enable_agent_id,					
                li.id,
                li.agency_location as locationID,
                li.agency_id as agencyId,
                li.agent_id as agentId,
                li.bop,
                li.gl,
                li.wc,
                li.policy_type_info
            FROM clw_talage_agency_location_insurers as li
                INNER JOIN clw_talage_insurers as i ON li.insurer =i.id
            WHERE
                li.agency_location = ${agencyLocationId} AND
                i.state > 0 
            ORDER BY i.name ASC;`

            const result = await db.query(sql).catch(function(error) {
                // Check if this was
                rejected = true;
                log.error(`clw_talage_agency_location_insurers error on select ` + error + __location);
            });
            if(result && result.length > 0) {
                if (!rejected && result && result.length > 0) {
                    for(var i = 0; i < result.length; i++){
                        const insurer = result[i];
                        insurer.agencyId = await crypt.decrypt(insurer.agencyId);
                        insurer.agentId = await crypt.decrypt(insurer.agentId);
                        insurer.policy_type_info = JSON.parse(insurer.policy_type_info)
                    }
                    return result;
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
            throw new Error("No agencyLocationId");
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
    "agency_location": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "insurer": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "agency_id": {
        "default": null,
        "encrypted": true,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "blob"
    },
    "agent_id": {
        "default": null,
        "encrypted": true,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "blob"
    },
    "policy_type_info": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "json",
        "dbType": "json"
    },
    "bop": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    },
    "gl": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    },
    "wc": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    }
}

class DbTableOrm extends DatabaseObject {

    constructor(tableName){
        super(tableName, properties);
    }

}