'use strict';

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// Mongoose Models
const ApplicationNotes = global.mongoose.ApplicationNotes;
const AgencyPortalUser = global.mongoose.AgencyPortalUser;
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

const validate = async(newObjectJSON, userId) => {
    if(!newObjectJSON){
        throw new Error(`Empty applicationNotes object given`);
    }
    if(!newObjectJSON.applicationId){
        throw new Error(`No application id provided for to save notes`);
    }
    if(!userId){
        throw new Error(`No user id.`);
    }
}
module.exports = class ApplicationNotesBO{

    /**
	 * Save Model
     *
	 * @param {object} newObjectJSON - newObjectJSON JSON
     * @param {int} userId - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */
    async saveModel(newObjectJSON, userId){
        await validate(newObjectJSON, userId);
        let applicationNotesDoc = null;
        const dbDocJSON = await this.getById(newObjectJSON.applicationId);

        if(newObjectJSON.applicationId){
            if(!dbDocJSON){
                log.error(`Cannot find note object to update ` + __location);
            }
            log.debug('Update application notes.');
            newObjectJSON.agencyPortalModifiedUser = userId;
            applicationNotesDoc = await this.updateMongo(dbDocJSON.applicationId,newObjectJSON);
        }
        return applicationNotesDoc;
    }

    /**
	 * Insert Model
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @param {object} userId - Agency portal user ID who created this object.
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with
     *   saved application notes , or an Error if rejected
	 */
    async insertMongo(newObjectJSON, userId){
        await validate(newObjectJSON, userId);

        const insertObj = Object.assign({}, newObjectJSON);
        insertObj.agencyPortalCreatedUser = userId;

        const applicationNotes = new ApplicationNotes(insertObj);
        //Insert a doc
        try {
            await applicationNotes.save();
        }
        catch (err) {
            log.error('Mongo Application Notes Save err ' + err + __location);
            throw err;
        }
        return mongoUtils.objCleanup(applicationNotes);
    }

    /**
	 * Update Model
     * @param {applicationId} applicationId -- applicationId
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application notes , or an Error if rejected
	 */
    async updateMongo(applicationId, newObjectJSON) {
        if (!applicationId) {
            throw new Error('no applicationNotes id supplied')
        }
        if (typeof newObjectJSON !== "object") {
            throw new Error(`no newObjectJSON supplied applicationNotes: ${applicationId}`)
        }

        const query = {"applicationId": applicationId};
        let newApplicationNotes = null;
        try {
            const changeNotUpdateList = [
                "applicationId", "agencyPortalCreatedUser"
            ]
            for (let i = 0; i < changeNotUpdateList.length; i++) {
                if (newObjectJSON[changeNotUpdateList[i]]) {
                    delete newObjectJSON[changeNotUpdateList[i]];
                }
            }
            // Add updatedAt
            newObjectJSON.updatedAt = new Date();

            await ApplicationNotes.updateOne(query, newObjectJSON);
            const newAgencyLocationDoc = await ApplicationNotes.findOne(query);

            newApplicationNotes = mongoUtils.objCleanup(newAgencyLocationDoc);
        }
        catch (err) {
            log.error(`Updating application notes error for id: ${applicationId}` + err + __location);
            throw err;
        }

        return newApplicationNotes;
    }

    /**
     * Get Model By Application Id
     * @param {id} id - applicationId
     * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application notes , or an Error if rejected
     */
    async getByApplicationId(id) {
        if(!id){
            throw new Error('no id supplied');
        }
        const query = {'applicationId': id};
        let applicationNotesDoc = null;
        try {
            const docDB = await ApplicationNotes.find(query).sort({createdAt: -1});
            if(docDB){
                applicationNotesDoc = mongoUtils.objCleanup(docDB);
            }
        }
        catch (err) {
            log.error(`Getting Application Notes ${id}` + err + __location);
            throw err;
        }

        for (const note of applicationNotesDoc) {
            const user = await AgencyPortalUser.findOne({agencyPortalUserId: note.agencyPortalCreatedUser});
            if (user) {
                note.agencyPortalCreatedUser = user.email;
            }
            else {
                note.agencyPortalCreatedUser = '';
            }
        }
        return applicationNotesDoc;
    }
}
