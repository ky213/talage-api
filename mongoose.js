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

module.exports = function() {
    let mongoConnStr = '';
    mongoose.Promise = Promise;

    var connectionUrl = global.settings.MONGODB_CONNECTIONURL;
    var connectionUrlQuery = '';
    if(global.settings.MONGODB_CONNECTIONURLQUERY){
        connectionUrlQuery = global.settings.MONGODB_CONNECTIONURLQUERY;
    }

    var connectionParts = connectionUrl.split("@");
    var dataserver = "";
    if(connectionParts.length > 1){
        dataserver = connectionParts[1];
    }
    else {
        dataserver = connectionParts[0];
    }

    var databaseName = global.settings.MONGODB_DATABASENAME;


    mongoConnStr = connectionUrl + databaseName + connectionUrlQuery
    // eslint-disable-next-line object-property-newline
    var connectionOption = {useNewUrlParser: true, useUnifiedTopology: true};
    //do not log password
    const mongoConnStrParts = mongoConnStr.split("@")
    log.debug("mongoConnStr: " + mongoConnStrParts[1]);
    var mongodb = mongoose.connect(mongoConnStr,connectionOption);
    var mongodb2 = mongoose.connection;

    mongodb2.on('connected', function() {
        log.info('Mongoose connected to mongodb at ' + dataserver + ' DB: ' + databaseName);
        talageEvent.emit('mongo-connected', mongodb);
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


    require('./shared/models/mongoose/PolicyType.model');

    require('./shared/models/mongoose/AgencyPortalUser.model');


    return mongodb;

};