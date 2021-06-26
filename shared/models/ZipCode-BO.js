'use strict';


global.requireShared('./helpers/tracker.js');
const ZipCodeModel = require('mongoose').model('ZipCode');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

const smartystreetSvc = global.requireShared('./services/smartystreetssvc.js');

module.exports = class ZipCodeBO{


    // Don't think we need a constructor anymore, since we're handling this w/ mongoose
    // constructor(){
    //     this.id = 0;
    //     this.#dbTableORM = new DbTableOrm(tableName);
    // }

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
                const error = `ZipCode-BO: Error: Empty ZipCode object given. ${__location}`;
                log.error(error);
                return reject(new Error(error));
            }


            let mongoZipCodeDoc = null;
            let insert = true;
            if (newObjectJSON.zipCodeId) {
                insert = false;
                const query = {zipCodeId: newObjectJSON.zipCodeId};
                try {
                    mongoZipCodeDoc = await ZipCodeModel.findOne(query);
                }
                catch (e) {
                    log.error(`ZipCode-BO: Error: Couldn't find existing ZIP code object from id in saveModel. ${__location}`);
                }
            }

            try {
                if (insert) {
                    await this.insertMongo(newObjectJSON);
                }
                else {
                    await this.updateMongo(mongoZipCodeDoc.zipCodeId, newObjectJSON);
                }
            }
            catch (e) {
                const error = `ZipCode-BO: Error: Failed to save ZipCode record: ${e}. ${__location}`;
                log.error(error);
                return reject(new Error(error));
            }

            return resolve(true);
        });
    }


    // inserts a new record into the mongo collection
    async insertMongo(newObjectJSON) {
        if (!newObjectJSON) {
            const error = `ZipCode-BO: No data supplied in insertMongo. ${__location}`;
            log.error(error);
            throw new Error(error);
        }

        const zipCode = new ZipCodeModel(newObjectJSON);

        //Insert a doc
        try {
            await zipCode.save();
        }
        catch (e) {
            const error = `ZipCode-BO: Error: Failed to insert new ZipCode record into Mongo: ${e}. ${__location}`;
            log.error(error);
            throw new Error(error);
        }

        return mongoUtils.objCleanup(zipCode);
    }

    // updates an existing record in the mongo collection, only for those props that are updateable
    async updateMongo(zipCodeId, newObjectJSON) {
        if (zipCodeId) {
            if (typeof newObjectJSON === "object") {
                const updateableProps = [
                    "type",
                    "getUpdate",
                    "city",
                    "state",
                    "county"
                ];

                Object.keys(newObjectJSON).forEach(prop => {
                    if (!updateableProps.includes(prop)) {
                        delete newObjectJSON[prop];
                    }
                });

                // Add updatedAt
                newObjectJSON.updatedAt = new Date();

                const query = {zipCodeId: zipCodeId};
                let newZipCodeJSON = null;
                try {
                    //because Virtual Sets.  new need to get the model and save.
                    await ZipCodeModel.updateOne(query, newObjectJSON);
                    newZipCodeJSON = mongoUtils.objCleanup(newZipCodeJSON);
                }
                catch (e) {
                    const error = `ZipCode-BO: Error: Failed to update ZipCode object in updateMongo: ${e}. ${__location}`;
                    log.error(error);
                    throw new Error(error);
                }

                return newZipCodeJSON;
            }
            else {
                const error = `ZipCode-BO: Error: No newObjectJSON supplied in updateMongo. ${__location}`;
                log.error(error);
                throw new Error(error);
            }
        }
        else {
            const error = `ZipCode-BO: Error: No id supplied in updateMongo. ${__location}`;
            log.error(error);
            throw new Error(error);
        }
    }

    // Returns JSON, not Doc
    async loadByZipCode(zipCode) {
        if (zipCode) {
            let zip = zipCode;
            let extendedZip = null;

            if (zipCode.length > 5) {
                zip = zipCode.slice(0, 5);

                if (zipCode.length === 9) {
                    extendedZip = zipCode;
                }
            }

            // if we have the more precise zip code (9 digits), use that instead
            let query = null;
            if (extendedZip) {
                query = {extendedZipCode: extendedZip};
            }
            else {
                query = {zipCode: zip};
            }

            // Run the query
            let zipCodeDoc = null;
            try {
                zipCodeDoc = await ZipCodeModel.find(query).lean();
            }
            catch (e) {
                const error = `ZipCode-BO: Error: Failed to lookup ZIP code: ${e}. ${__location}`;
                log.error(error);
                throw new Error(error);
            }

            if (zipCodeDoc && zipCodeDoc.length > 0) {
                return zipCodeDoc[0];
            }
            else {
                log.debug(`ZipCode-BO: ZIP code not found in DB by loadByZipCode. Checking ZipCodeSvc: ${JSON.stringify(query)}` + __location);
                //Call to zipcode service to lookup zip.
                let newZip = null;
                try {
                    newZip = await this.checkZipCodeSvc(zip);
                }
                catch (e) {
                    const error = `ZipCode-BO: Error: Failed ZIP validation in checkZipCodeSvc: ${e}. ${__location}`;
                    log.error(error);
                    throw new Error(error);
                }

                if (newZip) {
                    return newZip;
                }
                else {
                    const error = `ZipCode-BO: Error: ZIP code now found. ${__location}`;
                    log.error(error);
                    throw new Error(error);
                }
            }
        }
        else {
            const error = `ZipCode-BO: Error: No ZIP code supplied. ${__location}`;
            log.error(error);
            throw new Error(error);
        }

    }

    async checkZipCodeSvc(zipCode) {
        let response = null;
        try {
            response = await smartystreetSvc.checkZipCode(zipCode.toString());

            if (response.error) {
                log.error(`ZipCode-BO: Error: smartystreetSvc encountered an error: ${response.error}. ${__location}`);
                return null;
            }
        }
        catch (e) {
            log.error(`ZipCode-BO: Error: smartystreetSvc encountered an error: ${e}. ${__location}`);
            return null;
        }

        // Got a zip code.
        if (response.zipcode) {
            // populate BO and save.
            const newJSON = {
                city: response.city,
                state: response.state_abbreviation,
                county: response.county_name
            };

            switch(response.zipcode_type){
                case "S":
                    newJSON.type = "STANDARD";
                    break;
                case "U":
                    newJSON.type = "UNIQUE";
                    break;
                case "P":
                    newJSON.type = "PO BOX";
                    break;
                case "M":
                    newJSON.type = "MILITARY";
                    break;
                default:
                    log.debug(`ZipCode-BO: Encountered unknown ZIP code type from smartystreetSvc response: ${response.zipcode_type}.`);
                    newJSON.type = response.zipcode_type;
                    break;
            }

            // these are just safeguards. smartystreets should only ever return a 5 digit <string> ZIP code
            if (response.zipcode.length === 9) {
                newJSON.extendedZipCode = response.zipcode;
            }

            if (response.zipcode.length > 5) {
                newJSON.zipCode = response.zipcode.slice(0, 5);
            }
            else {
                newJSON.zipCode = response.zipcode;
            }

            // insert into mongo
            try {
                await this.insertMongo(newJSON);
            }
            catch (e) {
                log.error(`ZipCode-BO: Error: Failed to insert new ZIP code record: ${e}. ${__location}`);
                return null;
            }

            // retrieve and return from mongo
            let newZipDoc = null;
            try {
                newZipDoc = await ZipCodeModel.findOne(newJSON);
            }
            catch (e) {
                log.error(`ZipCode-BO: Error: Failed to retrieve newly inserted ZIP code record: ${e}. Returning raw insert JSON. ${__location}`);
                return newJSON;
            }

            return newZipDoc;
        }
        else {
            log.debug(`ZipCode-BO: smartystreetSvc response did not contain a ZIP code. ${__location}`);
            return null;
        }

    }

    async getStatesForZipCodeList(zipCodeArray) {
        const query = {$or: [
            {extendedZipCode: {$in: zipCodeArray}}, {zipCode: {$in: zipCodeArray}}
        ]};

        let states = null;
        try {
            states = await ZipCodeModel.distinct("state", query);
        }
        catch (e) {
            log.error(`Question Service: An error occurred while attempting to look up zipCodeArray: ${e}. ${__location}`);
            return false;
        }

        if (states && states.length > 0) {
            return states
        }
        else {
            log.warn(`Question Service: Bad Request: No states found for ZIP codes: ${zipCodeArray.join(',')}. ${__location}`);
            return [];
        }

    }
}