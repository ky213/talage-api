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
// var timestamps = require('mongoose-timestamp'); // zy Is this important?
var uuid = require('uuid');
// var mongooseHistory = require('mongoose-history');  // zy Is this important?

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js'); // zy Is this important?

const incomeLimitValuesSchema = new Schema({
    effectiveDate: {type: Date, required: [true, 'effective date required']},
    expirationDate: {type: Date, required: [true, 'expiration date required']},
    payrollMin: {type: Number, required: false},
    payrollMax: {type: Number, required: false}
})

const includedInCoverageSchema = new Schema({ // zy This is certainly wrong but could be a skeleton of something if we wanted to include it at all
    employeeType: {type: String, enum: ['executive', 'employee', 'manager', 'proprietor']},
    included: {type: Boolean},
    canFlipInclusionStatus: {type: Boolean}
})

const IncomeLimitsSchema = new Schema({ // zy I think this is a terrible name
    insurerId: {type: Number, required: [true, 'insurer id required']},
    state: {type: String, required: [true, 'state required']},
    entity: {type: String, 
            enum: [
                'corporation', 
                'proprietorship', 
                'partnership', 
                'llc', 
                'non-profit', 
                'public', 
                'other', 
                'trusts-and-estates', 
                'family-members',
                'board-of-directors',
                'employee-election'
            ]},
    attributes: {type: Schema.Types.Mixed},
    inclusionStatus: {type: [includedInCoverageSchema], required: false, default: []},
    incomeLimits: {type: [incomeLimitValuesSchema], required: false, default: []}
})

// MessageSchema.plugin(timestamps); // zy remove?
// MessageSchema.plugin(mongooseHistory); // zy remove?


// MessageSchema.pre('validate', function(next) { // zy What is this?
//     if (this.isNew) {
//         if (!this.messageId) {
//             this.messageId = uuid.v4();
//         }
//     }
//     next();
// });

// MessageSchema.pre('save', function(next) { // zy What is this?
//     next();
// });


// Configure the 'MessageSchema' to use getters and virtuals when transforming to JSON
// MessageSchema.set('toJSON', { // zy What is this
//     getters: true,
//     virtuals: true
// });

mongoose.set('useCreateIndex', true); // zy What do these do?
mongoose.model('IncomeLimits', IncomeLimitsSchema);