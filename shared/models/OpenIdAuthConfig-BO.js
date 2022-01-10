const OpenIdAuthConfig = global.mongodb.model('OpenIdAuthConfig');

module.exports = class OpenIdAuthConfigBO {
    async getById(id) {
        // Check redis first
        const redisKey = `openid-auth-config-${id}`;
        const resp = await global.redisSvc.getKeyValue(redisKey);

        if (resp.found) {
            return JSON.parse(resp.value);
        }

        // Cache miss
        const obj = await OpenIdAuthConfig.findOne({configId: id});

        // Save in redis
        await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(obj), 3600);
        return obj;
    }
};