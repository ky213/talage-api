/* eslint-disable object-curly-spacing */
/* eslint-disable strict */
/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */
// Invoke 'strict' JavaScript mode
/* jshint -W097 */ // don't warn about "use strict"
/*jshint esversion: 6 */
'use strict';

const mongoose = global.mongodb, Schema = require('mongoose').Schema;
var timestamps = require('mongoose-timestamp');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');
//const crypt = global.requireShared('./services/crypt.js');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const opts = {toJSON: {virtuals: true}};
//const optsNoId = {toJSON: {virtuals: true},id: false, _id: false};

const contactSchema = new Schema({
    email: {type: String},
    firstName: {type: String},
    lastName: {type: String},
    phone: {type: String},
    primary: {type: Boolean, default: false}
});

const ActivityCodeEmployeeTypeEntrySchema = new Schema({
    employeeTypePayroll: { type: Number },
    employeeType: { type: String },
    employeeTypeCount: { type: Number }
})

const ActivtyCodeEmployeeTypeSchema = new Schema({
    activityCodeId: {type: Number},
    ncciCode: {type: String},
    payroll: {type: Number, default: 0},
    ownerPayRoll: {type: Number},
    employeeTypeList: [ActivityCodeEmployeeTypeEntrySchema]
})

const ActivtyCodePayrollSchema = new Schema({
    activityCodeId: {type: Number},
    ncciCode: {type: String},
    payroll: {type: Number, default: 0},
    ownerPayRoll: {type: Number}
});


const QuestionSchema = new Schema({
    questionId: {type: Number, required: [true, 'questionId required']},
    questionType: {type: String},
    questionText: {type: String},
    hint: {type: String},
    hidden: {type: Boolean, default: false},
    answerId: {type: Number},
    answerValue: {type: String},
    answerList: [String]
});

const locationBOPPolicySchema = new Schema({
    fireAlarmType: {type: String},
    sprinklerEquipped: {type: Boolean},
    sprinklerPercentCoverage: {type: Number},
    roofingImprovementYear: {type: Number},
    wiringImprovementYear: {type: Number},
    heatingImprovementYear: {type: Number},
    plumbingImprovementYear: {type: Number}

    // TODO: Add these later from location schema...
    // constructionType:{type: String, required:false},
    // numStories:{type: Number, required:false},
    // yearBuilt: {type: Number, required:false}
    // businessPersonalPropertyLimit: {type: Number, required:false},
    // buildingLimit: {type: Number, required:false},
});

const locationSchema = new Schema({
    address: {type: String},
    address2: {type: String},
    city: {type: String},
    state: {type: String},
    zipcode: {type: String},
    county: {type: String},
    phone: {type: String},
    ein: {type: String},
    full_time_employees:  {type: Number, default: 0},
    part_time_employees:  {type: Number, default: 0},
    square_footage:  {type: Number},
    unemployment_num:  {type: Number},
    billing: {type: Boolean, default: false}, //For new app for  AP this primary.  Billing is a Mailing address.
    primary: {type: Boolean, default: false}, //Primary and Billing are different. Primary is physical
    own: {type: Boolean, required:false},
    businessPersonalPropertyLimit: {type: Number, required:false},
    buildingLimit: {type: Number, required:false},
    constructionType:{type: String, required:false},
    numStories:{type: Number, required:false},
    yearBuilt: {type: Number, required:false},
    activityPayrollList: [ActivtyCodeEmployeeTypeSchema],
    questions: [QuestionSchema],
    bop: locationBOPPolicySchema
},opts);

