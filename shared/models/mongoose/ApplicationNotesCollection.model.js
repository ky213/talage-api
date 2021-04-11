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

var mongoose = require('mongoose'), Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');
var mongooseHistory = require('mongoose-history');

// eslint-disable-next-line no-unused-vars

const ApplicationNotesCollectionSchema = new Schema({
    applicationId: {type: String, required: [true, 'applicationId required'], unique: true},
    applicationNotesJSON: {type: Schema.Types.Mixed, required: false},
    agencyPortalCreatedUser: {type: String},
    agencyPortalModifiedUser: {type: String},
});

ApplicationNotesCollectionSchema.plugin(timestamps);
ApplicationNotesCollectionSchema.plugin(mongooseHistory);

mongoose.set('useCreateIndex', true);
mongoose.model('ApplicationNotesCollection', ApplicationNotesCollectionSchema);
