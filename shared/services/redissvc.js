const redis = require("redis");

let redisClient = null;
let redisHost = 'localhost';
let redisPort = 6379;

exports.connect = async() => {
    if(global.settings.USE_REDIS === "NO"){
        return true;
    }


    if(global.settings.REDIS_HOST){
        redisHost = global.settings.REDIS_HOST
    }
    if(global.settings.REDIS_PORT){
        redisPort = global.settings.REDIS_PORT
    }
    const redisOptions = {};
    redisClient = redis.createClient(redisPort, redisHost, redisOptions);

    redisClient.on("connect", function() {
        log.info(`Connected to Redis ${redisHost}:${redisPort}`);
    });

    redisClient.on("error", function(err) {
        log.error("Redis Error " + err + __location);
    });

    return true;
};


exports.test = function() {
    return new Promise(function(fulfill, reject){
        redisClient.time(function(err, data) {
            if(err) {
                reject(err);
            }
            else {
                fulfill(data)
            }
        });
    });
}

exports.getKeyValue = function(key) {
    return new Promise(function(fulfill, reject){
        if(key) {
            redisClient.get(key, function(err, reply) {
                if(err) {
                    log.error(`Redis getKeyValue   error: ` + err + __location);
                    reject(err);
                }
                else {
                    var response = {found: false};
                    if(reply){
                        response = {
                            found: true,
                            value: reply.toString()
                        };
                    }
                    //log.debug("redis service response getKeyValue " + JSON.stringify(response) + ' @file ' + __file + " @line " + __line);
                    fulfill(response);
                }
            });
        }
        else {
            reject(new Error('missing key'));
        }


    });
}

exports.storeKeyValue = function(key, valueString, ttlSeconds) {
    return new Promise(function(fulfill, reject){
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
            redisClient.set(key, valueString, function(err) {
                if (err) {
                    reject(err);
                }
                else {
                    //log.debug("Redis set response: " + JSON.stringify(reply))
                    if (ttlSecondsInt) {
                        redisClient.expire(key, ttlSecondsInt);
                    }
                    fulfill({saved: true});
                }
            });
        }
        else {
            reject(new Error('missing key or value'));
        }
    });
}


exports.deleteKey = function(key) {
    return new Promise(function(fulfill, reject){
        if(key) {
            redisClient.del(key, function(err, reply) {
                if(err) {
                    log.error(`Redis deleteKey   error: ` + err + __location);
                    reject(err);
                }
                else if(reply === 1){
                    fulfill(true);
                }
                else {
                    fulfill(false)
                }
            });
        }
        else {
            reject(new Error('missing key'));
        }
    });
}