/* eslint-disable prefer-const */
/* eslint-disable array-element-newline */
'use strict';
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const serverHelper = global.requireRootPath('server.js');
//const auth = require('./helpers/auth.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

/**
 * Returns the record for a single Agency Network
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencyNetwork(req, res, next) {
    let error = false;
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    const agencyNetwork = req.authentication.agencyNetwork;
    if (agencyNetwork) {
        // agency network user.
        // check request matches rights.
        if (agencyNetwork !== id) {
            res.send(403);
            return next(serverHelper.forbiddenError('Do Not have Permissions'));
        }
    }
    else {
        // agency user. lookup agency network
        const agency_network = req.authentication.agencyNetworkId
        if (agency_network !== id) {
            res.send(403);
            return next(serverHelper.forbiddenError('Do Not have Permissions'));
        }
    }

    let agencyNetworkBO = new AgencyNetworkBO();

    const getResp = await agencyNetworkBO.getById(id).catch(function(err) {
        log.error("agencyNetworkBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    if (getResp) {
        res.send(200, agencyNetworkBO);
        return next();
    }
    else {
        log.debug(`No object returned from getByID ${id} ` + __location)
        res.send(404);
        return next(serverHelper.notFoundError('Agency Network not found'));
    }
}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get AgencyNetwork', `${basePath}/agency-network/:id`, getAgencyNetwork, 'agencies', 'view');
};