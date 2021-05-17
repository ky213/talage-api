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

const IncomeLimitSchema = new Schema({
    effectiveDate: {type: Date, required: false},
    expirationDate: {type: Date, required: false},
    payrollLimit: {type: Number, required: false},
    attributes: {type: Schema.Types.Mixed} // Solves the problem from New York data where construction and non-construction have different limits (given same entity type)
});

const IncludedInCoverageSchema = new Schema({
    employeeType: {type: String},
    include: {type: Boolean}, 
    exclude: {type: Boolean}, 
    conditions: {type: Schema.Types.Mixed} 
// zy Rules are difficult to structure. As laid out here we can show whether something can be included or excluded. 
// The conditions property just shows stated rules, not necessarily what to do about them. 
// Alternatively, we could drop entire "description" block into a "rules" property on the main schema
});

const OwnerIncomeLimitsSchema = new Schema({
    ownerIncomeId : {type: String, required: [true, 'owner income id required'], unique: true},
    insurerId: {type: Number, required: [true, 'insurer id required']},
    state: {type: String, required: [true, 'state required']},
    entityType: {type: String, required: [true, 'entity type required']}, // Do we want entity type to be an array to allow for different entities with the same rules?
    attributes: {type: Schema.Types.Mixed},
    employeeInclusionStatus: {type: [IncludedInCoverageSchema], required: false, default: []},
    minLimit: {type: [IncomeLimitSchema], required: false, default: []},
    maxLimit: {type: [IncomeLimitSchema], required: false, default: []}
});

OwnerIncomeLimitsSchema.plugin(timestamps);
OwnerIncomeLimitsSchema.plugin(mongooseHistory);

OwnerIncomeLimitsSchema.pre('validate', next => {
    if (this.isNew) {
        if (!this.ownerIncomeId) {
            this.ownerIncomeId = uuid.v4();
        }
    }
    next();
});

OwnerIncomeLimitsSchema.pre('save', next => {
    next();
});

// Configure the 'MessageSchema' to use getters and virtuals when transforming to JSON
// OwnerIncomeLimitsSchema.set('toJSON', { // zy What does this do?
//     getters: true,
//     virtuals: true
// });

mongoose.set('useCreateIndex', true); // zy What do these do?
mongoose.model('OwnerIncomeLimits', OwnerIncomeLimitsSchema);