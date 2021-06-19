'use strict';
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const ZipCodeBO = global.requireShared('./models/ZipCode-BO');

/**
 * Responds to get requests for the getCityTerritory endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getCityTerritory(req, res, next) {

    // Check that query parameters were received
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: Query parameters missing');
        return next(serverHelper.requestError('Query parameters missing'));
    }

    // Check for required parameters
    if (!Object.prototype.hasOwnProperty.call(req.query, 'zip') || !req.query.zip) {
        log.info('Bad Request: You must specify a zip code');
        return next(serverHelper.requestError('You must specify a zip code'));
    }

    // Get the user groups, excluding 'Administrator' for now as this permission is currently unused. It will be added soon.
    const zipCodeBO = new ZipCodeBO();
    let result = null;
    let error = null;
    try {
        result = await zipCodeBO.loadByZipCode(req.query.zip);
    }
    catch (err) {
        error = err;
        log.error("getCityTerritory by Zipcode error " + err + __location)
        //this will not stop the processing of this function.
        // return....
    }

    if (error) {
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    }
    else if (result) {
        // Return the response
        res.send(200, {
            'city': result.city,
            'territory': result.state
        });
        return next();

    }
    else {
        return next(serverHelper.requestError('The zip code you entered is invalid'));
    }

}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get City State', `${basePath}/city-territory`, getCityTerritory);
};