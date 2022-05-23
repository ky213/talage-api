// eslint-disable-next-line no-unused-vars
const serverHelper = global.requireRootPath('server.js');
// const ApplicationMongooseModel = global.mongoose.Application;
// const QuoteMongooseModel = global.mongoose.Quote;
const Quote = global.mongoose.Quote;

/**
 * Responds to get unique quotes for current insurer id the application page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getUniqueQuotes(req, res, next){
    const agrQuery = [
        {$match:
            {
                insurerId: parseInt(req.authentication.insurerId, 10),
                createdAt: {$gte: new Date("2022-01-01T00:08:00.000Z")}
            }},
        {$group:
            {_id:
                {
                    applicationId : "$applicationId",
                    amount : "$amount",
                    quoteStatus: "$quoteStatusDescription",
                    quoteNumber: "$quoteNumber"
                }}},
        {$lookup:
            {
                from : "applications",
                localField : "_id.applicationId",
                foreignField : "applicationId",
                as : "appl"
            }},
        {$project:
            {
                "appl.applicationId": 1,
                "appl.agencyId": 1,
                "appl.status": 1,
                "appl.policies": 1,
                "appl.mailingState": 1,
                "appl.updatedAt": 1,
                "appl.createdAt": 1
            }},
        {$lookup:
            {
                from: "agencies",
                localField: "appl.agencyId",
                foreignField: "systemId",
                as: "agency"
            }},
        {$project:
            {
                "agency._id": 0,
                "agency.additionalInfo": 0,
                "agency.mysqlId": 0,
                "agency.systemId": 0
            }},
        {$unwind:
            {path: "$appl"}},
        {$unwind:
            {path: "$appl.policies"}},
        {$unwind:
            {path: "$agency"}},
        {$replaceRoot:
            {newRoot: {$mergeObjects: [{"quote":"$_id"},
                {"appl":"$appl"},
                {"agency":"$agency"}]}}}
    ]

    if(req.query && req.query.quoteStatus){
        agrQuery[0].$match.quoteStatusDescription = {$in: req.query.quoteStatus}
    }

    try {
        const insurerUniqueQuotes = await Quote.aggregate(agrQuery);
        res.send(200, insurerUniqueQuotes);
    }
    catch(err){
        log.error('Unique Quote Error ' + err + __location);
    }
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetInsurerPortalAuth('Get Unique Quotes by InsurerId', `${basePath}/applications/getuniquequotes`, getUniqueQuotes, 'applications', 'view');
};