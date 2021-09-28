/* eslint-disable strict */
/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */

const mongoose = global.mongodb, Schema = require('mongoose').Schema;
var timestamps = require('mongoose-timestamp');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');

const opts = {toJSON: {virtuals: true}};

const PolicyTypeSchema = new Schema({
    policyTypeId: {type: String, required: [true, 'policyTypeId required'], unique: true},
    policyTypeCd: {type: String, required: [true, 'policyTypeCd required'], unique: true},
    abbr: {type: String, required: [true, 'abbr required'], unique: true},
    name: {type: String, required: true},
    description: {type: String, required: false},
    heading: {type: String, required: false},
    wheelhouse_support: {type: Boolean, default: true},
    active: {type: Boolean, default: true}
},opts)


PolicyTypeSchema.plugin(timestamps);
PolicyTypeSchema.plugin(mongooseHistory, {
    historyConnection: global.mongodb
});


PolicyTypeSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.policyTypeId) {
            this.policyTypeId = uuid.v4();
        }
    }
    next();
});

PolicyTypeSchema.pre('save', function(next) {
    next();
});

mongoose.set('useCreateIndex', true);
mongoose.model('PolicyType', PolicyTypeSchema);