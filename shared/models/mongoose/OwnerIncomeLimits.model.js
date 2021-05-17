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

const IncomeLimitSchema = new Schema({ // zy Make just "IncomeLimitSchema"?
    effectiveDate: {type: Date, required: false},
    expirationDate: {type: Date, required: false},
    payrollLimit: {type: Number, required: false},
    attributes: {type: Schema.Types.Mixed} // Solves the problem from New York data where construction and non-construction have different limits (given same entity type)
});

const IncludeExcludeSchema = new Schema({ // zy Review naming
    able: {type: Boolean, required: true},
    conditions: {type: Schema.Types.Mixed}
});

const IncludedInCoverageSchema = new Schema({ // zy This is certainly wrong but could be a skeleton of something if we wanted to include it at all
    employeeType: {type: String},
    include: {type: IncludeExcludeSchema},
    exclude: {type: IncludeExcludeSchema}
});

const OwnerIncomeLimitsSchema = new Schema({
    ownerIncomeId : {type: String, required: [true, 'owner income id required'], unique: true},
    insurerId: {type: Number, required: [true, 'insurer id required']},
    state: {type: String, required: [true, 'state required']},
    entityType: {type: String, required: [true, 'entity type required']}, // Do we want entity type to be an array to allow for different entities with the same rules
    attributes: {type: Schema.Types.Mixed},
    inclusionStatus: {type: [IncludedInCoverageSchema], required: false, default: []},
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