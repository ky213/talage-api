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

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const opts = {toJSON: {virtuals: true}};
const optsNoId = {toJSON: {virtuals: true}, _id : false}

//Used to override main list for special cases.
const InsurerTerritoryQuestionSchema = new Schema({
    territory: {type: String, required: true},
    insurerQuestionIdList: [String]
},optsNoId)


const InsurerIndustryCodeSchema = new Schema({
    insurerIndustryCodeId: {type: String, required: [true, 'insurerIndustryCodeId required'], unique: true},
    insurerId: {type: Number},
    policyType: {type: String, required: false, default: null},
    policyTypeList: [String],
    type: {type: String, required: false},
    code: {type: String, required: false},
    description: {type: String, required: false},
    attributes: {type: Schema.Types.Mixed},
    effectiveDate: {type: Date, required: true},
    expirationDate: {type: Date, required: true},
    territoryList: [String],
    talageIndustryCodeIdList: [Number],
    talageQuestionIdList: [Number],
    insurerQuestionIdList: [String],
    insurerQuestionSystemIdList: [Number],
    insurerTerritoryQuestionList: [InsurerTerritoryQuestionSchema],
    oldSystemIdList: [Number],
    active: {type: Boolean, default: true}
},opts)


InsurerIndustryCodeSchema.index({insurerId: 1}); // Insure Index
//InsurerIndustryCodeSchema.index({insurerId: 1, policyType: 1, code: 1});
//InsurerIndustryCodeSchema.index({insurerId: 1, talageIndustryCodeIdList: 1});

// //***** Virtuals old field names ****************** */

InsurerIndustryCodeSchema.plugin(timestamps);
InsurerIndustryCodeSchema.plugin(mongooseHistory);


InsurerIndustryCodeSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.insurerIndustryCodeId) {
            this.insurerIndustryCodeId = uuid.v4();
        }
    }
    next();
});

InsurerIndustryCodeSchema.pre('save', function(next) {
    next();
});


// // Configure the 'InsurerIndustryCodeSchema' to use getters and virtuals when transforming to JSON
// InsurerIndustryCodeSchema.set('toJSON', {
//     getters: true,
//     virtuals: true
// });

mongoose.set('useCreateIndex', true);
mongoose.model('InsurerIndustryCode', InsurerIndustryCodeSchema);