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

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const opts = {toJSON: {virtuals: true}};
const optsNoId = {toJSON: {virtuals: true},id: false, _id: false};


const faqSchema = new Schema({
    question: {type: String, required: false, default: ""},
    answer: {type: String, required: false, default: ""}

}, optsNoId);

const landingPageSchema = new Schema({
    bannerHeadingDefault: {type: String, required: false, default: ""},
    showFaq:{type: Boolean, required: false, default: true},
    faq: [faqSchema],
    meta: {
        title: {type: String, required: false, default: ""},
        description: {type: String, required: false, default: ""}
    },
    workflow: {
        heading: {type: String, required: false, default: ""},
        section1Heading: {type: String, required: false, default: ""},
        section1Content: {type: String, required: false, default: ""},
        section2Heading: {type: String, required: false, default: ""},
        section2Content: {type: String, required: false, default: ""},
        section3Heading: {type: String, required: false, default: ""},
        section3Content: {type: String, required: false, default: ""},
        subtext: {type: String, required: false, default: ""}
    }
}, optsNoId)

const startAndEndThresholdsSchema = new Schema({
    start: {type: Number, required: true, default: 1},
    end: {type: Number, required: true, default: 90}
}, optsNoId);

const policyEffectiveDateThresholdsSchema = new Schema({
    WC: {type: startAndEndThresholdsSchema, required: true},
    GL: {type: startAndEndThresholdsSchema, required: true},
    BOP: {type: startAndEndThresholdsSchema, required: true},
    CYBER: {type: startAndEndThresholdsSchema, required: true},
    PL: {type: startAndEndThresholdsSchema, required: true}
}, optsNoId);

const quoteAppPageOptionsSchema = new Schema({
    congratsPageHeader: {type: String, required: false},
    hideCongratsPageImages: {type: Boolean, required: false}
});

const featureSchema = new Schema({
    applicationOptOut: {type: Boolean, required: true, default: false},
    enablePrimeAgency: {type: Boolean, required: true, default: false},
    agencyPrimePerInsurer: {type: Boolean, required: true, default: false},
    agencyPrimeDefaultUse: {type: Boolean, required: true, default: true},
    agencyPrimeUseAppointmentText: {type: String, required: true, default: 'Use Agency Prime Appointment'},
    donotShowEmailAddress: {type: Boolean, required: true, default: false},
    notifyTalage: {type: Boolean, required: true, default: false},
    talageWholesale: {type: Boolean, required: true, default: false},
    agencyNetworkQuoteEmails: {type: Boolean, required: true, default: false},
    agencyNetworkAbandonQuoteEmails: {type: Boolean, required: true, default: false},
    agencyNetworkQuoteEmailsNoWaitOnQuote: {type: Boolean, required: true, default: false},
    agencyQuoteEmailsNoWaitOnQuote: {type: Boolean, required: true, default: false},
    quoteEmailsCustomer: {type: Boolean, required: true, default: true},
    quoteEmailsAgency: {type: Boolean, required: true, default: true},
    agencyNetworkDailyDigestEmail: {type: Boolean, required: true, default: false},
    agencyPortalRequestToBind: {type: Boolean, required: true, default: false},
    abandonAppEmailsCustomer: {type: Boolean, required: true, default: true},
    abandonAppEmailsAgency: {type: Boolean, required: true, default: false},
    quoteAppBinding: {type: Boolean, required: true, default: false},
    appSingleQuotePath: {type: Boolean, required: true, default: false},
    enableAgencyCodeField: {type: Boolean, required: true, default: false},
    quickQuoteOnly: {type: Boolean, required: true, default: false},
    enableAgencyLevelFaqEdit: {type: Boolean, required: true, default: true},
    showAppAssociationsField: {type: Boolean, required: true, default: true},
    enableApiAccess: {type: Boolean, required: true, default: true},
    showAgencyTierFields: {type: Boolean, required: true, default: false},
    requestToBindButtonText: {type: String, required: true, default: 'Submit to UW'},
    requestToBindProcessedText: {type: String, required: true, default: 'Submitted to UW'},
    requestToBindReferredProcessedText: {type: String, required: true, default: '*Submitted to UW'},
    requestToBindReferredProcessedSearchText: {type: String, required: true, default: 'Referred Submitted to UW'},
    requireMFA: {type: Boolean, required: true, default: true},
    showTalageUniversityLink: {type: Boolean, required: true, default: true},
    enableApiKeys: {type: Boolean, required: true, default: false},
    ncciInsurerId: {type: Number, required: true, default: 9},
    enableGhostPolicyCheck: {type: Boolean, required: true, default: false},
    enableSoleProAutoAddForGhostPolicy: {type: Boolean, required: true, default: false},
    enableEmployersAutoAddForGhostPolicy: {type: Boolean, required: true, default: false},
    enableGhostPolicyAgencyPortalSelection: {type: Boolean, required: true, default: false},
    enableAcordOcr: {type: Boolean, required: true, default: false},
    enableTieredQuoting: {type: Boolean, required: true, default: false},
    enableTieredQuotingAgencyLevel: {type: Boolean, required: true, default: false},
    premiumReportGraphs: {type: Boolean, required: true, default: false},
    policyEffectiveDateThresholds:
    {
        type: policyEffectiveDateThresholdsSchema,
        required: true,
        default: {
            WC: {},
            GL: {},
            BOP: {},
            CYBER: {},
            PL: {}
        }
    }
}, optsNoId);

const AgencyNetworkSchema = new Schema({
    agencyNetworkUuidId: {type: String, required: [true, 'agencyNetworkUuidId required'], unique: true},
    agencyNetworkId: {type: Number, unique: true},
    systemId: {type: Number, unique: true},
    name: {type: String, required: true},
    slug: {type: String, required: false},
    email: {type: String, required: false},
    email_brand: {type: String, required: false},
    logo: {type: String, required: false},
    footer_logo: {type: String, required: false},
    login_logo: {type: String, required: false},
    fname: {type: String, required: false},
    lname: {type: String, required: false},
    help_text: {type: String, required: false},
    landing_page_content: {type: landingPageSchema},
    custom_emails: {type: Schema.Types.Mixed},
    phone: {type: String, required: false},
    quoteAppCustomRouting: {type: Object, required: false},
    appRequirementOverrides: {type: Object, required: false},
    featureJson: {type: featureSchema},
    additionalInfo: {type: Schema.Types.Mixed},
    insurerIds: [Number],
    agencyFiveMinuteLimit: {type: Number, default: 500},
    agencyNetworkFiveMinuteLimit: {type: Number, default: 600},
    agency24HourLimit: {type: Number, default: 1000},
    agencyNetwork24HourLimit: {type: Number, default: 1200},
    agencyMonthLimit: {type: Number, default: 15000},
    agencyNetworkMonthLimit: {type: Number, default: 20000},
    marketingChannel: {type: String, required: false},
    quoteAppPageOptions: quoteAppPageOptionsSchema,
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
AgencyNetworkSchema.plugin(mongooseHistory, {
    historyConnection: global.mongodb
});


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