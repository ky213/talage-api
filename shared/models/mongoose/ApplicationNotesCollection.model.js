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
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');

// eslint-disable-next-line no-unused-vars

const ApplicationNotesCollectionSchema = new Schema({
    applicationNotesCollectionId: {type: String, required: [true, 'applicationNotesCollectionId required'], unique: true},
    applicationId: {type: String, required: [true, 'applicationId required']},
    applicationNotesJSON: {type: Schema.Types.Mixed, required: false},
    agencyPortalCreatedUser: {type: String},
    agencyPortalModifiedUser: {type: String},
});

ApplicationNotesCollectionSchema.plugin(timestamps);
ApplicationNotesCollectionSchema.plugin(mongooseHistory);

ApplicationNotesCollectionSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.applicationNotesCollectionId) {
            this.applicationNotesCollectionId = uuid.v4();
        }
    }
    next();
});

mongoose.set('useCreateIndex', true);
mongoose.model('Application', ApplicationNotesCollectionSchema);
