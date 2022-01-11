/* eslint-disable no-unused-vars */
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

allConnections.init = function init() {
    mongoose.Promise = Promise;

    let connectionUrlQuery = '';
    if(global.settings.MONGODB_CONNECTIONURLQUERY){
        connectionUrlQuery = global.settings.MONGODB_CONNECTIONURLQUERY;
    }

    const mongoConnStr = global.settings.MONGODB_CONNECTIONURL +
        global.settings.MONGODB_DATABASENAME +
        connectionUrlQuery;

    let mongoInsurerConnStr = mongoConnStr;
    let mongoInsurerUrl = global.settings.MONGODB_CONNECTIONURL
    let mongoInsurerDB = global.settings.MONGODB_DATABASENAME
    if(global.settings.MONGODB_INSURER_CONNECTIONURL && global.settings.MONGODB_INSURER_DATABASENAME){
        mongoInsurerUrl = global.settings.MONGODB_INSURER_CONNECTIONURL
        mongoInsurerDB = global.settings.MONGODB_INSURER_DATABASENAME
        mongoInsurerConnStr = global.settings.MONGODB_INSURER_CONNECTIONURL +
            global.settings.MONGODB_INSURER_DATABASENAME +
            connectionUrlQuery;
    }

    const connectionOption = {
        useNewUrlParser: true,
        useUnifiedTopology: true
    };

    allConnections.conn = mongoose.createConnection(mongoConnStr, connectionOption);
    allConnections.insurerConn = mongoose.createConnection(mongoInsurerConnStr, connectionOption);

    global.mongodb = allConnections.conn;
    global.insurerMongodb = allConnections.insurerConn;

    let appDBConnected = false;
    let insurerDBConnected = false;
    // Wait for connections to complete.
    // await waitForConnection(allConnections.conn, mongoConnStr, "Application Database");
    // await waitForConnection(allConnections.insurerConn, mongoInsurerConnStr, "Insurer Database");
    //åvar mongodb = mongoose.connect(mongoConnStr,connectionOption);
    var mongodb2 = allConnections.conn;

    mongodb2.on('connected', function() {
        var connectionParts = global.settings.MONGODB_CONNECTIONURL.split("@");
        var dataserver = "";
        if(connectionParts.length > 1){
            dataserver = connectionParts[1];
        }
        else {
            dataserver = connectionParts[0];
        }
        log.info('Mongoose connected to mongodb at ' + dataserver + ' DB: ' + global.settings.MONGODB_DATABASENAME);
        appDBConnected = true;
        if(insurerDBConnected === true){
            talageEvent.emit('mongo-connected', allConnections.conn);
        }
        //
    });

    mongodb2.on('disconnected', function() {
        log.warn('Mongoose disconnected');
        talageEvent.emit('mongo-disconnected');
    });

    mongodb2.on('error', function(err) {
        log.error('Mongoose database error ' + err + __location);
        log.error(" KILLING process do to mongoose client failure at " + new Date().toISOString());
        talageEvent.emit('mongo-error', err);

        // eslint-disable-next-line no-process-exit
        process.exit(1);
    });


    var mongodbInsurer2 = allConnections.conn;

    mongodbInsurer2.on('connected', function() {
        var connectionParts = mongoInsurerUrl.split("@");
        var dataserver = "";
        if(connectionParts.length > 1){
            dataserver = connectionParts[1];
        }
        else {
            dataserver = connectionParts[0];
        }
        log.info('Mongoose connected to mongodb at ' + dataserver + ' DB: ' + mongoInsurerDB);
        insurerDBConnected = true;
        if(appDBConnected === true){
            talageEvent.emit('mongo-connected', allConnections.conn);
        }
    });

    mongodbInsurer2.on('disconnected', function() {
        log.warn('Mongoose disconnected');
        talageEvent.emit('mongo-disconnected');
    });

    mongodbInsurer2.on('error', function(err) {
        log.error('Mongoose database error ' + err + __location);
        log.error(" KILLING process do to mongoose client failure at " + new Date().toISOString());
        talageEvent.emit('mongo-error', err);

        // eslint-disable-next-line no-process-exit
        process.exit(1);
    });


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

    require('./shared/models/mongoose/OpenIdAuthConfig.model');

    require('./shared/models/mongoose/PolicyType.model');
    require('./shared/models/mongoose/WCStateIncomeLimits.model');
    require('./shared/models/mongoose/ZipCode.model');
    require('./shared/models/mongoose/AgencyPortalUser.model');
    require('./shared/models/mongoose/Territory.model');

    require('./shared/models/mongoose/ColorScheme.model');

    //Insurer, Code and Questions DB
    require('./shared/models/mongoose/Insurer.model');
    require('./shared/models/mongoose/InsurerPolicyType.model');
    require('./shared/models/mongoose/InsurerIndustryCode.model');
    require('./shared/models/mongoose/InsurerQuestion.model');
    require('./shared/models/mongoose/InsurerActivityCode.model');

    require('./shared/models/mongoose/ActivityCode.model');
    require('./shared/models/mongoose/IndustryCode.model');
    require('./shared/models/mongoose/IndustryCodeCategory.model');

    require('./shared/models/mongoose/Question.model');
    require('./shared/models/mongoose/QuestionGroup.model');

    require('./shared/models/mongoose/CodeGroup.model');


    //Touch all the model so the models are loaded. - index checks have run...
    //Application DB
    //const Mapping = require('mongoose').model('Mapping');

    global.mongoose = {
        Agency: global.mongodb.model('Agency'),
        AgencyEmail: global.mongodb.model('AgencyEmail'),
        AgencyLandingPage: global.mongodb.model('AgencyLandingPage'),
        AgencyLocation: global.mongodb.model('AgencyLocation'),
        AgencyNetwork: global.mongodb.model('AgencyNetwork'),
        AgencyPortalUser: global.mongodb.model('AgencyPortalUser'),
        AgencyPortalUserGroup: global.mongodb.model('AgencyPortalUserGroup'),
        Application: global.mongodb.model('Application'),
        ApplicationNotesCollection: global.mongodb.model('ApplicationNotesCollection'),
        ColorScheme: global.mongodb.model('ColorScheme'),
        IndustryCode: global.insurerMongodb.model('IndustryCode'),
        IndustryCodeCategory: global.insurerMongodb.model('IndustryCodeCategory'),
        Mapping: global.mongodb.model('Mapping'),
        Message: global.mongodb.model('Message'),
        OpenIdAuthConfig: global.mongodb.model('OpenIdAuthConfig'),
        PolicyType: global.mongodb.model('PolicyType'),
        Quote: global.mongodb.model('Quote'),
        Territory: global.mongodb.model('Territory'),
        WCStateIncomeLimits: global.mongodb.model('WCStateIncomeLimits'),
        ZipCode: global.mongodb.model('ZipCode'),

        //InsurerDB
        ActivityCode: global.insurerMongodb.model('ActivityCode'),
        CodeGroup: global.insurerMongodb.model('CodeGroup'),
        Insurer: global.insurerMongodb.model('Insurer'),
        InsurerActivityCode: global.insurerMongodb.model('InsurerActivityCode'),
        InsurerIndustryCode: global.insurerMongodb.model('InsurerIndustryCode'),
        InsurerPolicyType: global.insurerMongodb.model('InsurerPolicyType'),
        InsurerQuestion: global.insurerMongodb.model('InsurerQuestion'),
        Question: global.insurerMongodb.model('Question'),
        QuestionGroup: global.insurerMongodb.model('QuestionGroup')
    }


    // Only emit the main connection
    //talageEvent.emit('mongo-connected', allConnections.conn);

    // return;
};

/**
 * Wait for MongoDB to finish connectiong to the database. Handle any errors
 * that may arise. If a DB connection occurs, we will run process.exit(1).
 * @param {*} conn Newly created Mongo connection
 * @param {string} mongoConnStr MongoDB connection string
 * @param {string} connDesc Description of connection - DB purpose
 * @returns {void}
 */
async function waitForConnection(conn, mongoConnStr, connDesc) {
    //do not log password
    const mongoConnStrParts = mongoConnStr.split("@")
    // If using localhost, then there might not be a password. If so, print the
    // whole string. If there is a password, then remove the password part.
    const logConnectionString = mongoConnStrParts.length > 1 ? mongoConnStrParts[1] : mongoConnStrParts[0];
    log.debug(`${connDesc} mongoConnStr: ${logConnectionString}`);

    await new Promise((resolve) => {
        conn.on('connected', function() {
            log.info(`${connDesc} Mongoose connected to mongodb at ${logConnectionString}`);
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