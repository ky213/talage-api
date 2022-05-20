// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const Quote = global.mongoose.Quote;

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

    const monthlyCount = await Quote.aggregate([
        {$match: {
            insurerId: insurerId,
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

    const appsByState = await Quote.aggregate([
        {$match: {
            insurerId: insurerId,
            createdAt: {$gte: new Date("2021-01-01T00:08:00.000Z")}
        }},
        {$lookup:
        {
            from: "applications",
            localField: "applicationId",
            foreignField: "applicationId",
            as: "application"
        }},
        {$group: {
            _id: {state: '$application.mailingState'},
            amount: {$sum: '$amount'}
        }}
    ]);

    const classCodes = await Quote.aggregate([
        {$match: {
            insurerId: insurerId,
            createdAt: {$gte: new Date("2021-01-01T00:08:00.000Z")}
        }},
        {$lookup:
        {
            from: "applications",
            localField: "applicationId",
            foreignField: "applicationId",
            as: "application"
        }},
        {$group: {
            _id: {industryCode: '$application.industryCode'},
            amount: {$sum: '$amount'}
        }},
        {$replaceRoot: {newRoot: {$mergeObjects: [{"amount": "$amount"}, "$_id"]}}}
    ]);

    const totalApplications = await Quote.aggregate([
        {$match: {
            insurerId: insurerId,
            createdAt: {$gte: new Date("2021-01-01T00:08:00.000Z")}
        }},
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
        {$match: {
            quoteStatusId: quoteStatusId,
            insurerId: insurerId,
            createdAt: {$gte: new Date("2021-01-01T00:08:00.000Z")}
        }},
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
    const premiumRequestBound = await getQuoteAmount(60); //status === quoted


    res.send({
        monthlyCount: monthlyCount,
        appsByState: appsByState.
            filter(t => t.amount !== 0).
            map(t => ({
                state: t?._id?.state?.[0],
                amount: t.amount
            })),
        classCodes: classCodes.
            filter(t => t.amount !== 0).
            map(t => ({
                industryCode: t?.industryCode?.[0],
                amount: t.amount
            })),
        totalApplications: totalApplications?.[0]?.amount,
        premiumQuoted: premiumQuoted?.[0]?.totalAmount,
        premiumRequestBound: premiumRequestBound?.[0]?.totalAmount
    });
    next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetInsurerPortalAuth('Insurer Portal Dashboard', `${basePath}/dashboard`, getDashboard, 'dashboard', 'view');
};
