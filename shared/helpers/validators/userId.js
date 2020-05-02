'use strict';

module.exports = async function(val, agency, agencyNetwork){
	if(!validator.id(val) || agency && !validator.id(agency)){
		return false;
	}

	// If the agency ID was supplied, make sure the user belongs to that agency
	let where = '';
	if(agency){
		if(agencyNetwork){
			where = ` AND \`agency_network\` = ${parseInt(agency, 10)}`;
		}else{
			where = ` AND \`agency\` = ${parseInt(agency, 10)}`;
		}
	}

	// Make sure this user exists in the database
	const sql = `
		SELECT \`id\`
		FROM \`#__agency_portal_users\`
		WHERE \`id\` = ${parseInt(val, 10)}
		${where}
		LIMIT 1;
	`;

	// Run the query
	let error = false;
	const result = await db.query(sql).catch(function(){
		error = true;
	});
	if(error){
		return false;
	}

	// Check the result
	return Boolean(result.length);
};