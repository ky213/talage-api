const serverHelper = global.requireRootPath('server.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const QuoteMongooseModel = global.mongoose.Quote;

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
    const agenciesWithApps = agenciesList.filter(a => a.appCount > 0);
    let quoteList = [];
    try {
        const quotesQuery = {agencyId: {$in: agenciesWithApps.map(a => a.systemId)}};
        // TODO: transfer to BO
        quoteList = await QuoteMongooseModel.find(quotesQuery).lean();
    }
    catch(err){
        log.error("getAgencies load error " + err + __location);
        return next(serverHelper.internalError('Unable to retrieve Agency List'));
    }
    // TODO: Enhance to Aggregation or Denormalizing (to be discussed with Brian & Roger)
    agenciesList = agenciesList.map(agency => {
        const quotesAgencyList = quoteList.filter(quote => quote.agencyId === agency.systemId);
        const quotesAgencyInsurerList = quotesAgencyList.filter(quote => quote.insurerId === insurerId);
        const quotesAgencyInsurerBoundList = quotesAgencyInsurerList.filter(quote => quote.bound);
        return {
            ...agency,
            premiumBound: quotesAgencyInsurerBoundList.filter(quote => quote.amount).reduce((prev, curr) => prev + curr.amount, 0),
            boundApps: quotesAgencyInsurerBoundList.length,
            quotedApps: quotesAgencyInsurerList.filter(quote => quote.quoteStatusId === 50).length,
            totalBoundApps: quotesAgencyList.filter(quote => quote.bound).length,
            totalQuotedApps: quotesAgencyList.filter(quote => quote.quoteStatusId === 50).length
        }
    });
    res.send(200, {
        rows: agenciesList,
        count: agenciesCount
    });
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get Agency list', `${basePath}/agency`, getAgencies, 'agencies', 'view', {insurerPortal: true});
    // server.addGetAuth('Get Agency', `${basePath}/agency/:id`, getAgencies, 'agencies', 'view', {insurerPortal: true});
};