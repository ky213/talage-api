/* eslint-disable object-shorthand */
/* eslint-disable object-curly-newline */
/* eslint-disable array-element-newline */

global.requireShared('./helpers/tracker.js');
const FireCodeModel = global.mongoose.FireCode;
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

module.exports = class FireCodeBO{

    constructor() {
        this.id = '';
    }

    /**
	 * (Async) Adds or updates an existing record with the provided JSON object dependant on if a talageFireCodeId exists on the object already or not
     * If talageFireCodeId exists, update the record
     * If talageFireCodeId does not exist, add the new record
     *
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns the saved/updated JSON object, or an Error if one occurred
	 */
    async saveModel(newObjectJSON) {
        let updatedDoc = null;
        try {
            if (newObjectJSON.talageFireCodeId) {
                updatedDoc = await this.updateMongo(newObjectJSON.talageFireCodeId, newObjectJSON);
            }
            else{
                updatedDoc = await this.insertMongo(newObjectJSON);
            }
        }
        catch (e) {
            throw e;
        }

        return updatedDoc;
    }

    /**
     * (Async) Updates an existing Fire Code record in the collection using the provided talageFireCodeId for lookup
     *
     * @param {String} talageFireCodeId the Fire Code id used for lookup
     * @param {Object} newObjectJSON The raw JSON of the Fire Code record to be updated in the collection
     * @returns {Object} the cleaned-up newly updated Fire Code record from the collection
     */
    async updateMongo(talageFireCodeId, newObjectJSON) {
        if (talageFireCodeId) {
            if (typeof newObjectJSON === "object") {
                const nonUpdateableProps = [
                    "talageFireCodeId",
                    "id"
                ];

                // remove non-updateable props from the update object
                for (const propName of nonUpdateableProps) {
                    if(newObjectJSON[propName]){
                        delete newObjectJSON[propName];
                    }
                }

                const query = {
                    talageFireCodeId
                };

                let fireCodeRecord = null;
                try {
                    await FireCodeModel.updateOne(query, newObjectJSON);
                    const fireCodeRecordRaw = await FireCodeModel.findOne(query);
                    fireCodeRecord = mongoUtils.objCleanup(fireCodeRecordRaw);
                }
                catch (e) {
                    log.error(`FireCode BO <updateMongo>: Error updating FireCode record: ${e}. ` + __location);
                    throw e;
                }

                return fireCodeRecord;
            }
            else {
                throw new Error('newObjectJSON is not an object');
            }

        }
        else {
            throw new Error('no talageFireCodeId supplied');
        }

    }

    /**
     * (Async) Creates and inserts the new JSON object into the Fire Code collection
     *
     * @param {Object} newObjecJSON the raw JSON to be inserted into the Fire Code collection
     * @returns {Object} the cleaned-up record that was inserted into the Fire Code collection
     */
    async insertMongo(newObjecJSON) {
        const FireCode = new FireCodeModel(newObjecJSON);

        try {
            await FireCode.save();
        }
        catch (e) {
            log.error(`FireCode BO <insertMongo>: Error inserting new Fire Code record: ${e}. ` + __location);
            throw e;
        }

        const docDB = mongoUtils.objCleanup(FireCode);
        return docDB;
    }

    /**
     * (Async) Retrieves a Fire Code from the collection using the provided talageFireCodeId
     *
     * @param {String} talageFireCodeId the id used for lookup
     * @returns {Object} the Fire Code object retrieved from the collection using the provided talageFireCodeId
     */
    async getById(talageFireCodeId) {
        if (!talageFireCodeId) {
            log.error(`FireCode BO <getById>: No talageFireCodeId supplied. ` + __location);
            throw new Error(`No talageFireCodeId supplied`);
        }

        const query = {
            talageFireCodeId
        };

        let fireCodeRecord = null;
        try {
            fireCodeRecord = await FireCodeModel.findOne(query);
        }
        catch (e) {
            log.error(`FireCode BO <getById>: Error getting Fire Code record with id ${talageFireCodeId}: ${e}. ` + __location);
            throw e;
        }

        if (!fireCodeRecord) {
            log.error(`FireCode BO <getById>: No Fire Code record found with id ${talageFireCodeId}. ` + __location);
        }

        // calling code should handle whether a record was found or not
        return fireCodeRecord;
    }

    /**
     * (Async) Retrieves all Fire Code records from the collection that have the provided CGL.
     * Filters the cgl list down to only the one matching CGL record on the Fire Code.
     *
     * @param {String} cgl the CGL code used for lookup
     * @param {Boolean} active (optional) defaulted TRUE - the active property used for lookup
     * @param {Boolean} allRecords (optional) defaulted FALSE - whether to include all records, both active and not
     * @returns {Array<Object>} an array of all Fire Code records retrieved with matching CGL code from the collection
     */
    async getByCGL(cgl, active = true, allRecords = false) {
        if (!cgl) {
            log.error(`FireCode BO <getByCGL>: No cgl supplied. ` + __location);
            throw new Error(`No cgl supplied`);
        }

        // TODO in AP: Make sure the selected Fire Code gets set on the application model
        const query = allRecords ? {} : {
            active
        };

        let fireCodeRecords = [];
        try {
            fireCodeRecords = await FireCodeModel.find(query);
        }
        catch (e) {
            log.error(`FireCode BO <getByCGL>: Error getting Fire Code records with CGL ${cgl}: ${e}. ` + __location);
            // do not just throw errors.
            //throw e;
        }

        if (!fireCodeRecords || fireCodeRecords.length === 0) {
            log.warn(`FireCode BO <getByCGL>: No Fire Code records were found with CGL ${cgl}.` + __location);
            // in case fireCodeRecords came back not defined
            fireCodeRecords = [];
        }

        // return a filtered list with any fire code record that has a cgl object w/ matching cgl code
        const filteredFireCodes = fireCodeRecords.filter(record => record.cgl.some(cglObject => cglObject.cgl === cgl));

        // filter each fire codes cgl down to only the cgl record that matches the passed in cgl value
        // NOTE: This is done because all other cgl records are unnecessary, and makes it easier for calling code so it doesn't need to know the cgl to search on
        filteredFireCodes.forEach(filteredFireCode => {
            filteredFireCode.cgl = [filteredFireCode.cgl.find(recordCGL => recordCGL.cgl === cgl)];
        });

        // calling code should handle whether any records were found
        return filteredFireCodes;
    }
}