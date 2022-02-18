/* eslint-disable no-shadow */
'use strict';

const moment = require('moment');
const AgencyNetworkBO = require('./AgencyNetwork-BO.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const fileSvc = global.requireShared('services/filesvc.js');
const {'v4': uuidv4} = require('uuid');
var FastJsonParse = require('fast-json-parse')

var AgencyEmail = global.mongoose.AgencyEmail;

var AgencyModel = global.mongoose.Agency;
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const s3AgencyLogoPath = "public/agency-logos/";
const s3AgencyFaviconPath = "public/agency-logos/favicon/";
const collectionName = 'Agencies'

const REDIS_AGENCYID_PREFIX = 'agency-';
const REDIS_AGENCY_SLUG_PREFIX = 'agencyslug-'
const REDIS_AGENCYNETWORK_DONOTREPORT_PREFIX = 'agencynetwork-donotreport-'

module.exports = class AgencyBO {

    constructor() {
        this.id = 0;
    }


    /**
     * Save ModelagencyInfo
     *
     * @param {object} newObjectJSON - newObjectJSON JSON
     * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
     */
    saveModel(newObjectJSON) {
        return new Promise(async(resolve, reject) => {
            if (!newObjectJSON) {
                reject(new Error(`empty ${collectionName} object given`));
            }
            //convert old snake case to new camel case
            const alPropMappings = {
                agency_network: "agencyNetworkId",
                ca_license_number: "caLicenseNumber",
                "fname": "firstName",
                "lname": "lastName",
                wholesale_agreement_signed: "wholesaleAgreementSigned",
                docusign_envelope_id: "docusignEnvelopeId",
                do_not_report: "doNotReport",
                enable_optout: "enabelOptOut",
                enableOptOut:"enabelOptOut"

            }
            this.mapToMongooseJSON(newObjectJSON, newObjectJSON, alPropMappings);

            let newDoc = true;
            if(newObjectJSON.id){
                const dbDocJSON = await this.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${collectionName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                if(dbDocJSON){
                    newObjectJSON.systemId = dbDocJSON.systemId;
                    if (newObjectJSON.logo && newObjectJSON.logo.startsWith('data:')) {
                        if (dbDocJSON.logo) {
                        //removed old logo from S3.
                            try {
                                log.debug("Removing logo " + s3AgencyLogoPath + dbDocJSON.logo);
                                await fileSvc.deleteFile(s3AgencyLogoPath + dbDocJSON.logo)
                            }
                            catch (e) {
                                log.error("Agency Logo delete error: " + e + __location);
                            }
                        }

                        try {
                            const fileName = await this.processLogo(newObjectJSON);
                            newObjectJSON.logo = fileName;
                            log.debug("new logo file " + newObjectJSON.logo);
                        }
                        catch (e) {
                            log.error(`Agency SaveModel: Error processing logo for agencyId: ${newObjectJSON.agencyId} | ${e} |${__location}`);
                            //newObjectJSON.logo = null;
                            delete newObjectJSON.logo;
                            reject(e);
                        }
                    }
                    if(newObjectJSON.favicon && newObjectJSON.favicon.startsWith('data:')){
                        if(dbDocJSON.favicon){
                            try {
                                log.debug("Removing favicon " + s3AgencyFaviconPath + dbDocJSON.favicon);
                                await fileSvc.deleteFile(s3AgencyFaviconPath + dbDocJSON.logo);
                            }
                            catch(e){
                                log.error("Agency favicon delete error: " + e + __location);
                            }
                        }
                        try {
                            const favIconFileName = await this.processFavicon(newObjectJSON);
                            newObjectJSON.favicon = favIconFileName;
                            log.debug("new favicon file name " + newObjectJSON.favicon);
                        }
                        catch(e) {
                            if (e.message && e.message.includes('Please upload your favicon in png or ico')){
                                log.warn("Agency SaveModel error processing favicon " + e + __location);
                            }
                            else {
                                log.error("Agency SaveModel error processing favicon " + e + __location);
                            }
                            delete newObjectJSON.favicon;
                            reject(e);
                        }
                    }
                    newDoc = false;
                    await this.updateMongo(dbDocJSON.agencyId,newObjectJSON)
                }
                else {
                    log.error("Agency PUT id not found " + newObjectJSON.id + __location)
                }
            }
            if(newDoc === true) {
                const newAgencyDoc = await this.insertMongo(newObjectJSON);
                this.id = newAgencyDoc.systemId;
                if(newObjectJSON.primary){
                    await this.resetPrimary(newAgencyDoc.agencyId, newAgencyDoc.systemId);
                }

            }

            resolve(true);

        });
    }

    mapToMongooseJSON(sourceJSON, targetJSON, propMappings){
        for(const sourceProp in sourceJSON){
            if(typeof sourceJSON[sourceProp] !== "object"){
                if(propMappings[sourceProp]){
                    const appProp = propMappings[sourceProp]
                    if(!targetJSON[appProp]){
                        targetJSON[appProp] = sourceJSON[sourceProp];
                    }
                }
            }
        }
    }

    processFavicon(newObjectJSON) {
        return new Promise(async(fulfill, reject) => {
            // Handle the favicon file
            if (newObjectJSON.favicon) {
                let rejected = false;
                // If the favicon is base64, we need to save it; otherwise, assume no changes were made
                if (newObjectJSON.favicon.startsWith('data:')) {

                    // If this is an existing record, attempt to remove the old favicon first

                    // Isolate the extension
                    const extension = newObjectJSON.favicon.substring(11, newObjectJSON.favicon.indexOf(';'));
                    if (![
                        'png', 'vnd.microsoft.icon'
                    ].includes(extension)) {
                        reject(new Error('Please upload your favicon in png or ico preferably ico format.'));
                        return;
                    }

                    // Isolate the file data from the type prefix
                    const faviconData = newObjectJSON.favicon.substring(newObjectJSON.favicon.indexOf(',') + 1);

                    // Check the file size (max 100KB)
                    if (faviconData.length * 0.75 > 100000) {
                        reject(new Error('Favicon too large. The maximum file size is 100KB.'));
                        return;
                    }

                    // Generate a random file name (defeats caching issues issues)
                    const fileName = `${newObjectJSON.id}-${uuidv4().substring(24)}.${extension}`;

                    // Store on S3
                    log.debug("Agency saving favicion " + fileName)
                    await fileSvc.PutFile(s3AgencyFaviconPath + fileName, faviconData).catch(function(err) {
                        log.error("Agency add favicon error " + err + __location);
                        reject(err)
                        rejected = true;
                    });
                    if (rejected) {
                        return;
                    }

                    // Save the file name locally
                    fulfill(fileName);
                }
            }


        });
    }

    processLogo(newObjectJSON) {
        return new Promise(async(fulfill, reject) => {
            // Handle the logo file
            if (newObjectJSON.logo) {
                let rejected = false;
                // If the logo is base64, we need to save it; otherwise, assume no changes were made
                if (newObjectJSON.logo.startsWith('data:')) {

                    // If this is an existing record, attempt to remove the old logo first

                    // Isolate the extension
                    const extension = newObjectJSON.logo.substring(11, newObjectJSON.logo.indexOf(';'));
                    if (!['gif',
                        'jpeg',
                        'png'].includes(extension)) {
                        reject(new Error('Please upload your logo in gif, jpeg, or preferably png format.'));
                        return;
                    }

                    // Isolate the file data from the type prefix
                    const logoData = newObjectJSON.logo.substring(newObjectJSON.logo.indexOf(',') + 1);

                    // Check the file size (max 200KB)
                    if (logoData.length * 0.75 > 200000) {
                        reject(new Error('Logo too large. The maximum file size is 200KB.'));
                        return;
                    }

                    // Generate a random file name (defeats caching issues issues)
                    const fileName = `${newObjectJSON.id}-${uuidv4().substring(24)}.${extension}`;

                    // Store on S3
                    log.debug("Agency saving logo " + fileName)
                    await fileSvc.PutFile(s3AgencyLogoPath + fileName, logoData).catch(function(err) {
                        log.error("Agency add logo error " + err + __location);
                        reject(err)
                        rejected = true;
                    });
                    if (rejected) {
                        return;
                    }

                    // Save the file name locally
                    fulfill(fileName);
                }
            }


        });
    }


    async getMongoDocbyMysqlId(mysqlId, returnMongooseModel = true, getAgencyNetwork = false, returnDeleted = false) {
        return new Promise(async(resolve, reject) => {
            if (mysqlId) {
                if(global.settings.USE_REDIS_AGENCY_CACHE === "YES" && returnMongooseModel === false){
                    let docDB = null;
                    try{
                        docDB = await this.getRedisById(mysqlId)
                        if(getAgencyNetwork === true){
                            const agencyNetworkBO = new AgencyNetworkBO();
                            try {
                                const agencyNetworkJSON = await agencyNetworkBO.getById(docDB.agencyNetworkId);
                                docDB.agencyNetworkName = agencyNetworkJSON.name;
                            }
                            catch (err) {
                                log.error("Error getting Agency Network  " + err + __location);
                            }
                        }
                    }
                    catch(err){
                        log.error("Getting Agency from Redis error " + err + __location);
                    }
                    if(docDB){
                        resolve(docDB);
                        return;
                    }
                }
                const query = {
                    "mysqlId": mysqlId,
                    active: true
                };
                if(returnDeleted){
                    delete query.active;
                }
                let docDB = null;
                try {
                    docDB = await AgencyModel.findOne(query, '-__v');
                    if(global.settings.USE_REDIS_AGENCY_CACHE === "YES" && returnMongooseModel === false){
                        await this.updateRedisCache(docDB);
                    }
                    if(docDB && getAgencyNetwork === true){
                        const agencyNetworkBO = new AgencyNetworkBO();
                        try {
                            const agencyNetworkJSON = await agencyNetworkBO.getById(docDB.agencyNetworkId);
                            docDB.agencyNetworkName = agencyNetworkJSON.name;
                        }
                        catch (err) {
                            log.error("Error getting Agency Network  " + err + __location);
                        }

                    }
                }
                catch (err) {
                    log.error("Getting Agency error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    const agencyDoc = mongoUtils.objCleanup(docDB);
                    resolve(agencyDoc);
                }
                else {
                    resolve(null);
                }

            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    async getAgencyByMysqlId(mysqlId) {

        return this.getMongoDocbyMysqlId(mysqlId,true,false,true);
        // return new Promise(async(resolve, reject) => {
        //     if (mysqlId) {
        //         const query = {mysqlId: mysqlId};
        //         let docDB = null;
        //         try {
        //             docDB = await AgencyModel.findOne(query, '-__v');
        //         }
        //         catch (err) {
        //             log.error("Getting Agency error " + err + __location);
        //             reject(err);
        //         }
        //         resolve(docDB);
        //     }
        //     else {
        //         reject(new Error('no id supplied'))
        //     }
        // });
    }


    async getbySlug(slug, returnMongooseModel = false, getAgencyNetwork = false) {
        return new Promise(async(resolve, reject) => {
            if (slug) {
                if(global.settings.USE_REDIS_AGENCY_CACHE === "YES" && returnMongooseModel === false){
                    let docDB = null;
                    try{
                        docDB = await this.getRedisBySlug(slug)
                        if(getAgencyNetwork === true){
                            const agencyNetworkBO = new AgencyNetworkBO();
                            try {
                                const agencyNetworkJSON = await agencyNetworkBO.getById(docDB.agencyNetworkId);
                                docDB.agencyNetworkName = agencyNetworkJSON.name;
                            }
                            catch (err) {
                                log.error("Error getting Agency Network  " + err + __location);
                            }
                        }
                    }
                    catch(err){
                        log.error("Getting Agency from Redis error " + err + __location);
                    }
                    if(docDB){
                        resolve(docDB);
                        return;
                    }
                }

                const query = {
                    "slug": slug,
                    active: true
                };
                let docDB = null;
                try {
                    docDB = await AgencyModel.findOne(query, '-__v');
                    if(global.settings.USE_REDIS_AGENCY_CACHE === "YES"){
                        await this.updateRedisCache(docDB);
                    }
                    if(getAgencyNetwork === true){
                        const agencyNetworkBO = new AgencyNetworkBO();
                        try {
                            const agencyNetworkJSON = await agencyNetworkBO.getById(docDB.agencyNetworkId);
                            docDB.agencyNetworkName = agencyNetworkJSON.name;
                        }
                        catch (err) {
                            log.error("Error getting Agency Network  " + err + __location);
                        }

                    }
                }
                catch (err) {
                    log.error("Getting Agency error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    const agencyDoc = mongoUtils.objCleanup(docDB);
                    resolve(agencyDoc);
                }
                else {
                    resolve(null);
                }

            }
            else {
                reject(new Error('no slug supplied'));
            }
        });
    }


    getList(requestQueryJSON, getAgencyNetwork = false, noActiveCheck = false) {
        return new Promise(async(resolve, reject) => {
            if(!requestQueryJSON){
                requestQueryJSON = {};
            }
            // eslint-disable-next-line prefer-const
            let queryJSON = JSON.parse(JSON.stringify(requestQueryJSON));
            let agencyNetworkList = null;
            if (getAgencyNetwork === true) {
                const agencyNetworkBO = new AgencyNetworkBO();
                try {
                    agencyNetworkList = await agencyNetworkBO.getList();
                }
                catch (err) {
                    log.error("Error getting Agency Network List " + err + __location);
                }
            }

            const queryProjection = {"__v": 0};

            let findCount = false;

            let rejected = false;
            // eslint-disable-next-line prefer-const
            let query = noActiveCheck ? {} : {active:true};
            let error = null;

            var queryOptions = {};
            queryOptions.sort = {"name": 1};
            if (queryJSON.sort) {
                var acs = 1;
                if (queryJSON.desc) {
                    acs = -1;
                    delete queryJSON.desc;
                }
                queryOptions.sort[queryJSON.sort] = acs;
                delete queryJSON.sort;
            }
            // else {
            //     queryOptions.sort.name = 1;

            // }
            const queryLimit = 5000;
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
            if(queryJSON.page){
                const page = queryJSON.page ? stringFunctions.santizeNumber(queryJSON.page, true) : 1;
                // offset by page number * max rows, so we go that many rows
                queryOptions.skip = (page - 1) * queryOptions.limit;
                delete queryJSON.page;
            }
            if (queryJSON.count) {
                if(queryJSON.count === 1 || queryJSON.count === true || queryJSON.count === "1" || queryJSON.count === "true"){
                    findCount = true;
                }
                delete queryJSON.count;
            }
            if(queryJSON.agency_network){
                query.agencyNetworkId = queryJSON.agency_network;
                delete queryJSON.systemId;
            }

            if(queryJSON.systemId && Array.isArray(queryJSON.systemId)){
                if(queryJSON.notInSystemId === true || queryJSON.notInSystemId === 'true'){
                    query.systemId = {$nin: queryJSON.systemId};
                    delete queryJSON.notInSystemId;
                }
                else{
                    query.systemId = {$in: queryJSON.systemId};
                }
                delete queryJSON.systemId;
            }
            else if(queryJSON.systemId){
                query.systemId = queryJSON.systemId;
                delete queryJSON.systemId;
            }

            if(queryJSON.agencyId && Array.isArray(queryJSON.agencyId)){
                query.agencyId = {$in: queryJSON.agencyId};
                delete queryJSON.agencyId;
            }
            else if(queryJSON.agencyId){
                query.agencyId = queryJSON.agencyId;
                delete queryJSON.agencyId;
            }
            //doNotReport false - So we can search on false
            if(queryJSON.doNotReport === false){
                query.doNotReport = false;
                delete queryJSON.doNotReport;
            }

            // Old Mysql reference
            if(queryJSON.agency && Array.isArray(queryJSON.agency)){
                query.systemId = {$in: queryJSON.agency};
                delete queryJSON.agency;
            }
            else if(queryJSON.agency){
                query.systemId = queryJSON.agency;
                delete queryJSON.agency;
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
                // eslint-disable-next-line prefer-const
                try {
                    //log.debug("AgencyModel GetList query " + JSON.stringify(query) + __location);
                    docList = await AgencyModel.find(query, queryProjection, queryOptions).lean();
                    if(getAgencyNetwork === true){
                        // eslint-disable-next-line prefer-const
                        for(let agencyDoc of docList){
                        // eslint-disable-next-line prefer-const
                            if (agencyDoc.agencyNetworkId && agencyNetworkList && agencyNetworkList.length > 0) {
                                try {
                                    const agencyNetwork = agencyNetworkList.find(agencyNetwork => agencyNetwork.id === agencyDoc.agencyNetworkId);
                                    agencyDoc.agencyNetworkName = agencyNetwork.name;
                                }
                                catch (err) {
                                    log.error("Error getting agency network name " + err + __location);
                                }
                            }
                            else {
                                log.error(`Error getting agency network name missing info ${JSON.stringify(agencyNetworkList)}` + __location);
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
                const docCount = await AgencyModel.countDocuments(query).catch(err => {
                    log.error("AgencyModel.countDocuments error " + err + __location);
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


    // ***************************
    //    Copied same as getList, except removed network list and hardcoded query projection
    //
    // *************************
    getNameAndIdList(requestQueryJSON, noActiveCheck = false) {
        return new Promise(async(resolve, reject) => {
            if(!requestQueryJSON){
                requestQueryJSON = {};
            }
            // eslint-disable-next-line prefer-const
            let queryJSON = JSON.parse(JSON.stringify(requestQueryJSON));

            const queryProjection =
                {
                    "name": 1,
                    "systemId": 1
                };

            let findCount = false;

            let rejected = false;
            // eslint-disable-next-line prefer-const
            let query = noActiveCheck ? {} : {active:true};
            let error = null;

            var queryOptions = {};
            queryOptions.sort = {"name": 1};
            if (queryJSON.sort) {
                var acs = 1;
                if (queryJSON.desc) {
                    acs = -1;
                    delete queryJSON.desc;
                }
                queryOptions.sort[queryJSON.sort] = acs;
                delete queryJSON.sort;
            }
            const queryLimit = 10000;
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
            if(queryJSON.page){
                const page = queryJSON.page ? stringFunctions.santizeNumber(queryJSON.page, true) : 1;
                // offset by page number * max rows, so we go that many rows
                queryOptions.skip = (page - 1) * queryOptions.limit;
                delete queryJSON.page;
            }
            if (queryJSON.count) {
                if(queryJSON.count === 1 || queryJSON.count === true || queryJSON.count === "1" || queryJSON.count === "true"){
                    findCount = true;
                }
                delete queryJSON.count;
            }

            if(queryJSON.agencyId && Array.isArray(queryJSON.agencyId)){
                query.agencyId = {$in: queryJSON.agencyId};
                delete queryJSON.agencyId;
            }
            else if(queryJSON.agencyId){
                query.agencyId = queryJSON.agencyId;
                delete queryJSON.agencyId;
            }
            //doNotReport false - So we can search on false
            if(queryJSON.doNotReport === false){
                query.doNotReport = false;
                delete queryJSON.doNotReport;
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
                // eslint-disable-next-line prefer-const
                try {
                    docList = await AgencyModel.find(query, queryProjection, queryOptions).lean();
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
                const docCount = await AgencyModel.countDocuments(query).catch(err => {
                    log.error("AgencyModel.countDocuments error " + err + __location);
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

    getById(id, getAgencyNetwork = false, returnDeleted = false) {
        const returnDoc = false;
        return this.getMongoDocbyMysqlId(id, returnDoc, getAgencyNetwork, returnDeleted)
    }

    async getByAgencyNetwork(agencyNetworkId) {

        //validate
        if (agencyNetworkId && agencyNetworkId > 0) {
            const query = {agencyNetworkId: agencyNetworkId}
            return this.getList(query);
        }
        else {
            throw new Error('no id supplied')
        }

    }

    async getByAgencyNetworkDoNotReport(agencyNetworkId, isGlobalView) {

        //validate
        if (agencyNetworkId && agencyNetworkId > 0) {

            if(global.settings.USE_REDIS_AGENCY_CACHE === "YES" && isGlobalView === false){
                let docList = null;
                const redisKey = REDIS_AGENCYNETWORK_DONOTREPORT_PREFIX + agencyNetworkId;
                const resp = await global.redisSvc.getKeyValue(redisKey);
                if(resp.found){
                    try{
                        const parsedJSON = new FastJsonParse(resp.value)
                        if(parsedJSON.err){
                            throw parsedJSON.err
                        }
                        docList = parsedJSON.value;
                    }
                    catch(err){
                        log.error(`Error Parsing question cache key ${redisKey} value: ${resp.value} ${err} ` + __location);
                    }
                    if(docList){
                        return docList;
                    }
                }
            }
            //hit database
            const query = {
                agencyNetworkId: agencyNetworkId,
                doNotReport: true
            }
            if(isGlobalView){
                delete query.agencyNetworkId;
            }
            const docList = await this.getList(query);
            if(global.settings.USE_REDIS_AGENCY_CACHE === "YES" && docList && isGlobalView === false){
                const redisKey = REDIS_AGENCYNETWORK_DONOTREPORT_PREFIX + agencyNetworkId;
                try{
                    const ttlSeconds = 900; //15 minutes
                    const redisResponse = await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(docList),ttlSeconds)
                    if(redisResponse && redisResponse.saved){
                        log.debug(`REDIS: saved ${redisKey} to Redis ` + __location);
                    }
                }
                catch(err){
                    log.error(`Error save ${redisKey} to Redis cache ` + err + __location);
                }
            }
            return docList;
        }
        else {
            throw new Error('no id supplied')
        }

    }

    async updateMongo(docId, newObjectJSON) {
        if (docId) {
            if (typeof newObjectJSON === "object") {

                const query = {"agencyId": docId};
                let newAgencyJSON = null;
                try {
                    const changeNotUpdateList = ["active",
                        "id",
                        "mysqlId",
                        "systemId",
                        "agencyId",
                        "agencyNetworkId"]
                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    if(newObjectJSON.hasOwnProperty('$inc') || newObjectJSON.hasOwnProperty('$set')){
                        if(!newObjectJSON.hasOwnProperty('$set')) {
                            newObjectJSON.$set = {};
                        }
                        newObjectJSON.$set.updatedAt = new Date();
                    }
                    else {
                        newObjectJSON.updatedAt = new Date();
                    }

                    await AgencyModel.updateOne(query, newObjectJSON);
                    const newAgencyDoc = await AgencyModel.findOne(query);
                    //const newAgencyDoc = await AgencyModel.findOneAndUpdate(query, newObjectJSON, {new: true});
                    if(global.settings.USE_REDIS_AGENCY_CACHE === "YES"){
                        await this.updateRedisCache(newAgencyDoc);
                    }
                    newAgencyJSON = mongoUtils.objCleanup(newAgencyDoc);
                }
                catch (err) {
                    log.error(`Updating Agency error appId: ${docId}` + err + __location);
                    throw err;
                }
                //

                return newAgencyJSON;
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
        const agency = new AgencyModel(newObjectJSON);
        //Insert a doc
        await agency.save().catch(function(err) {
            log.error('Mongo Agency Save err ' + err + __location);
            throw err;
        });
        newObjectJSON.id = newSystemId;
        if(global.settings.USE_REDIS_AGENCY_CACHE === "YES"){
            await this.updateRedisCache(agency);
        }
        return mongoUtils.objCleanup(agency);
    }

    async newMaxSystemId(){
        let maxId = 0;
        try{

            //small collection - get the collection and loop through it.
            // TODO refactor to use mongo aggretation.
            const query = {}
            const queryProjection = {"systemId": 1}
            var queryOptions = {};
            queryOptions.sort = {};
            queryOptions.sort.systemId = -1;
            queryOptions.limit = 1;
            const docList = await AgencyModel.find(query, queryProjection, queryOptions).lean()
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


    deleteSoftById(id, userId) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (id && id > 0) {
                let agencyDoc = null;
                try {
                    const returnDoc = true;
                    agencyDoc = await this.getMongoDocbyMysqlId(id, returnDoc);
                    if(agencyDoc && agencyDoc.systemId){
                        agencyDoc.active = false;
                        if(userId){
                            agencyDoc.deletedByUser = userId;
                        }
                        await agencyDoc.save();
                    }
                }
                catch (err) {
                    log.error(`Error marking deleted agencyDoc from mysqlId ${id}` + err + __location);
                    reject(err);
                }

                resolve(true);

            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    activateById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (id && id > 0) {
                let agencyDoc = null;
                try {
                    agencyDoc = await this.getAgencyByMysqlId(id);
                    if(agencyDoc && agencyDoc.systemId){
                        agencyDoc.active = true;
                        await agencyDoc.save();
                    }
                }
                catch (err) {
                    log.error(`Error marking active agencyDoc from mysqlId ${id}` + err + __location);
                    reject(err);
                }

                resolve(true);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    setWholesaleAgreementAsSigned(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (id && id > 0) {
                let agencyDoc = null;
                try {
                    const returnDoc = true;
                    agencyDoc = await this.getMongoDocbyMysqlId(id, returnDoc);
                    agencyDoc.wholesaleAgreementSigned = new moment();
                    await agencyDoc.save();
                }
                catch (err) {
                    log.error("Error get marking agencyDoc from mysqlId " + err + __location);
                    reject(err);
                }
                resolve(true);

            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    setDocusignEnvelopeId(agencyId, envelopeId) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (agencyId && agencyId > 0) {
                let agencyDoc = null;
                try {
                    const returnDoc = true;
                    agencyDoc = await this.getMongoDocbyMysqlId(agencyId, returnDoc);
                    agencyDoc.docusignEnvelopeId = envelopeId;
                    await agencyDoc.save();
                }
                catch (err) {
                    log.error("Error get marking agencyDoc from mysqlId " + err + __location);
                    reject(err);
                }

                resolve(true);

            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    checkIfSlugExists(slug) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (slug) {
                const rejected = null;
                const query = {slug: slug};
                const docList = await this.getList(query).catch(function(err) {
                    // Check if this was
                    log.error(`Database Object ${collectionName} Selete checkIfSlugExists error : ` + err + __location);
                    reject(err);
                });
                if (rejected) {
                    return false;
                }
                if(docList && docList.length > 0){
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            }
            else {
                reject(new Error('no slug supplied'))
            }
        });
    }


    // ############ Email content retrievial methods ###############################
    // AgencyNetwork does not need to be loaded AgencyNetwork Id is passed in.
    // methods are async returning the contentJSON {"emailBrand": brandName message:" messageTemplate, "subject:" subjectTemplate}..

    /**
 * getEmailContentAgencyAndCustomer
   *
 * @param {string} agencyId - string or integer for agencyNetwork Id
   * @param {string} agencyContentProperty - string for Agency's template property
   * @param {string} customerContentProperty - string for Customer's template property
   *
 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with BrandName. message template and subject template, or an Error if rejected
 */
    async getEmailContentAgencyAndCustomer(agencyId, agencyContentProperty, customerContentProperty) {
        //log.debug("agencyId " + agencyId + __location)
        if(!agencyId){
            log.error(`No agencyId ${agencyId} supplied for getEmailContentAgencyAndCustomer` + __location)
            throw new Error("No agencyId supplied");
        }
        // if (agencyId > 0) {
        let agencyJSON = null;
        try {
            agencyJSON = await this.getById(agencyId);
        }
        catch (err) {
            log.error("Error getting Agency Network " + err + __location)
            throw new Error('Error getting Agency Network');
        }
        if (agencyJSON) {
            //get AgencyNetwork 1st than replace with Agency overwrites
            const agencyNetworkBO = new AgencyNetworkBO();
            const emailTemplateJSON = await agencyNetworkBO.getEmailContentAgencyAndCustomer(agencyJSON.agencyNetworkId, agencyContentProperty, customerContentProperty).catch(function(err) {
                log.error(`Email content Error Unable to get email content for ${agencyContentProperty}.  error: ${err}` + __location);
                throw new Error(`Email content Error Unable to get email content for ${agencyContentProperty}.  error: ${err}`)
            });

            const query = {active: true};
            query.agencyMySqlId = agencyId

            let agencyEmailDB = null;
            try {
                agencyEmailDB = await AgencyEmail.findOne(query, '-__v');
            }
            catch (err) {
                log.error(`Getting AgencyEmail error agencyId ${agencyId}` + err + __location);
            }
            if (agencyEmailDB) {
                if (agencyEmailDB[agencyContentProperty] && agencyEmailDB[agencyContentProperty].subject && agencyEmailDB[agencyContentProperty].subject.length > 0) {

                    emailTemplateJSON.agencyMessage = agencyEmailDB[agencyContentProperty].message;
                    emailTemplateJSON.agencySubject = agencyEmailDB[agencyContentProperty].subject;
                }
                if (agencyEmailDB[customerContentProperty] && agencyEmailDB[customerContentProperty].subject && agencyEmailDB[customerContentProperty].subject.length > 0) {

                    emailTemplateJSON.customerMessage = agencyEmailDB[customerContentProperty].message;
                    emailTemplateJSON.customerSubject = agencyEmailDB[customerContentProperty].subject;
                }
            }
            return emailTemplateJSON;

        }
        else {
            log.error(`getEmailContentAgencyAndCustomer Agency ID ${agencyId} did not find agnecy record` + __location)
        }
    }

    /**
 * getEmailContent
   *
 * @param {string} agencyId - string or integer for agencyNetwork Id
   * @param {string} contentProperty - string for template property
   *
 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with BrandName. message template and subject template, or an Error if rejected
 */
    async getEmailContent(agencyId, contentProperty) {

        if (agencyId) {
            let agencyJSON = {};
            try {
                agencyJSON = await this.getById(agencyId);
            }
            catch (err) {
                log.error("Error getting Agency " + err + __location)
                throw new Error('Error getting Agnecy in getEmailContent ');
            }
            if (agencyJSON) {
                //get AgencyNetwork 1st than replace with Agency overwrites
                const agencyNetworkBO = new AgencyNetworkBO();
                const emailTemplateJSON = await agencyNetworkBO.getEmailContent(agencyJSON.agencyNetworkId, contentProperty).catch(function(err) {
                    log.error(`Email content Error Unable to get email content for ${contentProperty}.  error: ${err}` + __location);
                    throw new Error(`Email content Error Unable to get email content for ${contentProperty}.  error: ${err}`)
                });
                if (emailTemplateJSON) {
                    const query = {active: true};
                    query.agencyMySqlId = agencyId

                    let agencyEmailDB = null;
                    try {
                        agencyEmailDB = await AgencyEmail.findOne(query, '-__v');
                    }
                    catch (err) {
                        log.error(`Getting AgencyEmail error agencyId ${agencyId}` + err + __location);
                    }
                    if (agencyEmailDB) {
                        if (agencyEmailDB[contentProperty] && agencyEmailDB[contentProperty].length > 0) {
                            emailTemplateJSON.message = agencyEmailDB[contentProperty].message;
                            emailTemplateJSON.subject = agencyEmailDB[contentProperty].subject;
                        }
                    }
                    return emailTemplateJSON;

                }
                else {
                    log.error(`No emailcontent from agencyNetworkBO.getEmailContent ${agencyJSON.agencyNetworkId} ` + __location)
                }
            }
            else {
                log.error(`No agency doc for systemId ${agencyId} ` + __location)
                throw new Error("No agency doc bad getEmailContent");
            }

        }
        else {
            log.error(`No agencyId bad getEmailContent ${agencyId} ` + __location)
            throw new Error("No agencyId bad getEmailContent");
        }
    }

    async getRedisById(id){
        if(id){
            let agencyJson = null;
            const redisKey = REDIS_AGENCYID_PREFIX + id;
            const resp = await global.redisSvc.getKeyValue(redisKey);
            if(resp.found){
                try{
                    const parsedJSON = new FastJsonParse(resp.value)
                    if(parsedJSON.err){
                        throw parsedJSON.err
                    }
                    agencyJson = parsedJSON.value;
                }
                catch(err){
                    log.error(`Error Parsing question cache key ${redisKey} value: ${resp.value} ${err} ` + __location);
                }
                if(agencyJson){
                    return agencyJson;
                }
            }
            return null;
        }
        return null;
    }

    async getRedisBySlug(slug){
        if(slug){
            let agencyJson = null;
            const redisKey = REDIS_AGENCY_SLUG_PREFIX + slug;
            const resp = await global.redisSvc.getKeyValue(redisKey);
            if(resp.found){
                try{
                    const parsedJSON = new FastJsonParse(resp.value)
                    if(parsedJSON.err){
                        throw parsedJSON.err
                    }
                    agencyJson = parsedJSON.value;
                }
                catch(err){
                    log.error(`Error Parsing question cache key ${redisKey} value: ${resp.value} ${err} ` + __location);
                }
                if(agencyJson){
                    return agencyJson;
                }
            }
            return null;
        }
        return null;
    }

    async updateRedisCache(agencyJSON){
        if(agencyJSON && typeof agencyJSON === 'object'){
            const agencyInfo = JSON.stringify(agencyJSON);
            let redisKey = REDIS_AGENCYID_PREFIX + agencyJSON.systemId;
            try{
                const ttlSeconds = 86400;
                const redisResponse = await global.redisSvc.storeKeyValue(redisKey, agencyInfo,ttlSeconds)
                if(redisResponse && redisResponse.saved){
                    log.debug(`Saved ${redisKey} to Redis ` + __location);
                }
            }
            catch(err){
                log.error(`Error save ${redisKey} to Redis cache ` + err + __location);
            }
            redisKey = REDIS_AGENCY_SLUG_PREFIX + agencyJSON.slug;
            try{
                const ttlSeconds = 86400;
                const redisResponse = await global.redisSvc.storeKeyValue(redisKey, agencyInfo,ttlSeconds)
                if(redisResponse && redisResponse.saved){
                    log.debug(`Saved ${redisKey} to Redis ` + __location);
                }
            }
            catch(err){
                log.error(`Error save ${redisKey} to Redis cache ` + err + __location);
            }

            //just delete the agencynetwork do not report.
            //it will rebuild on the next agencynetwork get applist request.
            redisKey = REDIS_AGENCYNETWORK_DONOTREPORT_PREFIX + agencyJSON.agencyNetworkId;
            try{
                const redisResponse = await global.redisSvc.deleteKey(redisKey)
                if(redisResponse){
                    log.debug(`REDIS: Removed ${redisKey} in Redis ` + __location);
                }
            }
            catch(err){
                log.error(`REDIS: Error removing ${redisKey} to Redis cache ` + err + __location);
            }


            return true;
        }
        else {
            log.warn(`updateRedisCache bad agencyJSON ${typeof agencyJSON} ` + __location);
        }
        return false;
    }
}
