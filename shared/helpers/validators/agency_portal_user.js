'use strict';

const positive_integer = /^[1-9]\d*$/;

/**
 * Checks whether an agency portal user is valid (exists in our database). Valid agents are active
 * A valid agent is identified by ID
 *
 * @param {number} agency_portal_user - The ID of the agency portal user
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = async function(agency_portal_user){
	if(positive_integer.test(agency_portal_user)){
		let had_error = false;
		const sql = `SELECT COUNT(\`id\`) FROM \`#__agency_portal_users\` WHERE \`id\` = ${db.escape(parseInt(agency_portal_user, 10))} AND \`state\` > 0 LIMIT 1;`;
		const rows = await db.query(sql).catch(function(error){
			log.error(error + __location);
			had_error = true;
		});
		if(had_error){
			return false;
		}
		if(!rows || rows.length !== 1 || !Object.prototype.hasOwnProperty.call(rows[0], 'COUNT(`id`)') || rows[0]['COUNT(`id`)'] !== 1){
			return false;
		}
		return true;
	}
	return false;
};