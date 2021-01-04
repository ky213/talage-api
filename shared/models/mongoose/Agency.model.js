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

const AgencySchema = new Schema({
    agencyId: {type: String, required: [true, 'agencyId required'], unique: true},
    systemId: {type: Number, unique: true},
    mysqlId: {type: Number, unique: true},
    agencyNetworkId: {type: Number},
    caLicenseNumber: {type: String, required: false},
    email: {type: String, required: false},
    logo: {type: String, required: false},
    firstName: {type: String, required: false},
    lastName: {type: String, required: false},
    name: {type: String, required: false},
    phone: {type: String, required: false},
    slug: {type: String, required: false},
    website: {type: String, required: false},
    wholesale: {type: Boolean, default: false},
    wholesaleAgreementSigned: {type: Date},
    docusignEnvelopeId: {type: String, required: false},
    doNotReport: {type: Boolean, default: false},
    enabelOptOut: {type: Boolean, default: false},
    donotShowEmailAddress: {type: Boolean, default: false},
    additionalInfo: {type: Schema.Types.Mixed},
    agencyPortalCreatedUser: {type: String},
    agencyPortalModifiedUser: {type: String},
    agencyPortalDeletedUser: {type: String},
    primaryAgency: {type: Boolean, default: false},
    active: {type: Boolean, default: true}
},opts)

// const SocialMediaSchema = new Schema({
//     facebookPixel: {type: String, required: false},
//     googleAdTag: {type: String, required: false},
//     googleAdLabel:{type: String,required:false}
// },opts)


// //***** Virtuals old field names ****************** */

AgencySchema.virtual('id').
    get(function() {
        if(this.systemId){
            return this.systemId;
        }
        else {
            return 0;
        }
    });

AgencySchema.virtual('enableOptOut').
    get(function() {
        if(this.enabelOptOut){
            return this.enabelOptOut;
        }
        else {
            return false;
        }
    }).
    set(function(v){
        this.enabelOptOut = v;
    });

AgencySchema.virtual('fname').
    get(function() {
        if(this.firstName){
            return this.firstName;
        }
        else {
            return "";
        }
    }).
    set(function(v){
        this.firstName = v;
    });

AgencySchema.virtual('lname').
    get(function() {
        if(this.lastName){
            return this.lastName;
        }
        else {
            return "";
        }
    }).
    set(function(v){
        this.lastName = v;
    });
AgencySchema.virtual('agency_network').
    get(function() {
        if(this.agencyNetworkId){
            return this.agencyNetworkId;
        }
        else {
            return 1;
        }
    });

AgencySchema.virtual('docusign_envelope_id').
    get(function() {
        if(this.docusignEnvelopeId){
            return this.docusignEnvelopeId;
        }
        else {
            return "";
        }
    }).
    set(function(v){
        this.docusignEnvelopeId = v;
    });

AgencySchema.virtual('wholesale_agreement_signed').
    get(function() {
        if(this.wholesaleAgreementSigned){
            return this.wholesaleAgreementSigned;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.wholesaleAgreementSigned = v;
    });

AgencySchema.virtual('ca_license_number').
    get(function() {
        if(this.caLicenseNumber){
            return this.caLicenseNumber;
        }
        else {
            return "";
        }
    }).
    set(function(v){
        this.caLicenseNumber = v;
    });

AgencySchema.plugin(timestamps);
AgencySchema.plugin(mongooseHistory);


AgencySchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.agencyId) {
            this.agencyId = uuid.v4();
        }
    }
    next();
});

AgencySchema.pre('save', function(next) {
    next();
});


// // Configure the 'AgencySchema' to use getters and virtuals when transforming to JSON
// AgencySchema.set('toJSON', {
//     getters: true,
//     virtuals: true
// });

mongoose.set('useCreateIndex', true);
mongoose.model('Agency', AgencySchema);
mongoose.model('SocialMedia', SocialMediaSchema);