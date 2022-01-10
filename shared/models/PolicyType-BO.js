

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
var PolicyTypeModel = global.mongodb.model('PolicyType');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');


const collectionName = 'PolicyTypes'
module.exports = class PolicyTypeBO{

    constructor(){
        this.id = '';
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
            let updatedDoc = null;
            try{
                if(newObjectJSON.policyTypeId){
                    updatedDoc = await this.updateMongo(newObjectJSON.policyTypeId, newObjectJSON);
                }
                else{
                    updatedDoc = await this.insertMongo(newObjectJSON);
                }
            }
            catch(err){
                reject(err);
            }
            resolve(updatedDoc);
        });
    }


    async updateMongo(id, newObjectJSON){
        if(id){
            if(typeof newObjectJSON === "object"){
                const changeNotUpdateList = ["active",
                    "policyTypeId",
                    "id"]
                for(let i = 0; i < changeNotUpdateList.length; i++){
                    if(newObjectJSON[changeNotUpdateList[i]]){
                        delete newObjectJSON[changeNotUpdateList[i]];
                    }
                }
                const query = {"policyTypeId": id};
                let newMappingJSON = null;
                try {
                    await PolicyTypeModel.updateOne(query, newObjectJSON);

                    const mappingDocDB = await PolicyTypeModel.findOne(query);
                    newMappingJSON = mongoUtils.objCleanup(mappingDocDB);
                }
                catch (err) {
                    log.error(`Updating ${collectionName} error ` + err + __location);
                    throw err;
                }
                return newMappingJSON;
            }
            else {
                throw new Error('no newObjectJSON supplied')
            }

        }
        else {
            throw new Error('no id supplied')
        }

    }

    async insertMongo(newObjecJSON){


        const PolicyType = new PolicyTypeModel(newObjecJSON);
        //Insert a doc
        await PolicyType.save().catch(function(err){
            log.error(`Mongo ${collectionName} Save err ` + err + __location);
            throw err;
        });
        const docDB = mongoUtils.objCleanup(PolicyType);
        return docDB;
    }


    getList(queryJSON) {
        return new Promise(async(resolve, reject) => {
            // Create the update query
            const query = {active: true};
            if(queryJSON){

                if(queryJSON.active === false || queryJSON.active === 'false'){
                    query.active = queryJSON.active
                }
                if(queryJSON.name){
                    query.name = queryJSON.name
                }
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

            // Run the query
            let docCleanList = null;
            try {
                const doclist = await PolicyTypeModel.find(query, '-__v');
                docCleanList = mongoUtils.objListCleanup(doclist);
            }
            catch (err) {
                log.error(`Getting ${collectionName} error ` + err + __location);
                reject(err);
            }

            if(docCleanList && docCleanList.length > 0){
                resolve(docCleanList);
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
            if(id){
                const query = {
                    "policyTypeId": id,
                    active: true
                };
                let docCleanDB = null;
                try {
                    const docDB = await PolicyTypeModel.findOne(query, '-__v');
                    if(docDB){
                        docCleanDB = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error(`Getting ${collectionName} error ` + err + __location);
                    reject(err);
                }
                resolve(docCleanDB);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    getByPolicyTypeCd(policyTypeCd) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(policyTypeCd){
                const query = {
                    "policyTypeCd": policyTypeCd,
                    active: true
                };
                let docCleanDB = null;
                try {
                    const docDB = await PolicyTypeModel.findOne(query, '-__v');
                    if(docDB){
                        docCleanDB = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error(`Getting ${collectionName} error ` + err + __location);
                    reject(err);
                }
                resolve(docCleanDB);
            }
            else {
                reject(new Error('no policyTypeCd supplied'))
            }
        });
    }

    deleteSoftById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id){
                const activeJson = {active: false};
                const query = {"policyTypeId": id};
                try {
                    await PolicyTypeModel.updateOne(query, activeJson);
                }
                catch (err) {
                    log.error(`Soft Deleting ${collectionName} error ` + err + __location);
                    reject(err);
                }

                resolve(true);

            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }


}