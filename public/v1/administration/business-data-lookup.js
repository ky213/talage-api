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
async function businessDataLookup(req, res, next) {
    if (!req.query.businessName || !req.query.state) {
        return next(serverHelper.requestError("You must enter at least a company name and state"));
    }

    try {
        log.warn('The data can only be used by Talage Staff and cannot be given or sold to anyone outside of Talage');
        const currCompanyAppJSON = {
            name: req.query.businessName,
            streetAddress: req.query.address,
            city: req.query.city,
            state: req.query.state,
            zipCode: req.query.zipCode
        }
        const openCorporateData = await openCorporateDataService.performCompanyLookup(currCompanyAppJSON);

        res.send(200, openCorporateData);
        return next();
    }
    catch (err) {
        return next(serverHelper.requestError("Business data lookup error: " + err.message));
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Business Data lookup', `${basePath}/business-data-lookup`, businessDataLookup, 'TalageAdminUser', 'all');
    server.addGetAuthAdmin('GET Company EIN lookup - depr', `${basePath}/ein-lookup`, businessDataLookup, 'TalageAdminUser', 'all');
};
