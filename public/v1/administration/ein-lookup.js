const EinLookupService = global.requireShared('./services/businessdatalookupsvc.js')
const openCorporateDataService = global.requireShared('./services/opencorporatesvc.js');
const serverHelper = global.requireRootPath('server.js');

/**
 * Perform EIN lookup
 *
 * @param {*} req req
 * @param {*} res res
 * @param {*} next next
 * @returns {void}
 */
async function einLookup(req, res, next) {
    if (!req.query.businessName || !req.query.state) {
        return next(serverHelper.requestError("You must enter at least a company name and state"));
    }

    try {
        log.warn('The data can only be used by Talage Staff and cannot be given or sold to anyone outside of Talage');
        const einData = await EinLookupService.performCompanyLookup({
            name: req.query.businessName,
            streetAddress: req.query.address,
            city: req.query.city,
            state: req.query.state,
            zipCode: req.query.zipCode
        });
        const openCorporateData = await openCorporateDataService.performCompanyLookup({
            businessName: req.query.businessName,
            state: req.query.state
        });
        res.send(200, einData);
        return next();
    }
    catch (err) {
        return next(serverHelper.requestError("EIN lookup error: " + err.message));
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Company EIN lookup', `${basePath}/ein-lookup`, einLookup, 'TalageAdminUser', 'all');
};
