'use strict';

const validator = requireShared('./helpers/validator.js');

module.exports = async function(val){
	if(!validator.id(val)){
		return false;
	}

	// Make sure this landing page exists in the database
	const sql = `
		SELECT \`id\`
		FROM \`#__agency_landing_pages\`
		WHERE \`id\` = ${parseInt(val, 10)}
		LIMIT 1;
	`;

	// Run the query
	let error = false;
	const result = await db.query(sql).catch(function(err){
		log.error(err.message);
		error = true;
	});
	if(error){
		return false;
	}

	// Check the  result
	return Boolean(result.length);
};