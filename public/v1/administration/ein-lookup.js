const EinLookupService = global.requireShared('./services/einlookup.js')
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
        const einData = await EinLookupService.performCompanyLookup({
            name: req.query.businessName,
            streetAddress: req.query.address,
            city: req.query.city,
            state: req.query.state,
            zipCode: req.query.zipCode
        });
        res.send(200, einData.map(t => ({
            ein: `${t.IRS_NUMBER.substr(0,2)}-${t.IRS_NUMBER.substr(2)}`,
            businessName: t.CONFORMED_NAME,
            address: `${t.BUSINESS_ADDRESS_STREET1 || t.MAIL_ADDRESS_STREET1 || ''} ${t.BUSINESS_ADDRESS_STREET2 || t.MAIL_ADDRESS_STREET2 || ''}`,
            city: t.BUSINESS_ADDRESS_CITY || t.MAIL_ADDRESS_CITY || '',
            state: t.BUSINESS_ADDRESS_STATE || t.MAIL_ADDRESS_STATE || '',
            zipCode: t.BUSINESS_ADDRESS_ZIP || t.MAIL_ADDRESS_ZIP || ''
        })));
        return next();
    }
    catch (err) {
        return next(serverHelper.requestError("EIN lookup error: " + err.message));
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Company EIN lookup', `${basePath}/ein-lookup`, einLookup, 'TalageAdminUser', 'all');
};
