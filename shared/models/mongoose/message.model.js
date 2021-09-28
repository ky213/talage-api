/* eslint-disable strict */
/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */
// Invoke 'strict' JavaScript mode
/* jshint -W097 */ // don't warn about "use strict"
/*jshint esversion: 6 */
'use strict';

const mongoose = global.mongodb, Schema = require('mongoose').Schema;
var timestamps = require('mongoose-timestamp');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const AttachmentSchema = new Schema({
    content: {type: String, required: false},
    filename: {type: String, required: false},
    type: {type: String, required: false},
    disposition: {type: String, required: false}
})

const MessageSchema = new Schema({
    messageId: {type: String, required: [true, 'messageId required'], unique: true},
    mysqlId: {type: Number, required: false},
    applicationId: {type: String, required: false},
    appmysqlId: {type: Number, required: false},
    businessId: {type: Number, required: false},
    businessName: {type: String, required: false},
    agencyLocationId: {type: Number, required: false},
    agencyId: {type: Number, required: false},
    agencyNetworkId: {type: Number, required: false},
    subject: {type: String, required:[true, 'subject required']},
    message: {type: String, required:[true, 'message required']},
    attachment: {type: String, required: false},
    recipients: [String],
    attachments: [AttachmentSchema],
    "sent": Date,
    sendGridResp: {type: Schema.Types.Mixed}
})

MessageSchema.plugin(timestamps);
MessageSchema.plugin(mongooseHistory, {
    historyConnection: global.mongodb
});


MessageSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.messageId) {
            this.messageId = uuid.v4();
        }
    }
    next();
});

MessageSchema.pre('save', function(next) {
    next();
});


// Configure the 'MessageSchema' to use getters and virtuals when transforming to JSON
MessageSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('Message', MessageSchema);