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

const mongoose = require('mongoose'), Schema = mongoose.Schema;
const timestamps = require('mongoose-timestamp');
const uuid = require('uuid');
const mongooseHistory = require('mongoose-history');

global.requireShared('./helpers/tracker.js');

const opts = {toJSON: {virtuals: true}};
const optsNoId = {toJSON: {virtuals: true}, _id : false}

const IncomeLimitSchema = new Schema({
    effectiveDate: {type: Date, required: true},
    minIncomeLimit: {type: Number, required: false},
    maxIncomeLimit: {type: Number, required: false}
}, optsNoId);

const OfficerTitleInclusionStatusSchema = new Schema({
    officerTitle: {type: String, required: true},
    stateOfficerTitle: {type: String, required: false},
    mustInclude: {type: Boolean, required: true}
}, optsNoId);

const WCStateIncomeLimitsSchema = new Schema({
    wcStateIncomeLimitsId: {type: String, required: [true, 'state income limit id required'], unique: true},
    state: {type: String, required: [true, 'state required']},
    entityType: {type: String, required: [true, 'entity type required']},
    stateEntityTypeDesc: {type: String, required: false},
    rulesDesc: {type: String, required: false},
    isCustom: {type: Boolean, default: false},
    attributes: {type: Schema.Types.Mixed, required: false},
    officerTitleInclusionStatuses: [OfficerTitleInclusionStatusSchema],
    incomeLimits: [IncomeLimitSchema],
    active: {type: Boolean, default: true}
}, opts);

WCStateIncomeLimitsSchema.plugin(timestamps);
WCStateIncomeLimitsSchema.plugin(mongooseHistory);

WCStateIncomeLimitsSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.wcStateIncomeLimitsId) {
            this.wcStateIncomeLimitsId = uuid.v4();
        }
    }
    next();
});

WCStateIncomeLimitsSchema.pre('save', function(next) {
    next();
});

mongoose.set('useCreateIndex', true);
mongoose.model('WCStateIncomeLimits', WCStateIncomeLimitsSchema);