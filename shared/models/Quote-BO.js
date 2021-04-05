/* eslint-disable guard-for-in */

const moment = require('moment');

const DatabaseObject = require('./DatabaseObject.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const validator = global.requireShared('./helpers/validator.js');

// Mongo Models
var Quote = require('mongoose').model('Quote');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');


const tableName = 'clw_talage_quotes'
const skipCheckRequired = false;
module.exports = class QuoteBO {

    #dbTableORM = null;

    constructor() {
        this.id = 0;
        this.#dbTableORM = new DbTableOrm(tableName);
    }


    /**
   * Save Model
     *
   * @param {object} newObjectJSON - newObjectJSON JSON
   * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
   */
    saveModel(newObjectJSON) {
        return new Promise(async(resolve, reject) => {

            if (!newObjectJSON) {
                reject(new Error(`empty ${tableName} object given`));
            }
            let newDoc = true;
            let quoteDocDB = null;
            await this.cleanupInput(newObjectJSON);
            if (newObjectJSON.id) {
                newDoc = false;
                const query = {"mysqlId": newObjectJSON.id}
                quoteDocDB = await Quote.findOne(query).catch(function(err) {
                    log.error("Mongo quote load error " + err + __location);
                });


            }
            //save mongo.
            try{
                if(newDoc){
                    await this.insertMongo(newObjectJSON);
                }
                else {
                    await this.updateMongo(quoteDocDB.quoteId, newObjectJSON);
                }
            }
            catch(err){
                log.error("Error Saving Mongo Quote " + err + __location);
            }

            resolve(true);

        });
    }

    saveIntegrationQuote(quoteJSON, columns, values) {
        return new Promise(async(resolve) => {
            let quoteID = 0;
            const quoteResult = await db.query(`INSERT INTO \`#__quotes\` (\`${columns.join('`,`')}\`) VALUES (${values.map(db.escape).join(',')});`).catch(function(err) {
                log.error("Error QuoteBO insertByColumnValue " + err + __location);
                // reject(err);
                // do not stop mongo save.
            });
            if(quoteResult){
                quoteID = quoteResult.insertId;
                log.debug(`${tableName} saved id ` + quoteID);
                quoteJSON.mysqlId = quoteID;
            }
            //check limits
            if(quoteJSON.limits && quoteJSON.limits.length > 0){
                for (let i = 0; i < quoteJSON.limits.length; i++){
                    const limitJSON = quoteJSON.limits[i];
                    if(!limitJSON.amount && typeof limitJSON.amount !== 'number' || limitJSON.amount === "NaN"){
                        log.error(`QuoteBO Bad limits ${JSON.stringify(quoteJSON)} ` + __location)
                        limitJSON.amount = 0;
                    }
                }
            }
            //mongo save.
            //log.debug("quoteJSON " + JSON.stringify(quoteJSON))
            try{
                const quote = new Quote(quoteJSON);
                await quote.save().catch(function(err){
                    log.error('Mongo Quote Save err ' + err + __location);
                });
            }
            catch(err){
                log.error("Error saving Mongo quote " + err + __location);
            }

            resolve(quoteID);
        });
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

    async getById(quoteId) {
        if(validator.isUuid(quoteId)){
            return this.getfromMongoByQuoteId(quoteId)
        }
        else {
            return this.getMongoDocbyMysqlId(quoteId)
        }
    }

    getList(queryJSON, getOptions = null) {
        return new Promise(async(resolve, reject) => {
            //
            // eslint-disable-next-line prefer-const
            let getListOptions = {getInsurerName: false}

            if(getOptions){
                for(const prop in getOptions){
                    getListOptions[prop] = getOptions[prop];
                }
            }
            if(!queryJSON){
                queryJSON = {};
            }

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

            if (queryJSON.searchbegindate && queryJSON.searchenddate) {
                const fromDate = moment(queryJSON.searchbegindate);
                const toDate = moment(queryJSON.searchenddate);
                if (fromDate.isValid() && toDate.isValid()) {
                    query.createdAt = {
                        $lte: toDate,
                        $gte: fromDate
                    };
                    delete queryJSON.searchbegindate;
                    delete queryJSON.searchenddate;
                }
                else {
                    reject(new Error("Date format"));
                    return;
                }
            }
            else if (queryJSON.searchbegindate) {
                // eslint-disable-next-line no-redeclare
                const fromDate = moment(queryJSON.searchbegindate);
                if (fromDate.isValid()) {
                    query.createdAt = {$gte: fromDate};
                    delete queryJSON.searchbegindate;
                }
                else {
                    reject(new Error("Date format"));
                    return;
                }
            }
            else if (queryJSON.searchenddate) {
                // eslint-disable-next-line no-redeclare
                const toDate = moment(queryJSON.searchenddate);
                if (toDate.isValid()) {
                    query.createdAt = {$lte: toDate};
                    delete queryJSON.searchenddate;
                }
                else {
                    reject(new Error("Date format"));
                    return;
                }
            }

            if(queryJSON.quoteId && Array.isArray(queryJSON.quoteId)){
                queryJSON.quoteId = {$in: queryJSON.quoteId};
            }


            if(queryJSON.quoteId && Array.isArray(queryJSON.quoteId)){
                queryJSON.quoteId = {$in: queryJSON.quoteId};
            }

            if(queryJSON.mysqlId && Array.isArray(queryJSON.mysqlId)){
                queryJSON.mysqlId = {$in: queryJSON.mysqlId};
            }


            if(queryJSON.insurerId && Array.isArray(queryJSON.insurerId)){
                queryJSON.insurerId = {$in: queryJSON.insurerId};
            }
            //Status check for multiple Values
            if(queryJSON.status && Array.isArray(queryJSON.status)){
                queryJSON.status = {$in: queryJSON.status};
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
                    log.debug("QuoteList query " + JSON.stringify(query))
                    docList = await Quote.find(query, queryProjection, queryOptions);
                    if(getListOptions.getInsurerName === true && docList.length > 0){
                        //TODO loop doclist adding InsurerName

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
                const docCount = await Quote.countDocuments(query).catch(err => {
                    log.error("Quote.countDocuments error " + err + __location);
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

    getNewAppQuotes(queryJSON) {
        return new Promise(async(resolve, reject) => {
            //
            // eslint-disable-next-line prefer-const

            if(!queryJSON){
                reject(new Error("getNewAppQuotes: no query Data"));
            }
            if(!queryJSON.mysqlAppId && !queryJSON.applicationId || !queryJSON.lastMysqlId){
                reject(new Error("getNewAppQuotes: missing query Data"));
            }

            const queryProjection = {"__v": 0}
            let rejected = false;
            // eslint-disable-next-line prefer-const
            let query = {active: true};
            let error = null;

            var queryOptions = {lean:true};
            queryOptions.sort = {mysqlId: 1};

            queryOptions.limit = 500;


            if(queryJSON.lastMysqlId){
                query.mysqlId = {$gt: queryJSON.lastMysqlId};
            }

            if(queryJSON.mysqlAppId){
                query.mysqlAppId = queryJSON.mysqlAppId;
                delete queryJSON.mysqlAppId
            }
            else if(queryJSON.applicationId){
                query.applicationId = queryJSON.applicationId;
                delete queryJSON.applicationId
            }

            let docList = null;
            try {
                log.debug("QuoteList query " + JSON.stringify(query))
                docList = await Quote.find(query, queryProjection, queryOptions);
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
        });

    }

    getByApplicationId(applicationId, policy_type = null) {
        // eslint-disable-next-line prefer-const
        let query = {"applicationId": applicationId}
        if(policy_type){
            query.policyType = policy_type;
        }
        return this.getList(query);

    }
    

    async getfromMongoByQuoteId(quoteId) {
        return new Promise(async(resolve, reject) => {
            if (quoteId) {
                const query = {
                    "quoteId": quoteId,
                    active: true
                };
                let quoteDoc = null;
                try {
                    const docDB = await Quote.findOne(query, '-__v');
                    if (docDB) {
                        quoteDoc = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error("Getting Application error " + err + __location);
                    reject(err);
                }
                resolve(quoteDoc);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    async getMongoDocbyMysqlId(mysqlId) {
        return new Promise(async(resolve, reject) => {
            if (mysqlId) {
                const query = {
                    "mysqlId": mysqlId,
                    active: true
                };
                let quoteDoc = null;
                try {
                    const docDB = await Quote.findOne(query, '-__v');
                    if (docDB) {
                        quoteDoc = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error("Getting Application error " + err + __location);
                    reject(err);
                }
                resolve(quoteDoc);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    async updateMongo(quoteId, newObjectJSON) {
        if (quoteId) {
            if (typeof newObjectJSON === "object") {
                const changeNotUpdateList = ["active",
                    "id",
                    "mysqlId",
                    "mysqlAppId",
                    "quoteId",
                    "applicationId",
                    "uuid"]
                for (let i = 0; i < changeNotUpdateList.length; i++) {
                    if (newObjectJSON[changeNotUpdateList[i]]) {
                        delete newObjectJSON[changeNotUpdateList[i]];
                    }
                }
                // Add updatedAt
                newObjectJSON.updatedAt = new Date();

                const query = {"quoteId": quoteId};
                let newQuoteJSON = null;
                try {
                    //because Virtual Sets.  new need to get the model and save.
                    // const quote = new Quote(newObjectJSON);
                    await Quote.updateOne(query, newObjectJSON);
                    const newQuotedoc = await Quote.findOne(query);
                    newQuoteJSON = mongoUtils.objCleanup(newQuotedoc);
                }
                catch (err) {
                    log.error("Updating Application error " + err + __location);
                    throw err;
                }
                //


                return newQuoteJSON;
            }
            else {
                throw new Error('no newObjectJSON supplied')
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

        //covers quote app WF where mysql saves first.
        if (!newObjectJSON.applicationId && newObjectJSON.uuid) {
            newObjectJSON.applicationId = newObjectJSON.uuid;
        }

        const quote = new Quote(newObjectJSON);
        //log.debug("insert application: " + JSON.stringify(application))
        //Insert a doc
        await quote.save().catch(function(err) {
            log.error('Mongo Application Save err ' + err + __location);
            throw err;
        });


        return mongoUtils.objCleanup(quote);
    }

    async updateQuoteAggregatedStatus(quoteId, aggregatedStatus) {
        if(quoteId && aggregatedStatus){
            const sql = `
                UPDATE clw_talage_quotes
                SET aggregated_status = ${db.escape(aggregatedStatus)}
                WHERE id = ${quoteId}
            `;
            try {
                await db.query(sql);
                log.info(`Updated Mysql clw_talage_quotes.aggregated_status on  ${quoteId}` + __location);
            }
            catch (err) {
                log.error(`Could not mysql update quote ${quoteId} aggregated status: ${err} ${__location}`);

            }
            // update Mongo
            try{
                const query = {"mysqlId": quoteId};
                const updateJSON = {"aggregatedStatus": aggregatedStatus};
                await Quote.updateOne(query, updateJSON);
                log.info(`Update Mongo QuoteDoc aggregated status on mysqlId: ${quoteId}` + __location);
            }
            catch(err){
                log.error(`Could not update mongo quote ${quoteId} aggregated status: ${err} ${__location}`);
                throw err;
            }
        }
        return true;
    }

    async bindQuote(quoteId, applicationId, bindUser) {
        if(quoteId && applicationId && bindUser){
            // update Mongo
            const query = {
                "quoteId": quoteId,
                "applicationId": applicationId
            };
            let quoteDoc = null;
            try{
                quoteDoc = await Quote.findOne(query, '-__v');
                if(!quoteDoc.bound){
                    const bindDate = moment();
                    const updateJSON = {
                        "bound": true,
                        "boundUser": bindUser,
                        "boundDate": bindDate,
                        "aggregatedStatus": "bound",
                        "status": "bound"
                    };
                    await Quote.updateOne(query, updateJSON);
                    log.info(`Update Mongo QuoteDoc bound status on quoteId: ${quoteId}` + __location);
                }
            }
            catch(err){
                log.error(`Could not update mongo quote ${quoteId} bound status: ${err} ${__location}`);
                throw err;
            }


        }

        return true;
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
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    },
    "policy_type": {
        "default": "WC",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(3)"
    },
    "application": {
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
    "number": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(15)"
    },
    "package_type": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "request_id": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(36)"
    },
    "amount": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "float(9,2) unsigned"
    },
    "seconds": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(4) unsigned"
    },
    "aggregated_status": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(50)"
    },
    "status": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(19)"
    },
    "api_result": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(19)"
    },
    "bound": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    },
    "log": {
        "default": "",
        "encrypted": true,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "blob"
    },
    "payment_plan": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "reasons": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(500)"
    },
    "quote_letter": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(40)"
    },
    "writer": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(50)"
    },
    "quote_link": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(500)"
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
    }
}


class DbTableOrm extends DatabaseObject {

    // eslint-disable-next-line no-shadow
    constructor(tableName) {
        super(tableName, properties);
    }

}