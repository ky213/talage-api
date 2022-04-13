// eslint-disable-next-line no-unused-vars
const ApiKey = global.mongoose.ApiKey;
const uuid = require('uuid');
const crypto = require('crypto');
const moment = require('moment');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
const jwt = require('jsonwebtoken');
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const AgencyPortalUserBO = global.requireShared('./models/AgencyPortalUser-BO.js');

module.exports = class ApiKeyBO{

    /**
     * Creates a new API key and secret for the specified user.
     * @param {*} agencyPortalUser Agency portal user ID
     * @returns {*} New key
     */
    async createApiKeySet(agencyPortalUser) {
        const keyId = uuid.v4();
        const keySecret = crypto.randomBytes(256).toString('base64');

        const salt = crypto.randomBytes(16).toString('base64');
        const hash = crypto.createHmac('sha512', salt).update(keySecret).digest('base64');

        const newApiKey = await ApiKey.create({
            agencyPortalUser: agencyPortalUser,
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
     * @param {*} agencyPortalUser Agency portal user ID
     * @returns {*} List of API keys
     */
    async getApiKeysForUser(agencyPortalUser) {
        return mongoUtils.objListCleanup(await ApiKey.find({agencyPortalUser: agencyPortalUser})).map(t => {
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
            agencyPortalUser: userId,
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

        const token = `Bearer ${jwt.sign({userID: curApiKey.agencyPortalUser}, global.settings.AUTH_SECRET_KEY, {expiresIn: '1h'})}`;
        return {
            token: token,
            isSuccess: true
        };
    }

    async isApiKeysEnabled(agencyPortalUserId, keyId = null) {
        // If Agency Portal User ID is not provided
        if(!agencyPortalUserId && keyId){
            const curApiKey = await ApiKey.findOne({keyId: keyId});
            agencyPortalUserId = curApiKey.agencyPortalUser;
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
            agencyPortalUser: userId,
            expirationDate: {$gte: moment()}
        }
        return ApiKey.countDocuments(query);
    }

}
