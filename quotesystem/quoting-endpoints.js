const runQuoting = require('./run-quoting');
const Application = require('./models/Application');
const serverHelper = global.requireRootPath('server.js');

const route = async(req, res, next) => {
    const app = new Application();
    try {
        // NOTE: forceQuoting should always be set to 'true' when using this
        // endpoint.
        await app.load(req.body, true);
    }
    catch (ex) {
        log.error(`Quoting: Application load error ${ex} ` + __location);
        return next(serverHelper.requestError('An error occured while retrieving quotes.'));
    }
    // NOTE: Do not use 'await'! Quoting is executed in the background! We do
    // not block before returning.
    doQuoting(app);
    res.send(200, {success: true});
    next();
}

/**
 * Basically an error-handling wrapper around runQuoting() method.
 *
 * @param {object} app - Loaded application.
 * @returns {void}
 */
async function doQuoting(app) {
    try {
        await runQuoting(app);
    }
    catch (ex) {
        log.error(`Quoting error ${ex} ` + __location);
    }
}


// eslint-disable-next-line require-jsdoc
async function getUptime(req, res, next) {
    res.setHeader('content-type', 'application/xml');
    const startTime = process.hrtime();
    // Check the database connection by selecting all active activity codes
    // let error = false;
    // const agencyNetworkBO = new AgencyNetworkBO();
    // await agencyNetworkBO.getById(1).catch(function(e){
    //     log.error(e.message + __location);
    //     error = true;
    // });

    // Calculate the elapsed time
    const elapsed = process.hrtime(startTime)[1] / 1000000;

    // Send the appropriate response
    // if (error) {
    //     res.end(`<pingdom_http_custom_check> <status>DOWN</status> <response_time>${elapsed.toFixed(8)}</response_time> <version>${global.version}</version> </pingdom_http_custom_check>`);
    //     return next();
    // }
    res.end(`<pingdom_http_custom_check> <status>OK</status> <response_time>${elapsed.toFixed(8)}</response_time> <version>${global.version}</version> </pingdom_http_custom_check>`);
    return next();
}

exports.registerEndpoints = (server) => {
    server.addPost('Run quote retrieval ', `/v1/run-quoting`, route);
    server.addGet('Run quote retrieval ', `/quote/uptime`, getUptime);
};