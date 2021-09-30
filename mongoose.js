/* eslint-disable object-curly-newline */
// Invoke 'strict' JavaScript mode
/* jshint -W097 */ // don't warn about "use strict"
/*jshint esversion: 6 */
'use strict';

var mongoose = require('mongoose');
// eslint-disable-next-line no-unused-vars
const talageEvent = require('./shared/services/talageeventemitter.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const allConnections = {
    conn: null,
    insurerConn: null
};

allConnections.init = async function init() {
    mongoose.Promise = Promise;

    let connectionUrlQuery = '';
    if(global.settings.MONGODB_CONNECTIONURLQUERY){
        connectionUrlQuery = global.settings.MONGODB_CONNECTIONURLQUERY;
    }

    const mongoConnStr = global.settings.MONGODB_CONNECTIONURL +
        global.settings.MONGODB_DATABASENAME +
        connectionUrlQuery;
    const mongoInsurerConnStr = global.settings.MONGODB_INSURER_CONNECTIONURL +
        global.settings.MONGODB_INSURER_DATABASENAME +
        connectionUrlQuery;

    const connectionOption = {
        useNewUrlParser: true,
        useUnifiedTopology: true
    };

    allConnections.conn = mongoose.createConnection(mongoConnStr, connectionOption);
    allConnections.insurerConn = mongoose.createConnection(mongoInsurerConnStr, connectionOption);

    global.mongodb = allConnections.conn;
    global.insurerMongodb = allConnections.insurerConn;

    // Wait for connections to complete.
    await waitForConnection(allConnections.conn, mongoConnStr);
    await waitForConnection(allConnections.insurerConn, mongoInsurerConnStr);

    require('./shared/models/mongoose/message.model');
    require('./shared/models/mongoose/Application.model');
    require('./shared/models/mongoose/AgencyPortalUserGroup.model');
    require('./shared/models/mongoose/Mapping.model');
    require('./shared/models/mongoose/AgencyEmail.model');
    require('./shared/models/mongoose/Quote.model');
    require('./shared/models/mongoose/AgencyNetwork.model');
    require('./shared/models/mongoose/Agency.model');
    require('./shared/models/mongoose/AgencyLocation.model');
    require('./shared/models/mongoose/AgencyLandingPage.model');
    require('./shared/models/mongoose/ApplicationNotesCollection.model');

    require('./shared/models/mongoose/Insurer.model');
    require('./shared/models/mongoose/InsurerPolicyType.model');
    require('./shared/models/mongoose/InsurerIndustryCode.model');
    require('./shared/models/mongoose/InsurerQuestion.model');
    require('./shared/models/mongoose/InsurerActivityCode.model');

    require('./shared/models/mongoose/ActivityCode.model');
    require('./shared/models/mongoose/IndustryCode.model');
    require('./shared/models/mongoose/IndustryCodeCategory.model');
    require('./shared/models/mongoose/CodeGroup.model');
    require('./shared/models/mongoose/QuestionGroup.model');
    require('./shared/models/mongoose/OpenIdAuthConfig.model');

    require('./shared/models/mongoose/PolicyType.model');
    require('./shared/models/mongoose/WCStateIncomeLimits.model');
    require('./shared/models/mongoose/ZipCode.model');
    require('./shared/models/mongoose/AgencyPortalUser.model');
    require('./shared/models/mongoose/Territory.model');

    require('./shared/models/mongoose/Question.model');
    require('./shared/models/mongoose/ColorScheme.model');

    // Only emit the main connection
    talageEvent.emit('mongo-connected', allConnections.conn);
};

/**
 * Wait for MongoDB to finish connectiong to the database. Handle any errors
 * that may arise. If a DB connection occurs, we will run process.exit(1).
 * @param {*} conn Newly created Mongo connection
 * @param {string} mongoConnStr MongoDB connection string
 * @returns {void}
 */
async function waitForConnection(conn, mongoConnStr) {
    //do not log password
    const mongoConnStrParts = mongoConnStr.split("@")
    // If using localhost, then there might not be a password. If so, print the
    // whole string. If there is a password, then remove the password part.
    const logConnectionString = mongoConnStrParts.length > 1 ? mongoConnStrParts[1] : mongoConnStrParts[0];
    log.debug(`mongoConnStr: ${logConnectionString}`);

    await new Promise((resolve) => {
        conn.on('connected', function() {
            log.info(`Mongoose connected to mongodb at ${logConnectionString}`);
            resolve();
        });

        conn.on('disconnected', function() {
            log.warn('Mongoose disconnected');
            talageEvent.emit('mongo-disconnected');
        });

        conn.on('error', function(err) {
            log.error(`Mongoose database error (using connection: ${logConnectionString} ${err} ${__location}`);
            log.error(" KILLING process do to mongoose client failure at " + new Date().toISOString());
            talageEvent.emit('mongo-error', err);

            // eslint-disable-next-line no-process-exit
            process.exit(1);
        });
    });
}

module.exports = allConnections;