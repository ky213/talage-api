'use strict';

const positive_integer = /^[1-9]\d*$/;

/**
 * Checks whether an industry code is valid (exists in our database)
 *
 * @param {number} id - The ID of the industry code
 * @returns {mixed} - Description as a string if valid, false otherwise
 */
module.exports = async function(id){
	if(positive_integer.test(id)){
		let had_error = false;
		const sql = `SELECT description FROM \`#__industry_codes\` WHERE \`id\` = ${db.escape(parseInt(id, 10))};`;
		const rows = await db.query(sql).catch(function(error){
			log.error(error + __location);
			had_error = true;
		});
		if(had_error){
			return false;
		}
		if(!rows || rows.length !== 1 || !Object.prototype.hasOwnProperty.call(rows[0], 'description') || rows[0].description === ''){
			return false;
		}
		return rows[0].description;
	}
	return false;
};