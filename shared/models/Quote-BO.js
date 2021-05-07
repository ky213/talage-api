/* eslint-disable object-curly-newline */
/* eslint-disable no-trailing-spaces */
/* eslint-disable guard-for-in */

global.requireShared('./helpers/tracker.js');

const moment = require('moment');

const validator = global.requireShared('./helpers/validator.js');

// Mongo Models
var Quote = require('mongoose').model('Quote');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
const {quoteStatus, convertToAggregatedStatus} = global.requireShared('./models/status/quoteStatus.js');

const collectionName = 'Quotes'


const QUOTE_MIN_TIMEOUT = 5;

module.exports = class QuoteBO {

    #dbTableORM = null;

    constructor() {
        this.id = null;
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
                reject(new Error(`empty ${collectionName} object given`));
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

    saveIntegrationQuote(quoteId, quoteJSON) {
        return new Promise(async(resolve) => {
            if (quoteId === null) {
                // if null, insert new record

                //check limits
                if (quoteJSON.limits && quoteJSON.limits.length > 0) {
                    for (let i = 0; i < quoteJSON.limits.length; i++) {
                        const limitJSON = quoteJSON.limits[i];
                        if (!limitJSON.amount && typeof limitJSON.amount !== 'number' || limitJSON.amount === "NaN") {
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
                    quoteId = quote.quoteId;
                }
                catch(err){
                    log.error("Error saving Mongo quote " + err + __location);
                }
            } 
            else {
                // otherwise record exists, update it
                const query = {"quoteId": quoteId};
                try {
                    await Quote.updateOne(query, quoteJSON);
                }
                catch (e) {
                    log.error(`Error updating quote: ${e}.`);
                    throw e;
                }
            }

            resolve(quoteId);
        });
    }

    async getById(quoteId, returnModel = false) {
        if(validator.isUuid(quoteId)){
            return this.getfromMongoByQuoteId(quoteId, returnModel)
        }
        else {
            return this.getMongoDocbyMysqlId(quoteId, returnModel)
        }
    }

    getList(requestQueryJSON, getOptions = null) {
        return new Promise(async(resolve, reject) => {
            if(!requestQueryJSON){
                requestQueryJSON = {};
            }
            // eslint-disable-next-line prefer-const
            let queryJSON = JSON.parse(JSON.stringify(requestQueryJSON));

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
                if(queryJSON.count === 1 || queryJSON.count === true || queryJSON.count === "1" || queryJSON.count === "true"){
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

                docList = mongoUtils.objListCleanup(docList);
                for (const quoteDoc of docList) {
                    if(quoteDoc && quoteDoc.quoteStatusId === quoteStatus.initiated.id){
                        await this.checkAndFixQuoteStatus(quoteDoc);
                    }
                }
                return resolve(docList);
            }
            else {
                const docCount = await Quote.countDocuments(query).catch(err => {
                    log.error("Quote.countDocuments error " + err + __location);
                    error = null;
                    rejected = true;
                });
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
            if(!queryJSON.applicationId){
                reject(new Error("getNewAppQuotes: missing query Data"));
            }

            const queryProjection = {"__v": 0}
            let rejected = false;
            // eslint-disable-next-line prefer-const
            let query = {active: true};
            let error = null;

            var queryOptions = {lean:true};
            

            queryOptions.limit = 500;


            if(queryJSON.applicationId){
                query.applicationId = queryJSON.applicationId;
            
            }
            if(queryJSON.createdAt){
                query.createdAt = {$gte: queryJSON.createdAt};
            
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

            docList = mongoUtils.objListCleanup(docList);
            for (const quoteDoc of docList) {
                if(quoteDoc && quoteDoc.quoteStatusId === quoteStatus.initiated.id){
                    await this.checkAndFixQuoteStatus(quoteDoc);
                }
            }
            return resolve(docList);
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


    async getfromMongoByQuoteId(quoteId, returnModel = false) {
        return new Promise(async(resolve, reject) => {
            if (quoteId) {
                const query = {
                    "quoteId": quoteId,
                    active: true
                };
                let quoteDoc = null;
                try {
                    const docDB = await Quote.findOne(query, '-__v');
                    if (docDB && returnModel === false) {
                        quoteDoc = mongoUtils.objCleanup(docDB);
                    }
                    else {
                        quoteDoc = docDB
                    }
                    if(quoteDoc && quoteDoc.quoteStatusId === quoteStatus.initiated.id){
                        await this.checkAndFixQuoteStatus(quoteDoc);
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

    async getMongoDocbyMysqlId(mysqlId, returnModel = false) {
        return new Promise(async(resolve, reject) => {
            if (mysqlId) {
                const query = {
                    "mysqlId": mysqlId,
                    active: true
                };
                let quoteDoc = null;
                try {
                    const docDB = await Quote.findOne(query, '-__v');
                    if (docDB && returnModel === false) {
                        quoteDoc = mongoUtils.objCleanup(docDB);
                    }
                    else {
                        quoteDoc = docDB
                    }
                    if(quoteDoc && quoteDoc.quoteStatusId === quoteStatus.initiated.id){
                        await this.checkAndFixQuoteStatus(quoteDoc);
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
                    if(newQuotedoc && newQuotedoc.quoteStatusId === quoteStatus.initiated.id){
                        await this.checkAndFixQuoteStatus(newQuotedoc);
                    }
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

    // NOTE: Keeping the name the same, even though aggregatedStatus will be deprecated. This function now updates both statuses
    async updateQuoteAggregatedStatus({quoteId, mysqlId}, status) {
        if(quoteId && mysqlId && status){
            // update Mongo
            try{
                const query = {quoteId: quoteId};
                const updateJSON = {
                    "aggregatedStatus": convertToAggregatedStatus(status),
                    "quoteStatusId": status.id, 
                    "quoteStatusDescription": status.description
                };
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
    //bindQuote

    async markQuoteAsBound(quoteId, applicationId, bindUser, policyInfo) {
        if(quoteId && applicationId && bindUser){
            const status = quoteStatus.bound;

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
                    // eslint-disable-next-line prefer-const
                    let updateJSON = {
                        "bound": true,
                        "boundUser": bindUser,
                        "boundDate": bindDate,
                        "aggregatedStatus": convertToAggregatedStatus(status),
                        "status": "bound",
                        "quoteStatusId": status.id,
                        "quoteStatusDescription": status.description
                    };
                    if(policyInfo){
                        updateJSON.policyInfo = policyInfo;
                    }
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


    // checks the status of the quote and fixes it if its timed out
    async checkAndFixQuoteStatus(quoteDoc){
        // only check and fix quotes that are potentially hanging on initiated
        if(quoteDoc && quoteDoc.quoteStatusId === quoteStatus.initiated.id){
            try{
                const now = moment.utc();
                // if the quotingStartedDate doesnt exist, set it and return (this shouldn't happen)
                if(!quoteDoc.quotingStartedDate){
                    quoteDoc.quotingStartedDate = now;
                    const query = {quoteId: quoteDoc.quoteId};
                    await Quote.updateOne(query, {quotingStartedDate: now});
                    return;
                }

                const status = global.requireShared('./models/status/quoteStatus.js');
                const duration = moment.duration(now.diff(moment(quoteDoc.quotingStartedDate)));
                if(duration.minutes() >= QUOTE_MIN_TIMEOUT){
                    log.error(`Quote: ${quoteDoc.quoteId} timed out ${QUOTE_MIN_TIMEOUT} minutes after quote initiated.`);
                    // This probably should just handle the update to mongo without the call to quotestatus.
                    // we know exactly what should happen.
                    await status.updateQuoteStatus(quoteDoc, true);
                }
            }
            catch(err){
                log.error('QuoteBO checkAndFixQuoteStatus  ' + err + __location);
            }
        }
        return;
    }

}