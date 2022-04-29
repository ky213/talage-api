'use strict';

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
var InsurerPortalUserGroup = global.mongoose.InsurerPortalUserGroup;
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

module.exports = class InsurerPortalUserGroupBO{

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
            let updatedDoc = null;
            try{
                if(newObjectJSON.id){
                    updatedDoc = await this.update(newObjectJSON.id, newObjectJSON);
                }
                else{
                    updatedDoc = await this.insert(newObjectJSON);
                }
            }
            catch(err){
                reject(err);
            }
            resolve(updatedDoc);
        });
    }

    // /**
    //  * saves model.
    //  *
    //  * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved model , or an Error if rejected
    //  */

    // save(asNew = false){
    //     return new Promise(async(resolve, reject) => {
    //     //validate

    //         resolve(true);
    //     });
    // }

    async update(id, newObjectJSON){
        if(id && id > 0){
            if(typeof newObjectJSON === "object"){
                const changeNotUpdateList = ["active",
                    "id",
                    "systemId",
                    "insurerPortalUserGroupId"]
                for(let i = 0; i < changeNotUpdateList.length; i++){
                    if(newObjectJSON[changeNotUpdateList[i]]){
                        delete newObjectJSON[changeNotUpdateList[i]];
                    }
                }
                log.debug("newObjectJSON: " + JSON.stringify(newObjectJSON))
                const query = {"systemId": id};
                let newUserGroupJSON = null;

                //so we have easier tracing in history table.
                newObjectJSON.systemId = id;
                try {
                    await InsurerPortalUserGroup.updateOne(query, newObjectJSON);

                    const newUserGroupdoc = await InsurerPortalUserGroup.findOne(query);
                    newUserGroupJSON = mongoUtils.objCleanup(newUserGroupdoc);
                    newUserGroupJSON.id = newUserGroupJSON.systemId;
                }
                catch (err) {
                    log.error("Updating InsurerPortalUserGroup error " + err + __location);
                    throw err;
                }
                return newUserGroupJSON;
            }
            else {
                throw new Error('no newObjectJSON supplied')
            }
        }
        else {
            throw new Error('no id supplied')
        }

    }

    async insert(newObjecJSON){
        let newSystemId = await this.getMaxSystemId();
        newSystemId++;
        newObjecJSON.systemId = newSystemId;
        log.debug("newSystemId: " + newSystemId)
        const insurerPortalUserGroup = new InsurerPortalUserGroup(newObjecJSON);
        //Insert a doc
        await insurerPortalUserGroup.save().catch(function(err){
            log.error('Mongo insurerPortalUserGroup Save err ' + err + __location);
            throw err;
        });
        // eslint-disable-next-line prefer-const
        let userGroup = mongoUtils.objCleanup(insurerPortalUserGroup);
        userGroup.id = userGroup.systemId;
        return userGroup;
    }

    getList(queryJSON) {
        return new Promise(async(resolve, reject) => {
            // Create the update query
            // eslint-disable-next-line prefer-const
            let query = {active: true};
            if(queryJSON){

                if(queryJSON.active){
                    query.active = queryJSON.active
                }
                if(queryJSON.name){
                    query.name = queryJSON.name
                }
            }

            // Run the query
            let userGroupList = null;
            try {
                const doclist = await InsurerPortalUserGroup.find(query, '-__v');
                userGroupList = mongoUtils.objListCleanup(doclist);
                for(let i = 0; i < userGroupList.length; i++) {
                    userGroupList[i].id = userGroupList[i].systemId;
                }
            }
            catch (err) {
                log.error("Getting InsurerPortalUserGroup error " + err + __location);
                reject(err);
            }

            if(userGroupList && userGroupList.length > 0){
                resolve(userGroupList);
            }
            else {
                //Search so no hits ok.
                resolve([]);
            }


        });
    }


    getById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id && id > 0){
                const query = {
                    "systemId": id,
                    active: true
                };
                let userGroup = null;
                try {
                    const docDB = await InsurerPortalUserGroup.findOne(query, '-__v');
                    if(docDB){
                        userGroup = mongoUtils.objCleanup(docDB);
                        userGroup.id = userGroup.systemId;
                    }
                }
                catch (err) {
                    log.error("Getting InsurerPortalUserGroup error " + err + __location);
                    reject(err);
                }
                resolve(userGroup);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    deleteSoftById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id && id > 0){
                const activeJson = {active: false};
                const query = {"systemId": id};
                try {
                    await InsurerPortalUserGroup.updateOne(query, activeJson);
                }
                catch (err) {
                    log.error("Soft Deleting InsurerPortalUserGroup error " + err + __location);
                    reject(err);
                }

                resolve(true);

            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    async getMaxSystemId(){
        let maxId = 0;
        try{

            //small collection - get the collection and loop through it.
            const query = {active: true}
            const docList = await InsurerPortalUserGroup.find(query)
            if(docList && docList.length > 0){
                for(let i = 0; i < docList.length; i++){
                    if(docList[i].systemId > maxId){
                        maxId = docList[i].systemId;
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

}
