const runQuoteRetrieval = require('./run-quote-retrieval');
const Application = require('./models/Application');
const serverHelper = global.requireRootPath('server.js');

const route = async(req, res, next) => {
    try {
        const app = new Application();
        await app.load(req.body);
        await runQuoteRetrieval(app);
    } catch (ex) {
        log.error(`Quote retrieval error ${ex} ` + __location);
        return next(serverHelper.requestError('An error occured while retrieving quotes.'));
    }
    next();
}

exports.registerEndpoints = (server) => {
    server.addPostAuth('Run quote retrieval ', `/v1/run-quote-retrieval`, route);
};