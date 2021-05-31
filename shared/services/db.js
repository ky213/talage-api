/**
 * Database connection manager for the API
 */

'use strict';

const mysql = require('mysql');
const util = require('util');
const colors = require('colors');

let conn = null;
let connRo = null;
let connRoCluster = null;
let useReadOnly = false;
let usingReadOnlyCluster = false;
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
            log.info("Write Conn: Set aurora_replica_read_consistency")
        }
    });
    let roHostArray = [];
    if(global.settings.DATABASE_HOST_READONLY){
        useReadOnly = true;
        connRo = mysql.createPool({
            'connectionLimit': 100,
            'database': global.settings.DATABASE_NAME,
            'host': global.settings.DATABASE_HOST_READONLY,
            'password': global.settings.DATABASE_PASSWORD,
            'user': global.settings.DATABASE_USER,
            'timezone': 'Z'
        });
        //only effects writes.
        connRo.on('connection', function() {
            log.debug("ReadOnly connection: ")
        });
    }

    if(global.settings.DATABASE_RO_HOST_LIST && global.settings.DATABASE_RO_HOST_LIST.length > 0){
        roHostArray = global.settings.DATABASE_RO_HOST_LIST.split(",");
        log.debug("roHostArray: " + JSON.stringify(roHostArray))
        if(roHostArray.length > 1 && global.settings.USING_AURORA_CLUSTER === "YES"){
            log.debug("Using PoolCluster for Read only.")
            usingReadOnlyCluster = true;
            connRoCluster = mysql.createPoolCluster();
            for(let i = 0; i < roHostArray.length; i++){
                log.debug(`Adding ${roHostArray[i]} to PoolCluster for Read only.`)
                connRoCluster.add("ReadOnly" + i, {
                    'connectionLimit': 100,
                    'database': global.settings.DATABASE_NAME,
                    'host': roHostArray[i],
                    'password': global.settings.DATABASE_PASSWORD,
                    'user': global.settings.DATABASE_USER,
                    'timezone': 'Z'
                });
            }
        }
    }





    // Try to connect to the database to ensure it is reachable.
    try{
        log.debug("testing write connection")
        const connection = await util.promisify(conn.getConnection).call(conn);
        connection.release();

    }
    catch(error){
        log.error(colors.red(`\tMySQL DB ERROR: ${error.toString(global.settings.DATABASE_HOST)}`)); // eslint-disable-line no-console
        return false;
    }
    log.info(colors.green(`\tMySQL Connected to ${colors.cyan(global.settings.DATABASE_HOST)}:${colors.cyan(global.settings.DATABASE_NAME)}`)); // eslint-disable-line no-console


    if(useReadOnly === true){
        // Try to connect to the database to ensure it is reachable.
        try{
            const connection = await util.promisify(connRo.getConnection).call(connRo);
            connection.release();
            log.info(colors.green(`\tREADONLY MySQL Connected to ${colors.cyan(global.settings.DATABASE_HOST_READONLY)}`)); // eslint-disable-line no-console
        }
        catch(error){
            log.error(colors.red(`\tMySQL DB ERROR: ${error.toString(global.settings.DATABASE_HOST_READONLY)}:${colors.cyan(global.settings.DATABASE_NAME)}`)); // eslint-disable-line no-console
            return false;
        }
    }

    if(usingReadOnlyCluster === true){
        // Try to connect to the database to ensure it is reachable.
        try{
            log.debug("testing readonly Cluster connection")
            connRoCluster.getConnection(function(error, connQuery) {
                if(error){
                    throw error;
                }
                log.info(colors.green(`\tREADONLY MySQL Connected to ${colors.cyan(global.settings.DATABASE_RO_HOST_LIST)}`)); // eslint-disable-line no-console
                connQuery.release();
            });
        }
        catch(error){
            log.error(colors.red(`\tMySQL DB ERROR: ${error.toString(global.settings.DATABASE_HOST_READONLY)}`)); // eslint-disable-line no-console
            return false;
        }
    }
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
 * Executes a given SQL query against the tranactional database
 *
 * @param {string} sql - The SQL query string to be run
 *
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
exports.query = function(sql){
    return queryInternal(sql);
};

