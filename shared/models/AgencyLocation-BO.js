'use strict';

const InsurerBO = require('./Insurer-BO.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const ZipCodeBO = global.requireShared('./models/ZipCode-BO.js');


var AgencyLocationMongooseModel = require('mongoose').model('AgencyLocation');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');


const tableName = 'agencyLocations'

module.exports = class AgencyLocationBO{


    constructor(){
        this.id = 0;
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
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

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


    async getMongoDocbyMysqlId(mysqlId, children = true, addAgencyPrimaryLocation = false, returnMongooseModel = false) {
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
                    if(docDB.useAgencyPrime && addAgencyPrimaryLocation){
                        const insurerList = await this.getAgencyPrimeInsurers(docDB.agencyId)
                        if(insurerList){
                            docDB.insurers = insurerList
                        }
                    }
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

    getList(queryJSON, getAgencyName = false, loadChildren = false, addAgencyPrimaryLocation = false, mainCollection = false) {
        return new Promise(async(resolve, reject) => {
            let queryProjection = {"__v": 0}

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

            if(mainCollection) {
                queryProjection = {
                    agencyLocationId: 1,
                    agencyId: 1,
                    address: 1,
                    systemId: 1,
                    city: 1,
                    state: 1,
                    zipcode: 1,
                    mysqlId: 1
                };
            }


            if (findCount === false) {
                let docList = null;
                try {
                    //log.debug("AgencyLocation GetList query " + JSON.stringify(query) + __location)
                    docList = await AgencyLocationMongooseModel.find(query,queryProjection, queryOptions);

                    if(mainCollection){
                        for(const doc of docList){
                            if(doc.agencyId){
                                const agencyJSON = await this.getAgencyJSON(doc.agencyId);
                                if(agencyJSON){
                                    doc.name = agencyJSON.name;
                                }
                            }
                        }
                    }
                    else if((getAgencyName || loadChildren || addAgencyPrimaryLocation) && docList.length > 0){
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
                            if(doc.useAgencyPrime && addAgencyPrimaryLocation){
                                const insurerList = await this.getAgencyPrimeInsurers(doc.agencyId, doc.agencyNetworkId)
                                if(insurerList){
                                    doc.insurers = insurerList
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

    async getAgencyPrimeInsurers(agencyId, agencyNetworkId){
        log.debug("in getAgencyPrimeInsurers")
        const AgencyBO = global.requireShared('./models/Agency-BO.js');
        const agencyBO = new AgencyBO();

        let agencyPrimeInsurers = [];
        try{
            if(!agencyNetworkId){
                const agencyJSON = await this.getAgencyJSON(agencyId);
                if(agencyJSON){
                    agencyNetworkId = agencyJSON.agencyNetworkId;
                }
                else {
                    log.error(`getAgencyPrimeInsurers: Could not find secondary agency ${agencyId}` + __location)
                }
            }
            if(agencyNetworkId > 0){
                //Get newtorks prime agency.
                const queryAgency = {
                    "agencyNetworkId": agencyNetworkId,
                    "primaryAgency": true
                }
                const agencyList = await agencyBO.getList(queryAgency);
                if(agencyList && agencyList.length > 0){
                    const agencyPrime = agencyList[0];
                    //get agency's prime location
                    // return prime location's insurers.
                    const returnChildren = true;
                    const agencyLocationPrime = await this.getByAgencyPrimary(agencyPrime.systemId, returnChildren);
                    if(agencyLocationPrime && agencyLocationPrime.insurers){
                        agencyPrimeInsurers = agencyLocationPrime.insurers
                    }
                    else {
                        log.error(`Agency Prime id ${agencyPrime.systemId} as no insurers ` + __location)
                    }
                }
                else {
                    log.error(`No Agency Prime for secondary agency ${agencyId}  agencyNetworkId ${agencyNetworkId}` + __location)
                }

            }
            else {
                log.error(`getAgencyPrimeInsurers: No agency Network ${agencyNetworkId} for secondary agency ${agencyId}` + __location)
            }
        }
        catch(err){
            log.error(`Error getting AgencyPrime's insurers secondary agency ${agencyId} agencyNetworkId ${agencyNetworkId} ` + err + __location);
        }

        return agencyPrimeInsurers;
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

        // Territories
        if(agencyLocationJSON.additionalInfo && agencyLocationJSON.additionalInfo.territories){
            // log.debug("Using agencyLocationJSON.additionalInfo.territories ")
            agencyLocationJSON.territories = agencyLocationJSON.additionalInfo.territories;
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


    getById(id, children = true, addAgencyPrimaryLocation = false) {
        return this.getMongoDocbyMysqlId(id, children, addAgencyPrimaryLocation)
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
                    agencyLocationDoc = await this.getMongoDocbyMysqlId(id, returnChildren, returnChildren, returnDoc);
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

    // updateProperty(){
    //     const dbJSON = this.#dbTableORM.cleanJSON()
    //     // eslint-disable-next-line guard-for-in
    //     for (const property in properties) {
    //         this[property] = dbJSON[property];
    //     }
    // }


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
            const insurerJSON = agencyLocationJSON.insurers.find(insurer => insurerId === insurer.insurerId);
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
    // async loadORM(inputJSON){
    //     await this.#dbTableORM.load(inputJSON, skipCheckRequired);
    //     this.updateProperty();
    //     return true;
    // }

    // cleanJSON(noNulls = true){
    //     return this.#dbTableORM.cleanJSON(noNulls);
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
        return this.getList(queryJSON, getAgencyName, false, false, true);
    }
}