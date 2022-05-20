const moment = require('moment');
const serverHelper = global.requireRootPath('server.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const QuoteMongooseModel = global.mongoose.Quote;
const ApplicationMongooseModel = global.mongoose.Application;

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
    const insurerId = req.authentication.insurerId;
    let agenciesList = [];
    let quoteList = [];
    let appsList = [];
    try {
        const agencyBO = new AgencyBO();
        const agencyListResponse = await agencyBO.getListByInsurerId({}, insurerId);
        agenciesList = agencyListResponse;
        const appsQuery = {
            agencyId: {$in: agenciesList.map(a => a.systemId)},
            createdAt: {
                $gte: startPeriod,
                $lte: endPeriod
            }
        };
        const appsQueryProjection = {
            agencyId: 1,
            appStatusId: 1,
            applicationId: 1
        };
        appsList = await ApplicationMongooseModel.find(appsQuery, appsQueryProjection).lean();
        const quotesQuery = {
            agencyId: {$in: agenciesList.map(a => a.systemId)},
            insurerId: insurerId,
            apiResult: 'quoted',
            applicationId: {$in: appsList.map(a => a.applicationId)}
        };
        const quotesQueryProjection = {
            agencyId: 1,
            insurerId: 1,
            quoteStatusId: 1,
            amount: 1
        };
        quoteList = await QuoteMongooseModel.find(quotesQuery, quotesQueryProjection).lean();
    }
    catch(err){
        log.error("getAgencies load error " + err + __location);
        return next(serverHelper.internalError('Unable to retrieve Agency List'));
    }
    agenciesList = agenciesList.map(agency => {
        const agencyAppList = appsList.filter(app => app.agencyId === agency.systemId);
        const insurerAgencyQuotesQuoted = quoteList.filter((quote) => quote.agencyId === agency.systemId).
            reduce((prev, curr) => {
                const dup = prev.find(a => a.applicationId === curr.applicationId);
                if(!dup || dup.quoteStatusId < curr.quoteStatusId) {
                    prev.push(curr);
                }
                return prev;
            }, []);
        const insurerAgencyQuotesBound = insurerAgencyQuotesQuoted.filter(quote => quote.quoteStatusId === 100);
        return {
            ...agency,
            premiumBound: insurerAgencyQuotesBound.reduce((prev, curr) => prev + (curr.amount || 0), 0),
            boundApps: insurerAgencyQuotesBound.length,
            totalBoundApps: agencyAppList.filter(agencyApp => agencyApp.appStatusId === 90).length,
            premiumQuoted: insurerAgencyQuotesQuoted.reduce((prev, curr) => prev + (curr.amount || 0), 0),
            quotedApps: insurerAgencyQuotesQuoted.length,
            totalQuotedApps: agencyAppList.filter(agencyApp => agencyApp.appStatusId === 60).length
        }
    });
    res.send(200, {
        rows: agenciesList,
        count: agenciesList.length
    });
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetInsurerPortalAuth('Get Agency list', `${basePath}/agency`, getAgencies, 'agencies', 'view');
};