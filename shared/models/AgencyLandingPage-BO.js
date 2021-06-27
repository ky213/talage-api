'use strict';

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// const moment = require('moment');
// const moment_timezone = require('moment-timezone');
// const {debug} = require('request');
var AgencyLandingPageModel = require('mongoose').model('AgencyLandingPage');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

const collectionName = 'AgencyLandingPags'
module.exports = class AgencyLandingPageBO {

  #dbTableORM = null;

  doNotSnakeCase = ['additionalInfo'];

  constructor() {
      this.id = 0;

  }

  saveModel(newObjectJSON) {
      return new Promise(async(resolve, reject) => {
          if(!newObjectJSON){
              reject(new Error(`empty ${collectionName} object given`));
          }
          let newDoc = true;

          if(newObjectJSON.id){
              const dbDocJSON = await this.getById(newObjectJSON.id).catch(function(err) {
                  log.error(`Error getting ${collectionName} from Database ` + err + __location);
                  reject(err);
                  return;
              });
              if(dbDocJSON){
                  newDoc = false;
                  this.id = dbDocJSON.systemId;
                  await this.updateMongo(dbDocJSON.agencyLandingPageId, newObjectJSON)
              }
          }
          if(newDoc === true) {
              const newAgencyLandingPageDoc = await this.insertMongo(newObjectJSON);
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
                  // Add updatedAt
                  newObjectJSON.updatedAt = new Date();

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
      this.id = newSystemId;
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
                  log.error(`Error getting  ${collectionName} from Database ` + err + __location);
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
              if(queryJSON.count === 1 || queryJSON.count === true || queryJSON.count === "1" || queryJSON.count === "true"){
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

  async getbySlug(agencyId, slug, getPrimary = false, returnMongooseModel = false) {
      return new Promise(async(resolve, reject) => {

          const query = {
              agencyId: agencyId,
              active: true
          };

          if(getPrimary){
              query.primary = true;
          }
          else {
              query.slug = slug;
          }
          //pageSlug
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


      });
  }

  async addPageHit(systemId){
      if (systemId) {
          const query = {"systemId": systemId};
          try {
              // eslint-disable-next-line prefer-const
              let docDB = await AgencyLandingPageModel.findOne(query, '-__v');
              if (docDB) {
                  docDB.hits += 1;
              }
              await docDB.save();
          }
          catch (err) {
              log.error(`Updating Landing Page error Id: ${systemId} ` + err + __location);
              throw err;
          }
      }
      else {
          throw new Error('no id supplied')
      }

  }


}