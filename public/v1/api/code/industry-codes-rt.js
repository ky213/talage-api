/**
 * Handles all tasks related to managing multiple industry codes
 */

'use strict';

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
    const sql_all_industry_codes =
		"SELECT `ic`.`description`, `ic`.`id`, `ic`.`featured`, `ic`.`iso`, `ic`.`naics`, `ic`.`sic`, GROUP_CONCAT(DISTINCT `ican`.`name`) AS 'alternate_names', `icc`.`name` AS `category` FROM `#__industry_codes` AS `ic` LEFT JOIN `#__industry_code_alt_names` AS `ican` ON `ic`.`id` = `ican`.`industry_code` LEFT JOIN `#__industry_code_categories` AS `icc` ON `ic`.`category` = `icc`.`id` WHERE `ic`.`state` = 1 GROUP BY `ic`.`id` ORDER BY `ic`.`description`;";
    const codes = await db.queryReadonly(sql_all_industry_codes).catch(function(e) {
        log.warn(e.message);
        res.send(500, {
            message: 'Internal Server Error',
            status: 'error'
        });
        error = true;
    });
    if (error) {
        return next(false);
    }
    if (codes && codes.length) {
        codes.forEach(function(code) {
            if (code.alternate_names) {
                code.alternate_names = code.alternate_names.split(',');
            }
            else {
                delete code.alternate_names;
            }
            if (!code.category) {
                delete code.category;
            }
            if (!code.featured) {
                delete code.featured;
            }
        });
        // log.info(`Returning ${codes.length} Industry Codes`);
        res.send(200, codes);
        return next();
    }
    log.info('No Codes Available');
    res.send(404, {
        message: 'No Codes Available',
        status: 'error'
    });
    return next(false);
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAppWF('Get All Industry Codes', `${basePath}/industry-codes`, GetIndustryCodes);
    // TODO: do we want to pair one call with an optional query instead?
    // server.addGet('Get Industry Codes for an agency', `${basePath}/industry-codes/:agencyid`, GetIndustryCodes);
};