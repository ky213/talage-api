const moment = require('moment');
//const serverHelper = global.requireRootPath('server.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const QuoteMongooseModel = global.mongoose.Quote;
//const ApplicationMongooseModel = global.mongoose.Application;

/**
 * Responds to get requests for the applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencies(req, res, next){
    let startPeriod = moment().tz("America/Los_Angeles").subtract(3,'month').startOf('day');
    if(req.query.startDate){
        try{
            startPeriod = moment(req.query.startDate, 'YYYY/MM/DD').tz("America/Los_Angeles").startOf('day');
        }
        catch(err){
            log.error(`StartPeriod error ${err}` + __location)
        }
    }
    let endPeriod = moment().tz("America/Los_Angeles").endOf('day');
    if(req.query.endDate){
        try{
            endPeriod = moment(req.query.endDate, 'YYYY/MM/DD').tz("America/Los_Angeles").endOf('day');
        }
        catch(err){
            log.error(`EndPeriod error ${err}` + __location)
        }
    }
    const insurerId = parseInt(req.authentication.insurerId, 10);
    let agenciesList = [];
    const agencyResplist = [];
    try {
        const agencyBO = new AgencyBO();
        const agencyListResponse = await agencyBO.getListByInsurerId({}, insurerId);
        //log.debug(`agencyListResponse count: ${agencyListResponse.length}`)
        agenciesList = JSON.parse(JSON.stringify(agencyListResponse));

        for(const agency of agenciesList){
            if(agency.systemId === 1){
                log.debug('Talage Agency')
            }
            agency.agencyId = agency.systemId
            try{
                const quoteAggQuery = [
                    {$match: {
                        quotingAgencyId: agency.agencyId,
                        insurerId: insurerId,
                        createdAt: {
                            $gte: startPeriod.toDate(),
                            $lte: endPeriod.toDate()
                        }
                    }},
                    {$project: {
                        quoteStatusId: 1,
                        quoteStatusDescription: 1,
                        insurerId: 1,
                        amount: 1
                    }},
                    {$group: {
                        _id: {
                            quoteStatusId: '$quoteStatusId',
                            quoteStatusDescription: '$quoteStatusDescription',
                            insurerId: '$insurerId'
                        },
                        count: {$sum: 1},
                        premium: {$sum: '$amount'}
                    }},
                    {$sort: {
                        '_id.quoteStatusId': 1,
                        '_id.quoteStatusDescription': 1
                    }},
                    {$replaceRoot: {"newRoot":
                        {"$mergeObjects": ["$_id", {
                            "count": "$count" ,
                            "Premium": "$premium"
                        }]}}},
                    {$project: {
                        quoteStatusId: 1,
                        quoteStatusDescription: 1,
                        insurerId: 1,
                        count: 1,
                        Premium: 1,
                        quoteRequests : {$cond : [{$in : ["$quoteStatusId", [20,
                            40,
                            50,
                            55,
                            60,
                            58,
                            65,
                            100]]},
                        "$count",
                        null]},
                        declined : {$cond : [{$eq : ["$quoteStatusId", 20]},
                            "$count",
                            null]},
                        referred : {$cond : [{$eq : ["$quoteStatusId", 40]},
                            "$count",
                            null]},
                        quoted : {$cond : [{$in : ["$quoteStatusId", [50,
                            55,
                            60,
                            58,
                            65,
                            100]]},
                        "$count",
                        null]},
                        quotedPremium: {$cond : [{$in : ["$quoteStatusId", [50,
                            55,
                            60,
                            58,
                            65,
                            100]]},
                        "$Premium",
                        null]},
                        bound : {$cond : [{$eq : ["$quoteStatusId", 100]},
                            "$count",
                            null]},
                        boundPremium : {$cond : [{$eq : ["$quoteStatusId", 100]},
                            "$Premium",
                            null]}

                    }},
                    {$group : {
                        _id: {
                            month: '$month',
                            year: '$year'
                        },
                        premium: {$sum: '$amount'},
                        quoteRequestsCount : {$sum : "$quoteRequests"},
                        quotedCount : {$sum : "$quoted"},
                        quotedPremiumAmount:{$sum: "$quotedPremium"},
                        boundCount : {$sum : "$bound"},
                        boundPremiumAmount : {$sum : "$boundPremium"}
                    }},
                    {$sort: {
                        '_id.quoteStatusId': 1,
                        '_id.month': 1
                    }},
                    {$replaceRoot: {"newRoot":
                        {"$mergeObjects": ["$_id", {
                            "quoteRequests": "$quoteRequestsCount" ,
                            "quotedCount": "$quotedCount" ,
                            "quotedPremium": "$quotedPremiumAmount" ,
                            "boundCount": "$boundCount" ,
                            "BoundPremium": "$boundPremiumAmount"
                        }]}}}

                ];

                const quoteNumbers = await QuoteMongooseModel.aggregate(quoteAggQuery);

                //Do not send full agency Talge IP in tiering info
                const agencytest = {
                    "fullName": agency.fullName,
                    "agencyNetworkName": agency.agencyNetworkName,
                    name: agency.name,
                    email: agency.email,
                    phone: agency.phone
                }
                agencyResplist.push(agencytest);
                if(quoteNumbers?.length > 0){
                    agencytest.premiumBound = quoteNumbers[0].BoundPremium
                    agencytest.boundApps = quoteNumbers[0].boundCount
                    agencytest.premiumQuoted = quoteNumbers[0].quotedPremium
                    agencytest.quotedApps = quoteNumbers[0].quotedCount
                }

                const quoteAgencyTotalCountQuery = [
                    {$match: {
                        quotingAgencyId: 1,
                        createdAt: {
                            $gte: startPeriod.toDate(),
                            $lte: endPeriod.toDate()
                        }
                    }},
                    {$project: {
                        quoteStatusId: 1,
                        quoteStatusDescription: 1,
                        quotingAgencyId: 1,
                        amount: 1
                    }},
                    {$group: {
                        _id: {
                            quoteStatusId: '$quoteStatusId',
                            quoteStatusDescription: '$quoteStatusDescription',
                            quotingAgencyId: '$insurerId'
                        },
                        count: {$sum: 1},
                        premium: {$sum: '$amount'}
                    }},
                    {$sort: {
                        '_id.quoteStatusId': 1,
                        '_id.quoteStatusDescription': 1
                    }},
                    {$replaceRoot: {"newRoot":
                        {"$mergeObjects": ["$_id", {
                            "count": "$count" ,
                            "Premium": "$premium"
                        }]}}},
                    {$project: {
                        quoteStatusId: 1,
                        quoteStatusDescription: 1,
                        quotingAgencyId: 1,
                        count: 1,
                        Premium: 1,
                        quoteRequests : {$cond : [{$in : ["$quoteStatusId", [20,
                            40,
                            50,
                            55,
                            60,
                            58,
                            65,
                            100]]},
                        "$count",
                        null]},
                        declined : {$cond : [{$eq : ["$quoteStatusId", 20]},
                            "$count",
                            null]},
                        referred : {$cond : [{$eq : ["$quoteStatusId", 40]},
                            "$count",
                            null]},
                        quoted : {$cond : [{$in : ["$quoteStatusId", [50,
                            55,
                            60,
                            58,
                            65,
                            100]]},
                        "$count",
                        null]},
                        quotedPremium: {$cond : [{$in : ["$quoteStatusId", [50,
                            55,
                            60,
                            58,
                            65,
                            100]]},
                        "$Premium",
                        null]},
                        bound : {$cond : [{$eq : ["$quoteStatusId", 100]},
                            "$count",
                            null]},
                        boundPremium : {$cond : [{$eq : ["$quoteStatusId", 100]},
                            "$Premium",
                            null]}

                    }},
                    {$group : {
                        _id: {
                            month: '$month',
                            year: '$year'
                        },
                        premium: {$sum: '$amount'},
                        quoteRequestsCount : {$sum : "$quoteRequests"},
                        quotedCount : {$sum : "$quoted"},
                        quotedPremiumAmount:{$sum: "$quotedPremium"},
                        boundCount : {$sum : "$bound"},
                        boundPremiumAmount : {$sum : "$boundPremium"}
                    }},
                    {$sort: {
                        '_id.quoteStatusId': 1,
                        '_id.month': 1
                    }},
                    {$replaceRoot: {"newRoot":
                        {"$mergeObjects": ["$_id", {
                            "quoteRequests": "$quoteRequestsCount" ,
                            "quotedCount": "$quotedCount" ,
                            "quotedPremium": "$quotedPremiumAmount" ,
                            "boundCount": "$boundCount" ,
                            "BoundPremium": "$boundPremiumAmount"
                        }]}}}

                ];


                const quoteNumbersTotal = await QuoteMongooseModel.aggregate(quoteAgencyTotalCountQuery);
                if(quoteNumbersTotal?.length > 0){
                    agencytest.totalQuotedApps = quoteNumbersTotal[0].quotedCount
                    agencytest.totalBoundApps = quoteNumbersTotal[0].boundCount
                }
            }
            catch(err){
                log.error("getAgencies load error " + err + __location);
            }

        }
    }
    catch(err){
        log.error("getAgencies load error " + err + __location);
    }
    res.send(200, {
        rows: agencyResplist,
        count: agencyResplist.length
    });
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetInsurerPortalAuth('Get Agency list', `${basePath}/agency`, getAgencies, 'agencies', 'view');
};