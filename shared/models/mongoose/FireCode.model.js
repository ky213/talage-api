/* eslint-disable strict */
/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */

const mongoose = global.insurerMongodb, Schema = require('mongoose').Schema;
var timestamps = require('mongoose-timestamp');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');

const opts = {toJSON: {virtuals: true}};

const CGLSchema = new Schema({
    cgl: {type: String, required: true},
    cglDescription: {type: String, required: false},
    fireCodeDescription: {type: String, required: false}
}, opts);

const FireCodeSchema = new Schema({
    talageFireCodeId: {type: String, required: [true, 'talageFireCodeId required'], unique: true},
    // featured:{type: Boolean, default: false},
    naics: {type: String, required: false},
    cgl: {type: [CGLSchema], required: false},
    sic: {type: String, required: false},
    iso: {type: String, required: false},
    description: {type: String, required: false},
    talageStandard: {type: Boolean, default: true},
    codeGroupList: [String],
    alternateNames: [String],
    attributes: {type: Schema.Types.Mixed},
    parentFireCodeId: {type: Number, required: false},
    active: {type: Boolean, default: true}
}, opts);

FireCodeSchema.virtual('id').
    get(function() {
        return this.talageFireCodeId;
    });


FireCodeSchema.plugin(timestamps);
FireCodeSchema.plugin(mongooseHistory, {
    historyConnection: global.insurerMongodb
});


FireCodeSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.talageFireCodeId) {
            this.talageFireCodeId = uuid.v4();
        }
    }
    next();
});

FireCodeSchema.pre('save', function(next) {
    next();
});

mongoose.set('useCreateIndex', true);
mongoose.model('FireCode', FireCodeSchema);