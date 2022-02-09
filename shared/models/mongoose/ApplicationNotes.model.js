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
var mongooseHistory = require('mongoose-history');

// eslint-disable-next-line no-unused-vars

const ApplicationNotesCollectionSchema = new Schema({
    applicationId: {type: String, required: [true, 'applicationId required']},
    noteContents: {type: Schema.Types.Mixed, required: false},
    agencyPortalCreatedUser: {type: String}
});

ApplicationNotesCollectionSchema.plugin(timestamps);
ApplicationNotesCollectionSchema.plugin(mongooseHistory, {
    historyConnection: global.mongodb
});

mongoose.set('useCreateIndex', true);
mongoose.model('ApplicationNotes', ApplicationNotesCollectionSchema);