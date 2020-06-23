'use strict';

const positive_integer = /^[1-9]\d*$/;

/**
 * Checks whether a payment plan ID is valid (exists in our database)
 *
 * @param {number} id - The ID of the payment plan
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = async function(id){
	if(positive_integer.test(id)){
		let had_error = false;
		const sql = `SELECT COUNT(\`id\`) FROM \`#__insurer_payment_plans\` WHERE \`payment_plan\` = ${db.escape(parseInt(id, 10))};`;
		const rows = await db.query(sql).catch(function(error){
			log.error(error + __location);
			had_error = true;
		});
		if(had_error){
			return false;
		}
		if(!rows || rows.length !== 1 || !Object.prototype.hasOwnProperty.call(rows[0], 'COUNT(`id`)') || rows[0]['COUNT(`id`)'] < 1){
			return false;
		}
		return true;
	}
	return false;
};