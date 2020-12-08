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
                  this.updateMongo(dbDocJSON.agencyLandingPageId, newObjectJSON)
              }
          }
          if(newDoc === true) {
              const newAgencyLandingPageDoc = this.insertMongo(newObjectJSON);
              this.id = newAgencyLandingPageDoc.systemId;
          }

          resolve(true);

      });
  }

  async updateMongo(docId, newObjectJSON) {
      if (docId) {
          if (typeof newObjectJSON === "object") {

              const query = {"agencyLandingPageId": docId};
              let newAgencyLocationJSON = null;
              try {
                  const changeNotUpdateList = ["active",
                      "id",
                      "mysqlId",
                      "agencyLandingPageId",
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
          const query = {}
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

          const queryProjection = {"__v": 0}

          let findCount = false;

          let rejected = false;
          // eslint-disable-next-line prefer-const
          let query = {active: true};
          let error = null;

          var queryOptions = {lean:true};
          queryOptions.sort = {};
          if (queryJSON.sort) {
              var acs = 1;
              if (queryJSON.desc) {
                  acs = -1;
                  delete queryJSON.desc
              }
              queryOptions.sort[queryJSON.sort] = acs;
              delete queryJSON.sort
          }
          else {
              // default to DESC on sent
              queryOptions.sort.createdAt = -1;

          }
          const queryLimit = 500;
          if (queryJSON.limit) {
              var limitNum = parseInt(queryJSON.limit, 10);
              delete queryJSON.limit
              if (limitNum < queryLimit) {
                  queryOptions.limit = limitNum;
              }
              else {
                  queryOptions.limit = queryLimit;
              }
          }
          else {
              queryOptions.limit = queryLimit;
          }
          if (queryJSON.count) {
              if (queryJSON.count === "1") {
                  findCount = true;
              }
              delete queryJSON.count;
          }
          //hard match on name for duplicate checking.
          if(queryJSON.nameExact){
              query.name = queryJSON.nameExact;
              delete queryJSON.nameExact;
          }

          if(queryJSON.slugExact){
              query.slug = queryJSON.slugExact;
              delete queryJSON.slugExact;
          }

          if(queryJSON.agencyId && Array.isArray(queryJSON.agencyId)){
              query.agencyId = {$in: queryJSON.agencyId};
              delete queryJSON.agencyId
          }
          else if(queryJSON.agencyId){
              query.agencyId = queryJSON.agencyId;
              delete queryJSON.agencyId
          }

          if(queryJSON.agency && Array.isArray(queryJSON.agency)){
              query.agencyId = {$in: queryJSON.agency};
              delete queryJSON.agency
          }
          else if(queryJSON.agency){
              query.agencyId = queryJSON.agency;
              delete queryJSON.agency
          }


          if (queryJSON) {
              for (var key in queryJSON) {
                  if (typeof queryJSON[key] === 'string' && queryJSON[key].includes('%')) {
                      let clearString = queryJSON[key].replace("%", "");
                      clearString = clearString.replace("%", "");
                      query[key] = {
                          "$regex": clearString,
                          "$options": "i"
                      };
                  }
                  else {
                      query[key] = queryJSON[key];
                  }
              }
          }


          if (findCount === false) {
              let docList = null;
              try {
                  log.debug("AgencyLandingPageModel GetList query " + JSON.stringify(query) + __location)
                  docList = await AgencyLandingPageModel.find(query,queryProjection, queryOptions);
              }
              catch (err) {
                  log.error(err + __location);
                  error = null;
                  rejected = true;
              }
              if(rejected){
                  reject(error);
                  return;
              }


              resolve(mongoUtils.objListCleanup(docList));
              return;
          }
          else {
              const docCount = await AgencyLandingPageModel.countDocuments(query).catch(err => {
                  log.error("AgencyLandingPageModel.countDocuments error " + err + __location);
                  error = null;
                  rejected = true;
              })
              if(rejected){
                  reject(error);
                  return;
              }
              resolve({count: docCount});
              return;
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