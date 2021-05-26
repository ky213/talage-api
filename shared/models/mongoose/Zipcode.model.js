/* eslint-disable strict */
/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */

var mongoose = require('mongoose'), Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');

global.requireShared('./helpers/tracker.js');

// enum for zipcode type
const zipCodeTypes = [
    "UNIQUE",
    "STANDARD",
    "PO BOX",
    "MILITARY"
];

const ZipCodeSchema = new Schema({
    zipCodeId: {type: String, required: [true, 'zipCodeId required'], unique: true},
    zipCode: {type: String, required: true, unique: false},
    extendedZipCode: {type: String, required: false, unique: true},
    type: {type: String, enum: zipCodeTypes, default: 'STANDARD'},
    city: {type: String},
    state: {type: String},
    county: {type: String},
    getUpdate: {type: Boolean, required: true, default: false}
}, {_id: false});

ZipCodeSchema.plugin(timestamps);
ZipCodeSchema.plugin(mongooseHistory);


ZipCodeSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.zipCodeId) {
            this.zipCodeId = uuid.v4();
        }
    }
    next();
});

ZipCodeSchema.pre('save', function(next) {
    next();
});


// Configure the 'QuoteSchema' to use getters and virtuals when transforming to JSON
ZipCodeSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('ZipCode', ZipCodeSchema);