const crypt = global.requireShared('services/crypt.js');
const jwt = require('jsonwebtoken');
const serverHelper = global.requireRootPath('server.js');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const Quote = global.mongoose.Quote;

const ROGER_HARD_CODED_CARRIER = 19;

/**
 * Responds to get requests for an authorization token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token using username/password credentials
 */
async function getDashboard(req, res, next){
    const error = false;

    const insurerMetric = await Quote.aggregate([
        {$match: {
            insurerId: ROGER_HARD_CODED_CARRIER,
            createdAt: {$gte: new Date("2022-01-01T00:08:00.000Z")}
        }},
        {$project: {
            creationMonth: {$month: {
                date: '$createdAt',
                timezone: "America/Los_Angeles"
            }},
            creationYear: {$year: {
                date: '$createdAt',
                timezone: "America/Los_Angeles"
            }},
            quoteStatusId: 1,
            quoteStatusDescription: 1,
            insurerId: 1,
            amount: 1
        }},
        {$group: {
            _id: {
                month: '$creationMonth',
                year: '$creationYear',
                quoteStatusId: '$quoteStatusId',
                quoteStatusDescription: '$quoteStatusDescription',
                insurerId: '$insurerId'
            },
            count: {$sum: 1},
            premium: {$sum: '$amount'}
        }},
        {$sort: {
            '_id.insurerId': 1,
            '_id.year': 1,
            '_id.month': 1,
            '_id.quoteStatusId': 1,
            '_id.quoteStatusDescription': 1
        }},
        {"$replaceRoot": {"newRoot": {"$mergeObjects": ["$_id", {
            "count": "$count" ,
            "Premium": "$premium"
        }]}}}
    ]);

    const monthlyCount = await Quote.aggregate([
        {$match: {
            insurerId: ROGER_HARD_CODED_CARRIER,
            createdAt: {$gte: new Date("2021-01-01T00:08:00.000Z")}
        }},
        {$project: {
            creationMonth: {$month: {
                date: '$createdAt',
                timezone: "America/Los_Angeles"
            }},
            creationYear: {$year: {
                date: '$createdAt',
                timezone: "America/Los_Angeles"
            }},
            insurerId: 1
        }},
        {$group: {
            _id: {
                month: '$creationMonth',
                year: '$creationYear',
                insurerId: '$insurerId'
            },
            count: {$sum: 1}
        }},
        {$sort: {
            '_id.insurerId': 1,
            '_id.year': 1,
            '_id.month': 1
        }},
        {$replaceRoot: {newRoot: {$mergeObjects:
                    [{"count": "$count"}, "$_id"]}}}
    ]);

    const statNumbers = await Quote.aggregate([
        {$match: {
            insurerId: ROGER_HARD_CODED_CARRIER,
            createdAt: {$gte: new Date("2021-01-01T00:08:00.000Z")}
        }},
        {$group: {
            _id: {
                aggregatedStatus: '$aggregatedStatus',
                apiResult: '$apiResult'
            },
            count: {$sum: '$amount'}
        }},
        {$sort: {'_id.aggregatedStatus': 1}},
        {$replaceRoot: {newRoot: {$mergeObjects: [{"count": "$count"}, "$_id"]}}}
    ]);

    res.send({
        insurerMetric: insurerMetric,
        monthlyCount: monthlyCount,
        statNumbers: statNumbers
    });
    next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGet('Insurer Portal Dashboard', `${basePath}/dashboard`, async(req, res, next) => {
        try {
            return await getDashboard(req, res, next);
        }
        catch (ex) {
            console.log(ex);
        }
    });
};
