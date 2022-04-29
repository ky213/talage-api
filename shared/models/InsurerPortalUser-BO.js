/* eslint-disable prefer-const */
'use strict';


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const moment = require('moment');
var InsurerPortalUserModel = global.mongoose.InsurerPortalUser;
var InsurerPortalUserGroup = global.mongoose.InsurerPortalUserGroup;
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

const collectionName = 'InsurerPortalUsers'
module.exports = class InsurerPortalUserBO{


    constructor(){
        this.id = 0;
        this.mongoDoc = null;
    }


    /**
	 * Save Model
     *
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */
    // Use SaveMessage
    saveModel(newObjectJSON){
        return new Promise(async(resolve, reject) => {
            if(!newObjectJSON){
                reject(new Error(`empty ${collectionName} object given`));
            }
            let newDoc = true;
            if(newObjectJSON.id){
                const skipActiveCheck = true;
                const dbDocJSON = await this.getMongoDocbyUserId(newObjectJSON.id,false,skipActiveCheck).catch(function(err) {
                    log.error(`Error getting ${collectionName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                if(dbDocJSON){
                    newObjectJSON.insurerPortalUserId = dbDocJSON.insurerPortalUserId;
                    this.id = dbDocJSON.insurerPortalUserId;
                    newDoc = false;
                    await this.updateMongo(dbDocJSON.insurerPortalUserUuidId,newObjectJSON)
                }
                else {
                    log.error("InsurerPortalUser PUT object not found " + newObjectJSON.id + __location)
                }
            }
            if(newDoc === true) {
                newDoc = await this.insertMongo(newObjectJSON).catch((err) => {
                    log.error("InsurerPortalUser POST object error " + err + __location);
                    reject(err);
                });
                this.id = newDoc.insurerPortalUserId;
                this.mongoDoc = newDoc;

            }
            else {
                this.mongoDoc = this.getById(this.id);
            }
            resolve(true);

        });
    }


    getList(requestQueryJSON, addPermissions = false, includeDisabled = false) {
        return new Promise(async(resolve, reject) => {
            if(!requestQueryJSON){
                requestQueryJSON = {};
            }
            // eslint-disable-next-line prefer-const
            let queryJSON = JSON.parse(JSON.stringify(requestQueryJSON));
            const queryProjection = {
                "__v": 0,
                "_id": 0,
                "password": 0
            }

            let findCount = false;

            let rejected = false;
            // eslint-disable-next-line prefer-const

            let query = {};
            if (!includeDisabled) {
                query.active = true;
            }

            let error = null;


            var queryOptions = {};
            queryOptions.sort = {insurerPortalUserId: 1};
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

            if(queryJSON.id && Array.isArray(queryJSON.id)){
                query.insurerPortalUserId = {$in: queryJSON.id};
                delete queryJSON.id;
            }
            else if(queryJSON.id){
                query.insurerPortalUserId = queryJSON.id;
                delete queryJSON.id;
            }

            if(queryJSON.insurerPortalUserId && Array.isArray(queryJSON.insurerPortalUserId)){
                query.insurerPortalUserId = {$in: queryJSON.insurerPortalUserId};
                delete queryJSON.insurerPortalUserId;
            }
            else if(queryJSON.insurerPortalUserId){
                query.insurerPortalUserId = queryJSON.insurerPortalUserId;
                delete queryJSON.insurerPortalUserId;
            }

            if(queryJSON.insurerId && Array.isArray(queryJSON.insurerId)){
                query.insurerId = {$in: queryJSON.insurerId};
                delete queryJSON.insurerId;
            }
            else if(queryJSON.insurerId){
                query.insurerId = queryJSON.insurerId;
                delete queryJSON.insurerId;
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
                    docList = await InsurerPortalUserModel.find(query,queryProjection, queryOptions)
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
                    for(let i = 0; i < docList.length; i++){
                        if(docList[i].password){
                            delete docList[i].password;
                        }
                        if(addPermissions){
                            const userGroupQuery = {"systemId": docList[i].insurerPortalUserGroupId};
                            const userGroup = await InsurerPortalUserGroup.findOne(userGroupQuery, '-__v');
                            if(userGroup){
                                docList[i].groupRole = userGroup.name;
                                docList[i].permissions = userGroup.permissions;
                            }
                        }
                    }
                    resolve(docList);
                }
                else {
                    resolve([]);
                }
                return;
            }
            else {
                const docCount = await InsurerPortalUserModel.countDocuments(query).catch(err => {
                    log.error("InsurerPortalUserModel.countDocuments error " + err + __location);
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


    async getMongoDocbyUserId(insurerPortalUserId, returnMongooseModel = false, skipActiveCheck = false) {
        return new Promise(async(resolve, reject) => {
            if (insurerPortalUserId) {
                const query = {
                    insurerPortalUserId: insurerPortalUserId,
                    active: true
                };
                if(skipActiveCheck){
                    delete query.active;
                }
                const queryProjection = {
                    "__v": 0,
                    "password": 0
                }

                let docDB = null;
                try {
                    docDB = await InsurerPortalUserModel.findOne(query, queryProjection);
                    if(docDB){
                        docDB.id = docDB.insurerPortalUserId;
                    }
                }
                catch (err) {
                    log.error("Getting insurerPortalUser error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    const insurerPortalUserDoc = mongoUtils.objCleanup(docDB);
                    resolve(insurerPortalUserDoc);
                }
                else {
                    resolve(null);
                }

            }
            else {
                log.info(`no id supplied` + __location);
                reject(new Error('no id supplied'))
            }
        });
    }

    getById(id) {
        return this.getMongoDocbyUserId(id);
    }


    async getByEmailAndInsurerId(email, activeUser = true, insurerId) {
        return new Promise(async(resolve, reject) => {
            if (email) {
                const query = {
                    email: email.toLowerCase(),
                    insurerId: insurerId,
                    active: activeUser
                };
                log.debug(`getByEmailAndInsurerId ${JSON.stringify(query)} insurerId ${insurerId}` + __location);
                try {
                    const userDoc = await InsurerPortalUserModel.findOne(query, '-__v');

                    if(userDoc){
                        userDoc.id = userDoc.insurerId;
                        resolve(mongoUtils.objCleanup(userDoc));
                    }
                    else {
                        resolve(null);
                    }
                }
                catch (err) {
                    log.error("Getting InsurerPortalUser error " + err + __location);
                    reject(err);
                }

            }
            else {
                log.info(`no email supplied` + __location)
                reject(new Error('no email supplied'))
            }
        });
    }

    async updateMongo(docId, newObjectJSON) {
        if (docId) {
            if (typeof newObjectJSON === "object") {

                const query = {insurerPortalUserUuidId: docId};
                //allow reset to active = true only.
                if(newObjectJSON.active === false){
                    delete newObjectJSON.active;
                }
                try {
                    const changeNotUpdateList = [
                        "id",
                        "insurerPortalUserUuidId",
                        "insurerPortalUserId"
                    ]
                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    //so we have easier tracing in history table.
                    newObjectJSON.insurerPortalUserUuidId = docId;

                    await InsurerPortalUserModel.updateOne(query, newObjectJSON);
                    const newInsurerPortalDoc = await InsurerPortalUserModel.findOne(query);

                    return mongoUtils.objCleanup(newInsurerPortalDoc);
                }
                catch (err) {
                    log.error(`Updating Insurer Portal User error appId: ${docId}` + err + __location);
                    throw err;
                }

            }
            else {
                throw new Error(`no newObjectJSON supplied appId: ${docId}`)
            }

        }
        else {
            log.info(`no id supplied` + __location);
            throw new Error('no id supplied')
        }

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
        if(newObjectJSON.email){
            newObjectJSON.email = newObjectJSON.email.toLowerCase();
        }
        const newSystemId = await this.newMaxSystemId()
        newObjectJSON.insurerPortalUserId = newSystemId;
        const insurerPortalUser = new InsurerPortalUserModel(newObjectJSON);
        //Insert a doc
        await insurerPortalUser.save().catch(function(err) {
            log.error('Mongo InsurerPortalUser Save err ' + err + __location);
            throw err;
        });
        newObjectJSON.id = newSystemId;
        return mongoUtils.objCleanup(insurerPortalUser);
    }

    async newMaxSystemId(){
        let maxId = 0;
        try{

            //small collection - get the collection and loop through it.
            // TODO refactor to use mongo aggretation.
            const query = {}
            const queryProjection = {insurerPortalUserId: 1}
            var queryOptions = {};
            queryOptions.sort = {};
            queryOptions.sort.insurerPortalUserId = -1;
            queryOptions.limit = 1;
            const docList = await InsurerPortalUserModel.find(query, queryProjection, queryOptions)
            if(docList && docList.length > 0){
                for(let i = 0; i < docList.length; i++){
                    if(docList[i].insurerPortalUserId > maxId){
                        maxId = docList[i].insurerPortalUserId + 1;
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

    async getByInsurerId(insurerId, addPermissions = false) {
        if(insurerId){
            addPermissions = true;
            const query = {insurerId: insurerId};
            const userList = await this.getList(query, addPermissions).catch(function(err){
                throw err;
            })
            return userList;
        }
        else {
            throw new Error("Missing insurerId");
        }
    }

    deleteSoftById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (id) {
                try {
                    const getDoc = true;
                    const insurerPortalUserDoc = await this.getMongoDocbyUserId(id, getDoc);
                    insurerPortalUserDoc.active = false;
                    await insurerPortalUserDoc.save();
                }
                catch (err) {
                    log.error(`Error marking insurerPortalUserDoc from id ${id} ` + err + __location);
                    reject(err);
                }
                resolve(true);

            }
            else {
                log.info(`no id supplied` + __location);
                reject(new Error('no id supplied'))
            }
        });
    }

    getGroupList() {
        return new Promise(async(resolve, reject) => {
            const query = {active: true};
            let userGroupList = null;
            try {
                const doclist = await InsurerPortalUserGroup.find(query, '-__v').lean();
                userGroupList = mongoUtils.objListCleanup(doclist);
                for(let i = 0; i < userGroupList.length; i++) {
                    userGroupList[i].id = userGroupList[i].systemId;
                }
            }
            catch (err) {
                log.error("Getting InsurerPortalUserGroup error " + err + __location);
                reject(err);
            }
            resolve(userGroupList);
        });
    }

    async updateRole(insurerPortalUserId, insurerPortalUserGroupId){
        try{
            const query = {insurerPortalUserId: insurerPortalUserId};
            const queryProjection = {"__v": 0}
            const apuDoc = await InsurerPortalUserModel.findOne(query,queryProjection)
            if(apuDoc){
                apuDoc.insurerPortalUserGroupId = insurerPortalUserGroupId;
                await apuDoc.save()
            }
        }
        catch(err){
            log.error(`Error saving role for ${insurerPortalUserId} error: ` + err + __location)
            return false
        }
        return true;
    }

    async updateLastLogin(insurerPortalUserId){
        try{
            const query = {insurerPortalUserId: insurerPortalUserId};
            const queryProjection = {"__v": 0}
            const apuDoc = await InsurerPortalUserModel.findOne(query,queryProjection)
            if(apuDoc){
                apuDoc.lastLogin = new moment();
                await apuDoc.save()
            }
        }
        catch(err){
            log.error(`Error saving last log for ${insurerPortalUserId} error: ` + err + __location)
            return false
        }
        return true;
    }

    /**
	 * checkForDuplicateEmail
     *
	 * @param {object} insurerPortalUserId - new or updating userId -999 for new
     * @param {object} chkEmail - chkEmail to check
     * @param {object} insurerId - users agency network
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */
    async checkForDuplicateEmail(insurerPortalUserId, chkEmail, insurerId){
        let hasDuplicate = false;
        //new user
        if(!insurerPortalUserId){
            insurerPortalUserId = -999;
        }

        try{
            const query = {
                insurerPortalUserId: {$ne: insurerPortalUserId},
                active: true,
                email: chkEmail
            };
            if(insurerId){
                query.insurerId = insurerId;
            }
            const ipuDoc = await InsurerPortalUserModel.findOne(query)
            // eslint-disable-next-line no-unneeded-ternary
            hasDuplicate = ipuDoc ? true : false;
        }
        catch(err){
            log.error(`Error saving last log for ${insurerPortalUserId} error: ` + err + __location)
            return false
        }
        return hasDuplicate;
    }

    setPassword(id, newHashedPassword) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (id && id > 0) {
                let insurerPortalUserDoc = null;
                try {
                    const getDoc = true;
                    insurerPortalUserDoc = await this.getMongoDocbyUserId(id, getDoc);
                    if(insurerPortalUserDoc){
                        insurerPortalUserDoc.password = newHashedPassword;
                        insurerPortalUserDoc.resetRequired = false;
                        await insurerPortalUserDoc.save();
                    }
                    else {
                        log.info(`Set Password user not found ${id}` + __location);
                        reject(new Error(`User not found ${id}`))
                    }
                }
                catch (err) {
                    log.warn(`Error setting password insurerPortalUserDoc from id ${id} ` + err + __location);
                    reject(err);
                }
                resolve(true);

            }
            else {
                log.info(`no id supplied` + __location);
                reject(new Error('no id supplied'))
            }
        });
    }


}
