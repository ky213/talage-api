'use strict';

const DatabaseObject = require('./DatabaseObject.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// const moment = require('moment');
// const moment_timezone = require('moment-timezone');
// const {debug} = require('request');
var AgencyLandingPageModel = require('mongoose').model('AgencyLandingPage');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

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
      return new Promise(async(resolve, reject) => {
          if(!newObjectJSON){
              reject(new Error(`empty ${tableName} object given`));
          }
          let newDoc = true;
          await this.cleanupInput(newObjectJSON);
          if(newObjectJSON.id){
              const dbDocJSON = await this.getById(newObjectJSON.id).catch(function(err) {
                  log.error(`Error getting ${tableName} from Database ` + err + __location);
                  reject(err);
                  return;
              });
              if(dbDocJSON){
                  newDoc = false;
                  if(newObjectJSON.primary){
                      await this.resetPrimary(dbDocJSON.agencyId, dbDocJSON.systemId);
                  }
                  this.updateMongo(dbDocJSON.agencyLocationId,newObjectJSON)
              }
          }
          if(newDoc === true) {
              const newAgencyLandingPageDoc = this.insertMongo(newObjectJSON);
              this.id = newAgencyLandingPageDoc.systemId;
              if(newObjectJSON.primary){
                  await this.resetPrimary(newAgencyLandingPageDoc.agencyId, newAgencyLandingPageDoc.systemId);
              }

          }

          resolve(true);

      });
  }

  async updateMongo(docId, newObjectJSON) {
      if (docId) {
          if (typeof newObjectJSON === "object") {

              const query = {"agencyLocationId": docId};
              let newAgencyLocationJSON = null;
              try {
                  const changeNotUpdateList = ["active",
                      "id",
                      "mysqlId",
                      "agencyLocationId",
                      "uuid"]
                  for (let i = 0; i < changeNotUpdateList.length; i++) {
                      if (newObjectJSON[changeNotUpdateList[i]]) {
                          delete newObjectJSON[changeNotUpdateList[i]];
                      }
                  }

                  await AgencyLandingPageModel.updateOne(query, newObjectJSON);
                  const newAgencyLandingPageDoc = await AgencyLandingPageModel.findOne(query);

                  newAgencyLocationJSON = mongoUtils.objCleanup(newAgencyLandingPageDoc);
              }
              catch (err) {
                  log.error(`Updating Application error appId: ${docId}` + err + __location);
                  throw err;
              }
              //

              return newAgencyLocationJSON;
          }
          else {
              throw new Error(`no newObjectJSON supplied appId: ${docId}`)
          }

      }
      else {
          throw new Error('no id supplied')
      }
      // return true;

  }

  async insertMongo(newObjectJSON) {
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
      const newSystemId = await this.newMaxSystemId()
      newObjectJSON.systemId = newSystemId;
      newObjectJSON.mysqlId = newSystemId;
      const agencyLandingPage = new AgencyLandingPageModel(newObjectJSON);
      //Insert a doc
      await agencyLandingPage.save().catch(function(err) {
          log.error('Mongo Application Save err ' + err + __location);
          throw err;
      });

      return mongoUtils.objCleanup(agencyLandingPage);
  }

  async newMaxSystemId(){
      let maxId = 0;
      try{

          //small collection - get the collection and loop through it.
          // TODO refactor to use mongo aggretation.
          const query = {active: true}
          const queryProjection = {"systemId": 1}
          var queryOptions = {lean:true};
          queryOptions.sort = {};
          queryOptions.sort.systemId = -1;
          queryOptions.limit = 1;
          const docList = await AgencyLandingPageModel.find(query, queryProjection, queryOptions)
          if(docList && docList.length > 0){
              for(let i = 0; i < docList.length; i++){
                  if(docList[i].systemId > maxId){
                      maxId = docList[i].systemId + 1;
                  }
              }
          }


      }
      catch(err){
          log.error("Get max system id " + err + __location)
          throw err;
      }
      log.debug("maxId: " + maxId + __location)
      return maxId;
  }


  loadFromId(id) {
      return new Promise(async(resolve, reject) => {
      //validate
          if (id && id > 0) {
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
          //log.debug("AgencyLandingPageBO getlist sql: " + sql);
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
          if (result && result.length > 0) {
              for (let i = 0; i < result.length; i++) {
                  const agencyLandingPageBO = new AgencyLandingPageBO();
                  await agencyLandingPageBO.#dbTableORM.decryptFields(result[i]);
                  await agencyLandingPageBO.#dbTableORM.convertJSONColumns(result[i]);
                  const resp = await agencyLandingPageBO.loadORM(result[i], skipCheckRequired).catch(function(err) {
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

  async getMongoDocbyMysqlId(mysqlId, returnMongooseModel = false) {
      return new Promise(async(resolve, reject) => {
          if (mysqlId) {
              const query = {
                  "mysqlId": mysqlId,
                  active: true
              };
              let agencyLandingPageDoc = null;
              let docDB = null;
              try {
                  docDB = await AgencyLandingPageModel.findOne(query, '-__v');
                  if (docDB) {
                      agencyLandingPageDoc = mongoUtils.objCleanup(docDB);
                  }
              }
              catch (err) {
                  log.error("Getting Agency Location error " + err + __location);
                  reject(err);
              }
              if(returnMongooseModel){
                  resolve(docDB);
              }
              else {
                  resolve(agencyLandingPageDoc);
              }

          }
          else {
              reject(new Error('no id supplied'))
          }
      });
  }


  getById(id) {
      return this.getMongoDocbyMysqlId(id)
  }


  deleteSoftById(id) {
      return new Promise(async(resolve, reject) => {
          //validate
          if(id && id > 0){
              //Mongo....
              let agencyLandingPage = null;
              try {
                  const returnDoc = true;
                  agencyLandingPage = await this.getMongoDocbyMysqlId(id, returnDoc);
                  agencyLandingPage.active = false;
                  await agencyLandingPage.save();
              }
              catch (err) {
                  log.error("Error get marking agencyLandingPage from mysqlId " + err + __location);
                  reject(err);
              }

              resolve(true);

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
                  if (properties[property].type === "number" && typeof inputJSON[property] === "string") {
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