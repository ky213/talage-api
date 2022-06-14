/* eslint-disable prefer-const */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable object-curly-spacing */
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
const _ = require('lodash');
const moment = require('moment');

const Application = global.mongoose.Application;
const Quote = global.mongoose.Quote;
const AgencyBO = global.requireShared(`./models/Agency-BO.js`)
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
//const Quote = global.mongoose.Quote;
const {applicationStatus} = global.requireShared('./models/status/applicationStatus.js');


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

// const mysqlDateToJsDate = (date, offSetHours) => moment(date).
//     add(-1 * offSetHours, 'h').
//     toDate()

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
    const TerritoryBO = global.requireShared('./models/Territory-BO.js');
    const territoryBO = new TerritoryBO();
    const territories = _.chain(await territoryBO.getAbbrNameList()).
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

// ***** App Count  ******
const getMonthlyTrendsAppcount = async(where) => {
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


const getDailyTrendsAppCount = async(where) => {
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
// ***** END AppCount **********

///*****  Quoted Premium *******/
const getMonthlyTrendsQuotedPremium = async(where) => {

    const monthlyTrends = await Application.aggregate([
        {$match: where},
        {$project: {
            creationMonth: {$month: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            creationYear: {$year: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            "metrics.appValue": 1
        }},
        {$group: {
            _id: {
                month: '$creationMonth',
                year: '$creationYear'
            },
            premium: {$sum: '$metrics.appValue'}
        }},
        {$sort: {
            '_id.year': 1,
            '_id.month': 1
        }}
    ]);
    return monthlyTrends.map(t => [
        moment(t._id.month, 'M').format('MMMM'), t.premium
    ]);
}


const getDailyTrendsQuotedPremium = async(where) => {
    const monthlyTrends = await Application.aggregate([
        {$match: where},
        {$project: {
            creationDay: {$dayOfMonth: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            creationMonth: {$month: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            creationYear: {$year: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            "metrics.appValue": 1
        }},
        {$group: {
            _id: {
                day: '$creationDay',
                month: '$creationMonth',
                year: '$creationYear'
            },
            premium: {$sum: '$metrics.appValue'}
        }},
        {$sort: {
            '_id.year': 1,
            '_id.month': 1,
            '_id.day': 1
        }}
    ]);

    return monthlyTrends.map(t => [
        moment(`${t._id.year}-${t._id.month}-${t._id.day}`, 'Y-M-D').format('M-D'), t.premium
    ]);
}
///*****  END Quoted Premium *******/

///*****  request to Bind Premium from Quotes *******/
const getMonthlyTrendsRequestBoundPremium = async(where) => {

    if(where.handledByTalage){
        where.talageWholesale = true
        delete where.handledByTalage;
    }

    const monthlyTrends = await Quote.aggregate([
        {$match: where},
        {$project: {
            creationMonth: {$month: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            creationYear: {$year: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            "amount": 1
        }},
        {$group: {
            _id: {
                month: '$creationMonth',
                year: '$creationYear'
            },
            premium: {$sum: '$amount'}
        }},
        {$sort: {
            '_id.year': 1,
            '_id.month': 1
        }}
    ]);

    return monthlyTrends.map(t => [
        moment(t._id.month, 'M').format('MMMM'), t.premium
    ]);
}


const getDailyTrendsRequestBoundPremium = async(where) => {
    if(where.handledByTalage){
        where.talageWholesale = true
        delete where.handledByTalage;
    }
    const monthlyTrends = await Quote.aggregate([
        {$match: where},
        {$project: {
            creationDay: {$dayOfMonth: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            creationMonth: {$month: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            creationYear: {$year: {date: '$createdAt', timezone: "America/Los_Angeles"}},
            "amount": 1
        }},
        {$group: {
            _id: {
                day: '$creationDay',
                month: '$creationMonth',
                year: '$creationYear'
            },
            premium: {$sum: '$amount'}
        }},
        {$sort: {
            '_id.year': 1,
            '_id.month': 1,
            '_id.day': 1
        }}
    ]);

    return monthlyTrends.map(t => [
        moment(`${t._id.year}-${t._id.month}-${t._id.day}`, 'Y-M-D').format('M-D'), t.premium
    ]);
}
///*****  END Request bind Quoted Premium *******/


///*****  Bound Premium from Quotes *******/
const getMonthlyTrendsBoundPremium = async(where) => {
    if(where.handledByTalage){
        where.talageWholesale = true
        delete where.handledByTalage;
    }
    const monthlyTrends = await Quote.aggregate([
        {$match: where},
        {$project: {
            creationMonth: {$month: {date: '$boundDate', timezone: "America/Los_Angeles"}},
            creationYear: {$year: {date: '$boundDate', timezone: "America/Los_Angeles"}},
            "amount": 1
        }},
        {$group: {
            _id: {
                month: '$creationMonth',
                year: '$creationYear'
            },
            premium: {$sum: '$amount'}
        }},
        {$sort: {
            '_id.year': 1,
            '_id.month': 1
        }}
    ]);

    return monthlyTrends.map(t => [
        moment(t._id.month, 'M').format('MMMM'), t.premium
    ]);
}


const getDailyTrendsBoundPremium = async(where) => {
    if(where.handledByTalage){
        where.talageWholesale = true
        delete where.handledByTalage;
    }
    const monthlyTrends = await Quote.aggregate([
        {$match: where},
        {$project: {
            creationDay: {$dayOfMonth: {date: '$boundDate', timezone: "America/Los_Angeles"}},
            creationMonth: {$month: {date: '$boundDate', timezone: "America/Los_Angeles"}},
            creationYear: {$year: {date: '$boundDate', timezone: "America/Los_Angeles"}},
            "amount": 1
        }},
        {$group: {
            _id: {
                day: '$creationDay',
                month: '$creationMonth',
                year: '$creationYear'
            },
            premium: {$sum: '$amount'}
        }},
        {$sort: {
            '_id.year': 1,
            '_id.month': 1,
            '_id.day': 1
        }}
    ]);

    return monthlyTrends.map(t => [
        moment(`${t._id.year}-${t._id.month}-${t._id.day}`, 'Y-M-D').format('M-D'), t.premium
    ]);
}
///*****  END Quoted Premium *******/


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

const getIndustries = async(where, totalAppCount) => {

    const industriesCountList = await Application.aggregate([
        {"$match": where},
        {"$group": {
            "_id": {"industryCodeId": { '$toInt': "$industryCode"}},
            "count": {"$sum": 1}}},
        {"$project":{_id:0, "industryCodeId":"$_id", count:1}},
        {"$replaceRoot": {
            "newRoot": {
                "$mergeObjects": [{ "count": "$count" }, "$industryCodeId"]
            }
        }},
        {"$lookup":
            {
                from: "industrycodes",
                localField: "industryCodeId",
                foreignField: "industryCodeId",
                as: "industrycode"
            }},
        {
            "$replaceRoot": { newRoot: { $mergeObjects: [{ "count": "$count" },
                { $arrayElemAt: ["$industrycode", 0] },
                "$$ROOT"] } }
        },
        {$lookup:
            {
                from: "industrycodecategories",
                localField: "industryCodeCategoryId",
                foreignField: "industryCodeCategoryId",
                as: "industrycodecategory"
            }},
        {
            $replaceRoot: { newRoot: { $mergeObjects: [{ "count": "$count" },
                { $arrayElemAt: ["$industrycodecategory", 0] },
                "$$ROOT"] } }
        },
        {"$group": {
            "_id": {"name": "$name"},
            "count": {"$sum": "$count"}}},
        {"$replaceRoot": {
            "newRoot": {
                "$mergeObjects": [{ "count": "$count" }, "$_id"]}
        }},
        {"$sort":{count:-1}},
        {"$limit": 8}
    ])


    let industries = {};
    let totalCount = 0;
    for (const countJSON of industriesCountList) {

        if (industries[countJSON.name]) {
            industries[countJSON.name] += countJSON.count;
        }
        else {
            industries[countJSON.name] = countJSON.count;
        }
        totalCount += countJSON.count;
    }
    const otherCount = totalAppCount - totalCount > 0 ? totalAppCount - totalCount : 0;
    industries.Other = otherCount;

    // // Sort industries by the ones with the most applications.
    // industries = _.fromPairs(_.sortBy(_.toPairs(industries), 1).reverse())
    // // Trim to only 6 entries
    // industries = trimObjectLength(industries, 8);
    // Convert to an array.

    return Object.keys(industries).map(k => [
        k, industries[k]
    ]);
}

const getPremium = async(where) => {
    const bound = async(product) => _.sum((await Application.aggregate([
        {$match: Object.assign({}, where, {appStatusId: {$gte: applicationStatus.referred.appStatusId}})}, {$group: {
            _id: '$uuid',
            count: {$sum: '$metrics.lowestBoundQuoteAmount.' + product}
        }}
    ])).map(t => t.count));

    const quoted = async(product) => _.sum((await Application.aggregate([
        {$match: Object.assign({}, where, {appStatusId: {$gte: applicationStatus.priceIndication.appStatusId}})}, {$group: {
            _id: '$uuid',
            count: {$sum: '$metrics.lowestQuoteAmount.' + product}
        }}
    ])).map(t => t.count));

    return {
        quoted: roundCurrency(await quoted('WC') + await quoted('GL') + await quoted('BOP') + await quoted('CYBER') + await quoted('PL')),
        bound: roundCurrency(await bound('WC') + await bound('GL') + await bound('BOP') + await bound('CYBER') + await bound('PL'))
    };
}

const getAgencyList = async(where,req, nameAndIdOnly = false) => {
    const isAgencyNetworkUser = req.authentication.isAgencyNetworkUser;
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
        // backward compatibility if nameAndIdOnly then grab using new functionality else the whole doc
        let agencyList = null;
        if(nameAndIdOnly){
            agencyList = await agencyBO.getNameAndIdList(agencyQuery).catch(err => {
                log.error(`Report agencyList getNameAndIdList error ${err} ${__location}`);
            });
        }
        else {
            agencyList = await agencyBO.getList(agencyQuery).catch(err => {
                log.error(`Report agencyList error ${err}`)
            });
        }
        if(agencyList && agencyList.length > 0){
            let agencyDisplayList = [];
            if(isAgencyNetworkUser && where.agencyNetworkId === 1 && req.authentication.permissions.talageStaff === true){
                const displayJSON = {
                    agencyId: -9999,
                    name: "Global View"
                }
                const channelList = [];
                agencyDisplayList.push(displayJSON);
                // add agency networks. no wheelhouse.
                const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO');
                const agencyNetworkBO = new AgencyNetworkBO();
                const agencyNetworkList = await agencyNetworkBO.getList({})
                for(const agencyNetworkDoc of agencyNetworkList){
                    const anJSON = {
                        agencyId: -1 * agencyNetworkDoc.agencyNetworkId,
                        name: agencyNetworkDoc.name
                    }
                    agencyDisplayList.push(anJSON);
                    const inList = channelList.find((cl) => cl.name === agencyNetworkDoc?.marketingChannel);
                    if(!inList && agencyNetworkDoc.marketingChannel?.trim()){
                        const mcJSON = {
                            agencyId: parseInt(agencyNetworkDoc.agencyNetworkId, 10) * -1 - 10000,
                            name: agencyNetworkDoc.marketingChannel
                        }
                        channelList.push(mcJSON)
                    }
                }
                for(const mc of channelList){
                    agencyDisplayList.push(mc);
                }

                //Talage Wholesale
                const mcJSON = {
                    agencyId: -20001,
                    name: "Talage Wholesale"
                }
                agencyDisplayList.push(mcJSON)

                const mcJSON2 = {
                    agencyId: -15001,
                    name: "Talage Wholesale & Agency"
                }
                agencyDisplayList.push(mcJSON2)
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
    // Get the filter parameters
    let startDate = null;
    let endDate = null;

    //Fix bad dates coming in.
    if(!req.query.startDate || req.query.startDate && req.query.startDate.startsWith('T00:00:00.000')){
        log.debug('AP getReports resetting start date' + __location);
        startDate = moment('2017-01-01').toISOString();
    }
    else {
        startDate = req.query.startDate;
    }

    if(!req.query.endDate || req.query.endDate && req.query.endDate.startsWith('T23:59:59.999')){
        // now....
        log.debug('AP getReports resetting end date' + __location);
        endDate = moment().toISOString();
    }
    else {
        endDate = req.query.endDate;
    }

    let utcOffset = req.query.utcOffset;
    if (!utcOffset) {
        utcOffset = '+00:00';
    }
    // const offSetParts = utcOffset.split(":");
    // let offSetHours = 0;
    // if(offSetParts.length > 0){
    //     offSetHours = parseInt(offSetParts[0],10);
    // }

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
            // where.createdAt = {
            //     $gte: mysqlDateToJsDate(startDate, offSetHours),
            //     $lte: mysqlDateToJsDate(endDate, offSetHours)
            // };

            where.createdAt = {
                $gte: moment(startDate).toDate(),
                $lte: moment(endDate).toDate()
            };
            log.debug(`Date Where ${JSON.stringify(where.createdAt)}`)

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
    const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO');
    const agencyNetworkBO = new AgencyNetworkBO();

    const agencyNetworkUserJson = await agencyNetworkBO.getById(agencyNetworkId);

    // Filter out any agencies with do_not_report value set to true
    if (req.authentication.isAgencyNetworkUser) {
        where.agencyNetworkId = agencyNetworkId // make sure to limit exposure in case something is missed in the logic below.

        try {
            const agencyId = parseInt(req.query.agencyid,10);
            if((req.query.agencyid || req.query.agencylocationid) && agencyId > 0){
                log.debug("in agency filter")
                if(where.agencyId){
                    delete where.agencyId
                }
                else if(req.query.agencylocationid){
                    const agencyLocationId = parseInt(req.query.agencylocationid,10);
                    where.agencyLocationId = agencyLocationId;
                }
                else if(req.query.agencyid){
                    where.agencyId = agencyId;
                }
            }
            else {
                const agencyBO = new AgencyBO();
                const donotReportQuery = {doNotReport: true };
                if(req.query.agencyid === "-9999" || parseInt(req.query.agencyid,10) < -9999 || agencyId === 4){
                    donotReportQuery.systemId = {$ne: 209}
                }
                const noReportAgencyList = await agencyBO.getList(donotReportQuery);
                if(noReportAgencyList && noReportAgencyList.length > 0){
                    // eslint-disable-next-line prefer-const
                    let donotReportAgencyIdArray = []
                    for(const agencyJSON of noReportAgencyList){
                        donotReportAgencyIdArray.push(agencyJSON.systemId);
                    }
                    if (donotReportAgencyIdArray.length > 0) {
                        where.agencyId = {$nin: donotReportAgencyIdArray};
                    }
                    //check for all
                    if(req.authentication.isAgencyNetworkUser && agencyNetworkId === 1
                        && req.authentication.permissions.talageStaff === true
                        && agencyId < 0){
                        log.debug('global view 1')

                        if(where.agencyId){
                            delete where.agencyId;
                        }
                        if(req.query.agencyid === "-9999"){
                            if(where.agencyNetworkId){
                                delete where.agencyNetworkId;
                            }
                        }
                        else if(parseInt(req.query.agencyid,10) === -20001){
                            if(where.agencyNetworkId){
                                delete where.agencyNetworkId;
                            }
                            where.handledByTalage = true;
                        }
                        else if(parseInt(req.query.agencyid,10) === -15001){
                            if(where.agencyNetworkId){
                                delete where.agencyNetworkId;
                            }
                            where.$or = [{"handledByTalage": true}, {agencyId: 1}]
                        }
                        else if(parseInt(req.query.agencyid,10) < -9999){
                            const agencyNetworkIdMC = parseInt(req.query.agencyid, 10) * -1 - 10000;
                            const agencyNetworkDoc = await agencyNetworkBO.getById(agencyNetworkIdMC);
                            if(agencyNetworkDoc){
                                const agencyNetorkIdList = [];
                                const agencyNetworkList = await agencyNetworkBO.getList({marketingChannel: agencyNetworkDoc.marketingChannel });
                                for(const agencyNetworkJson of agencyNetworkList){
                                    agencyNetorkIdList.push(agencyNetworkJson.agencyNetworkId)
                                }
                                where.agencyNetworkId = {$in: agencyNetorkIdList}
                            }
                            else {
                                where.agencyNetworkId = -999
                            }
                        }
                        else {
                            where.agencyNetworkId = -1 * agencyId
                        }
                        if(donotReportAgencyIdArray.length > 0){
                            where.agencyId = {$nin: donotReportAgencyIdArray};
                        }
                    }

                }
                else if(req.authentication.isAgencyNetworkUser && agencyNetworkId === 1
                        && req.authentication.permissions.talageStaff === true
                        && agencyId < 0){
                    log.debug('global view 2')

                    if(where.agencyId){
                        delete where.agencyId;
                    }
                    if(req.query.agencyid === "-9999"){
                        if(where.agencyNetworkId){
                            delete where.agencyNetworkId;
                        }
                    }
                    else {
                        where.agencyNetworkId = -1 * agencyId
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
        // Get the agents that we are permitted to view
        let agents = await auth.getAgents(req);

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

    // log.debug("Where " + JSON.stringify(where))
    // Define a list of queries to be executed based on the request type
    // backward compatibility, make sure behavior doesn't break cached UI
    let reportsInfoAndAgency = false;
    if(req.query.agencyNameAndIdOnly === 'true' || req.query.agencyNameAndIdOnly === true){
        reportsInfoAndAgency = true;
    }
    if (initialRequest) {
        //get list of agencyIds for agencyNetwork.
        //get list of agencyLocations
        //get list of agencyLandingpages.
        if(reportsInfoAndAgency === true){
            const nameAndIdOnly = true;
            return {
                minDate: await getMinDate(where),
                hasApplications: await hasApplications(where) ? 1 : 0,
                agencyList: await getAgencyList(where, req, nameAndIdOnly)
            };
        }
        else {
            return {
                minDate: await getMinDate(where),
                hasApplications: await hasApplications(where) ? 1 : 0,
                "agencyList": await getAgencyList(where, req),
                "agencyLocationList": await getAgencyLocationList(where),
                "referrerList": await getReferredList(where)
            };
        }
    }
    else {
        log.debug(`Report where ${JSON.stringify(where)}` + __location);
        //trend monthly or daily ?
        const startedCount = await Application.countDocuments(where);
        const trendDataAppCount = monthlyTrend ? await getMonthlyTrendsAppcount(where) : await getDailyTrendsAppCount(where);
        const returnDataJson = {
            funnel: {
                started: startedCount,
                completed: await Application.countDocuments(Object.assign({}, where, {appStatusId: {$gt:  applicationStatus.questionsDone.appStatusId}})),
                quoted: await Application.countDocuments(Object.assign({}, where, {appStatusId: {$gte: applicationStatus.priceIndication.appStatusId}})),
                bound: await Application.countDocuments(Object.assign({}, where, {appStatusId: {$gte: applicationStatus.requestToBind.appStatusId}}))
            },
            geography: await getGeography(where),
            industries: await getIndustries(where,startedCount),
            monthlyTrends: trendDataAppCount,
            premium: await getPremium(where)
        }
        // Advanced Graphs - quoted, requested premium and bound.
        // Agency Network feature  -  Initial only Talage Super users.
        if(req.authentication.agencyNetworkId === 1
            && req.authentication.permissions.talageStaff === true
            && agencyNetworkUserJson?.featureJson?.premiumReportGraphs === true){
            //TODO check agencyNetwork feature for user when enable for other agencyNetworkss

            //Quote Trend
            where.appStatusId = {$gte: 50}
            returnDataJson.trendDataQuotedPremium = monthlyTrend ? await getMonthlyTrendsQuotedPremium(where) : await getDailyTrendsQuotedPremium(where);
            delete where.appStatusId

            //requested premium
            where.quoteStatusId = {$gte: 60}
            returnDataJson.trendDataRequestedPremium = monthlyTrend ? await getMonthlyTrendsRequestBoundPremium(where) : await getDailyTrendsRequestBoundPremium(where);

            //Confirmed Bound
            where.quoteStatusId = {$gte: 100}
            returnDataJson.trendDataBoundPremium = monthlyTrend ? await getMonthlyTrendsBoundPremium(where) : await getDailyTrendsBoundPremium(where);

        }
        return returnDataJson
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
async function reportWrapAround(req, res, next) {
    try {
        const out = await getReports(req);
        res.send(200, out);
        return next();
    }
    catch (err) {
        log.error("reportWrapAround error: " + err + __location);
        return next(err);
    }
}

/**
 * Responds to get requests for the agency location and referrer list
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencyLocationAndReferrList(req, res, next){
    log.debug(`authentication: ${JSON.stringify(req.authentication, null, 2)}`)
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: Query parameters missing for getAgencyLocationAndReferrerList' + __location);
        return next(serverHelper.requestError('Query parameters missing'));
    }

    // Check for required parameters
    if (!Object.prototype.hasOwnProperty.call(req.query, 'agencyId') || !req.query.agencyId) {
        log.info('Bad Request: You must specify an agencyId');
        return next(serverHelper.requestError('You must specify a agencyId'));
    }
    const where = {
        active: true
    }
    if(req.authentication.isAgencyNetworkUser && req.query.agencyId){
        where.agencyId = parseInt(req.query.agencyId, 10);
        where.agencyNetworkId = req.authentication.agencyNetworkId;
    }
    else {
        const agencyIdList = req.authentication.agents;
        if(agencyIdList.length > 0){
            where.agencyId = agencyIdList[0];
        }
        else {
            log.error(`Error while trying to retrieve agency info from req.authentication.agents ${req.authentication.agents} ${__location}`);
        }
    }
    let agencyLocationList = [];
    let referrerList = [];
    try {
        agencyLocationList = await getAgencyLocationList(where);
        referrerList = await getReferredList(where);
    }
    catch (err) {
        log.error(`Error while trying to retrieve agency locations and referrerList Error: ${err} ${__location}`);
    }
    const data = {
        'agencyLocationList': agencyLocationList,
        'referrerList': referrerList
    }
    res.send(200, data);
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get reports', `${basePath}/reports`, reportWrapAround, 'dashboard', 'view');
    server.addGetAuth('Get reports', `${basePath}/reports/agency-locations-referrers`, getAgencyLocationAndReferrList, 'dashboard', 'view');
};
