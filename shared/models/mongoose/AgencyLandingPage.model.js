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



const AgencyLandingPageSchema = new Schema({
    agencyLandingPageId: {type: String, required: [true, 'agencyLandingPageId required'], unique: true},
    systemId: {type: Number, unique: true},
    mysqlId: {type: Number, unique: true},
    agencyId: {type: Number},
    agencyLocationId: {type: Number},
    primary: {type: Boolean, default: false},
    industryCodeId: {type: Number},
    industryCodeCategoryId: {type: Number},
    colorSchemeId: {type: Number},
    introHeading: {type: String, required: false},
    introText: {type: String, required: false},
    name: {type: String, required: false},
    showIndustrySection: {type: Boolean, required: false},
    zipcode: {type: String, required: false},
    phone: {type: String, required: false},
    email: {type: String, required: false},
    slug: {type: String, required: false},
    banner: {type: String, required: false},
    about: {type: String, required: false},
    additionalInfo: {type: Schema.Types.Mixed},
    agencyPortalCreatedUser: {type: String},
    agencyPortalModifiedUser: {type: String},
    agencyPortalDeletedUser: {type: String},
    active: {type: Boolean, default: true}
})

AgencyLandingPageSchema.plugin(timestamps);
AgencyLandingPageSchema.plugin(mongooseHistory);


AgencyLandingPageSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.agencyLandingPageId) {
            this.agencyLandingPageId = uuid.v4();
        }
    }
    next();
});

AgencyLandingPageSchema.pre('save', function(next) {
    next();
});


// Configure the 'AgencyLandingPageSchema' to use getters and virtuals when transforming to JSON
AgencyLandingPageSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('AgencyLandingPage', AgencyLandingPageSchema);