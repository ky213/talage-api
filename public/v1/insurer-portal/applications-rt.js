// eslint-disable-next-line no-unused-vars
const serverHelper = global.requireRootPath('server.js');
// const ApplicationMongooseModel = global.mongoose.Application;
// const QuoteMongooseModel = global.mongoose.Quote;
const Quote = global.mongoose.Quote;
const moment = require('moment');
// eslint-disable-next-line no-unused-vars
const moment_timezone = require('moment-timezone');

/**
 * Returns quote info to populate the "Live Applications" page on insurer-portal.
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getApplications(req, res, next){
    const startDate = moment(req.query.startDate, 'YYYY/MM/DD').tz("America/Los_Angeles").startOf('day').toDate();
    const endDate = moment(req.query.endDate, 'YYYY/MM/DD').tz("America/Los_Angeles").endOf('day').toDate();

    const agrQuery = [
        {$match:
            {
                insurerId: parseInt(req.authentication.insurerId, 10),
                createdAt: {
                    $gte: startDate,
                    $lte: endDate
                }
                // Note: date fields and quoteStatus filter are below.
            }},
        {$group:
            {_id:
                {
                    applicationId : "$applicationId",
                    agencyId: "$quotingAgencyId",
                    amount : "$amount",
                    quoteStatus: "$quoteStatusDescription",
                    quoteNumber: "$quoteNumber",
                    policyType: "$policyType",
                    updatedAt: "$updatedAt",
                    createdAt: "$createdAt"
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
                "appl.status": 1,
                "appl.mailingState": 1
            }},
        {$lookup:
            {
                from: "agencies",
                localField: "_id.agencyId",
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
            {path: "$agency"}},
        {$replaceRoot:
            {newRoot: {$mergeObjects: [{"quote":"$_id"},
                {"appl":"$appl"},
                {"agency":"$agency"}]}}},
        {$sort:
            {'quote.createdAt': -1}}
    ]

    const begin90DayAgo = moment().tz("America/Los_Angeles").subtract(90,'d').startOf('day');
    if(req?.query?.quoteStatus && req?.query?.quoteStatus.includes('Bound')){
        agrQuery[0].$match.boundDate = {$gte: begin90DayAgo.toDate()}
    } else {
        agrQuery[0].$match.createdAt = {$gte: begin90DayAgo.toDate()}
    }
    if(req?.query?.quoteStatus){
        agrQuery[0].$match.quoteStatusDescription = {$in: req.query.quoteStatus}
    }
    try {
        const insurerUniqueQuotes = await Quote.aggregate(agrQuery);
        insurerUniqueQuotes.forEach((QuoteItem) => {
            QuoteItem.quote.createdAt = moment(QuoteItem.quote.createdAt).tz("America/Los_Angeles").format('YYYY-MM-DD');
        });
        res.send(200, insurerUniqueQuotes);
    }
    catch(err){
        log.error('Unique Quote Error ' + err + __location);
    }
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetInsurerPortalAuth('Get Unique Quotes by InsurerId', `${basePath}/applications`, getApplications, 'applications', 'view');
};