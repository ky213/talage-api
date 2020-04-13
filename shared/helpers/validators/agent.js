'use strict';

const positive_integer = /^[1-9]\d*$/;

/**
 * Checks whether an agent is valid (exists in our database). Valid agents are active or disabled (not deleted)
 * A valid agent is identified by ID
 *
 * @param {number} agent - The ID of the agent
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = async function(agent){
	if(positive_integer.test(agent)){
		let had_error = false;
		const sql = `SELECT COUNT(\`id\`) FROM \`#__agencies\` WHERE \`id\` = ${db.escape(parseInt(agent, 10))} AND \`state\` > 0 LIMIT 1;`;
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
	}
	return false;
};