locationSchema.virtual('locationId').
    get(function() {
        if(this._id){
            // make sure the id is coming out as a string
            return `${this._id}`;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this._id = v;
    });

locationSchema.virtual('territory').
    get(function() {
        return this.state;
    });

const ownerSchema = new Schema({
    birthdate: {type: Date},
    fname: {type: String},
    lname: {type: String},
    ownership: {type: Number, default: 0},
    officerTitle: {type: String},
    include: {type: Boolean},
    activityCodeId: {type: Number},
    payroll: {type: Number}
});

//IP required false in case we do not get it or maybe copying an old app.
// issues have been seen in demo with not ip address.
const legalAcceptanceSchema = new Schema({
    ip: { type: String, required: true, default: "0.0.0.0" },
    version: { type: Number, required: true, default: -1 }
});

const claimSchema = new Schema({
    policyType: {type: String},
    amountPaid: {type: Number},
    amountReserved: {type: Number},
    eventDate: {type: Date},
    open: {type: Boolean, default: false},
    missedWork: {type: Boolean, default: false},
    description: {type: String},
    questions: [QuestionSchema]
});

const cyberPolicySchema = new Schema({
    aggregateLimit: {type: Number, default: 50000},
    businessIncomeCoverage: {type: Number},
    hardwareReplCostEndorsement: {type: Boolean, default: false},
    hardwareReplCostLimit: {type: Number},
    computerFraudEndorsement: {type: Boolean, default: false},
    postBreachRemediationEndorsement: {type: Boolean, default: false},
    postBreachRemediationLimit: {type: Number},
    ransomPaymentEndorsement: {type: Boolean, default: false},
    ransomPaymentLimit: {type: Number},
    socialEngEndorsement: {type: Boolean, default: false},
    socialEngLimit: {type: Number},
    socialEngDeductible: {type: Number},
    telecomsFraudEndorsement: {type: Boolean, default: false},
    telecomsFraudEndorsementLimit: {type: Number},
    websiteMediaContentLiabilityEndorsement: {type: Boolean, default: false},
    websiteMediaContentLiabilityLimit: {type: Number},
    domains: {type: String},
    yearsOfPriorActs: {type: Number}, //previous years covered
    waitingPeriod: {type: Number} //hours
});

const professionalLiabilityPolicySchema = new Schema({
    aggregateLimit: {type: Number, default: 50000},
    occurrenceLimit: {type: Number, default: 25000},
    certificationsRequired: {type: Boolean, default: false},
    certificationsMaintained: {type: Boolean, default: false},
    yearsOfPriorActs: {type: Number}, //previous years covered
    periodLoading: {type: Number}, //years covered after policy end
    yearsOfProfessionalExperience: {type: Number}
});

const eventBasedInsurancePolicySchema = new Schema({
    eventName: {type: String},
    productName: {type: String},
    numberofAttendees: {type: Number, default: 0},
    numberofRacers: {type: Number},
    eventDate:{type: Date}
});

const WaiverSubrogationSchema = new Schema({
    entityName: {type: String, required: true},
    address: {type: String},
    address2: {type: String},
    city: {type: String},
    state: {type: String},
    zipcode: {type: String},
    activityCodeId: {type: Number},
    payroll: {type: Number}
});

const PolicySchema = new Schema({
    policyType: {type: String, required: true},
    productName: {type: String}, //Insurers ProductName for OTHER policy types
    effectiveDate: {type: Date},
    expirationDate: {type: Date},
    limits: {type: String},
    aggregateLimit: {type: Number},
    occurrenceLimit: {type: Number},
    personLimit: {type: Number},
    deductible: {type: Number}, //1500,
    addTerrorismCoverage: {type: Boolean},
    coverage: {type: Number}, // BOP field
    coverageLapse:  {type: Boolean, default: false},
    coverageLapseNonPayment: {type: Boolean, default: false},
    blanketWaiver: {type: Boolean, default: false}, // WC
    waiverSubrogation: {type: Boolean, default: false},
    waiverSubrogationList: [WaiverSubrogationSchema],
    currentInsuranceCarrier: {type: String},
    currentPremium: {type: Number},
    yearsWithCurrentInsurance: {type: Number},
    cyber: cyberPolicySchema,
    profLiability: professionalLiabilityPolicySchema,
    eventInsurance: eventBasedInsurancePolicySchema,
    bopIndustryCodeId: {type: Number},
    fireCode: {type: String},
    additionalInfo: {type: Object}
});

const ApplicationMetricsPremiumSchema = new Schema({
    WC: {type: Number},
    GL: {type: Number},
    BOP: {type: Number},
    CYBER: {type: Number},
    PL: {type: Number},
    EVENT: {type: Number}
});

const ApplicationMetricsSchema = new Schema({
    lowestBoundQuoteAmount: {type: ApplicationMetricsPremiumSchema},
    lowestQuoteAmount: {type: ApplicationMetricsPremiumSchema},
    appValue: {type: Number, default: 0}
});


const AdditionalInsuredSchema = new Schema({
    namedInsured: {type: String},
    dba: {type: String},
    entityType: {type: String},
    ein: {type: String}
},opts);

const PricingInfoSchema = new Schema({
    gotPricing: {type: Boolean, default: false},
    price: {type: Number},
    lowPrice: {type: Number},
    highPrice: {type: Number},
    outOfAppetite: {type: Boolean, default: false},
    pricingError: {type: Boolean, default: false}
},opts);

// note: ein - not saved to db
const ApplicationSchema = new Schema({
    applicationId: {type: String, required: [true, 'applicationId required'], unique: true},
    uuid: {type: String},
    mysqlId: {type: Number},
    agencyNetworkId: {type: Number, required: true},
    agencyId: {type: Number, required: true},
    agencyLocationId: {type: Number, default: 0},
    lockAgencyLocationId: {type: Boolean, default: false},
    appStatusId: {type: Number, required: true, default: 0},
    lastStep: {type: Number, default: 0},
    progress: {type: String, default: "unknown"},
    status: {type: String, default: "incomplete"},
    solepro:  {type: Boolean, default: false},
    wholesale:  {type: Boolean, default: false},
    coverageLapseWC:  {type: Boolean, default: false},
    agencyPortalCreated:  {type: Boolean, default: false},
    apiCreated:  {type: Boolean, default: false},
    abandonedEmail:  {type: Boolean, default: false},
    abandonedAppEmail:  {type: Boolean, default: false},
    optedOutOnlineEmailsent:  {type: Boolean, default: false},
    optedOutOnline:  {type: Boolean, default: false},
    stoppedAfterPricingEmailSent:  {type: Boolean, default: false},
    stoppedAfterPricing:  {type: Boolean, default: false},
    processStateOld: {type: Number, default: 1},
    referrer: {type: String},
    industryCode: {type: String},
    entityType: {type: String},
    businessName: {type: String},
    dba: {type: String},
    fileNum: {type: String},
    founded: {type: Date},
    hasEin: {type: Boolean, default: true},
    ein: {type: String},
    einEncrypted: {type: String},
    einEncryptedT2: {type: String},
    einHash: {type: String},
    mailingAddress: {type: String},
    mailingAddress2: {type: String},
    mailingCity: {type: String},
    mailingState: {type: String},
    mailingZipcode: {type: String},
    mailingSameAsPrimary: {type: Boolean, default: null},
    phone: {type: String},
    primaryState: {type: String},
    website: {type: String},
    yearsOfExp: {type: Number},
    management_structure: {type: String},
    unincorporatedAssociation: {type: Boolean},
    experienceModifier: {type: Number},
    unincorporated_association: {type: String},
    ncciNumber: {type: String},
    association: {type: String},
    associationId: {type: String},
    affiliate: {type: String},
    bureauNumber: {type: String},
    numOwners: {type: Number},
    ownersCovered: {type: Boolean, default: false},
    owners: [ownerSchema],
    locations: [locationSchema],
    contacts: [contactSchema],
    policies: [PolicySchema],
    claims:  [claimSchema],
    activityCodes: [ActivtyCodePayrollSchema],
    grossSalesAmt: {type: Number},
    //additionalInsured: {type: String},
    additionalInsuredList:[AdditionalInsuredSchema],
    questions: [QuestionSchema],
    legalAcceptance: legalAcceptanceSchema,
    additionalInfo: {type: Schema.Types.Mixed},
    businessDataJSON: {type: Schema.Types.Mixed},
    agencyPortalCreatedUser: {type: String},
    agencyPortalModifiedUser: {type: String},
    corporationType: {type: String},
    quotingStartedDate: {type: Date},
    metrics: {type: ApplicationMetricsSchema},
    handledByTalage: {type: Boolean, default: false}, // true with application as Talage Wholesale quote(s)
    copiedFromAppId: {type: String},
    renewal: {type: Boolean, default: false},
    pricingInfo: {type:PricingInfoSchema},
    agencyCode: {type: String},
    tagString: {type: String},
    lastPage: {type: String},
    active: {type: Boolean, default: true}
}, opts);
// NOTE:  EIN is not ever saved to database.

// Virtual Functions to save in old fields
ApplicationSchema.virtual('managementStructure').
    get(function() {
        if(this.management_structure){
            return this.management_structure;
        }
        else {
            return '';
        }
    }).
    set(function(v){
        this.management_structure = v;
    });

//industryCodeId

ApplicationSchema.virtual('industryCodeId').
    get(function() {
        return this.industryCode;
    }).
    set(function(v){
        this.industryCode = v;
    });

ApplicationSchema.plugin(timestamps);
ApplicationSchema.plugin(mongooseHistory, {
    historyConnection: global.mongodb
});


ApplicationSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.applicationId) {
            this.applicationId = uuid.v4();
            this.uuid = this.applicationId;
        }
    }
    if(this.ein){
        delete this.ein;
    }

    next();
});