/**
 * Executes a given SQL query against the tranactional database
 *
 * @param {string} sql - The SQL query string to be run
 *
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
function queryInternal(sql){
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
}

/**
 * Executes a given SQL query against the tranactional database
 *
 * @param {string} sql - The SQL query string to be run
 * @param {object} params - The SQL query string to be run
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
exports.queryParam = function(sql, params){
    return queryParamInternal(sql,params);
}


/**
 * Executes a given SQL query against the tranactional database
 *
 * @param {string} sql - The SQL query string to be run
 * @param {object} params - The SQL query string to be run
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
function queryParamInternal(sql, params){
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
                log.error('db query ro error: ' + err + __location);
                log.error('sql: ' + sql);
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
 * Executes a given SQL query against the ReadyOnly database
 *
 * @param {string} sql - The SQL query string to be run
 *
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
exports.queryReadonly = function(sql){
    if (useReadOnly === true){
        return queryReadonlyInternal(sql);
    }
    else{
        return queryInternal(sql);
    }
}

/**
 * Executes a given SQL query against the ReadyOnly database
 *
 * @param {string} sql - The SQL query string to be run
 *
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
function queryReadonlyInternal(sql){
    return new Promise(function(fulfill, reject){
    // Force SQL queries to end in a semicolon for security
        if(sql.slice(-1) !== ';'){
            sql += ';';
        }
        // Replace the prefix placeholder
        sql = sql.replace(/#__/g, global.settings.DATABASE_PREFIX);

        // Run the query on the database
        if(useReadOnly === true){
            if(usingReadOnlyCluster === true){
                // DOES NOT Work =>  const connQuery = await util.promisify(connRo.getConnection).call(connRo);
                connRo.getConnection(function(error, connQuery) {
                    if(error){
                        reject(error);
                        return;
                    }

                    connQuery.query(sql, function(err, rows){
                        if(err){
                            log.error('db ro query error: ' + err + __location);
                            log.info('sql: ' + sql);
                            // Docs-api had 'reject(new Error(err));'
                            reject(err);
                            return;
                        }
                        fulfill(rows);
                        connQuery.release();
                    });
                });
            }
            else {
                connRo.query(sql, function(err, rows){
                    if(err){
                        log.error('db ro query error: ' + err + __location);
                        log.info('sql: ' + sql);
                        reject(err);
                        return;
                    }
                    fulfill(rows);

                });
            }
        }
        else {
            conn.query(sql, function(err, rows){
                if(err){
                    log.error('db query error: ' + err + __location);
                    log.error('sql: ' + sql);
                    // Docs-api had 'reject(new Error(err));'
                    reject(err);
                    return;
                }

                // Question-api had 'fulfill(JSON.parse(JSON.stringify(rows)));'
                fulfill(rows);
            });
        }
    });
};

/**
 * Executes a given SQL query against the ReadyOnly database
 *
 * @param {string} sql - The SQL query string to be run
 * @param {object} params - The parameter JSON
 *
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
exports.queryParamReadOnly = function(sql, params){
    if (useReadOnly === true){
        return queryParamReadOnlyInternal(sql, params);
    }
    else{
        return queryParamInternal(sql,params);
    }

}

/**
 * Executes a given SQL query against the ReadyOnly database
 *
 * @param {string} sql - The SQL query string to be run
 * @param {object} params - The parameter JSON
 *
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
function queryParamReadOnlyInternal(sql, params){
    return new Promise(function(fulfill, reject){
        // Force SQL queries to end in a semicolon for security
        if(sql.slice(-1) !== ';'){
            sql += ';';
        }

        // Replace the prefix placeholder
        sql = sql.replace(/#__/g, global.settings.DATABASE_PREFIX);

        // Run the query on the database
        if(useReadOnly === true){
            if(usingReadOnlyCluster === true){
                // const connQuery = await util.promisify(connRo.getConnection).call(connRo);
                connRo.getConnection(function(error, connQuery) {
                    if(error){
                        reject(error);
                        return;
                    }

                    connQuery.query(sql, params, function(err, rows){
                        if(err){
                            log.error('db ro query error: ' + err + __location);
                            log.error('sql ro : ' + sql);
                            reject(err);
                            return;
                        }

                        fulfill(rows);
                        connQuery.release();
                    });
                });
            }
            else {
                connRo.query(sql, params, function(err, rows){
                    if(err){
                        log.error('db ro query error: ' + err + __location);
                        log.error('sql ro : ' + sql);
                        reject(err);
                        return;
                    }

                    fulfill(rows);
                });
            }
        }
        else {
            conn.query(sql, params, function(err, rows){
                if(err){
                    log.error('db query ro error: ' + err + __location);
                    log.error('sql: ' + sql);
                    reject(err);
                    return;
                }
                fulfill(rows);
            });
        }
    });
};

/**
 * Executes a given SQL query against the ReadyOnly database using PoolCluster connnection
 * spreads queries across read only servers. software controlled
 *
 * @param {string} sql - The SQL query string to be run
 *
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
exports.queryReadonlyCluster = async function(sql){
    if(usingReadOnlyCluster === true){
        return queryReadonlyClusterInternal(sql)
    }
    else if (useReadOnly === true){
        return queryReadonlyInternal(sql);
    }
    else{
        return queryInternal(sql);
    }

}

/**
 * Executes a given SQL query against the ReadyOnly database using PoolCluster connnection
 * spreads queries across read only servers. software controlled
 *
 * @param {string} sql - The SQL query string to be run
 *
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
function queryReadonlyClusterInternal(sql){
    return new Promise(function(fulfill, reject){
    // Force SQL queries to end in a semicolon for security
        if(sql.slice(-1) !== ';'){
            sql += ';';
        }
        // Replace the prefix placeholder
        sql = sql.replace(/#__/g, global.settings.DATABASE_PREFIX);

        // Run the query on the database

        // DOES NOT Work =>  const connQuery = await util.promisify(connRo.getConnection).call(connRo);
        connRoCluster.getConnection(function(error, connQuery) {
            if(error){
                reject(error);
                return;
            }

            connQuery.query(sql, function(err, rows){
                if(err){
                    log.error('db ro query error: ' + err + __location);
                    log.info('sql: ' + sql);
                    // Docs-api had 'reject(new Error(err));'
                    reject(err);
                    return;
                }
                fulfill(rows);
                connQuery.release();
            });
        });
    });
}

/**
 * Executes a given SQL Parameterized query against the ReadyOnly database using PoolCluster connnection
 * spreads queries across read only servers. software controlled
 *
 * @param {string} sql - The SQL query string to be run
 * @param {object} params - The parameter JSON
 *
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
exports.queryParamReadOnlyCluster = function(sql, params){
    if(usingReadOnlyCluster === true){
        return queryParamReadOnlyCluster(sql,params)
    }
    else if (useReadOnly === true){
        return queryParamReadOnlyInternal(sql)
    }
    else{
        return queryParamInternal(sql,params);
    }

}

/**
 * Executes a given SQL Parameterized query against the ReadyOnly database using PoolCluster connnection
 * spreads queries across read only servers. software controlled
 *
 * @param {string} sql - The SQL query string to be run
 * @param {object} params - The parameter JSON
 *
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
function queryParamReadOnlyCluster(sql, params){
    return new Promise(function(fulfill, reject){
        // Force SQL queries to end in a semicolon for security
        if(sql.slice(-1) !== ';'){
            sql += ';';
        }

        // Replace the prefix placeholder
        sql = sql.replace(/#__/g, global.settings.DATABASE_PREFIX);

        // Run the query on the database
        // const connQuery = await util.promisify(connRo.getConnection).call(connRo);
        connRoCluster.getConnection(function(error, connQuery) {
            if(error){
                reject(error);
                return;
            }

            connQuery.query(sql, params, function(err, rows){
                if(err){
                    log.error('db ro query error: ' + err + __location);
                    log.error('sql ro : ' + sql);
                    reject(err);
                    return;
                }

                fulfill(rows);
                connQuery.release();
            });
        });

    });
}


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