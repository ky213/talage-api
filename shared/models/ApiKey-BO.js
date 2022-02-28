// eslint-disable-next-line no-unused-vars
const ApiKey = global.mongoose.ApiKey;
const uuid = require('uuid');
const crypto = require('crypto');
const moment = require('moment');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

module.exports = class ApiKeyBO{

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

    async authenticate(keyId, keySecret) {
        const curApiKey = await ApiKey.findOne({
            keyId: keyId
        });
        const secretFields = curApiKey.keySecret.split('$');
        const salt = secretFields[0];

        const hash = crypto.createHmac('sha512', salt).update(keySecret).digest('base64');

        return hash === secretFields[1];
    }
}
