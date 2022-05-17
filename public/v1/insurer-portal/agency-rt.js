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
    const insurerId = req.authentication.insurerId;
    const agencyBO = new AgencyBO();
    let agenciesList = [];
    let agenciesCount = 0;
    try {
        const agencyListResponse = await agencyBO.getListByInsurerId({}, insurerId);
        agenciesList = agencyListResponse.rows;
        agenciesCount = agencyListResponse.count;
    }
    catch(err){
        log.error("getAgencies load error " + err + __location);
        return next(serverHelper.internalError('Unable to retrieve Agency List'));
    }
    let quoteList = [];
    let appsList = [];
    try {
        const quotesQuery = {
            agencyId: {$in: agenciesList.map(a => a.systemId)},
            insurerId: insurerId,
            apiResult: 'quoted'
        };
        const quotesQueryProjection = {
            agencyId: 1,
            insurerId: 1,
            quoteStatusId: 1,
            amount: 1
        };
        const appsQuery = {agencyId: {$in: agenciesList.map(a => a.systemId)}};
        const appsQueryProjection = {
            agencyId: 1,
            appStatusId: 1,
            applicationId: 1
        };
        quoteList = await QuoteMongooseModel.find(quotesQuery, quotesQueryProjection).lean();
        appsList = await ApplicationMongooseModel.find(appsQuery, appsQueryProjection).lean();
    }
    catch(err){
        log.error("getAgencies load error " + err + __location);
        return next(serverHelper.internalError('Unable to retrieve Agency List'));
    }
    // TODO: Enhance to Aggregation or Denormalizing (to be discussed with Brian & Roger)
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
        count: agenciesCount
    });
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetInsurerPortalAuth('Get Agency list', `${basePath}/agency`, getAgencies, 'agencies', 'view');
};