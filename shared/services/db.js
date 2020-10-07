/**
 * Database connection manager for the API
 */

'use strict';

const mysql = require('mysql');
const util = require('util');
const colors = require('colors');

let conn = null;

exports.connect = async() => {

    log.info(`MySQL Connecting to database ${colors.cyan(global.settings.DATABASE_HOST)}`); // eslint-disable-line no-console

    // Connect to the database set client to assume db datetimes are in UTC.
    conn = mysql.createPool({
        'connectionLimit': 100,
        'database': global.settings.DATABASE_NAME,
        'host': global.settings.DATABASE_HOST,
        'password': global.settings.DATABASE_PASSWORD,
        'user': global.settings.DATABASE_USER,
        'timezone': 'Z'
    });

    conn.on('connection', function(connection) {
        if(global.settings.USING_AURORA_CLUSTER === "YES"){
            connection.query(`set @@aurora_replica_read_consistency = 'session';`)
            log.info("Set aurora_replica_read_consistency")
        }
    });

    // Try to connect to the database to ensure it is reachable.
    try{
        const connection = await util.promisify(conn.getConnection).call(conn);
        connection.release();
    }
    catch(error){
        log.error(colors.red(`\tMySQL DB ERROR: ${error.toString()}`)); // eslint-disable-line no-console
        return false;
    }
    log.info(colors.green(`\tMySQL Connected to ${colors.cyan(global.settings.DATABASE_HOST)}`)); // eslint-disable-line no-console
    return true;
};

/**
 * Starts a database transaction
 *
 * @returns {Promise} - The database connection
 */
exports.beginTransaction = function(){
    return new Promise(function(fulfill, reject){
        // Get a single database connection from the pool. All queries in this same transaction will use this same connection.
        conn.getConnection(function(err, connection){
            if(err){
                log.error('Unable to establish single connection to database' + __location);
                reject(new Error('Database connection failed'));
                return;
            }

            // Begin the transaction
            connection.beginTransaction();
            log.info('Beginning database transaction');

            // Return the connection object
            fulfill(connection);
        });
    });
};

/**
 * Commit and end a database transaction
 *
 * @param {obj} connection (optional) - A database connection object
 *
 * @returns {void}
 */
exports.commit = function(connection){
    if(!connection){
        log.error('Parameter missing. db.commit() requires a database connection as a parameter' + __location);
        return;
    }

    // Commit the transaction
    connection.commit();

    // Release the connection
    connection.release();
    log.info('Database transaction committed');
};

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
 * Prepares a query for urnnning against our database
 *
 * @param {string} sql - The SQL query string to be run
 *
 * @returns {string} - The prepared query
 */
exports.prepareQuery = function(sql){
    // Force SQL queries to end in a semicolon for security
    if(sql.slice(-1) !== ';'){
        sql += ';';
    }

    // Replace the prefix placeholder
    return sql.replace(/#__/g, process.env.DATABASE_PREFIX);
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
        sql = sql.replace(/#__/g, global.settings.DATABASE_PREFIX);

        // Run the query on the database
        conn.query(sql, function(err, rows){
            if(err){
                log.error('db query error: ' + err + __location);
                log.info('sql: ' + sql);
                // Docs-api had 'reject(new Error(err));'
                reject(err);
                return;
            }

            // Question-api had 'fulfill(JSON.parse(JSON.stringify(rows)));'
            fulfill(rows);
        });
    });
};

exports.queryParam = function(sql, params){
    return new Promise(function(fulfill, reject){
        // Force SQL queries to end in a semicolon for security
        if(sql.slice(-1) !== ';'){
            sql += ';';
        }

        // Replace the prefix placeholder
        sql = sql.replace(/#__/g, global.settings.DATABASE_PREFIX);

        // Run the query on the database
        conn.query(sql, params, function(err, rows){
            if(err){
                log.error('db query error: ' + err + __location);
                log.info('sql: ' + sql);
                // Docs-api had 'reject(new Error(err));'
                reject(err);
                return;
            }

            // Question-api had 'fulfill(JSON.parse(JSON.stringify(rows)));'
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
    }
    else{
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

/**
 * Rollback and end a database transaction
 *
 * @param {obj} connection (optional) - A database connection object
 *
 * @returns {void}
 */
exports.rollback = function(connection){
    if(!connection){
        log.error('Parameter missing. db.rollback() requires a database connection as a parameter' + __location);
        return;
    }

    // Rollback the transaction
    connection.rollback();

    // Release the connection
    connection.release();
    log.info('Database transaction rolledback');
};

exports.dbTimeFormat = function(){
    return 'YYYY-MM-DD HH:mm:ss';
};

/**
 * Modifies the String prototype and adds a new capability, 'toSnakeCase' which will convert
 * the string to snake_case. Usage: string.toSnakeCase()
 */
// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'toSnakeCase', {'value': function(){
    return this.split(/(?=[A-Z])/).join('_').toLowerCase();
}});

/**
 * Modifies the String prototype and adds a new capability, 'toCamelCase' which will convert
 * the string to camelCase. Usage: string.toCamelCase()
 */
// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'toCamelCase', {'value': function(){
    return this.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
}});

// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'isSnakeCase', {'value': function(){
    if (this.includes("_")){
        return true;
    }
    else {
        return false;
    }
}});