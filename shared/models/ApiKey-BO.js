// eslint-disable-next-line no-unused-vars
const ApiKey = global.mongoose.ApiKey;
const uuid = require('uuid');
const crypto = require('crypto');
const moment = require('moment');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
const jwt = require('jsonwebtoken');

module.exports = class ApiKeyBO{

    /**
     * Creates a new API key and secret for the specified user.
     * @param {*} agencyPortalUser 
     * @returns 
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
            expirationDate: moment().add(90, 'days').toDate()
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
     * @param {*} agencyPortalUser 
     * @returns 
     */
    async getApiKeysForUser(agencyPortalUser) {
        return mongoUtils.objListCleanup(await ApiKey.find({
            agencyPortalUser: agencyPortalUser
        })).map(t => {
            delete t.keySecret;
            return t;
        });
    }

    async deleteApiKey(keyId) {
        await ApiKey.deleteOne({keyId: keyId});
    }

    /**
     * Verify that the specified API secret corresponds to the API key passed in. If authentication
     * is successful, also returns a JWT login for that user.
     * @param {*} keyId 
     * @param {*} keySecret 
     * @returns 
     */
    async authenticate(keyId, keySecret) {
        const curApiKey = await ApiKey.findOne({
            keyId: keyId
        });
        const secretFields = curApiKey.keySecret.split('$');
        const salt = secretFields[0];

        const hash = crypto.createHmac('sha512', salt).update(keySecret).digest('base64');
        if (hash !== secretFields[1]) {
            return {isSuccess: false};
        }

        const token = `Bearer ${jwt.sign({userID: curApiKey.agencyPortalUser}, global.settings.AUTH_SECRET_KEY, {expiresIn: '1h'})}`;
        return {
            token: token,
            isSuccess: true
        };
    }
}
