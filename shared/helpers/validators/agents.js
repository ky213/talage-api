'use strict';

const positive_integer = /^[1-9]\d*$/;

/**
 * Checks whether a list of agents is valid (exists in our database). Valid agents are active or disabled (not deleted)
 * A valid agent is identified by ID
 *
 * @param {array} agents - An array of numbers that are the ID of the agent
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = async function(agents){
	let had_error = false;

	// First, check that each agent appears to be an ID number
	agents.forEach(function(agent){
		if(!positive_integer.test(agent)){
			had_error = true;
		}
	});

	if(had_error){
		return false;
	}

	const sql = `
		SELECT COUNT(\`id\`)
		FROM \`#__agencies\`
		WHERE \`id\` IN (${agents.join(',')}) AND \`state\` > 0
		LIMIT 1;
	`;
	const rows = await db.query(sql).catch(function(error){
		log.error(error + __location);
		had_error = true;
	});
	if(had_error){
		return false;
	}
	if(!rows || rows.length !== 1 || !Object.prototype.hasOwnProperty.call(rows[0], 'COUNT(`id`)') || rows[0]['COUNT(`id`)'] !== agents.length){
		return false;
	}
	return true;
};