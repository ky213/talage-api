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
const optsNoId = {toJSON: {virtuals: true},id: false, _id: false};


const featureSchema = new Schema({
    applicationOptOut: {type: Boolean, required: true, default: false},
    enablePrimeAgency: {type: Boolean, required: true, default: false},
    donotShowEmailAddress: {type: Boolean, required: true, default: false},
    notifyTalage: {type: Boolean, required: true, default: false},
    agencyNetworkQuoteEmails: {type: Boolean, required: true, default: false},
    agencyNetworkDailyDigestEmail: {type: Boolean, required: true, default: false},
    agencyPortalRequestToBind: {type: Boolean, required: true, default: false}
}, optsNoId);

const AgencyNetworkSchema = new Schema({
    agencyNetworkUuidId: {type: String, required: [true, 'agencyNetworkUuidId required'], unique: true},
    agencyNetworkId: {type: Number, unique: true},
    systemId: {type: Number, unique: true},
    name: {type: String, required: true},
    email: {type: String, required: false},
    email_brand: {type: String, required: false},
    logo: {type: String, required: false},
    footer_logo: {type: String, required: false},
    login_logo: {type: String, required: false},
    fname: {type: String, required: false},
    lname: {type: String, required: false},
    help_text: {type: String, required: false},
    landing_page_content: {type: Schema.Types.Mixed},
    custom_emails: {type: Schema.Types.Mixed},
    phone: {type: String, required: false},
    featureJson: {type: featureSchema},
    additionalInfo: {type: Schema.Types.Mixed},
    insurerIds: [Number],
    active: {type: Boolean, default: true}
},opts)


// //***** Virtuals old field names ****************** */

AgencyNetworkSchema.virtual('id').
    get(function() {
        if(this.agencyNetworkId){
            return this.agencyNetworkId;
        }
        else {
            return 0;
        }
    });

AgencyNetworkSchema.virtual('agency_network').
    get(function() {
        if(this.agencyNetworkId){
            return this.agencyNetworkId;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.agencyNetworkId = v;
    });

AgencyNetworkSchema.virtual('emailBrand').
    get(function() {
        if(this.email_brand){
            return this.email_brand;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.email_brand = v;
    });


AgencyNetworkSchema.virtual('brandName').
    get(function() {
        if(this.name){
            return this.name;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.name = v;
    });

AgencyNetworkSchema.virtual('feature_json').
    get(function() {
        if(this.featureJson){
            return this.featureJson;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.featureJson = v;
    });


AgencyNetworkSchema.plugin(timestamps);
AgencyNetworkSchema.plugin(mongooseHistory);


AgencyNetworkSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.agencyNetworkUuidId) {
            this.agencyNetworkUuidId = uuid.v4();
        }
    }
    next();
});

AgencyNetworkSchema.pre('save', function(next) {
    next();
});


// // Configure the 'AgencyNetworkSchema' to use getters and virtuals when transforming to JSON
// AgencyNetworkSchema.set('toJSON', {
//     getters: true,
//     virtuals: true
// });

mongoose.set('useCreateIndex', true);
mongoose.model('AgencyNetwork', AgencyNetworkSchema);