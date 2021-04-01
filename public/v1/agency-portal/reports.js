/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable object-curly-spacing */
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = require('../../../server.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const mongoose = require('mongoose');
const _ = require('lodash');
const moment = require('moment');

const Application = mongoose.model('Application');
//const Quote = mongoose.model('Quote');

// eslint-disable-next-line valid-jsdoc
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

// eslint-disable-next-line valid-jsdoc
/**
 * For each application, we will extract the lowest quote amount from the quote
 * list and then return the sum of those quotes.
 */
// const sumOfQuotes = (quotes) => {
//     const amounts = {};

//     for (const q of quotes) {
//         if (amounts[q.applicationId] && q.amount > amounts[q.applicationId]) {
//             continue;
//         }
//         amounts[q.applicationId] = q.amount;
//     }
//     return _.sum(Object.values(amounts));
// }

const mysqlDateToJsDate = (date, offSetHours) => moment(date).
    add(-1 * offSetHours, 'h').
    toDate()

// eslint-disable-next-line valid-jsdoc
/** Round to 2 decimal places. */
const roundCurrency = n => Math.round(n * 100.0) / 100.0;

//---------------------------------------------------------------------------//
// Metric functions - These calculate the metrics that are later returned by
// getReports later.
//---------------------------------------------------------------------------//

// eslint-disable-next-line valid-jsdoc
/**
 * @return True if applications exist.
 */
const hasApplications = async(where) => await Application.countDocuments(where) > 0;


const getGeography = async(where) => {
    const territories = _.chain(await db.queryReadonly(`SELECT abbr, name FROM clw_talage_territories`)).
        keyBy('abbr').
        mapValues('name').
        value();
    const geography = await Application.aggregate([
        {$match: where}, {$group: {
            _id: '$mailingState',
            count: {$sum: 1}
        }}
    ]);
    return geography.map(t => [
        territories[t._id], t.count
    ]).filter(t => t[0]); // This filter removes undefined entries.
}
//default report to America/Los_Angeles (Talage HQ)
// TODO get user's timezone.
const getMonthlyTrends = async(where) => {
    const monthlyTrends = await Application.aggregate([
        {$match: where},
        {$project: {
            creationMonth: {$month: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            creationYear: {$year: {date: '$createdAt', timezone: "America/Los_Angeles"}}
        }},
        {$group: {
            _id: {
                month: '$creationMonth',
                year: '$creationYear'
            },
            count: {$sum: 1}
        }},
        {$sort: {
            '_id.year': 1,
            '_id.month': 1
        }}
    ]);

    return monthlyTrends.map(t => [
        moment(t._id.month, 'M').format('MMMM'), t.count
    ]);
}
// eslint-disable-next-line valid-jsdoc
/** Get the earliest application created date */
const getMinDate = async(where) => {
    const app = await Application.
        find(where, {createdAt: 1}).
        sort({createdAt: 1}).
        limit(1);
    // If this agency has no applications, then return the current date
    if (!app[0]) {
        return new Date();
    }
    return app[0].createdAt;
}

const getIndustries = async(where) => {
    const industryCodeCategories = _.chain(await db.queryReadonly(`SELECT
            ${db.quoteName('ic.id')},
            ${db.quoteName('icc.name')}
        FROM ${db.quoteName('#__industry_code_categories', 'icc')}
        INNER JOIN ${db.quoteName('#__industry_codes', 'ic')} ON ${db.quoteName('ic.category')} = ${db.quoteName('icc.id')}
        `)).
        keyBy('id').
        mapValues('name').
        value();
    const industriesQuery = await Application.aggregate([
        {"$match": where}, {"$group": {
            "_id": {"industryCode": "$industryCode"},
            "count": {"$sum": 1}
        }}
    ])
    let industries = {};
    for (const i of industriesQuery) {
        const id = industryCodeCategories[i._id.industryCode];
        if (industries[id]) {
            industries[id] += i.count;
        }
        else {
            industries[id] = i.count;
        }
    }
    // Sort industries by the ones with the most applications.
    industries = _.fromPairs(_.sortBy(_.toPairs(industries), 1).reverse())
    // Trim to only 6 entries
    industries = trimObjectLength(industries, 8);
    // Convert to an array.
    return Object.keys(industries).map(k => [
        k, industries[k]
    ]);
}

const getPremium = async(where) => {
    const bound = async(product) => _.sum((await Application.aggregate([
        {$match: Object.assign({}, where, {appStatusId: {$gte: 40}})}, {$group: {
            _id: '$uuid',
            count: {$sum: '$metrics.lowestBoundQuoteAmount.' + product}
        }}
    ])).map(t => t.count));

    const quoted = async(product) => _.sum((await Application.aggregate([
        {$match: Object.assign({}, where, {appStatusId: {$gte: 40}})}, {$group: {
            _id: '$uuid',
            count: {$sum: '$metrics.lowestQuoteAmount.' + product}
        }}
    ])).map(t => t.count));

    return {
        quoted: roundCurrency(await quoted('WC') + await quoted('GL') + await quoted('BOP')),
        bound: roundCurrency(await bound('WC') + await bound('GL') + await bound('BOP'))
    };
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
    let agents = await auth.getAgents(req);

    // Get the filter parameters
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    let utcOffset = req.query.utcOffset;
    if (!utcOffset) {
        utcOffset = '+00:00';
    }
    const offSetParts = utcOffset.split(":");
    let offSetHours = 0;
    if(offSetParts.length > 0){
        offSetHours = parseInt(offSetParts[0],10);
    }

    // When the static query parameter is set only the queries keyed under 'static' will be executed
    let initialRequest = false;
    if (req.query.initial === 'true') {
        initialRequest = true;
    }

    // Begin by only allowing applications that are not deleted from agencies that are also not deleted
    const where = {active: true};

    // If static data isn't being requested both dates are required
    if (!initialRequest) {
        // Process the dates if they were included in the request or return an error if they werent
        if (startDate && endDate) {
            where.createdAt = {
                $gte: mysqlDateToJsDate(startDate, offSetHours),
                $lte: mysqlDateToJsDate(endDate, offSetHours)
            };
        }
        else {
            log.info('Bad Request: Query parameters missing');
            throw serverHelper.requestError('Query parameters missing');
        }
    }

    // Localize data variables that the user is permitted to access
    const agencyNetworkId = parseInt(req.authentication.agencyNetworkId, 10);

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
                    log.debug("donotReportAgencyIdArray " + donotReportAgencyIdArray)
                    //where.agency = { $nin: donotReportAgencyIdArray };
                    //need to remove values from Agents array.
                    // eslint-disable-next-line no-unused-vars
                    agents = agents.filter(function(value, index, arr){
                        return donotReportAgencyIdArray.indexOf(value) === -1;
                    });
                }
                where.agencyId = {$in: agents};
                //check for all
                if(req.authentication.isAgencyNetworkUser && agencyNetworkId === 1 && req.query.all && req.query.all === '12332'){
                    if(where.agencyId){
                        delete where.agencyId;
                    }

                    if(donotReportAgencyIdArray.length > 0){
                        where.agencyId = {$nin: donotReportAgencyIdArray};
                    }
                }
            }
            else if(req.authentication.isAgencyNetworkUser && agencyNetworkId === 1 && req.query.all && req.query.all === '12332'){
                if(where.agencyId){
                    delete where.agencyId;
                }
            }
            else {
                where.agencyNetworkId = agencyNetworkId
            }
            log.debug("Report AgencyNetwork User where " + JSON.stringify(where) + __location)
        }
        catch(err) {
            log.error(`Report Dashboard error getting donotReport list ` + err + __location)
        }
    }
    else {
        // This is a very special case. If this is the agent 'Solepro' (ID 12) asking for applications, query differently
        // eslint-disable-next-line no-lonely-if
        if (!agencyNetworkId && agents[0] === 12) {
            where.solepro = 1;
        }
        else {
            where.agencyId = {$in: agents};
        }
    }
    //log.debug("Where " + JSON.stringify(where))
    // Define a list of queries to be executed based on the request type
    if (initialRequest) {
        return {
            minDate: await getMinDate(where),
            hasApplications: await hasApplications(where) ? 1 : 0
        };
    }
    else {
        return {
            funnel: {
                started: await Application.countDocuments(where),
                completed: await Application.countDocuments(Object.assign({}, where, {appStatusId: {$gt: 10}})),
                quoted: await Application.countDocuments(Object.assign({}, where, {appStatusId: {$gte: 40}})),
                bound: await Application.countDocuments(Object.assign({}, where, {appStatusId: {$gte: 70}}))
            },
            geography: await getGeography(where),
            industries: await getIndustries(where),
            monthlyTrends: await getMonthlyTrends(where),
            premium: await getPremium(where)
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
    }
    catch (err) {
        log.error("wrapAroundExpress error: " + err + __location);
        return next(err);
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get reports', `${basePath}/reports`, wrapAroundExpress, 'dashboard', 'view');
};