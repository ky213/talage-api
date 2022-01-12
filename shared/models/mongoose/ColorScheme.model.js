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

const opts = {toJSON: {virtuals: true}};

const ColorSchemeSchema = new Schema({
    colorSchemeUuid: {type: String, required: [true, 'colorSchemeId required'], unique: true},
    colorSchemeId: {type: Number, required: [true, 'colorSchemeId required'], unique: true},
    name: {type: String, required: true},
    primary: {type: String, required: false},
    primary_accent: {type: String, required: false},
    secondary: {type: String, required: false},
    secondary_accent: {type: String, required: false},
    tertiary: {type: String, required: false},
    tertiary_accent: {type: String, required: false},
    active: {type: Boolean, default: true}
},opts)


ColorSchemeSchema.plugin(timestamps);
ColorSchemeSchema.plugin(mongooseHistory);


ColorSchemeSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.colorSchemeUuid) {
            this.colorSchemeUuid = uuid.v4();
        }
    }
    next();
});

ColorSchemeSchema.pre('save', function(next) {
    next();
});

mongoose.set('useCreateIndex', true);
mongoose.model('ColorScheme', ColorSchemeSchema);