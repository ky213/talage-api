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


let EmailContentSchema = new Schema({
    subject: {type: String, required: false},
    message: {type: String, required: false}
})

let AgencyEmailSchema = new Schema({
    agencyEmailId: { type: String, required: [true, 'agencyEmailId required'], unique: true },
    agencyMySqlId: {type: Number, required: true, unique: true},
    abandoned_applications_customer: EmailContentSchema,
    abandoned_quotes_agency: EmailContentSchema,
    abandoned_quotes_customer: EmailContentSchema,
    daily_digest: EmailContentSchema,
    onboarding: EmailContentSchema,
    new_agency_user: EmailContentSchema,
    new_agency_network_user: EmailContentSchema,
    no_quotes_agency: EmailContentSchema,
    no_quotes_customer: EmailContentSchema,
    policy_purchase_agency: EmailContentSchema,
    policy_purchase_customer: EmailContentSchema,
    talage_wholesale: EmailContentSchema,
    active: { type: Boolean, default: true }
})

AgencyEmailSchema.plugin(timestamps);
AgencyEmailSchema.plugin(mongooseHistory);


AgencyEmailSchema.pre('validate', function (next) {
    if (this.isNew) {
         if (!this.agencyEmailId) {
              this.agencyEmailId = uuid.v4();
         }
    }
    next();
});

AgencyEmailSchema.pre('save', function (next) {
    next();
});



// Configure the 'AgencyEmailSchema' to use getters and virtuals when transforming to JSON
AgencyEmailSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('AgencyEmail', AgencyEmailSchema);