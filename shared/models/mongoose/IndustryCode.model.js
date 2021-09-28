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

const IndustryCodeSchema = new Schema({
    talageIndustryCodeUuid: {type: String, required: [true, 'talageIndustryCodeUuid required'], unique: true},
    industryCodeId: {type: Number, required: [true, 'industryCodeId required']},
    industryCodeCategoryId: {type: Number},
    featured:{type: Boolean, default: false},
    naics: {type: String, required: false},
    cgl: {type: String, required: false},
    sic: {type: String, required: false},
    iso: {type: String, required: false},
    hiscox: {type: String, required: false},
    description: {type: String, required: false},
    talageStandard: {type: Boolean, default: false},
    codeGroupList: [String],
    activityCodeIdList: [Number],
    primaryActivityCodeId: {type: Number, required: false}, //used when InsurerId only want the primary ActivityCode for the industry
    alternateNames: [String],
    attributes: {type: Schema.Types.Mixed},
    parentIndustryCodeId: {type: Number, required: false},
    active: {type: Boolean, default: true}
},opts)

IndustryCodeSchema.virtual('id').
    get(function() {
        return this.industryCodeId;
    });


IndustryCodeSchema.plugin(timestamps);
IndustryCodeSchema.plugin(mongooseHistory, {
    historyConnection: global.mongodb
});


IndustryCodeSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.talageIndustryCodeUuid) {
            this.talageIndustryCodeUuid = uuid.v4();
        }
    }
    next();
});

IndustryCodeSchema.pre('save', function(next) {
    next();
});

mongoose.set('useCreateIndex', true);
mongoose.model('IndustryCode', IndustryCodeSchema);