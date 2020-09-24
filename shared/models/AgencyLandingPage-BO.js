'use strict';


const DatabaseObject = require('./DatabaseObject.js');
const crypt = requireShared('./services/crypt.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const moment = require('moment');
const moment_timezone = require('moment-timezone');
const { debug } = require('request');


const tableName = 'clw_talage_agency_landing_pages'
const skipCheckRequired = false;
module.exports = class AgencyLandingPageBO {

  #dbTableORM = null;
  doNotSnakeCase = ['additionalInfo'];

  constructor() {
    this.id = 0;
    this.#dbTableORM = new DbTableOrm(tableName);
    this.#dbTableORM.doNotSnakeCase = this.doNotSnakeCase;

  }

  saveModel(newObjectJSON) {
    return new Promise(async (resolve, reject) => {
      if (!newObjectJSON) {
        reject(new Error(`empty ${tableName} object given`));
      }
      await this.cleanupInput(newObjectJSON);
      if (newObjectJSON.id) {
        await this.#dbTableORM.getById(newObjectJSON.id).catch(function (err) {
          log.error(`Error getting ${tableName} from Database ` + err + __location);
          reject(err);
          return;
        });
        this.updateProperty();
        this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
      }
      else {
        this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
      }

      //save
      await this.#dbTableORM.save().catch(function (err) {
        reject(err);
      });
      this.updateProperty();
      this.id = this.#dbTableORM.id;

      //MongoDB

      resolve(true);

    });
  }

  save(asNew = false) {
    return new Promise(async (resolve, reject) => {
      //validate
      this.#dbTableORM.load(this, skipCheckRequired);
      await this.#dbTableORM.save().catch(function (err) {
        reject(err);
      });
      resolve(true);
    });
  }

  loadFromId(id) {
    return new Promise(async (resolve, reject) => {
      //validate
      if (id && id > 0) {
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

  getList(queryJSON) {
    return new Promise(async (resolve, reject) => {

      let rejected = false;
      // Create the update query
      let sql = `
                    select *  from ${tableName}  
                `;
      let hasWhere = false;
      if (queryJSON) {
        if (queryJSON.name) {
          sql += hasWhere ? " AND " : " WHERE ";
          sql += ` name like ${db.escape(queryJSON.name)} `
          hasWhere = true;
        }
        if (queryJSON.agency) {
          sql += hasWhere ? " AND " : " WHERE ";
          sql += ` agency = ${db.escape(queryJSON.agency)} `
          hasWhere = true;
        }
      }
      sql += hasWhere ? " AND " : " WHERE ";
      sql += ` state > 0 `
      // Run the query
      log.debug("AgencyLandingPageBO getlist sql: " + sql);
      const result = await db.query(sql).catch(function (error) {
        // Check if this was

        rejected = true;
        log.error(`getList ${tableName} sql: ${sql}  error ` + error + __location)
        reject(error);
      });
      if (rejected) {
        return;
      }
      let boList = [];
      if (result && result.length > 0) {
        for (let i = 0; i < result.length; i++) {
          let agencyLandingPageBO = new AgencyLandingPageBO();
          await agencyLandingPageBO.#dbTableORM.decryptFields(result[i]);
          await agencyLandingPageBO.#dbTableORM.convertJSONColumns(result[i]);
          const resp = await agencyLandingPageBO.loadORM(result[i], skipCheckRequired).catch(function (err) {
            log.error(`getList error loading object: ` + err + __location);
          })
          if (!resp) {
            log.debug("Bad BO load" + __location)
          }
          boList.push(agencyLandingPageBO);
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
    return new Promise(async (resolve, reject) => {
      //validate
      if (id && id > 0) {
        await this.#dbTableORM.getById(id).catch(function (err) {
          log.error(`Error getting  ${tableName} from Database ` + err + __location);
          reject(err);
          return;
        });
        this.updateProperty();
        resolve(this.#dbTableORM.cleanJSON());
      }
      else {
        reject(new Error('no id supplied'))
      }
    });
  }

  cleanJSON(noNulls = true) {
    return this.#dbTableORM.cleanJSON(noNulls);
  }

  async cleanupInput(inputJSON) {
    for (const property in properties) {
      if (inputJSON[property]) {
        // Convert to number
        try {
          if (properties[property].type === "number" && "string" === typeof inputJSON[property]) {
            if (properties[property].dbType.indexOf("int") > -1) {
              inputJSON[property] = parseInt(inputJSON[property], 10);
            }
            else if (properties[property].dbType.indexOf("float") > -1) {
              inputJSON[property] = parseFloat(inputJSON[property]);
            }
          }
        }
        catch (e) {
          log.error(`Error converting property ${property} value: ` + inputJSON[property] + __location)
        }
      }
    }
  }

  updateProperty() {
    const dbJSON = this.#dbTableORM.cleanJSON()
    // eslint-disable-next-line guard-for-in
    for (const property in properties) {
      this[property] = dbJSON[property];
    }
  }

  /**
 * Load new object JSON into ORM. can be used to filter JSON to object properties
   *
 * @param {object} inputJSON - input JSON
 * @returns {void} 
 */
  async loadORM(inputJSON) {
    await this.#dbTableORM.load(inputJSON, skipCheckRequired);
    this.updateProperty();
    return true;
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
  "about": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "varchar(400)"
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
  "agency_location_id": {
    "default": 0,
    "encrypted": false,
    "hashed": false,
    "required": true,
    "rules": null,
    "type": "number",
    "dbType": "int(11) unsigned"
  },
  "banner": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "varchar(30)"
  },
  "color_scheme": {
    "default": "1",
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "number",
    "dbType": "tinyint(3) unsigned"
  },
  "heading": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "varchar(70)"
  },
  "hits": {
    "default": 0,
    "encrypted": false,
    "hashed": false,
    "required": true,
    "rules": null,
    "type": "number",
    "dbType": "int(10) unsigned"
  },
  "industry_code": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "number",
    "dbType": "int(10) unsigned"
  },
  "industry_code_category": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "number",
    "dbType": "int(10) unsigned"
  },
  "intro_heading": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "varchar(100)"
  },
  "intro_text": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "varchar(400)"
  },
  "meta": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "longtext"
  },
  "name": {
    "default": "",
    "encrypted": false,
    "hashed": false,
    "required": true,
    "rules": null,
    "type": "string",
    "dbType": "varchar(70)"
  },
  "slug": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "varchar(50)"
  },
  "show_industry_section": {
    "default": "1",
    "encrypted": false,
    "hashed": false,
    "required": true,
    "rules": null,
    "type": "number",
    "dbType": "tinyint(1) unsigned"
  },
  "additionalInfo": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "json",
    "dbType": "json"
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

  constructor(tableName) {
    super(tableName, properties);
  }

}