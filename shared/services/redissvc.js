/* eslint-disable require-jsdoc */

// eslint-disable-next-line no-unused-vars
const redis = require("redis");
const asyncRedis = require("async-redis");
const utility = global.requireShared('./helpers/utility.js');

let redisClient = null;
let redisClientReadyOnly = null;

let redisHost = 'localhost';
let redisPort = 6379;
let usingOneConnect = false;
async function connect() {

    if(global.settings.USE_REDIS === "NO"){
        return true;
    }
    let redisConnect = false;

    if(global.settings.REDIS_HOST){
        redisHost = global.settings.REDIS_HOST
    }
    if(global.settings.REDIS_PORT){
        redisPort = global.settings.REDIS_PORT
    }
    const redisOptions = {};
    redisClient = asyncRedis.createClient(redisPort, redisHost, redisOptions);
    //redisClientAsync = asyncRedis.decorate(redisClient);

    redisClient.on("connect", function() {
        log.info(`Connected to Redis ${redisHost}:${redisPort}`);
        redisConnect = true;
    });

    redisClient.on("error", function(err) {
        log.error("Redis Error " + err + __location);
    });

    // eslint-disable-next-line no-unmodified-loop-condition
    while(redisConnect === false){
        await utility.Sleep(50);
    }

    return true;
}


async function connectReadOnly() {
    if(global.settings.USE_REDIS === "NO"){
        return true;
    }
    let redisConnect = false;
    // //default to general purpose connect
    // if(global.settings.REDIS_HOST){
    //     redisHost = global.settings.REDIS_HOST
    // }
    // if(global.settings.REDIS_PORT){
    //     redisPort = global.settings.REDIS_PORT
    // }
    if(global.settings.REDIS_HOST_READONLY && global.settings.REDIS_PORT_ONLY){
        // use Readonly connect if we have it.
        if(global.settings.REDIS_HOST_READONLY){
            redisHost = global.settings.REDIS_HOST_READONLY
        }
        if(global.settings.REDIS_PORT_ONLY){
            redisPort = global.settings.REDIS_PORT_ONLY
        }

        const redisOptions = {};
        redisClientReadyOnly = asyncRedis.createClient(redisPort, redisHost, redisOptions);
        // redisClientReadyOnlyAsync = asyncRedis.decorate(redisClient);

        redisClientReadyOnly.on("connect", function() {
            log.info(`Connected to Redis ${redisHost}:${redisPort}`);
            redisConnect = true;
        });

        redisClientReadyOnly.on("error", function(err) {
            log.error("Redis Error " + err + __location);
        });

        // eslint-disable-next-line no-unmodified-loop-condition
        while(redisConnect === false){
            await utility.Sleep(50);
        }
    }
    else if(redisClient){
        redisClientReadyOnly = redisClient
        usingOneConnect = true;
    }

    return true;
}

async function test() {
    let data = null;
    try{
        data = await redisClientReadyOnly.time();
    }
    catch(err){
        log.error(`Redis Svc time error ${err}` + __location)
    }

    return data;
}

async function getKeyValue(key) {

    if(key) {
        let reply = null;
        const numOftries = 3;
        for(let i = 0; i < numOftries; i++){
            try{
                reply = await redisClientReadyOnly.get(key);
                break;
            }
            catch(err){
                log.error(`Redis getKeyValue redisClientReadyOnly error: ` + err + __location);
                if(i > numOftries - 2){
                    throw err;
                }
            }
            //no reply (failure) try read/write connection.
            //may be in middle of node switch (patch or failover)
            // one of the connections should alway be up.
            if(usingOneConnect === false){
                try{
                    reply = await redisClient.get(key);
                    break;
                }
                catch(err){
                    log.error(`Redis getKeyValue redisClient error: ` + err + __location);
                }
            }
            //pause 50 milliseconds and reconnect
            //might be need a new readonly node url.
            log.debug(`Waiting to reconnect to Redis getKeyValue`);
            await utility.Sleep(50);
            if(usingOneConnect === false){
                await connectReadOnly();
            }
            else {
                await connect();
            }
        }
        var response = {found: false};
        if(reply){
            response = {
                found: true,
                value: reply.toString()
            };
        }
        return response;
    }
    else {
        throw new Error('missing key');
    }


}

async function storeKeyValue(key, valueString, ttlSeconds) {

    let ttlSecondsInt = null;
    if(key && valueString) {
        try {
            if(ttlSeconds){
                ttlSecondsInt = parseInt(ttlSeconds,10);
            }
        }
        catch (e) {
            log.error('Redis storeKeyValue getting ttlSeconds error: ' + e);
        }
        const numOftries = 3;
        for(let i = 0; i < numOftries; i++){
            try{
                await redisClient.set(key, valueString)
                //log.debug("Redis set response: " + JSON.stringify(reply))
                if (ttlSecondsInt) {
                    await redisClient.expire(key, ttlSecondsInt);
                }
                break;
            }
            catch(err){
                log.error(`Redis getKeyValue   error: ` + err + __location);
                if(i > numOftries - 2){
                    throw err;
                }
            }
            if(i === 0){
                //might have change primary(writer) nodes.
                // pause 50 milliseconds as reconect
                await utility.Sleep(50);
            }
            else if(i === 1){
                // might be in the middle of the switch over of nodes
                // pause 2 seconds and reconnect
                await utility.Sleep(2000);

            }
            await connect();
        }
        return {saved: true};
    }
    else {
        throw new Error('missing key or value');
    }

}


async function deleteKey(key) {

    if(key) {
        let reply = null;
        try{
            reply = await redisClient.del(key);
        }
        catch(err){
            log.error(`Redis deleteKey   error: ` + err + __location);
            throw err;
        }
        if(reply === 1){
            return true;
        }
        else {
            return false;
        }
    }

}


module.exports = {
    connect: connect,
    connectReadOnly: connectReadOnly,
    test: test,
    getKeyValue: getKeyValue,
    storeKeyValue: storeKeyValue,
    deleteKey: deleteKey
}