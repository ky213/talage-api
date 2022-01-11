/* eslint-disable prefer-const */
'use strict';


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const moment = require('moment');
var AgencyPortalUserModel = require('mongoose').model('AgencyPortalUser');
var AgencyPortalUserGroup = require('mongoose').model('AgencyPortalUserGroup');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

const collectionName = 'AgencyPortalUsers'
module.exports = class AgencyPortalUserBO{


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
                    newObjectJSON.agencyPortalUserId = dbDocJSON.agencyPortalUserId;
                    this.id = dbDocJSON.agencyPortalUserId;
                    newDoc = false;
                    await this.updateMongo(dbDocJSON.agencyPortalUserUuidId,newObjectJSON)
                }
                else {
                    log.error("AgencyPortalUser PUT object not found " + newObjectJSON.id + __location)
                }
            }
            if(newDoc === true) {
                newDoc = await this.insertMongo(newObjectJSON).catch((err) => {
                    log.error("AgencyPortalUser POST object error " + err + __location);
                    reject(err);
                });
                this.id = newDoc.agencyPortalUserId;
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
            queryOptions.sort = {agencyPortalUserId: 1};
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
                query.agencyPortalUserId = {$in: queryJSON.id};
                delete queryJSON.id
            }
            else if(queryJSON.id){
                query.agencyPortalUserId = queryJSON.id;
                delete queryJSON.id
            }

            if(queryJSON.agencyPortalUserId && Array.isArray(queryJSON.agencyPortalUserId)){
                query.agencyPortalUserId = {$in: queryJSON.agencyPortalUserId};
                delete queryJSON.agencyPortalUserId
            }
            else if(queryJSON.agencyPortalUserId){
                query.agencyPortalUserId = queryJSON.agencyPortalUserId;
                delete queryJSON.agencyPortalUserId
            }

            if(queryJSON.agencyId && Array.isArray(queryJSON.agencyId)){
                query.agencyId = {$in: queryJSON.agencyId};
                delete queryJSON.agencyId
            }
            else if(queryJSON.agencyId){
                query.agencyId = queryJSON.agencyId;
                delete queryJSON.agencyId
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
                    // log.debug("AgencyPortalUserModel GetList query " + JSON.stringify(query) + __location)
                    docList = await AgencyPortalUserModel.find(query,queryProjection, queryOptions);
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
                            const userGroupQuery = {"systemId": docList[i].agencyPortalUserGroupId};
                            const userGroup = await AgencyPortalUserGroup.findOne(userGroupQuery, '-__v');
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
                const docCount = await AgencyPortalUserModel.countDocuments(query).catch(err => {
                    log.error("AgencyPortalUserModel.countDocuments error " + err + __location);
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


    async getMongoDocbyUserId(agencyPortalUserId, returnMongooseModel = false, skipActiveCheck = false) {
        return new Promise(async(resolve, reject) => {
            if (agencyPortalUserId) {
                const query = {"agencyPortalUserId": agencyPortalUserId};
                if(skipActiveCheck === false){
                    query.active = true;
                }
                const queryProjection = {
                    "__v": 0,
                    "password": 0
                }

                let docDB = null;
                try {
                    docDB = await AgencyPortalUserModel.findOne(query, queryProjection);
                    if(docDB){
                        docDB.id = docDB.agencyPortalUserId;
                    }
                }
                catch (err) {
                    log.error("Getting agencyPortalUser error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else if(docDB){
                    const agencyPortalUserDoc = mongoUtils.objCleanup(docDB);
                    resolve(agencyPortalUserDoc);
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


    async getByEmailAndAgencyNetworkId(email, activeUser = true, agencyNetworkId, forceAgencyNetworkCheck) {
        return new Promise(async(resolve, reject) => {
            if (email) {
                const query = {
                    "email": email.toLowerCase(),
                    active: activeUser
                };
                if(forceAgencyNetworkCheck){
                    query.agencyNetworkId = agencyNetworkId
                }
                log.debug(`getByEmailAndAgencyNetworkId ${JSON.stringify(query)} agencyNetworkId ${agencyNetworkId}` + __location);
                let userDoc = null;
                try {
                    let userList = await AgencyPortalUserModel.find(query, '-__v');
                    //backward compatible with only one email for system wide.
                    if(userList.length === 1){
                        //TODO hard match agencyNetworkId if not in development. (localhost)
                        // after data update script have run and DNS has been updated
                        userDoc = userList[0];
                    }
                    else if (userList.length > 1 && agencyNetworkId){
                        const AgencyBO = global.requireShared(`./models/Agency-BO.js`)
                        const agencyBO = new AgencyBO();
                        for(const userDB of userList){
                            if(userDB.agencyNetworkId === agencyNetworkId){
                                userDoc = userDB;
                                break;
                            }
                            else if(userDB.agencyId){
                                //load agency to get agencyNetworkId
                                const agencyDoc = await agencyBO.getById(userDB.agencyId)
                                if(agencyDoc?.agencyNetworkId === agencyNetworkId){
                                    userDoc = userDB;
                                    break;
                                }
                            }
                        }
                    }

                    if(userDoc){
                        userDoc.id = userDoc.agencyPortalUserId;
                    }
                }
                catch (err) {
                    log.error("Getting AgencyPortalUser error " + err + __location);
                    reject(err);
                }
                if(userDoc){
                    const agencyPortalUserDoc = mongoUtils.objCleanup(userDoc);
                    resolve(agencyPortalUserDoc);
                }
                else {
                    resolve(null);
                }

            }
            else {
                log.info(`no email supplied` + __location)
                reject(new Error('no email supplied'))
            }
        });
    }

    // Email is no longer unique system wide, only within an agency network
    // async getByEmail(email, activeUser = true) {
    //     return new Promise(async(resolve, reject) => {
    //         if (email) {
    //             const query = {
    //                 "email": email.toLowerCase(),
    //                 active: activeUser
    //             };
    //             log.debug(`getByEmail ${JSON.stringify(query)}` + __location);
    //             let docDB = null;
    //             try {
    //                 docDB = await AgencyPortalUserModel.findOne(query, '-__v');
    //                 if(docDB){
    //                     docDB.id = docDB.agencyPortalUserId;
    //                 }
    //             }
    //             catch (err) {
    //                 log.error("Getting AgencyPortalUser error " + err + __location);
    //                 reject(err);
    //             }
    //             if(docDB){
    //                 const agencyPortalUserDoc = mongoUtils.objCleanup(docDB);
    //                 resolve(agencyPortalUserDoc);
    //             }
    //             else {
    //                 resolve(null);
    //             }

    //         }
    //         else {
    //             reject(new Error('no id supplied'))
    //         }
    //     });
    // }

    async updateMongo(docId, newObjectJSON) {
        if (docId) {
            if (typeof newObjectJSON === "object") {

                const query = {"agencyPortalUserUuidId": docId};
                let newAgencyJSON = null;
                //allow reset to active = true only.
                if(newObjectJSON.active === false){
                    delete newObjectJSON.active;
                }
                try {
                    const changeNotUpdateList = [
                        "id",
                        "agencyPortalUserUuidId",
                        "agencyPortalUserId"
                    ]
                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    await AgencyPortalUserModel.updateOne(query, newObjectJSON);
                    const newAgencyDoc = await AgencyPortalUserModel.findOne(query);

                    newAgencyJSON = mongoUtils.objCleanup(newAgencyDoc);
                }
                catch (err) {
                    log.error(`Updating Application error appId: ${docId}` + err + __location);
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
            log.info(`no id supplied` + __location);
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
        if(newObjectJSON.email){
            newObjectJSON.email = newObjectJSON.email.toLowerCase();
        }
        const newSystemId = await this.newMaxSystemId()
        newObjectJSON.agencyPortalUserId = newSystemId;
        const agencyPortalUser = new AgencyPortalUserModel(newObjectJSON);
        //Insert a doc
        await agencyPortalUser.save().catch(function(err) {
            log.error('Mongo AgencyPortalUser Save err ' + err + __location);
            throw err;
        });
        newObjectJSON.id = newSystemId;
        return mongoUtils.objCleanup(agencyPortalUser);
    }

    async newMaxSystemId(){
        let maxId = 0;
        try{

            //small collection - get the collection and loop through it.
            // TODO refactor to use mongo aggretation.
            const query = {}
            const queryProjection = {"agencyPortalUserId": 1}
            var queryOptions = {};
            queryOptions.sort = {};
            queryOptions.sort.agencyPortalUserId = -1;
            queryOptions.limit = 1;
            const docList = await AgencyPortalUserModel.find(query, queryProjection, queryOptions)
            if(docList && docList.length > 0){
                for(let i = 0; i < docList.length; i++){
                    if(docList[i].agencyPortalUserId > maxId){
                        maxId = docList[i].agencyPortalUserId + 1;
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

    async getByAgencyId(agencyId, addPermissions = false) {
        if(agencyId){
            addPermissions = true;
            const query = {'agencyId': agencyId};
            const userList = await this.getList(query, addPermissions).catch(function(err){
                throw err;
            })
            return userList;
        }
        else {
            throw new Error("Missing agencyId");
        }
    }

    deleteSoftById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (id) {
                let agencyPortalUserDoc = null;
                try {
                    const getDoc = true;
                    agencyPortalUserDoc = await this.getMongoDocbyUserId(id, getDoc);
                    agencyPortalUserDoc.active = false;
                    await agencyPortalUserDoc.save();
                }
                catch (err) {
                    log.error(`Error marking agencyPortalUserDoc from id ${id} ` + err + __location);
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

    getGroupList(forTalageAdmin = false, agencyNetworkRoles = false) {
        return new Promise(async(resolve, reject) => {
            const query = {active: true};
            if(agencyNetworkRoles === false){
                query.agencyNetworkOnly = {$ne: true}
            }

            if(forTalageAdmin !== true){
                query.talageAdminOnly = false;
            }
            let userGroupList = null;
            try {
                const doclist = await AgencyPortalUserGroup.find(query, '-__v').lean();
                userGroupList = mongoUtils.objListCleanup(doclist);
                for(let i = 0; i < userGroupList.length; i++) {
                    userGroupList[i].id = userGroupList[i].systemId;
                }
            }
            catch (err) {
                log.error("Getting AgencyPortalUserGroup error " + err + __location);
                reject(err);
            }
            resolve(userGroupList);
        });
    }

    async updateRole(agencyPortalUserId, agencyPortalUserGroupId){
        try{
            const query = {agencyPortalUserId: agencyPortalUserId};
            const queryProjection = {"__v": 0}
            const apuDoc = await AgencyPortalUserModel.findOne(query,queryProjection)
            if(apuDoc){
                apuDoc.agencyPortalUserGroupId = agencyPortalUserGroupId;
                await apuDoc.save()
            }
        }
        catch(err){
            log.error(`Error saving role for ${agencyPortalUserId} error: ` + err + __location)
            return false
        }
        return true;
    }

    async updateLastLogin(agencyPortalUserId){
        try{
            const query = {agencyPortalUserId: agencyPortalUserId};
            const queryProjection = {"__v": 0}
            const apuDoc = await AgencyPortalUserModel.findOne(query,queryProjection)
            if(apuDoc){
                apuDoc.lastLogin = new moment();
                await apuDoc.save()
            }
        }
        catch(err){
            log.error(`Error saving last log for ${agencyPortalUserId} error: ` + err + __location)
            return false
        }
        return true;
    }

    /**
	 * checkForDuplicateEmail
     *
	 * @param {object} agencyPortalUserId - new or updating userId -999 for new
     * @param {object} chkEmail - chkEmail to check
     * @param {object} agencyNetworkId - users agency network
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */
    async checkForDuplicateEmail(agencyPortalUserId, chkEmail, agencyNetworkId){
        let hasDuplicate = false;
        //new user
        if(!agencyPortalUserId){
            agencyPortalUserId = -999;
        }

        try{
            const query = {
                agencyPortalUserId: {$ne: agencyPortalUserId},
                active: true,
                email: chkEmail
            };
            if(agencyNetworkId){
                query.agencyNetworkId = agencyNetworkId;
            }
            const apuDoc = await AgencyPortalUserModel.findOne(query)
            // eslint-disable-next-line no-unneeded-ternary
            hasDuplicate = apuDoc ? true : false;
        }
        catch(err){
            log.error(`Error saving last log for ${agencyPortalUserId} error: ` + err + __location)
            return false
        }
        return hasDuplicate;
    }

    setPasword(id, newHashedPassword) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (id) {
                let agencyPortalUserDoc = null;
                try {
                    const getDoc = true;
                    agencyPortalUserDoc = await this.getMongoDocbyUserId(id, getDoc);
                    agencyPortalUserDoc.password = newHashedPassword;
                    agencyPortalUserDoc.resetRequired = false;
                    await agencyPortalUserDoc.save();
                }
                catch (err) {
                    log.error(`Error marking agencyPortalUserDoc from id ${id} ` + err + __location);
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