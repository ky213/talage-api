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

const TerritorySchema = new Schema({
    territoryId: {type: String, required: [true, 'territoryId required'], unique: true},
    abbr: {type: String, required: [true, 'abbr required'], unique: true},
    name: {type: String, required: true},
    licensed: {type: Number, required: false},
    resource: {type: String, required: false},
    individual_license_expiration_date: {type: Date, required: false},
    individual_license_number: {type: String, required: false},
    talage_license_expiration_date: {type: Date, required: false},
    talage_license_number: {type: String, required: false},
    active: {type: Boolean, default: true}
},opts)


TerritorySchema.plugin(timestamps);
TerritorySchema.plugin(mongooseHistory, {
    historyConnection: global.mongodb
});


TerritorySchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.territoryId) {
            this.territoryId = uuid.v4();
        }
    }
    next();
});

TerritorySchema.pre('save', function(next) {
    next();
});

mongoose.set('useCreateIndex', true);
mongoose.model('Territory', TerritorySchema);