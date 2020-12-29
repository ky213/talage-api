'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const AgencyLocationInsurerBO = require('./AgencyLocationInsurer-BO.js');
const AgencyLocationTerritory = require('./AgencyLocationTerritory-BO.js');

const InsurerBO = require('./Insurer-BO.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const ZipCodeBO = global.requireShared('./models/ZipCode-BO.js');


var AgencyLocationMongooseModel = require('mongoose').model('AgencyLocation');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');


const tableName = 'clw_talage_agency_locations'
const skipCheckRequired = false;
module.exports = class AgencyLocationBO{

    #dbTableORM = null;

    doNotSnakeCase = ['additionalInfo'];

    constructor(){
        this.id = 0;
        this.#dbTableORM = new DbTableOrm(tableName);
        this.#dbTableORM.doNotSnakeCase = this.doNotSnakeCase;
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
            //check if city and state sent
            // if not but zip was get city/state from zip code BO
            //Agency Portal does not send city and state in. 2020-12-19
            if(newObjectJSON.zipcode && (!newObjectJSON.city || !newObjectJSON.state)){
                try{
                    const zipCodeBO = new ZipCodeBO();
                    const zipCodeJSON = await zipCodeBO.loadByZipCode(newObjectJSON.zipcode);
                    if(zipCodeJSON.city){
                        newObjectJSON.city = zipCodeJSON.city
                        newObjectJSON.state = zipCodeJSON.territory;
                    }
                }
                catch(err){
                    log.error("AgencyLocation Error looking up City and State from zipcode " + err + __location)
                }
            }
            let newDoc = true;
            if(newObjectJSON.id){
                const dbDocJSON = await this.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                if(dbDocJSON){
                    this.id = dbDocJSON.systemId;
                    newDoc = false;
                    if(newObjectJSON.primary){
                        await this.resetPrimary(dbDocJSON.agencyId, dbDocJSON.systemId);
                    }
                    await this.updateMongo(dbDocJSON.agencyLocationId,newObjectJSON)
                }
            }
            if(newDoc === true) {
                const newAgencyLocationDoc = await this.insertMongo(newObjectJSON);
                this.id = newAgencyLocationDoc.systemId;
                if(newObjectJSON.primary){
                    await this.resetPrimary(newAgencyLocationDoc.agencyId, newAgencyLocationDoc.systemId);
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

                    await AgencyLocationMongooseModel.updateOne(query, newObjectJSON);
                    const newAgencyLocationDoc = await AgencyLocationMongooseModel.findOne(query);

                    newAgencyLocationJSON = mongoUtils.objCleanup(newAgencyLocationDoc);
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
        const agencyLocation = new AgencyLocationMongooseModel(newObjectJSON);
        //Insert a doc
        await agencyLocation.save().catch(function(err) {
            log.error('Mongo Application Save err ' + err + __location);
            throw err;
        });
        this.id = newSystemId;
        return mongoUtils.objCleanup(agencyLocation);
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
            const docList = await AgencyLocationMongooseModel.find(query, queryProjection, queryOptions)
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


    //only top level
    jsonToSnakeCase(sourceJSON,propMappings) {
        for (const sourceProp in sourceJSON) {
            if (typeof sourceJSON[sourceProp] !== "object") {
                if (propMappings[sourceProp]) {
                    const appProp = propMappings[sourceProp]
                    sourceJSON[appProp] = sourceJSON[sourceProp];
                }
                else {
                    sourceJSON[sourceProp.toSnakeCase()] = sourceJSON[sourceProp];
                }
            }
        }

    }


    async resetPrimary(agencyId, primaryAgencyLocationId){
        if(!agencyId){
            return false;
        }

        try {
            const query = {
                "agencyId": agencyId,
                active: true
            };
            const docList = await AgencyLocationMongooseModel.find(query);
            // eslint-disable-next-line prefer-const
            for(let doc of docList){
                if(primaryAgencyLocationId !== doc.systemId){
                    doc.primary = false
                    await doc.save().catch(function(err) {
                        log.error('Reset Primaary AgencyLocation Save err ' + err + __location);
                        throw err;
                    });
                }
            }
        }
        catch(e){
            log.error(`Error resetting Agency Location primary agencyId ${agencyId} ` + e + __location)
            return false;
        }
        return true;
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

                if(this.additionalInfo && this.additionalInfo.territories){
                    this.territories = this.additionalInfo.territories;
                }

                await this.loadChildren(id, this)


                resolve(true);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }


    async getMongoDocbyMysqlId(mysqlId, children = true, returnMongooseModel = false) {
        return new Promise(async(resolve, reject) => {
            if (mysqlId) {
                const query = {
                    "mysqlId": mysqlId,
                    active: true
                };
                let agencyLocationDoc = null;
                let docDB = null;
                try {
                    docDB = await AgencyLocationMongooseModel.findOne(query, '-__v');
                    if(children === true){
                        await this.loadChildrenMongo(mysqlId, docDB)
                    }
                    if (docDB) {
                        agencyLocationDoc = mongoUtils.objCleanup(docDB);
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
                    resolve(agencyLocationDoc);
                }

            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    getList(queryJSON, getAgencyName = false, loadChildren = false) {
        return new Promise(async(resolve, reject) => {


            const queryProjection = {"__v": 0}

            let findCount = false;

            let rejected = false;
            // eslint-disable-next-line prefer-const
            let query = {};
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
                    //log.debug("AgencyLocation GetList query " + JSON.stringify(query) + __location)
                    docList = await AgencyLocationMongooseModel.find(query,queryProjection, queryOptions);
                    if((getAgencyName || loadChildren) && docList.length > 0){
                        //Get Agency Name -- potential change to one request to mongo and match lists.
                        // eslint-disable-next-line prefer-const
                        for(let doc of docList){
                            if(getAgencyName && doc.agencyId){
                                const agencyJSON = await this.getAgencyJSON(doc.agencyId);
                                if(agencyJSON){
                                    doc.name = agencyJSON.name;
                                    doc.agencyNetworkId = agencyJSON.agencyNetworkId;
                                    doc.agencyEmail = agencyJSON.email;
                                    doc.doNotReport = agencyJSON.doNotReport;
                                }
                            }
                            if(loadChildren === true){
                                await this.loadChildrenMongo(doc.systemId, doc)
                            }
                        }
                    }
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
                const docCount = await AgencyLocationMongooseModel.countDocuments(query).catch(err => {
                    log.error("AgencyLocationMongooseModel.countDocuments error " + err + __location);
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

    async getAgencyJSON(agencyId){
        const AgencyBO = global.requireShared('./models/Agency-BO.js');
        const agencyBO = new AgencyBO();
        const agencyJSON = await agencyBO.getById(agencyId).catch(function(err) {
            log.error("getAgencyName get agency list error: " + err + __location);
        })
        if(agencyJSON){
            return agencyJSON;
        }
        else {
            return null
        }
    }

    async loadChildrenMongo(agencyLocationId, agencyLocationJSON){
        if(!agencyLocationJSON){
            return;
        }
        if(agencyLocationJSON.insurers){
            //Map to current Insurers
            await this.addInsureInfoTolocationInsurersMongo(agencyLocationJSON.insurers);
        }
        if(!agencyLocationJSON.territories){
            agencyLocationJSON.territories = [];
        }
        if(!agencyLocationJSON.insurers){
            agencyLocationJSON.insurers = [];
        }


    }

    async addInsureInfoTolocationInsurersMongo(locationInsurerInfoArray){
        if(locationInsurerInfoArray){
            // let error = null;
            const insurerBO = new InsurerBO();
            const query = {};
            const insurerList = await insurerBO.getList(query).catch(function(err) {
                log.error("admin agencynetwork error: " + err + __location);
                //    error = err;
            })
            if(insurerList){
                for(let i = 0; i < locationInsurerInfoArray.length; i++){
                    if(typeof locationInsurerInfoArray[i].insurerId === "string"){
                        locationInsurerInfoArray[i].insurerId = parseInt(locationInsurerInfoArray[i].insurerId,10);
                    }
                    const insurer = insurerList.find(insurertest => insurertest.id === locationInsurerInfoArray[i].insurerId);
                    if(insurer){
                        locationInsurerInfoArray[i].logo = insurer.logo;
                        locationInsurerInfoArray[i].name = insurer.name;
                        locationInsurerInfoArray[i].agency_id_label = insurer.agency_id_label;
                        locationInsurerInfoArray[i].agent_id_label = insurer.agent_id_label;
                        locationInsurerInfoArray[i].enable_agent_id = insurer.enable_agent_id;
                    }
                    else {
                        log.error(`addInsureInfoTolocationInsurers Error insurerId = ${JSON.stringify(locationInsurerInfoArray[i])} `)
                    }

                }
            }
            else {
                log.error("No Insures AgencLocation.Insurers " + __location);
            }
        }
    }


    async loadChildren(agencyLocationId, agencyLocationJSON){
        if(agencyLocationJSON.insurers){
            //Map to current Insurers
            await this.addInsureInfoTolocationInsurers(agencyLocationJSON.insurers);
        }
        else {

            const agencyLocationInsurer = new AgencyLocationInsurerBO()
            const insurerList = await agencyLocationInsurer.getListByAgencyLocationForAgencyPortal(agencyLocationId).catch(function(error) {
                // Check if this was
                log.error(`agencyLocationInsurer.getListByAgencyLocationForAgencyPortal error on select ` + error + __location);
            });
            agencyLocationJSON.insurers = insurerList;
            await this.addInsureInfoTolocationInsurers(agencyLocationJSON.insurers);

        }
        // Territories
        if(agencyLocationJSON.additionalInfo && agencyLocationJSON.additionalInfo.territories){
            // log.debug("Using agencyLocationJSON.additionalInfo.territories ")
            agencyLocationJSON.territories = agencyLocationJSON.additionalInfo.territories;
        }
        else {
            log.debug("Using agencyLocationTerritory  ")
            const agencyLocationTerritory = new AgencyLocationTerritory()
            const territoryList = await agencyLocationTerritory.getListByAgencyLocationForAgencyPortal(agencyLocationId).catch(function(error) {
                // Check if this was
                log.error(`agencyLocationTerritory.getListByAgencyLocationForAgencyPortal error on select ` + error + __location);
            });
            agencyLocationJSON.territories = territoryList;
        }
        if(!agencyLocationJSON.territories){
            agencyLocationJSON.territories = [];
        }
        if(!agencyLocationJSON.insurers){
            agencyLocationJSON.insurers = [];
        }


    }


    async addInsureInfoTolocationInsurers(locationInsurerInfoArray){
        if(locationInsurerInfoArray){
            // let error = null;
            const insurerBO = new InsurerBO();
            const query = {};
            const insurerList = await insurerBO.getList(query).catch(function(err) {
                log.error("admin agencynetwork error: " + err + __location);
                //    error = err;
            })
            if(insurerList){
                for(let i = 0; i < locationInsurerInfoArray.length; i++){
                    if(typeof locationInsurerInfoArray[i].insurerId === "string"){
                        locationInsurerInfoArray[i].insurer = parseInt(locationInsurerInfoArray[i].insurer,10);
                    }
                    const insurer = insurerList.find(insurertest => insurertest.id === locationInsurerInfoArray[i].insurer);
                    if(insurer){
                        locationInsurerInfoArray[i].logo = insurer.logo;
                        locationInsurerInfoArray[i].name = insurer.name;
                        locationInsurerInfoArray[i].agency_id_label = insurer.agency_id_label;
                        locationInsurerInfoArray[i].agent_id_label = insurer.agent_id_label;
                        locationInsurerInfoArray[i].enable_agent_id = insurer.enable_agent_id;
                    }
                    else {
                        log.error(`addInsureInfoTolocationInsurers Error insurerId = ${JSON.stringify(locationInsurerInfoArray[i])} `)
                    }

                }
            }
            else {
                log.error("No Insures AgencLocation.Insurers " + __location);
            }
        }
    }


    getById(id, children = true) {
        return this.getMongoDocbyMysqlId(id, children)
    }

    deleteSoftById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id && id > 0){
                //Mongo....
                let agencyLocationDoc = null;
                try {
                    const returnChildren = false;
                    const returnDoc = true;
                    agencyLocationDoc = await this.getMongoDocbyMysqlId(id, returnChildren, returnDoc);
                    agencyLocationDoc.active = false;
                    await agencyLocationDoc.save();
                }
                catch (err) {
                    log.error("Error get marking agencyLocationDoc from mysqlId " + err + __location);
                    reject(err);
                }

                resolve(true);

            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    updateProperty(){
        const dbJSON = this.#dbTableORM.cleanJSON()
        // eslint-disable-next-line guard-for-in
        for (const property in properties) {
            this[property] = dbJSON[property];
        }
    }


    getByAgencyPrimary(agencyId, children = false, returnMongooseModel = false){
        return new Promise(async(resolve, reject) => {
            if(agencyId){
                const query = {
                    "agencyId": agencyId,
                    primary: true,
                    active: true
                };
                let agencyLocationDoc = null;
                let docDB = null;
                try {
                    docDB = await AgencyLocationMongooseModel.findOne(query, '-__v');
                    if(children === true){
                        await this.loadChildrenMongo(docDB.systemId, docDB)
                    }
                    if (docDB) {
                        agencyLocationDoc = mongoUtils.objCleanup(docDB);
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
                    resolve(agencyLocationDoc);
                }

            }
            else {
                reject(new Error('no agencyId supplied'))
            }
        });

    }

    async getPolicyInfo(agencyLocationId, insurerId){
        let policyInfoJSON = null;
        try{
            const agencyLocationJSON = await this.getById(agencyLocationId);
            const insurerJSON = agencyLocationJSON.insurers.find(insurer => insurerId === insurer.insurerId);
            policyInfoJSON = insurerJSON.policyTypeInfo;
        }
        catch(err){
            log.error(`Error get PolicyTypeInfo agencyLocationId ${agencyLocationId} ` + err + __location)
            throw err;
        }
        return policyInfoJSON;
    }

    async shouldNotifyTalage(agencyLocationId,insurerId){
        //  const insurerIdTest = insureId.toString;


        let notifyTalage = false;
        try{
            const agencyLocationJSON = await this.getById(agencyLocationId);
            const insurerJSON = agencyLocationJSON.insurers.find(insurer => insurerId === insurer.insurer);
            if(insurerJSON){
                const policyInfoJSON = insurerJSON.policyTypeInfo;
                if(policyInfoJSON.notifyTalage){
                    notifyTalage = true;
                }
            }
        }
        catch(err){
            log.error(`Error shouldNotifyTalage agencyLocationId ${agencyLocationId} ` + err + __location)
        }

        return notifyTalage;


    }


    /**
	 * Load new business JSON into ORM. can be used to filter JSON to busines properties
     *
	 * @param {object} inputJSON - business JSON
	 * @returns {void}
	 */
    async loadORM(inputJSON){
        await this.#dbTableORM.load(inputJSON, skipCheckRequired);
        this.updateProperty();
        return true;
    }

    cleanJSON(noNulls = true){
        return this.#dbTableORM.cleanJSON(noNulls);
    }

    // getCurrentLocationsLimited(){

    //     return new Promise(async(resolve, reject) => {
    //         const sql = `
    //              SELECT
    //                 al.id alid,
    //                 al.agency,
    //                 al.email AS agencyLocationEmail,
    //                 ag.email AS agencyEmail,
    //                 ag.agency_network as agency_network
    //             FROM clw_talage_agency_locations AS al
    //                 INNER JOIN clw_talage_agencies AS ag ON al.agency = ag.id
    //             WHERE
    //                 al.state = 1
    //         `;

    //         const rows = await db.query(sql).catch(function(err) {
    //             log.error(`Error getting  ${tableName} from Database ` + err + __location);
    //             reject(err);
    //             return;
    //         });
    //         resolve(rows);
    //     });
    // }


    // ***************************
    //    For administration site
    //
    // *************************
    async getSearchListForAdmin(queryJSON){
        if(queryJSON.agencyname){
            //get list of agencies that match
            const AgencyBO = global.requireShared('./models/Agency-BO.js');
            const agencyBO = new AgencyBO();
            const agencyQuery = {"name": queryJSON.agencyname}
            const agencyList = await agencyBO.getList(agencyQuery).catch(function(err) {
                log.error("getSearchListForAdmin get agency list error: " + err + __location);
            })
            if(agencyList && agencyList.length){
                // eslint-disable-next-line prefer-const
                let agencyIdList = [];
                for(const agency of agencyList){
                    if (agency.systemId){
                        agencyIdList.push(agency.systemId)
                    }
                }
                if(agencyIdList.length > 0){
                    queryJSON.agencyId = agencyIdList;
                }
            }

        }

        const getAgencyName = true;
        return this.getList(queryJSON, getAgencyName);

        // return new Promise(async(resolve, reject) => {
        //     let sql = `
        //         select al.id as agencyLocationid, al.address, al.zipcode, al.city, al.state_abbr, a.name
        //              from clw_talage_agencies a
        //             inner join clw_talage_agency_locations al on a.id = al.agency
        //             where al.state > 0 AND a.state > 0
        //     `;
        //     // let hasWhere = false;
        //     if(queryJSON.agencyname){
        //         sql += ` AND  a.name like ${db.escape(queryJSON.agencyname)} `;
        //         //   hasWhere = true;

        //     }
        //     sql += " Order by a.name limit 100"

        //     //log.debug('AgencyLocation Search list sql: ' + sql);
        //     const rows = await db.query(sql).catch(function(err) {
        //         log.error(`Error getting  ${tableName} from Database ` + err + __location);
        //         reject(err);
        //         return;
        //     });
        //     //decrypt
        //     if(rows.length > 0){
        //         for(let i = 0; i < rows.length; i++){
        //             const row = rows[i];
        //             for (var key in row) {
        //                 if (row.hasOwnProperty(key) && row[key] === null) {
        //                     row[key] = "";
        //                 }
        //             }
        //             if(rows[i].address){
        //                 rows[i].address = await crypt.decrypt(rows[i].address);
        //                 rows[i].displayString = `${rows[i].name}: ${rows[i].address}, ${rows[i].city}, ${rows[i].state_abbr} ${rows[i].zipcode}`;
        //             }
        //             else if(rows[i].zip){
        //                 rows[i].displayString = `${rows[i].name}: ${rows[i].city}, ${rows[i].state_abbr} ${rows[i].zipcode}`
        //             }
        //             else {
        //                 rows[i].displayString = `${rows[i].name}: no address`
        //             }


        //         }
        //     }
        //     resolve(rows);
        // });
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
    "city": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(60)"
    },
    "state_abbr": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(2)"
    },
    "zipcode": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(10)"
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
    "insurers": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "json",
        "dbType": "json"
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

    // eslint-disable-next-line no-shadow
    constructor(tableName){
        super(tableName, properties);
    }

}