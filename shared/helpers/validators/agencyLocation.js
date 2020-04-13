'use strict';

const regex = /^[1-9]\d*$/;

/**
 * Checks whether an agency location is valid (exists in our database).
 *
 * @param {Number} id - An integer corresponding to the ID of an agency location
 * @returns {Boolean} - True if valid, false otherwise
 */
module.exports = async function(id){
	log.info('Agent validator test');
	if(regex.test(id)){
		let hadError = false;
		const sql = `SELECT COUNT(${db.quoteName('id')}) FROM ${db.quoteName('#__agency_locations')} WHERE ${db.quoteName('id')} = ${db.escape(id)} AND ${db.quoteName('state')} = 1 LIMIT 1;`;
		const rows = await db.query(sql).catch(function(error){
			log.error(error);
			hadError = true;
		});
		if(hadError){
			return false;
		}
		if(!rows || rows.length !== 1 || !Object.prototype.hasOwnProperty.call(rows[0], 'COUNT(`id`)') || rows[0]['COUNT(`id`)'] !== 1){
			return false;
		}
		return true;
	}
	return false;
};