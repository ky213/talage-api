const runQuoteRetrieval = require('./run-quote-retrieval');
const Application = require('./models/Application');

const route = async (req, res, next) => {
    try {
        const app = new Application();
        await app.load(req.body);
        await runQuoteRetrieval(app);
    } catch (ex) {
        console.log(ex);
        throw ex;
    }
    next();
}

exports.registerEndpoints = (server) => {
    server.addPostAuth('Run quote retrieval ', `/v1/run-quote-retrieval`, route);
};