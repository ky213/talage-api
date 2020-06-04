'use strict';

const positive_integer = /^[1-9]\d*$/;

/**
 * Checks whether an industry code category is valid (exists in our database)
 *
 * @param {number} id - The ID of the industry code category
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = async function(id){
	if(positive_integer.test(id)){
		let had_error = false;
		const sql = `SELECT name FROM \`#__industry_code_categories\` WHERE \`id\` = ${db.escape(parseInt(id, 10))};`;
		const rows = await db.query(sql).catch(function(error){
			log.error(error);
			had_error = true;
		});
		if(had_error){
			return false;
		}
		if(!rows || rows.length !== 1 || !Object.prototype.hasOwnProperty.call(rows[0], 'name') || rows[0].name === ''){
			return false;
		}
		return true;
	}
	return false;
};