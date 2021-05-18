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
    maxIncomeLimit: {type: Number, required: false},
    attributes: {type: String, required: false}
}, optsNoId);

const EmployeeInclusionStatusSchema = new Schema({ 
    employeeTitle: {type: String, required: true}, 
    mustInclude: {type: Boolean, required: true},
}, optsNoId);


const StateIncomeLimitsSchema = new Schema({
    stateIncomeLimitsId : {type: String, required: [true, 'state income limit id required'], unique: true},
    state: {type: String, required: [true, 'state required']},
    entityType: {type: String, required: [true, 'entity type required']},
    rules: {type: String, required: false},
    employeeInclusionStatus: {type: [EmployeeInclusionStatusSchema], required: false, default: []},
    incomeLimit: {type: [IncomeLimitSchema], required: true}
}, opts);

StateIncomeLimitsSchema.plugin(timestamps);
StateIncomeLimitsSchema.plugin(mongooseHistory);

StateIncomeLimitsSchema.pre('validate', next => {
    if (this.isNew) {
        if (!this.stateIncomeLimitsId) {
            this.stateIncomeLimitsId = uuid.v4();
        }
    }
    next();
});

StateIncomeLimitsSchema.pre('save', next => {
    next();
});

mongoose.set('useCreateIndex', true);
mongoose.model('OwnerIncomeLimits', StateIncomeLimitsSchema);