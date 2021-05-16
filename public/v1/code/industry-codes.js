/**
 * Handles all tasks related to managing multiple industry codes
 */

'use strict';

const IndustryCodeSvc = global.requireShared('services/industrycodesvc.js');

/**
 * Responds to get requests for all enabled industry codes
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetIndustryCodes(req, res, next) {


    // Request for all codes
    let error = false;
    let icList = null;
    try{
        icList = await IndustryCodeSvc.GetIndustryCodes()
    }
    catch(err){
        error = err;
    }
    if (error) {
        return next(false);
    }
    if (icList && icList.length) {
        // log.info(`Returning ${categories.length} Industry Code Categories`);
        res.send(200, icList);
        return next();
    }
    log.info('No Codes Available' + __location);
    res.send(404, {
        message: 'No Codes Available',
        status: 'error'
    });
    return next(false);
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGet('Get All Industry Codes', `${basePath}/industry-codes`, GetIndustryCodes);
    server.addGet('Get All Industry Codes (depr)', `${basePath}/industry_codes`, GetIndustryCodes);
};