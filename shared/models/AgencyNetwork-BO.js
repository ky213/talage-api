'use strict';

const DatabaseObject = require('./DatabaseObject.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
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
            else{
                this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
            }
            this.#dbTableORM.state = 1;

            //logo processing
            if(newObjectJSON.headerLogoContent){
                const newFileName = await this.saveLogofiles(newObjectJSON.headerLogoContent, newObjectJSON.newHeaderFileName).catch(function(err){
                    reject(err)
                })
                if(newFileName){
                    this.#dbTableORM.logo = newFileName;
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
                    this.#dbTableORM.footer_logo = newFileName;
                }
                else {
                    log.error("No files name for S3 logo " + __location)
                }
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

    /**
	 * saves this object.
     *
	 * @returns {Promise.<JSON, Error>} save return true , or an Error if rejected
	 */
    save(asNew = false){
        return new Promise(async(resolve, reject) => {
            //validate
            this.#dbTableORM.load(this, skipCheckRequired);
            await this.#dbTableORM.save().catch(function(err){
                reject(err);
            });
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
                //process featureList
                this.fillInFeatureList(this.feature_json)
                resolve(true);
            }
            else {
                reject(new Error('no id supplied'))
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
                //process featureList
                this.fillInFeatureList(this.#dbTableORM.feature_json)
                resolve(this.#dbTableORM.cleanJSON());
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
            if(queryJSON){
                let hasWhere = false;
                if(queryJSON.name){
                    sql += hasWhere ? " AND " : " WHERE ";
                    sql += ` name like ${db.escape(queryJSON.name)} `
                    hasWhere = true;
                }
            }
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
                    const agencyNetworkBO = new AgencyNetworkBO();
                    await agencyNetworkBO.#dbTableORM.decryptFields(result[i]);
                    await agencyNetworkBO.#dbTableORM.convertJSONColumns(result[i]);
                    const resp = await agencyNetworkBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                        log.error(`getList error loading object: ` + err + __location);
                    })
                    if(!resp){
                        log.debug("Bad BO load" + __location)
                    }
                    //process featureList
                    this.fillInFeatureList(agencyNetworkBO.feature_json)
                    boList.push(agencyNetworkBO);
                }
                resolve(boList);
            }
            else {
                //Search so no hits ok.
                resolve([]);
            }


        });
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

        const emailContentSQL = `
        SELECT
            name as brandName,
            email_brand AS emailBrand,
            additionalInfo,
            JSON_EXTRACT(custom_emails, '$.${agencyContentProperty}') AS agencyEmailData,
            JSON_EXTRACT(custom_emails, '$.${customerContentProperty}') AS customerEmailData,
            (SELECT JSON_EXTRACT(custom_emails, '$.${agencyContentProperty}')  FROM  clw_talage_agency_networks WHERE id = 1 ) AS defaultAgencyEmailData,
            (SELECT JSON_EXTRACT(custom_emails, '$.${customerContentProperty}')  FROM  clw_talage_agency_networks WHERE id = 1 ) AS defaultCustomerEmailData
        FROM clw_talage_agency_networks
        WHERE id = ${db.escape(agencyNetworkId)}
        `;
        // log.debug("emailContent SQL: " + emailContentSQL);
        let error = null;
        const emailContentResultArray = await db.query(emailContentSQL).catch(function(err){
            log.error(`DB Error Unable to get email content for abandon quote. appid: ${applicationId}.  error: ${err}` + __location);
            error = true;
        });
        if(error){
            log.error("getEmailContentAgencyAndCustomer error: " + err + __location);
            throw error;
        }

        if(emailContentResultArray && emailContentResultArray.length > 0){

            const emailContentResult = emailContentResultArray[0];
            let emailTemplateJSON = {};
            try{
                const customerEmailData = emailContentResult.customerEmailData ? JSON.parse(emailContentResult.customerEmailData) : null;
                const defaultCustomerEmailData = emailContentResult.defaultCustomerEmailData ? JSON.parse(emailContentResult.defaultCustomerEmailData) : null;

                const customermessage = customerEmailData && customerEmailData.message ? customerEmailData.message : defaultCustomerEmailData.message;
                const customersubject = customerEmailData && customerEmailData.subject ? customerEmailData.subject : defaultCustomerEmailData.subject;


                const agencyEmailData = emailContentResult.agencyEmailData ? JSON.parse(emailContentResult.agencyEmailData) : null;
                const defaultAgencyEmailData = emailContentResult.defaultAgencyEmailData ? JSON.parse(emailContentResult.defaultAgencyEmailData) : null;
                const agencyMessage = agencyEmailData && agencyEmailData.message ? agencyEmailData.message : defaultAgencyEmailData.message;
                const agencySubject = agencyEmailData && agencyEmailData.subject ? agencyEmailData.subject : defaultAgencyEmailData.subject;

                emailTemplateJSON = {
                    "brandName": emailContentResult.brandName,
                    "emailBrand": emailContentResult.emailBrand,
                    "customerMessage": customermessage,
                    "customerSubject": customersubject,
                    "agencyMessage": agencyMessage,
                    "agencySubject": agencySubject
                }

                const environmentSettings = this.getEnvSettingFromJSON(emailContentResult.additionalInfo, agencyNetworkId)
                if(typeof environmentSettings === "object"){
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

        const emailContentSQL = `
        SELECT
            name as brandName,
            email_brand AS emailBrand,
            additionalInfo,
            JSON_EXTRACT(custom_emails, '$.${contentProperty}') AS emailData,
            (SELECT JSON_EXTRACT(custom_emails, '$.${contentProperty}')  FROM  clw_talage_agency_networks WHERE id = 1 ) AS defaultEmailData
        FROM clw_talage_agency_networks
        WHERE id = ${db.escape(agencyNetworkId)}
        `;
        // log.debug("emailContent SQL: " + emailContentSQL);
        let error = null;
        const emailContentResultArray = await db.query(emailContentSQL).catch(function(err){
            log.error(`DB Error Unable to get email content for abandon quote. appid: ${applicationId}.  error: ${err}` + __location);
            error = true;
        });
        if(error){
            log.error("getEmailContentAgencyAndCustomer error: " + err + __location);
            throw error;
        }

        if(emailContentResultArray && emailContentResultArray.length > 0){

            const emailContentResult = emailContentResultArray[0];
            let emailTemplateJSON = {};
            try{
                emailContentResult.defaultEmailData = JSON.parse(emailContentResult.defaultEmailData);
                if(emailContentResult.emailData){
                    emailContentResult.emailData = JSON.parse(emailContentResult.emailData);
                }
                const message = emailContentResult.emailData && emailContentResult.emailData.message && emailContentResult.emailData.message !== "" ? emailContentResult.emailData.message : emailContentResult.defaultEmailData.message;
                const subject = emailContentResult.emailData && emailContentResult.emailData.subject && emailContentResult.emailData.subject !== "" ? emailContentResult.emailData.subject : emailContentResult.defaultEmailData.subject;


                emailTemplateJSON = {

                    "emailBrand": emailContentResult.emailBrand,
                    "message": message,
                    "subject": subject
                }

                const environmentSettings = this.getEnvSettingFromJSON(emailContentResult.additionalInfo, agencyNetworkId)
                if(typeof environmentSettings === "object"){
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