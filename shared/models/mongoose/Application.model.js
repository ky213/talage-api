// Invoke 'strict' JavaScript mode
/* jshint -W097 */ // don't warn about "use strict"
/*jshint esversion: 6 */
'use strict';

var mongoose = require('mongoose'), Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');
var moment = require('moment');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');
const { stringify } = require('csv');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

let contactSchema = new Schema({
    email: {type: String, required: true},
    fristName: {type: String, required: true},
    lastName: {type: String, required: true},
    phone: {type: String, required: true},
    primary: {type: Boolean, required: true, default: false }
})

let ActivtyCodePayrollSchema = new Schema({
    ncciCode: {type: String, required: true},
    payroll: {type: Number, required: true}
})

let locationSchema = new Schema({
    address: {type: String, required: false},
    address2: {type: String, required: false},
    city: {type: string, required: false},
    state: {type: String, required: false},
    zipcode: {type: String, required: false},
    phone: {type: String, required: false},
    ein: {type: String, required: false},
    full_time_employees:  {type: Number, required: false},
    part_time_employees:  {type: Number, required: false},
    square_footage:  {type: Number, required: false},
    unemployment_num:  {type: Number, required: false},
    billing: {type: Boolean, required: true, default: false },
    activityPayrollList: [ActivtyCodePayrollSchema]
})

let ownerSchema = new Schema({
    birthdate: {type: Date, required: true},
    fname: {type: String, required: true},
    lname: {type: String, required: true},
    ownership: {type: Number, required: true},
    officerTitle: {type: String, required: true}
})


let BusinessSchema = new Schema({
    name: {type: String, required: false},
    entityType: {type: String, required: false},
    fileNum: {type: String, required: false},
    founded: {type: Date, required: false},
    hasEin: {type: Boolean, required: true, default: true },
    ein: {type: String, required: false},
    "mailingAddress": {type: String, required: false},
    "mailingAddress2": {type: String, required: false},
    "mailingCity": {type: String, required: false},
    "mailingState": {type: String, required: false},
    "mailingZipcode": {type: String, required: false},
    "phone": {type: String, required: false},
    "primaryTerritory": {type: String, required: false},
    "primaryState": {type: String, required: false},
    "website": {type: String, required: false},
    "yearsOfExp": {type: Number, required: false},
    management_structure: {type: String, required: false},
    "numOwners": {type: Number, required: false},
    "ownersIncluded": true,
    "owners": [ownerSchema],
    "unincorporated_association": {type: String, required: false},
    experience_modifier: {type: Number, required: false},
    ncciNumber: {type: String, required: false},
    association: {type: String, required: false},
    associationId: {type: String, required: false},
    affiliate: {type: String, required: false},
    bureauNumber: {type: String, required: false},
    locations: [locationSchema]

})

let claimSchema = new Schema({
    policyType: {type: String, required: true},
    amountPaid: {type: Number, required: true},
    amountReserved: {type: Number, required: true},
    eventDate: {type: Date, required: true},
    open: {type: Boolean, required: true, default: false },
    missedWork: {type: Boolean, required: true, default: false }

})

//limit structure.

let PolicySchema = new Schema({
    policyType: {type: String, required: true},
    effectiveDate: {type: Date, required: false},
    expirationDate: {type: Date, required: false},
    limits: {type: String, required: false},
    deductible: 1500,
    coverage: {type: Number, required: false}, // BOP field
    coverageLapse:  {type: Boolean, required: true, default: false },
    waiverSubrogation: {type: Boolean, required: true, default: false },
    claims =[claimSchema]

})

let ApplicationSchema = new Schema({
    applicationId: { type: String, required: [true, 'applicationId required'], unique: true },
    uuid: {type: String, required: false},
    mysqlId: {type: Number, required: false},
    agencyNetworkId: {type: Number, required: true},
    agencyId: {type: Number, required: true},
    agencyLocationId: {type: Number, required: true},
    appStatusId: {type: Number, required: true},
    progress: {type: Number, required: true},
    status: {type: String, required: false},
    solepro:  {type: Boolean, required: true, default: false },
    wholesale:  {type: Boolean, required: true, default: false },
    abandoned_email:  {type: Boolean, required: true, default: false },
    abandoned_app_email:  {type: Boolean, required: true, default: false },
    opted_out_online_emailsent:  {type: Boolean, required: true, default: false },
    opted_out_online:  {type: Boolean, required: true, default: false },
    processStateOld: {type: Number, required: true},
    referrer: {type: String, required: false},
    industryCode: {type: String, required: false},
    entityType: {type: String, required: false},
    businessName: {type: String, required: false},
    contact: [contactSchema],
    business: BusinessSchema,
    policies = [PolicySchema],
    grossSalesAmt: {type: Number, required: true},
    questions: { type: Schema.Types.Mixed },
    additionalInfo: { type: Schema.Types.Mixed },
    businessDataJSON: { type: Schema.Types.Mixed },
    active: { type: Boolean, default: true }
})

ApplicationSchema.plugin(timestamps);
ApplicationSchema.plugin(mongooseHistory);


ApplicationSchema.pre('validate', function (next) {
    if (this.isNew) {
         if (!this.applicationId) {
              this.applicationId = uuid.v4();
         }
    }
    next();
});

ApplicationSchema.pre('save', function (next) {
    if (this.isNew) {
         this.timestamp = moment().unix();
    }
    else {
         //check timestamp is number not date.
         if (isNaN(this.timestamp)) {
              this.timestamp = moment().unix();
         }
    }
    next();
});



// Configure the 'ApplicationSchema' to use getters and virtuals when transforming to JSON
ApplicationSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('Application', ApplicationSchema);