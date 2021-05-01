/* eslint-disable prefer-const */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable object-curly-spacing */
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
const mongoose = require('mongoose');
const _ = require('lodash');
const moment = require('moment');

const Application = mongoose.model('Application');
const AgencyBO = global.requireShared(`./models/Agency-BO.js`)
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
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


const getDailyTrends = async(where) => {
    const monthlyTrends = await Application.aggregate([
        {$match: where},
        {$project: {
            creationDay: {$dayOfMonth: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            creationMonth: {$month: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            creationYear: {$year: {date: '$createdAt', timezone: "America/Los_Angeles"}}
        }},
        {$group: {
            _id: {
                day: '$creationDay',
                month: '$creationMonth',
                year: '$creationYear'
            },
            count: {$sum: 1}
        }},
        {$sort: {
            '_id.year': 1,
            '_id.month': 1,
            '_id.day': 1
        }}
    ]);

    return monthlyTrends.map(t => [
        moment(`${t._id.year}-${t._id.month}-${t._id.day}`, 'Y-M-D').format('M-D'), t.count
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

const getAgencyList = async(where,isAgencyNetworkUser) => {
    const agencyBO = new AgencyBO()
    let agencyQuery = {active: true};

    //This should be manditory to have either agencyNetworkId or agencyID
    // otherwise we could leak an agency list between agencyNetworks.
    let goodQuery = false;
    if(where.agencyNetworkId){
        agencyQuery.agencyNetworkId = where.agencyNetworkId
        goodQuery = true;
    }
    if(where.agencyId){
        agencyQuery.systemId = where.agencyId
        goodQuery = true;
    }
    if(goodQuery){
        //log.debug(`agencyQuery: ${JSON.stringify(agencyQuery)} `)
        const agencyList = await agencyBO.getList(agencyQuery).catch(err => {
            log.error(`Report agencyList error ${err}`)
        });
        if(agencyList && agencyList.length > 0){
            let agencyDisplayList = [];
            if(isAgencyNetworkUser && where.agencyNetworkId === 1){
                const displayJSON = {
                    agencyId: -9999,
                    name: "Global View"
                }
                agencyDisplayList.push(displayJSON);
            }
            agencyList.forEach((agencyDoc) => {
                const displayJSON = {
                    agencyId: agencyDoc.systemId,
                    name: agencyDoc.name
                }
                agencyDisplayList.push(displayJSON);
            })
            return agencyDisplayList;
        }
        else {
            return [];
        }
    }
    else {
        return [];
    }
}

const getAgencyLocationList = async(where) => {
    const agencyLocationBO = new AgencyLocationBO()
    const agencyLocQuery = {
        agencyId: where.agencyId
    }
    log.debug("agencyLocQuery " + JSON.stringify(agencyLocQuery))
    const agencyLocList = await agencyLocationBO.getList(agencyLocQuery).catch(err => {
        log.error(`Report getAgencyLocationList error ${err}`)
    });

    if(agencyLocList && agencyLocList.length > 0){
        let agencyLocDisplayList = [];
        log.debug("agencyLocList.length " + agencyLocList.length);
        agencyLocList.forEach((agencyLocDoc) => {
            let name = agencyLocDoc.name;
            if(!name){
                name = `${agencyLocDoc.address} ${agencyLocDoc.city}, ${agencyLocDoc.state} ${agencyLocDoc.zipcode}`;
            }
            const displayJSON = {
                agencyId: agencyLocDoc.agencyId,
                agencyLocationId: agencyLocDoc.systemId,
                name: name
            }
            agencyLocDisplayList.push(displayJSON);
        })
        return agencyLocDisplayList;
    }
    else {
        return [];
    }
}

const getReferredList = async(where) => {
    const pipline = [
        {$match: where},
        {$group: {
            _id: {
                referrer: '$referrer',
                agencyId: '$agencyId'
            },
            count: {$sum: 1}
        }},
        {"$replaceRoot": {
            "newRoot": {
                "$mergeObjects": [{ "count": "$count" }, "$_id"]
            }
        }},
        {$project: {
            agencyId: 1,
            referrer: 1

        }}
    ];
    let referrerList = null;
    try{
        referrerList = await Application.aggregate(pipline);
        referrerList.forEach((referrerJson) => {
            if(!referrerJson.referrer){
                referrerJson.referrer = "AgencyPortal";
            }
        });
    }
    catch(err){
        log.error("Dashboard error getting referrer list " + err + __location)
    }

    if(!referrerList){
        referrerList = [];
    }
    return referrerList;
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
    log.debug(`req.query ${JSON.stringify(req.query)}` + __location)
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
    let monthlyTrend = true

    // If static data isn't being requested both dates are required
    if (!initialRequest) {
        // Process the dates if they were included in the request or return an error if they werent
        if (startDate && endDate) {
            where.createdAt = {
                $gte: mysqlDateToJsDate(startDate, offSetHours),
                $lte: mysqlDateToJsDate(endDate, offSetHours)
            };

            const startMoment = moment(startDate)
            const endMoment = moment(endDate)
            const reportDays = endMoment.diff(startMoment, 'days')
            if(reportDays <= 62){
                monthlyTrend = false;
            }
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
        where.agencyNetworkId = agencyNetworkId // make sure to limit exposure in case something is missed in the logic below.
        try {
            if((req.query.agencyid || req.query.agencylocationid) && req.query.agencyid !== "-9999"){
                log.debug("in agency filter")
                if(where.agencyId){
                    delete where.agencyId
                }
                else if(req.query.agencylocationid){
                    const agencyLocationId = parseInt(req.query.agencylocationid,10);
                    where.agencyLocationId = agencyLocationId;
                }
                else if(req.query.agencyid){
                    const agencyId = parseInt(req.query.agencyid,10);
                    where.agencyId = agencyId;
                }
            }
            else {
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
                        agents = agents.filter(function(value){
                            return donotReportAgencyIdArray.indexOf(value) === -1;
                        });
                        where.agencyId = {$nin: donotReportAgencyIdArray};
                    }
                    //check for all
                    if(req.authentication.isAgencyNetworkUser && agencyNetworkId === 1
                        && (req.query.all === '12332'
                        || (req.query.agencyid === "-9999"))){
                        log.debug('global view 1')
                        if(where.agencyId){
                            delete where.agencyId;
                        }
                        if(where.agencyNetworkId){
                            delete where.agencyNetworkId;
                        }
                        if(donotReportAgencyIdArray.length > 0){
                            where.agencyId = {$nin: donotReportAgencyIdArray};
                        }
                    }

                }
                else if(req.authentication.isAgencyNetworkUser && agencyNetworkId === 1
                        && (req.query.all === '12332'
                        || (req.query.agencyid === "-9999"))){
                    log.debug('global view 2')
                    if(where.agencyId){
                        delete where.agencyId;
                    }
                    if(where.agencyNetworkId){
                        delete where.agencyNetworkId;
                    }
                }
                else {
                    where.agencyNetworkId = agencyNetworkId
                }
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

        if(req.query.agencylocationid){
            const agencyLocationId = parseInt(req.query.agencylocationid,10);
            where.agencyLocationId = agencyLocationId;
        }
    }
    if(req.query.referrer){
        where.referrer = req.query.referrer;
        if(where.referrer === 'AgencyPortal'){
            where.referrer = null;
        }
    }

    //log.debug("Where " + JSON.stringify(where))
    // Define a list of queries to be executed based on the request type
    if (initialRequest) {
        //get list of agencyIds for agencyNetwork.
        //get list of agencyLocations
        //get list of agencyLandingpages.

        return {
            minDate: await getMinDate(where),
            hasApplications: await hasApplications(where) ? 1 : 0,
            "agencyList": await getAgencyList(where, req.authentication.isAgencyNetworkUser),
            "agencyLocationList": await getAgencyLocationList(where),
            "referrerList": await getReferredList(where)
        };
    }
    else {
        //trend monthly or daily ?
        const trendData = monthlyTrend ? await getMonthlyTrends(where) : await getDailyTrends(where);
        return {
            funnel: {
                started: await Application.countDocuments(where),
                completed: await Application.countDocuments(Object.assign({}, where, {appStatusId: {$gt: 10}})),
                quoted: await Application.countDocuments(Object.assign({}, where, {appStatusId: {$gte: 40}})),
                bound: await Application.countDocuments(Object.assign({}, where, {appStatusId: {$gte: 70}}))
            },
            geography: await getGeography(where),
            industries: await getIndustries(where),
            monthlyTrends: trendData,
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