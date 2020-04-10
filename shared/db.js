/**
 * Database connection manager for the API
 */

'use strict';

const mysql = require('mysql');

log.info("DB Host: " + process.env.DATABASE_HOST)

// Connect to the database
const conn = mysql.createPool({
	'connectionLimit': 100,
	'database': process.env.DATABASE_NAME,
	'host': process.env.DATABASE_HOST,
	'password': process.env.DATABASE_PASSWORD,
	'user': process.env.DATABASE_USER
});

/**
 * Escapes a value for use in SQL queries
 *
 * @param {string} str - The value to escape
 *
 * @returns {string} The escaped string
 */
exports.escape = function(str){
	return mysql.escape(str);
};

/**
 * Executes a given SQL query against the proper database
 *
 * @param {string} sql - The SQL query string to be run
 *
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
exports.query = function(sql){
	return new Promise(function(fulfill, reject){
		// Force SQL queries to end in a semicolon for security
		if(sql.slice(-1) !== ';'){
			sql += ';';
		}

		// Replace the prefix placeholder
		sql = sql.replace(/#__/g, process.env.DATABASE_PREFIX);

		// Run the query on the database
		conn.query(sql, function(err, rows){
			if(err){
				log.error(err);
				log.info(sql);
				// docs-api had 'reject(new Error(err));'
				reject(err);
				return;
			}

			// question-api had 'fulfill(JSON.parse(JSON.stringify(rows)));'
			fulfill(rows);
		});
	});
};

/**
 * Quotes a name with `backticks`
 *
 * @param {string} name - A table or column name to quote.
 * @param {string} alias - Aliases name using `name` AS `alias` syntax
 *
 * @returns {string} The quoted name
 */
exports.quoteName = function(name, alias = null){
	let quotedName = null;

	// Check if the name is prepended with an alias
	if(name.includes('.')){
		// Split the alias from the name
		const parts = name.split('.');

		// Return alias and name quoted separately
		quotedName = `\`${parts[0]}\`.\`${parts[1]}\``;
	}else{
		// Otherwise quote the name directly
		quotedName = `\`${name}\``;
	}

	// If the alias param was included, add the AS statement
	if(alias !== null){
		return `${quotedName} AS \`${alias}\``;
	}

	// Otherwise quoted name directly
	return quotedName;
};