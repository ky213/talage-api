'use strict';

const DatabaseObject = require('./DatabaseObject.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
var AgencyNetworkModel = require('mongoose').model('AgencyNetwork');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');


const fileSvc = global.requireShared('services/filesvc.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const {'v4': uuidv4} = require('uuid');

const featureList = ["notifyTalage",
    "applicationOptOut",
    'donotShowEmailAddress'];

const tableName = 'clw_talage_agency_networks'
const skipCheckRequired = false;
module.exports = class AgencyNetworkBO{

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
           

            //logo processing
            if(newObjectJSON.headerLogoContent){
                const newFileName = await this.saveLogofiles(newObjectJSON.headerLogoContent, newObjectJSON.newHeaderFileName).catch(function(err){
                    reject(err)
                })
                if(newFileName){
                    newObjectJSON.logo = newFileName;
                }
                else {
                    log.error("No files name for S3 logo " + __location)
                }

            }
            if(newObjectJSON.footerLogoContent){
                const newFileName = await this.saveLogofiles(newObjectJSON.footerLogoContent, newObjectJSON.newFooterFileName, false).catch(function(err){
                    reject(err)
                })
                if(newFileName){
                    newObjectJSON.footer_logo = newFileName;
                }
                else {
                    log.error("No files name for S3 logo " + __location)
                }
            }
            //save
            let newDoc = true;
            if(newObjectJSON.id){
                const dbDocJSON = await this.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                if(dbDocJSON){
                    newObjectJSON.systemId = dbDocJSON.systemId;
                    newObjectJSON.agencyNetworkId = dbDocJSON.systemId;
                    newDoc = false;
                    await this.updateMongo(dbDocJSON.agencyNetworkUuidId,newObjectJSON)
                }
                else {
                    log.error("AgencyNetwork PUT object not found " + newObjectJSON.id + __location)
                }
            }
            if(newDoc === true) {
                const newAgencyNetworkDoc = await this.insertMongo(newObjectJSON);
                this.id = newAgencyNetworkDoc.systemId;
            }
            resolve(true);

        });
    }

    async saveLogofiles(newLogoContent64, newFileName, isHeader = true){

        const logoData = newLogoContent64.substring(newLogoContent64.indexOf(',') + 1);

        const baseS3Path = 'public/agency-network-logos/';
        //clean name
        let fileName = stringFunctions.santizeFilename(this.name);
        fileName += isHeader ? "-header-" : "-footer-"
        fileName += uuidv4().toString();
        fileName += `-${stringFunctions.santizeFilename(newFileName)}`
        const s3Path = baseS3Path + fileName;
        await fileSvc.PutFile(s3Path, logoData).then(function(data){
            return fileName;

        }).catch(function(err){
            log.error("File Service HTTP Put: " + err + __location);
            throw err
        });
        return fileName;
    }


    loadFromIdMySql(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id && id > 0){
                await this.#dbTableORM.getById(id).catch(function(err) {
                    log.error(`Error getting  ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                //process featureList
                this.fillInFeatureList(this.feature_json)
                resolve(true);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }


    getList(queryJSON) {
        return new Promise(async(resolve, reject) => {
            if(!queryJSON){
                queryJSON = {};
            }
            const queryProjection = {"__v": 0}

            let findCount = false;

            let rejected = false;
            // eslint-disable-next-line prefer-const
            let query = {active: true};
            let error = null;


            var queryOptions = {};
            queryOptions.sort = {systemId: 1};
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

            if(queryJSON.systemId && Array.isArray(queryJSON.systemId)){
                query.systemId = {$in: queryJSON.systemId};
                delete queryJSON.systemId
            }
            else if(queryJSON.systemId){
                query.systemId = queryJSON.systemId;
                delete queryJSON.systemId
            }

            if(queryJSON.agencyNetworkId && Array.isArray(queryJSON.agencyNetworkId)){
                query.agencyNetworkId = {$in: queryJSON.agencyNetworkId};
                delete queryJSON.agencyNetworkId
            }
            else if(queryJSON.agencyNetworkId){
                query.agencyNetworkId = queryJSON.agencyNetworkId;
                delete queryJSON.agencyNetworkId
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
                    // log.debug("InsurerModel GetList query " + JSON.stringify(query) + __location)
                    docList = await AgencyNetworkModel.find(query,queryProjection, queryOptions);
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
                if(docList && docList.length > 0){
                    resolve(mongoUtils.objListCleanup(docList));
                }
                else {
                    resolve([]);
                }
                return;
            }
            else {
                const docCount = await AgencyNetworkModel.countDocuments(query).catch(err => {
                    log.error("InsurerModel.countDocuments error " + err + __location);
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
                    "systemId": mysqlId,
                    active: true
                };
                let docDB = null;
                try {
                    docDB = await AgencyNetworkModel.findOne(query, '-__v');
                }
                catch (err) {
                    log.error("Getting Agency error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    const agencyNetworkDoc = mongoUtils.objCleanup(docDB);
                    resolve(agencyNetworkDoc);
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

    getById(id) {
        return this.getMongoDocbyMysqlId(id);
    }

    async updateMongo(docId, newObjectJSON) {
        if (docId) {
            if (typeof newObjectJSON === "object") {

                const query = {"agencyNetworkUuidId": docId};
                let newAgencyNetworkJSON = null;
                try {
                    const changeNotUpdateList = ["active",
                        "id",
                        "mysqlId",
                        "systemId",
                        "agencyNetworkUuidId",
                        "agencyNetworkId"]
                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    await AgencyNetworkModel.updateOne(query, newObjectJSON);
                    const newAgencyNetworkDoc = await AgencyNetworkModel.findOne(query);
                    

                    newAgencyNetworkJSON = mongoUtils.objCleanup(newAgencyNetworkDoc);
                }
                catch (err) {
                    log.error(`Updating Application error appId: ${docId}` + err + __location);
                    throw err;
                }
                //

                return newAgencyNetworkJSON;
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
        newObjectJSON.agencyNetworkId = newSystemId;
        const agencyNetwork = new AgencyNetworkModel(newObjectJSON);
        //Insert a doc
        await agencyNetwork.save().catch(function(err) {
            log.error('Mongo agencyNetwork Save err ' + err + __location);
            throw err;
        });
        newObjectJSON.id = newSystemId;
        return mongoUtils.objCleanup(agencyNetwork);
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
            const docList = await AgencyNetworkModel.find(query, queryProjection, queryOptions)
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


    fillInFeatureList(featureJson){
        if(featureJson){
            for(let i = 0; i < featureList.length; i++){
                const featureName = featureList[i];
                if(!featureJson[featureName]){
                    featureJson[featureName] = false;
                }
            }

        }
    }

    cleanJSON(noNulls = true){
        return this.#dbTableORM.cleanJSON(noNulls);
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

    /**
	 * Load new object JSON into ORM. can be used to filter JSON to object properties
     *
	 * @param {object} inputJSON - input JSON
	 * @returns {void}
	 */
    async loadORM(inputJSON){
        await this.#dbTableORM.load(inputJSON, skipCheckRequired);
        this.updateProperty();
        return true;
    }


    // ############ Email content retrievial methods ###############################
    // AgencyNetwork does not need to be loaded AgencyNetwork Id is passed in.
    // methods are async returning the contentJSON {"emailBrand": brandName message:" messageTemplate, "subject:" subjectTemplate}..

    /**
	 * getEmailContentAgencyAndCustomer
     *
	 * @param {string} agencyNetworkId - string or integer for agencyNetwork Id
     * @param {string} agencyContentProperty - string for Agency's template property
     * @param {string} customerContentProperty - string for Customer's template property
     *
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with BrandName. message template and subject template, or an Error if rejected
	 */
    async getEmailContentAgencyAndCustomer(agencyNetworkId, agencyContentProperty, customerContentProperty) {
        let wheelHouseAgencyNetworkJSON = null;
        let agencyNetworkJSON = null;
        try{
            const wheelHouseId = 1;
            wheelHouseAgencyNetworkJSON = await this.getById(wheelHouseId);
            if(agencyNetworkId === wheelHouseId){
                agencyNetworkJSON = wheelHouseAgencyNetworkJSON;
            }
            else {
                agencyNetworkJSON = await this.getById(agencyNetworkId);
            }
        }
        catch(err){
            log.error(`DB Error Unable to get email content for ${agencyContentProperty} for agencyNetwork ${agencyNetworkId}. error: ${err}` + __location);
        }
        let error = null;
        if(wheelHouseAgencyNetworkJSON && agencyNetworkJSON){

            //const emailContentResult = emailContentResultArray[0];
            let emailTemplateJSON = {};
            try{
                const customerEmailData = agencyNetworkJSON.custom_emails[customerContentProperty];
                const defaultCustomerEmailData = wheelHouseAgencyNetworkJSON.custom_emails[customerContentProperty];

                const customermessage = customerEmailData && customerEmailData.message ? customerEmailData.message : defaultCustomerEmailData.message;
                const customersubject = customerEmailData && customerEmailData.subject ? customerEmailData.subject : defaultCustomerEmailData.subject;


                const agencyEmailData = agencyNetworkJSON.custom_emails[agencyContentProperty];
                const defaultAgencyEmailData = wheelHouseAgencyNetworkJSON.custom_emails[agencyContentProperty];
                const agencyMessage = agencyEmailData && agencyEmailData.message ? agencyEmailData.message : defaultAgencyEmailData.message;
                const agencySubject = agencyEmailData && agencyEmailData.subject ? agencyEmailData.subject : defaultAgencyEmailData.subject;

                emailTemplateJSON = {
                    "brandName": agencyNetworkJSON.name,
                    "emailBrand": agencyNetworkJSON.email_brand,
                    "customerMessage": customermessage,
                    "customerSubject": customersubject,
                    "agencyMessage": agencyMessage,
                    "agencySubject": agencySubject
                }
                log.debug("pre env emailTemplateJSON " + JSON.stringify(emailTemplateJSON))
                const environmentSettings = this.getEnvSettingFromJSON(agencyNetworkJSON.additionalInfo, agencyNetworkId)
                if(typeof environmentSettings === "object"){
                    // eslint-disable-next-line guard-for-in
                    for (var property in environmentSettings) {
                        emailTemplateJSON[property] = environmentSettings[property];
                    }
                }
                log.debug("post env emailTemplateJSON " + JSON.stringify(emailTemplateJSON))

            }
            catch(err) {
                log.error("getEmailContentAgencyAndCustomer error: " + err + __location);
                error = err;
            }
            if(error){
                throw error;
            }
            return emailTemplateJSON;
        }
        else {
            log.error(`${agencyContentProperty} missing emailcontent for agencynetwork: ${agencyNetworkId}` + __location);
            throw new Error("No email content");
        }

    }


    /**
	 * getEmailContent
     *
	 * @param {string} agencyNetworkId - string or integer for agencyNetwork Id
     * @param {string} contentProperty - string for template property
     *
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with BrandName. message template and subject template, or an Error if rejected
	 */
    async getEmailContent(agencyNetworkId, contentProperty) {

        let wheelHouseAgencyNetworkJSON = null;
        let agencyNetworkJSON = null;
        try{
            const wheelHouseId = 1;
            wheelHouseAgencyNetworkJSON = await this.getById(wheelHouseId);
            if(agencyNetworkId === wheelHouseId){
                agencyNetworkJSON = wheelHouseAgencyNetworkJSON;
            }
            else {
                agencyNetworkJSON = await this.getById(agencyNetworkId);
            }
        }
        catch(err){
            log.error(`DB Error Unable to get email content for ${contentProperty} for agencyNetwork ${agencyNetworkId}. error: ${err}` + __location);
        }

        let error = null;

        if(wheelHouseAgencyNetworkJSON && agencyNetworkJSON){
            // eslint-disable-next-line prefer-const
            let emailContentResult = {};
            let emailTemplateJSON = {};
            try{
                emailContentResult.defaultEmailData = wheelHouseAgencyNetworkJSON.custom_emails[contentProperty];
                if(agencyNetworkJSON.custom_emails[contentProperty]){
                    emailContentResult.emailData = agencyNetworkJSON.custom_emails[contentProperty];
                }
                const message = emailContentResult.emailData && emailContentResult.emailData.message && emailContentResult.emailData.message !== "" ? emailContentResult.emailData.message : emailContentResult.defaultEmailData.message;
                const subject = emailContentResult.emailData && emailContentResult.emailData.subject && emailContentResult.emailData.subject !== "" ? emailContentResult.emailData.subject : emailContentResult.defaultEmailData.subject;


                emailTemplateJSON = {
                    "brandName": agencyNetworkJSON.name,
                    "emailBrand": agencyNetworkJSON.email_brand,
                    "message": message,
                    "subject": subject
                }

                const environmentSettings = this.getEnvSettingFromJSON(agencyNetworkJSON.additionalInfo, agencyNetworkId)
                if(typeof environmentSettings === "object"){
                    // eslint-disable-next-line guard-for-in
                    for (var property in environmentSettings) {
                        emailTemplateJSON[property] = environmentSettings[property];
                    }
                }

            }
            catch(err) {
                log.error("getEmailContentAgencyAndCustomer error: " + err + __location);
                error = err;
            }
            if(error){
                throw error;
            }
            return emailTemplateJSON;
        }
        else {
            log.error(`${contentProperty} missing emailcontent for agencynetwork: ${agencyNetworkId}` + __location);
            throw new Error("No email content");
        }

    }

    async getEnvSettingbyId(agencyNetworkId){
        const error = null;
        const agencyNetworkJSON = await this.getById(agencyNetworkId).catch(err => error);
        if(error){
            log.error("Error getting AgencyNetwork for env settings " + error + __location);
            return null;
        }
        if(agencyNetworkJSON && agencyNetworkJSON.additionalInfo){
            const envSetting = this.getEnvSettingFromJSON(agencyNetworkJSON.additionalInfo,agencyNetworkId);
            envSetting.brandName = agencyNetworkJSON.name;
            envSetting.emailBrand = agencyNetworkJSON.email_brand;
            envSetting.brand = agencyNetworkJSON.additionalInfo.brand
            return envSetting;
        }
        else {
            log.error(`AgencyNetwork ${agencyNetworkId} does not have additionalInfo ` + __location);
            return null;
        }
    }

    getEnvSettingFromJSON(additionalInfoJSON, agencyNetworkId){
        if(!additionalInfoJSON){
            log.error(`AgencyNetwork ${agencyNetworkId} is missing additionalInfoJSON.environmentSettings for ${env} ` + __location)
            return {};
        }
        if(typeof additionalInfoJSON === 'string'){
            additionalInfoJSON = JSON.parse(additionalInfoJSON);
        }
        const env = global.settings.ENV
        if(additionalInfoJSON && additionalInfoJSON.environmentSettings && additionalInfoJSON.environmentSettings[env]){
            return additionalInfoJSON.environmentSettings[env];
        }
        else {
            log.error(`AgencyNetwork ${agencyNetworkId} is missing additionalInfoJSON.environmentSettings for ${env} ` + __location)
            return {};
        }
    }

    getIdToNameMap(){
        return new Promise(async(resolve, reject) => {
            const map = {};
            let rejected = false;
            // Create the update query
            const sql = `
                select *  from ${tableName}  
            `;

            // Run the query
            //log.debug("AgencyNetworkBO getlist sql: " + sql);
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
                    map[result[i].id] = result[i].name;
                }
                resolve(map);
            }
            else {
                //Search so no hits ok.
                resolve(map);
            }


        });

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
    "custom_emails": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "json",
        "dbType": "longtext"
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
    "email_brand": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(10)"
    },
    "footer_logo": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(250)"
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
    "help_text": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(300)"
    },
    "landing_page_content": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "json",
        "dbType": "longtext"
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
    "logo": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(250)"
    },
    "name": {
        "default": "",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(30)"
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
    "feature_json": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "json",
        "dbType": "json"
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