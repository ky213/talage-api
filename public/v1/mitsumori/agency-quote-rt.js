"use strict";
const AgencyBO = global.requireShared('./models/Agency-BO.js');

/**
 * Responds to GET requests and returns agency id from slug
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgency(req, res, next) {
    if (!req.query.slug) {
        res.send(400, {error: 'Missing Slug'});
        return next();
    }

    let agency = null;
    const agencyBO = new AgencyBO();
    try {
        agency = await agencyBO.getbySlug(req.query.slug);
    }
    catch (err) {
        log.error(`Error retrieving Agency in quote engine agency ${req.query.slug}: ${err} ${__location}`);
        return null;
    }
    if(!agency){
        log.warn(`Could not retrieve Agency quote engine agencySlug ${req.query.slug}: ${__location}`);
        return null;
    }

    res.send(200, agency.id);
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    // temporary use AuthAppWF (same as quote app V1)
    // server.addGetAuthAppWF('Get Quote Agency', `${basePath}/agency`, getAgency);
    server.addGetAuthQuoteApp("Get Quote App Agency Id", `${basePath}/agency`, getAgency);
};