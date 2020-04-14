
/**
 * Handles all tasks related to managing multiple industry code categories
 */

'use strict';



/* -----==== Version 1 Functions ====-----*/

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
	const sql_all_industry_categories = 'SELECT DISTINCT `icc`.`id`, `icc`.`name` FROM `#__industry_code_categories` AS `icc` RIGHT JOIN `#__industry_codes` AS `ic` ON `icc`.`id` = `ic`.`category` WHERE `icc`.`featured` = 1 AND `icc`.`state` = 1 ORDER BY `icc`.`name`;';
	const categories = await db.query(sql_all_industry_categories).catch(function (e) {
		log.warn(e.message);
		res.send(500, {
			'message': 'Internal Server Error',
			'status': 'error'
		});
		error = true;
	});
	if (error) {
		return next(false);
	}
	if (categories && categories.length) {
		log.info(`Returning ${categories.length} Industry Code Categories`);
		res.send(200, categories);
		return next();
	}
	log.info('No Categories Available');
	res.send(404, {
		'message': 'No Categories Available',
		'status': 'error'
	});
	return next(false);
}


/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath, server) => {
	log.info(`    Registering ${basePath}/industry-categories (GET)`);
	server.get({
		'name': 'Get All Industry Code Categories',
		'path': basePath + '/industry-categories'
	}, GetIndustryCategories);

	log.info(`    Registering ${basePath}/industry_categories (GET) [deprecated]`);
	server.get({
		'name': 'Get All Industry Code Categories',
		'path': basePath + '/industry_categories'
	}, GetIndustryCategories);
};