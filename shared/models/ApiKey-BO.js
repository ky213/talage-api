// eslint-disable-next-line no-unused-vars
const ApiKey = global.mongoose.ApiKey;
const uuid = require('uuid');
const crypto = require('crypto');
const moment = require('moment');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
//const jwt = require('jsonwebtoken');
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const AgencyPortalUserBO = global.requireShared('./models/AgencyPortalUser-BO.js');
const tokenSvc = global.requireShared('./services/tokensvc.js');

module.exports = class ApiKeyBO{

    /**
     * Creates a new API key and secret for the specified user.
     * @param {*} agencyPortalUserId Agency portal user ID
     * @returns {*} New key
     */
    async createApiKeySet(agencyPortalUserId) {
        const keyId = uuid.v4();
        const keySecret = crypto.randomBytes(256).toString('base64');

        const salt = crypto.randomBytes(16).toString('base64');
        const hash = crypto.createHmac('sha512', salt).update(keySecret).digest('base64');

        const newApiKey = await ApiKey.create({
            agencyPortalUserId: agencyPortalUserId,
            keyId: keyId,
            keySecret: salt + '$' + hash,
            expirationDate: moment().add(90, 'days')
        });

        return {
            keyId: keyId,
            keySecret: keySecret,
            createdAt: newApiKey.createdAt,
            expirationDate: newApiKey.expirationDate
        };
    }

    /**
     * Return all API keys for the specified Agency Portal user.
     * @param {*} agencyPortalUserId Agency portal user ID
     * @returns {*} List of API keys
     */
    async getApiKeysForUser(agencyPortalUserId) {
        return mongoUtils.objListCleanup(await ApiKey.find({agencyPortalUserId: agencyPortalUserId})).map(t => {
            delete t.id;
            delete t.keySecret;
            return t;
        });
    }

    /**
     * Deletes the specified API key
     * @param {*} userId User ID
     * @param {*} keyId Key ID
     * @return {void}
     */
    async deleteApiKey(userId, keyId) {
        await ApiKey.deleteOne({
            agencyPortalUserId: userId,
            keyId: keyId
        });
    }

    /**
     * Verify that the specified API secret corresponds to the API key passed in. If authentication
     * is successful, also returns a JWT login for that user.
     * @param {*} keyId Key ID
     * @param {*} keySecret Key Secret
     * @returns {*} Token and whether or not the attempt was successful
     */
    async authenticate(keyId, keySecret) {
        const curApiKey = await ApiKey.findOne({keyId: keyId});
        if(curApiKey){
            const secretFields = curApiKey.keySecret.split('$');
            const salt = secretFields[0];

            const hash = crypto.createHmac('sha512', salt).update(keySecret).digest('base64');
            if (hash !== secretFields[1]) {
                return {isSuccess: false};
            }

            // Make sure API key is not expired.
            if (moment().isAfter(moment(curApiKey.expirationDate))) {
                return {isSuccess: false};
            }

            // Update the Last Used date
            curApiKey.lastUsedDate = moment();
            curApiKey.save();

            // Double check the user is active and not been deleted and agencynetwork still allows api key access
            const accessEnabled = await this.isApiKeysEnabled(curApiKey.agencyPortalUserId)
            if(accessEnabled){
                const payload = {
                    userId: curApiKey.agencyPortalUserId,
                    apiToken: true
                };
                const additionalPayload = {};
                try{
                    //refactor to avoid the double hit to AgencyPortalUserBO
                    const agencyPortalUserBO = new AgencyPortalUserBO();
                    const agencyPortalUserJSON = await agencyPortalUserBO.getById(curApiKey.agencyPortalUserId);
                    const AgencyPortalUserGroupBO = global.requireShared('models/AgencyPortalUserGroup-BO.js');
                    const agencyPortalUserGroupBO = new AgencyPortalUserGroupBO();
                    const agencyPortalUserGroupDB = await agencyPortalUserGroupBO.getById(agencyPortalUserJSON.agencyPortalUserGroupId);
                    additionalPayload.agencyId = agencyPortalUserJSON.agencyId
                    additionalPayload.agencyNetworkId = agencyPortalUserJSON.agencyNetworkId
                    additionalPayload.isAgencyNetworkUser = agencyPortalUserJSON.isAgencyNetworkUser
                    additionalPayload.agencyPortalUserGroupId = agencyPortalUserJSON.agencyPortalUserGroupId
                    additionalPayload.permissions = agencyPortalUserGroupDB?.permissions ? agencyPortalUserGroupDB.permissions : null;
                }
                catch(err){
                    log.error("Error get permissions from Mongo " + err + __location);
                }


                const rawJwt = await tokenSvc.createNewToken(payload, additionalPayload);
                const token = `Bearer ${rawJwt}`;

                return {
                    token: token,
                    isSuccess: true
                };
            }
            else {
                return {isSuccess: false};
            }
        }
        else {
            return {isSuccess: false};
        }
    }

    async isApiKeysEnabled(agencyPortalUserId, keyId = null) {
        // If Agency Portal User ID is not provided
        if(!agencyPortalUserId && keyId){
            const curApiKey = await ApiKey.findOne({keyId: keyId});
            agencyPortalUserId = curApiKey.agencyPortalUserId;
        }

        // Get Agency Portal User Doc based on Agency Portal User Id from API Key Doc
        const agencyPortalUserBO = new AgencyPortalUserBO();
        const agencyPortalUserDoc = await agencyPortalUserBO.getById(agencyPortalUserId);

        // Get Agency Network Doc based on Agency Portal User Doc
        const agencyNetworkBO = new AgencyNetworkBO();
        const agencyNetworkDoc = await agencyNetworkBO.getById(agencyPortalUserDoc.agencyNetworkId);

        // Determine if API Keys are enabled in Agency Network's feature_json
        return agencyNetworkDoc.feature_json && agencyNetworkDoc.feature_json.enableApiKeys === true;
    }

    getActiveKeysCount(userId){
        const query = {
            agencyPortalUserId: userId,
            expirationDate: {$gte: moment()}
        }
        return ApiKey.countDocuments(query);
    }

}
