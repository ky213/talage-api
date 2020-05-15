'use strict';

/**
 * Checks whether a territory is valid (exists in our database)
 *
 * @param {string} abbr - The territory abbreviation
 * @return {boolean} - True if valid, false otherwise
 */
module.exports = async function(abbr){
	let had_error = false;
	const sql = `SELECT COUNT(\`abbr\`) FROM \`#__territories\` WHERE \`abbr\` = ${db.escape(abbr)};`;
	const rows = await db.query(sql).catch(function(error){
		log.error(error);
		had_error = true;
	});

	if(had_error){
		return false;
	}
	if(!rows || rows.length !== 1 || !Object.prototype.hasOwnProperty.call(rows[0], 'COUNT(`id`)') || rows[0]['COUNT(`id`)'] !== 1){
		return false;
	}
	return true;
};