//not called by update or findOneAndUpdate
ApplicationSchema.pre('save', async function() {
    if(this.ein){
        delete this.ein;
    }
});

ApplicationSchema.pre('updateOne', async function(next) {
    log.debug(`Mongoose applicagion.model in updateOne ` + __location);
    // Populate top-level this.activityCodes array
    populateActivityCodePayroll(this);

    next();
});


ApplicationSchema.methods.updateActivityPayroll = function(){
    populateActivityCodePayroll(this);
    return true;
}

mongoose.set('useCreateIndex', true);
mongoose.model('Application', ApplicationSchema);

// Utility Functions

/**
 * Seems broken does not detect locations Populates the top-level activityCodes array property with the total payroll for all activity codes across all locations
 *
 * @param  {Object} schema - Mongoose Application schema object
 * @returns {void}
 */
function populateActivityCodePayroll(schema) {
    const application = schema;
    if (application.locations) {
        const activityCodesPayrollSumList = [];
        for (const location of application.locations) {
            for (const ActivtyCodeEmployeeType of location.activityPayrollList) {
                // Find the entry for this activity code
                let activityCodePayrollSum = activityCodesPayrollSumList.find((acs) => acs.activityCodeId === ActivtyCodeEmployeeType.activityCodeId);
                if (!activityCodePayrollSum) {
                    // Add it if it doesn't exist
                    activityCodePayrollSum = {
                        activityCodeId: ActivtyCodeEmployeeType.activityCodeId,
                        payroll: 0
                    };
                    activityCodesPayrollSumList.push(activityCodePayrollSum);
                }
                // Sum the payroll
                activityCodePayrollSum.payroll += ActivtyCodeEmployeeType.payroll;
            }
        }
        schema.set({ activityCodes: activityCodesPayrollSumList });
    }
}


module.exports = {
    ApplicationSchema: ApplicationSchema
}