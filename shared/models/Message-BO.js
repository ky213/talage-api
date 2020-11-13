'use strict';


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// const moment = require('moment');
// const moment_timezone = require('moment-timezone');

module.exports = class MessageBO{


    //constructor(){}


    async saveMessage(columns, recipients, sendGridResp, attachments, applicationDoc){
        const mongoModelMapping = {
            application: "applicationId",
            business: "businessId",
            agency_location: "agencyLocationId"
        }
        //For MongoDB
        const sentDtm = columns.sent

        //************************** */
        //   MongoDB Write
        //************************** */

        var Message = require('mongoose').model('Message');
        const mongoMessageDoc = {}
        mongoMessageDoc.recipients = recipients;
        mongoMessageDoc.sendGridResp = sendGridResp;
        mongoMessageDoc.sent = sentDtm;

        if(columns.sent){
            delete columns.sent;
        }

        if(applicationDoc){
            mongoMessageDoc.agencyId = applicationDoc.agencyId;
            mongoMessageDoc.agencyNetworkId = applicationDoc.agencyNetworkId;
        }
        if(attachments){
            mongoMessageDoc.attachments = attachments;
        }
        //Map columns
        Object.entries(columns).forEach(([key, value]) => {
            let mongoProp = key;
            if(mongoModelMapping[key]){
                mongoProp = mongoModelMapping[key]
            }
            mongoMessageDoc[mongoProp] = value;
        });

        var message = new Message(mongoMessageDoc);

        //Insert a doc
        await message.save().catch(function(err){
            log.error('Mongo Message Save err ' + err + __location);
            //log.debug("message " + JSON.stringify(message.toJSON()));
        });


        return true;
    }

}