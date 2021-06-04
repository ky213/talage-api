/* eslint-disable strict */
/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */

const mongoose = require('mongoose'), Schema = mongoose.Schema;
const timestamps = require('mongoose-timestamp');
const uuid = require('uuid');
const mongooseHistory = require('mongoose-history');

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
    zipCode: {type: String, required: true, unique: false, minlength: 5, maxlength: 5},
    // This enforces extended zip code uniqueness, while dually allowing for duplicate null values
    extendedZipCode: {
        type: String, sparse: true, minLength: 9, maxLength: 9, index: {
            unique: true,
            partialFilterExpression: {extendedZipCode: {$type: "string"}}
        }
    },
    type: {type: String, enum: zipCodeTypes, default: 'STANDARD'},
    city: {type: String, trim: true},
    state: {type: String},
    county: {type: String, trim: true},
    getUpdate: {type: Boolean, required: true, default: false}
});

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