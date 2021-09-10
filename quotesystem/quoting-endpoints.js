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

exports.registerEndpoints = (server) => {
    server.addPostAuth('Run quote retrieval ', `/v1/run-quoting`, route);
};