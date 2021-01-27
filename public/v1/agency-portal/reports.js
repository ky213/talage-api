const auth = require('./helpers/auth.js');
const serverHelper = require('../../../server.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const mongoose = require('mongoose');
const _ = require('lodash');
const moment = require('moment');

const Application = mongoose.model('Application');
const Quote = mongoose.model('Quote');

/**
 * Keeps only the first 'len' keys in an object. All of the others are
 * consolidated into a new 'Other' key. The new object is returned.
 */
function trimObjectLength(object, len) {
    const newObj = {};
    const keys = Object.keys(object);
    const objLen = Object.keys(object).length;

    for (let i = 0; i < Math.min(objLen, len); i++) {
        newObj[keys[i]] = object[keys[i]];
    }

    if (objLen >= len) {
        newObj.Other = 0;
        for (let i = len; i < objLen; i++) {
            newObj.Other += object[keys[i]];
        }
    }
    return newObj;
}

/**
 * For each application, we will extract the lowest quote amount from the quote
 * list and then return the sum of those quotes.
 */
const sumOfQuotes = (quotes) => {
    const amounts = {};

    for (const q of quotes) {
        if (amounts[q.applicationId] && q.amount > amounts[q.applicationId]) {
            continue;
        }
        amounts[q.applicationId] = q.amount;
    }
    return _.sum(Object.values(amounts));
}

//---------------------------------------------------------------------------//
// Metric functions - These calculate the metrics that are later returned by
// getReports later.
//---------------------------------------------------------------------------//

/**
 * @return True if applications exist.
 */
const hasApplications = async (where) =>
    await Application.countDocuments(where) > 0;


const getGeography = async (where) => {
    const territories = _.chain(await db.queryReadonly(`SELECT abbr, name FROM clw_talage_territories`))
        .keyBy('abbr')
        .mapValues('name')
        .value();
    const geography = await Application.aggregate([
        { $match: where },
        { $group: {
            _id: '$mailingState',
            count: { $sum: 1 }
        }}
    ]);
    return geography.map(t => [
        territories[t._id],
        t.count
    ]).filter(t => t[0]); // This filter removes undefined entries.
}

const getMonthlyTrends = async (where) => {
    const monthlyTrends = await Application.aggregate([
        { $match: where },
        { $group: {
            _id: {
               month: { $month: '$createdAt' },
            },
            count: { $sum: 1 }
        }},
        { $sort: { _id: 1 }}
    ]);
    return monthlyTrends.map(t => ([
        moment(t._id.month, 'M').format('MMMM'),
        t.count
    ]));
}

/** Get the earliest application created date */
const getMinDate = async (where) => {
    const app = await Application
        .find(where, {createdAt: 1})
        .sort({createdAt: 1})
        .limit(1);
    return app[0].createdAt;
}

const getIndustries = async (where) => {
    const industryCodeCategories = _.chain(await db.queryReadonly(`SELECT
            ${db.quoteName('ic.id')},
            ${db.quoteName('icc.name')}
        FROM ${db.quoteName('#__industry_code_categories', 'icc')}
        INNER JOIN ${db.quoteName('#__industry_codes', 'ic')} ON ${db.quoteName('ic.category')} = ${db.quoteName('icc.id')}
        `))
        .keyBy('id')
        .mapValues('name')
        .value();
    const industriesQuery = await Application.aggregate([
        { "$match": where },
        { "$group": {
            "_id": {
                "industryCode": "$industryCode"
            },
            "count": { "$sum": 1 }
        }}
    ])
    let industries = {};
    for (const i of industriesQuery) {
        const id = industryCodeCategories[i._id.industryCode];
        if (industries[id]) {
            industries[id] += i.count;
        } else {
            industries[id] = i.count;
        }
    }
    // Sort industries by the ones with the most applications.
    industries = _.fromPairs(_.sortBy(_.toPairs(industries), 1).reverse())
    // Trim to only 6 entries
    industries = trimObjectLength(industries, 8);
    // Convert to an array.
    return Object.keys(industries).map(k => ([
        k,
        industries[k]
    ]));
}

const getPremium = async (where) => {
    let applications = await Application.find({}, {uuid: 1});
    applications = applications.map(t => t.uuid);

    let agencyApplications = await Application.find(
        Object.assign({}, where, {
            appStatusId: {$gte: 40},
            applicationId: {$in: applications}
        }), {uuid: 1});
    agencyApplications = agencyApplications.map(a => a.uuid);

    // other option: sum up all the quotes
    const bound = await Quote.find({
        $or: [
            {bound: 1},
            {status: 'bind_requested'},
        ],
        applicationId: {$in: agencyApplications}
    }, {
        _id: 1,
        applicationId: 1,
        amount: 1,
        policyType: 1,
    });

    const quoted = await Quote.find({
        $or: [
            {bound: 1},
            {status: 'bind_requested'},
            {api_result: 'quoted'},
            {api_result: 'referred_with_price'},
        ],
        applicationId: {$in: agencyApplications}
    }, {
        _id: 1,
        applicationId: 1,
        amount: 1,
        policyType: 1,
    });

    return {
        quoted: sumOfQuotes(quoted),
        bound: sumOfQuotes(bound),
    }
}

const mysqlDateToJsDate = (date, utcOffset) => {
    return moment(date.substr(1, date.length - 2))
        .utcOffset(utcOffset)
        .toDate()
}

//---------------------------------------------------------------------------//
// getReports - REST API endpoint for Agency Portal dashboard.
//---------------------------------------------------------------------------//

/**
 * Responds to get requests for the reports endpoint
 *
 * @param {object} req - HTTP request object
 *
 * @returns {void}
 */
async function getReports(req) {
    // Get the agents that we are permitted to view
    const agents = await auth.getAgents(req);

    // Get the filter parameters
    let startDate = req.query.startDate;
    let endDate = req.query.endDate;
    let utcOffset = req.query.utcOffset;
    if (!utcOffset) {
        utcOffset = '+00:00';
    }

    // When the static query parameter is set only the queries keyed under 'static' will be executed
    let initialRequest = false;
    if (req.query.initial === 'true') {
        initialRequest = true;
    }

    // Begin by only allowing applications that are not deleted from agencies that are also not deleted
    let where = { active: true };

    // If static data isn't being requested both dates are required
    if (!initialRequest) {
        // Process the dates if they were included in the request or return an error if they werent
        if (startDate && endDate) {
            startDate = mysqlDateToJsDate(
                db.escape(`${startDate.substring(0, 10)} ${startDate.substring(11, 19)}`),
                utcOffset
            );
            endDate = mysqlDateToJsDate(
                db.escape(`${endDate.substring(0, 10)} ${endDate.substring(11, 19)}`),
                utcOffset
            );
            where.createdAt = {
                $gte: startDate,
                $lte: endDate,
            }
        }
        else {
            log.info('Bad Request: Query parameters missing');
            throw serverHelper.requestError('Query parameters missing');
        }
    }

    // Localize data variables that the user is permitted to access
    const agencyNetwork = parseInt(req.authentication.agencyNetworkId, 10);

    // Filter out any agencies with do_not_report value set to true
    if (req.authentication.isAgencyNetworkUser) {
        try {
            const agencyBO = new AgencyBO();
            const donotReportQuery = {doNotReport: true};
            const noReportAgencyList = await agencyBO.getList(donotReportQuery);
            if(noReportAgencyList && noReportAgencyList.length > 0){
                // eslint-disable-next-line prefer-const
                let donotReportAgencyIdArray = []
                for(const agencyJSON of noReportAgencyList){
                    donotReportAgencyIdArray.push(agencyJSON.systemId);
                }
                if (donotReportAgencyIdArray.length > 0) {
                    where.agency = { $nin: donotReportAgencyIdArray };
                }
            }
        }
        catch(err) {
            log.error(`Report Dashboard error getting donotReport list ` + err + __location)
        }
    }

    // This is a very special case. If this is the agent 'Solepro' (ID 12) asking for applications, query differently
    if (!agencyNetwork && agents[0] === 12) {
        where.solepro = 1;
    }
    else {
        where.agencyId = { $in: agents };
    }

    // Define a list of queries to be executed based on the request type
    if (initialRequest) {
        return {
            minDate: await getMinDate(where),
            hasApplications: await hasApplications(where) ? 1 : 0,
        };
    } else {
        return {
            funnel: {
                started: await Application.countDocuments(where),
                completed: await Application.countDocuments(Object.assign({}, where, { appStatusId: {$gt: 10} })),
                quoted: await Application.countDocuments(Object.assign({}, where, { appStatusId: {$gte: 40} })),
                bound: await Application.countDocuments(Object.assign({}, where, { appStatusId: {$gte: 70} })),
            },
            geography: await getGeography(where),
            industries: await getIndustries(where),
            monthlyTrends: await getMonthlyTrends(where),
            premium: await getPremium(where),
        }
    }
}

/**
 * Responds to get requests for the reports endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function wrapAroundExpress(req, res, next) {
    try {
        const out = await getReports(req);
        res.send(200, out);
        return next();
    } catch (err) {
        return next(err);
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get reports', `${basePath}/reports`, wrapAroundExpress, 'dashboard', 'view');
};
