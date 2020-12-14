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

const MetaSchema = new Schema({
    description:{type: String, required: false},
    title: {type: String, required: false}
},{_id : false})

const opts = {toJSON: {virtuals: true}};

const AgencyLandingPageSchema = new Schema({
    agencyLandingPageId: {type: String, required: [true, 'agencyLandingPageId required'], unique: true},
    systemId: {type: Number, unique: true},
    mysqlId: {type: Number, unique: true},
    agencyId: {type: Number},
    agencyLocationId: {type: Number},
    about: {type: String, required: false},
    banner: {type: String, required: false},
    primary: {type: Boolean, default: false},
    industryCodeId: {type: Number},
    industryCodeCategoryId: {type: Number},
    colorSchemeId: {type: Number},
    heading: {type: String, required: false},
    hits: {type: Number, default: 0},
    introHeading: {type: String, required: false},
    introText: {type: String, required: false},
    showIntroText: {type: Boolean, default: false},
    meta: MetaSchema,
    name: {type: String, required: false},
    showIndustrySection: {type: Boolean, required: false},
    slug: {type: String, required: false},
    additionalInfo: {type: Schema.Types.Mixed},
    agencyPortalCreatedUser: {type: String},
    agencyPortalModifiedUser: {type: String},
    agencyPortalDeletedUser: {type: String},
    active: {type: Boolean, default: true}
},opts)

// //***** Virtuals old field names ****************** */

AgencyLandingPageSchema.virtual('id').
    get(function() {
        if(this.systemId){
            return this.systemId;
        }
        else {
            return 0;
        }
    });

AgencyLandingPageSchema.virtual('agency').
    get(function() {
        if(this.agencyId){
            return this.agencyId;
        }
        else {
            return 0;
        }
    }).
    set(function(v){
        this.agencyId = v;
    });




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


mongoose.set('useCreateIndex', true);
mongoose.model('AgencyLandingPage', AgencyLandingPageSchema);