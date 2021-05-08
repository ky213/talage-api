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

const IndustryCodeCategorySchema = new Schema({
    talageIndustryCodeCategoryUuid: {type: String, required: [true, 'talageIndustryCodeCategoryUuid required'], unique: true},
    industryCodeCategoryId: {type: Number, required: [true, 'industryCodeCategoryId required']},
    featured:{type: Boolean, default: true},
    name: {type: String, required: false},
    talageStandard: {type: Boolean, default: false},
    industryCodeCategoryGroupList: [String],
    active: {type: Boolean, default: true}
},opts)


IndustryCodeCategorySchema.plugin(timestamps);
IndustryCodeCategorySchema.plugin(mongooseHistory);


IndustryCodeCategorySchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.talageIndustryCodeCategoryUuid) {
            this.talageIndustryCodeCategoryUuid = uuid.v4();
        }
    }
    next();
});

IndustryCodeCategorySchema.pre('save', function(next) {
    next();
});

mongoose.set('useCreateIndex', true);
mongoose.model('ActivityCode', IndustryCodeCategorySchema);