/**
 * Handles all tasks related to managing multiple industry code categories
 */

'use strict';

const IndustryCodeSvc = global.requireShared('services/industrycodesvc.js');

/**
 * Responds to get requests for all enabled industry code categories
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetIndustryCategories(req, res, next) {
    // Request for all featured categories with associated codes
    let error = false;
    let iicList = null;
    try{
        iicList = await IndustryCodeSvc.GetIndustryCodeCategories()
    }
    catch(err){
        error = err;
    }
    if (error) {
        return next(false);
    }
    if (iicList && iicList.length) {
        // log.info(`Returning ${categories.length} Industry Code Categories`);
        res.send(200, iicList);
        return next();
    }
    log.info('No Categories Available' + __location);
    res.send(404, {
        message: 'No Categories Available',
        status: 'error'
    });
    return next(false);
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGet('Get All Industry Code Categories', `${basePath}/industry-categories`, GetIndustryCategories);
};