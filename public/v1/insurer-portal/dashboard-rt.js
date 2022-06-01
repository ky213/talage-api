// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const Quote = global.mongoose.Quote;
const moment = require('moment');

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
    const insurerId = parseInt(req.authentication.insurerId, 10);

    const startDate = moment(req.query.startDate, 'YYYY/MM/DD').tz("America/Los_Angeles").startOf('day').toDate();
    const endDate = moment(req.query.endDate, 'YYYY/MM/DD').tz("America/Los_Angeles").startOf('day').toDate();

    const queryMatch = {
        insurerId: insurerId,
        createdAt: {
            $gte: startDate,
            $lte: endDate
        }
    };
    if (req.query.amount) {
        queryMatch.amount = {$gte: parseFloat(req.query.amount)}
    }
    if (req.query.status) {
        switch (req.query.status) {
            case 'Request to Bind':
                queryMatch.quoteStatusId = {$gte: 60};
                break;
            case 'Bound':
                queryMatch.quoteStatusId = {$gte: 100};
                break;
            case 'Quoted':
            default:
                queryMatch.quoteStatusId = {$gte: 50};
                break;
        }
    }

    // Carrier industry name needs to be returned.
    const classCodes = await Quote.aggregate([
        {$match: queryMatch},
        {$lookup:
        {
            from: "applications",
            localField: "applicationId",
            foreignField: "applicationId",
            as: "application"
        }},
        // This is a hack because industryId is often a string in the application collection but
        // an integer in the industrycodes collection. So we need to cast it to int first.
        {$project:
        {
            application: {$arrayElemAt: ["$application", 0]},
            amount: 1
        }},
        {$project:
        {
            industryCodeId: {$toInt: '$application.industryCode'},
            amount: 1
        }},
        {$lookup:
            {
                from: "industrycodes",
                localField: "industryCodeId",
                foreignField: "industryCodeId",
                as: "industrycode"
            }},
        {$group: {
            _id: {
                industryCode: '$industryCodeId',
                description: '$industrycode.description'
            },
            amount: {$sum: '$amount'}
        }},
        {$sort: {amount: -1}},
        {$replaceRoot: {newRoot: {$mergeObjects: [{"amount": "$amount"}, "$_id"]}}},
        {$project:
            {
                description: {$arrayElemAt: ["$description", 0]},
                amount: 1
            }}
    ]);

    const monthlyCount = await Quote.aggregate([
        {$match: queryMatch},
        {$project: {
            creationMonth: {$month: {
                date: '$createdAt',
                timezone: "America/Los_Angeles"
            }},
            creationYear: {$year: {
                date: '$createdAt',
                timezone: "America/Los_Angeles"
            }},
            insurerId: 1,
            amount: 1
        }},
        {$group: {
            _id: {
                month: '$creationMonth',
                year: '$creationYear',
                insurerId: '$insurerId'
            },
            count: {$sum: '$amount'}
        }},
        {$sort: {
            '_id.insurerId': 1,
            '_id.year': 1,
            '_id.month': 1
        }},
        {$replaceRoot: {newRoot: {$mergeObjects:
                    [{"count": "$count"}, "$_id"]}}}
    ]);

    // Application Premium per State
    const appsByState = await Quote.aggregate([
        {$match: queryMatch},
        {$lookup:
        {
            from: "applications",
            localField: "applicationId",
            foreignField: "applicationId",
            as: "application"
        }},
        {$group: {
            _id: {state: '$application.primaryState'},
            amount: {$sum: '$amount'}
        }}
    ]);

    const totalApplications = await Quote.aggregate([
        {$match: queryMatch},
        {$lookup:
        {
            from: "applications",
            localField: "applicationId",
            foreignField: "applicationId",
            as: "application"
        }},
        {$count: 'count'},
        {$replaceRoot: {newRoot: {$mergeObjects: [{"amount": "$count"}, "$_id"]}}}
    ]);

    const getQuoteAmount = (quoteStatusId) => Quote.aggregate([
        {$match: Object.assign({}, queryMatch, {quoteStatusId: {$gte: quoteStatusId}})},
        {$lookup:
        {
            from: "applications",
            localField: "applicationId",
            foreignField: "applicationId",
            as: "application"
        }},
        {$group: {
            _id: null,
            totalAmount: {$sum: '$amount'}
        }}
    ]);

    const premiumQuoted = await getQuoteAmount(50); //status === quoted
    const premiumRequestBound = await getQuoteAmount(60); //status === request bound
    const premiumBound = await getQuoteAmount(100); //status === bound

    res.send({
        monthlyCount: monthlyCount,
        appsByState: appsByState.
            filter(t => t.amount !== 0 && t?._id?.state?.[0]).
            map(t => ({
                state: t?._id?.state?.[0],
                amount: t.amount
            })),
        classCodes: classCodes.
            filter(t => t.amount !== 0),
        totalApplications: totalApplications?.[0]?.amount,
        premiumQuoted: premiumQuoted?.[0]?.totalAmount,
        premiumRequestBound: premiumRequestBound?.[0]?.totalAmount,
        premiumBound: premiumBound?.[0]?.totalAmount
    });
    next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetInsurerPortalAuth('Insurer Portal Dashboard', `${basePath}/dashboard`, getDashboard, 'dashboard', 'view');
};
