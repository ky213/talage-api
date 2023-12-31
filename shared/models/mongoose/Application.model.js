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
    email: {type: String, required: false},
    firstName: {type: String, required: false},
    lastName: {type: String, required: false},
    phone: {type: String, required: false},
    primary: {type: Boolean, required: true, default: false}
});

const ActivityCodeEmployeeTypeEntrySchema = new Schema({
    employeeTypePayroll: { type: Number, required: true, default: 0},
    employeeType: { type: String, required: true, default: "Full Time"},
    employeeTypeCount: { type: Number, required: true, default: 0}
})

const ActivtyCodeEmployeeTypeSchema = new Schema({
    activityCodeId: {type: Number, required: false},
    ncciCode: {type: String, required: false},
    payroll: {type: Number, required: true, default: 0},
    ownerPayRoll: {type: Number, required: false},
    employeeTypeList: [ActivityCodeEmployeeTypeEntrySchema]
})

const ActivtyCodePayrollSchema = new Schema({
    activityCodeId: {type: Number, required: false},
    ncciCode: {type: String, required: false},
    payroll: {type: Number, required: true, default: 0},
    ownerPayRoll: {type: Number, required: false}
});


const QuestionSchema = new Schema({
    questionId: {type: Number, required: [true, 'questionId required']},
    questionType: {type: String, required: false},
    questionText: {type: String, required: false},
    hint: {type: String, required: false},
    hidden: {type: Boolean, default: false},
    answerId: {type: Number, required: false},
    answerValue: {type: String, required: false},
    answerList: [String]
});

const locationBOPPolicySchema = new Schema({
    fireAlarmType: {type: String, required: false},
    sprinklerEquipped: {type: Boolean, required: false},
    sprinklerPercentCoverage: {type: Number, required: false},
    roofingImprovementYear: {type: Number, required: false},
    wiringImprovementYear: {type: Number, required: false},
    heatingImprovementYear: {type: Number, required: false},
    plumbingImprovementYear: {type: Number, required: false}

    // TODO: Add these later from location schema...
    // constructionType:{type: String, required:false},
    // numStories:{type: Number, required:false},
    // yearBuilt: {type: Number, required:false}
    // businessPersonalPropertyLimit: {type: Number, required:false},
    // buildingLimit: {type: Number, required:false},
});

const locationSchema = new Schema({
    address: {type: String, required: false},
    address2: {type: String, required: false},
    city: {type: String, required: false},
    state: {type: String, required: false},
    zipcode: {type: String, required: false},
    county: {type: String, required: false},
    phone: {type: String, required: false},
    ein: {type: String, required: false},
    full_time_employees:  {type: Number, required: false, default: 0},
    part_time_employees:  {type: Number, required: false, default: 0},
    square_footage:  {type: Number, required: false},
    unemployment_num:  {type: Number, required: false},
    billing: {type: Boolean, required: false, default: false}, //For new app for  AP this primary.  Billing is a Mailing address.
    primary: {type: Boolean, required: false, default: false}, //Primary and Billing are different. Primary is physical
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
    birthdate: {type: Date, required: false},
    fname: {type: String, required: false},
    lname: {type: String, required: false},
    ownership: {type: Number, required: false, default: 0},
    officerTitle: {type: String, required: false},
    include: {type: Boolean, required: true, default: false},
    activityCodeId: {type: Number, required: false},
    payroll: {type: Number, required: false}
});

//IP required false in case we do not get it or maybe copying an old app.
// issues have been seen in demo with not ip address.
const legalAcceptanceSchema = new Schema({
    ip: { type: String, required: true, default: "0.0.0.0" },
    version: { type: Number, required: true, default: -1 }
});

const claimSchema = new Schema({
    policyType: {type: String, required: true},
    amountPaid: {type: Number, required: false},
    amountReserved: {type: Number, required: false},
    eventDate: {type: Date, required: false},
    open: {type: Boolean, default: false},
    missedWork: {type: Boolean, default: false},
    description: {type: String, required: false},
    questions: [QuestionSchema]
});

const cyberPolicySchema = new Schema({
    aggregateLimit: {type: Number, required: true, default: 50000},
    businessIncomeCoverage: {type: Number, required: false},
    hardwareReplCostEndorsement: {type: Boolean, default: false},
    hardwareReplCostLimit: {type: Number, required: false},
    computerFraudEndorsement: {type: Boolean, default: false},
    postBreachRemediationEndorsement: {type: Boolean, default: false},
    postBreachRemediationLimit: {type: Number, required: false},
    ransomPaymentEndorsement: {type: Boolean, default: false},
    ransomPaymentLimit: {type: Number, required: false},
    socialEngEndorsement: {type: Boolean, default: false},
    socialEngLimit: {type: Number, required: false},
    socialEngDeductible: {type: Number, required: false},
    telecomsFraudEndorsement: {type: Boolean, default: false},
    telecomsFraudEndorsementLimit: {type: Number, required: false},
    websiteMediaContentLiabilityEndorsement: {type: Boolean, default: false},
    websiteMediaContentLiabilityLimit: {type: Number, required: false},
    domains: {type: String},
    yearsOfPriorActs: {type: Number, required: false}, //previous years covered
    waitingPeriod: {type: Number, required: false} //hours
});

const professionalLiabilityPolicySchema = new Schema({
    aggregateLimit: {type: Number, required: true, default: 50000},
    occurrenceLimit: {type: Number, required: true, default: 25000},
    certificationsRequired: {type: Boolean, default: false},
    certificationsMaintained: {type: Boolean, default: false},
    yearsOfPriorActs: {type: Number, required: false}, //previous years covered
    periodLoading: {type: Number, required: false}, //years covered after policy end
    yearsOfProfessionalExperience: {type: Number, required: false}
});

const eventBasedInsurancePolicySchema = new Schema({
    eventName: {type: String, required: false},
    productName: {type: String, required: false},
    numberofAttendees: {type: Number, required: true, default: 0},
    numberofRacers: {type: Number, required: false},
    eventDate:{type: Date, required: false}
});

const WaiverSubrogationSchema = new Schema({
    entityName: {type: String, required: true},
    address: {type: String, required: false},
    address2: {type: String, required: false},
    city: {type: String, required: false},
    state: {type: String, required: false},
    zipcode: {type: String, required: false},
    activityCodeId: {type: Number, required: false},
    payroll: {type: Number, required: false}
});

const PolicySchema = new Schema({
    policyType: {type: String, required: true},
    productName: {type: String, required: false}, //Insurers ProductName for OTHER policy types
    effectiveDate: {type: Date, required: false},
    expirationDate: {type: Date, required: false},
    limits: {type: String, required: false},
    aggregateLimit: {type: Number, required: false},
    occurrenceLimit: {type: Number, required: false},
    personLimit: {type: Number, required: false},
    deductible: {type: Number, required: false}, //1500,
    addTerrorismCoverage: {type: Boolean, required: false},
    coverage: {type: Number, required: false}, // BOP field
    coverageLapse:  {type: Boolean, default: false},
    coverageLapseNonPayment: {type: Boolean, default: false},
    blanketWaiver: {type: Boolean, default: false}, // WC
    waiverSubrogation: {type: Boolean, default: false},
    waiverSubrogationList: [WaiverSubrogationSchema],
    currentInsuranceCarrier: {type: String, required: false},
    currentPremium: {type: Number, required: false},
    yearsWithCurrentInsurance: {type: Number, required: false},
    cyber: cyberPolicySchema,
    profLiability: professionalLiabilityPolicySchema,
    eventInsurance: eventBasedInsurancePolicySchema,
    bopIndustryCodeId: {type: Number, required: false},
    fireCode: {type: String, required: false},
    additionalInfo: {type: Object},
    isGhostPolicy: {type: Boolean, default: false} //WC
});

const ApplicationMetricsPremiumSchema = new Schema({
    WC: {type: Number, required: false},
    GL: {type: Number, required: false},
    BOP: {type: Number, required: false},
    CYBER: {type: Number, required: false},
    PL: {type: Number, required: false},
    EVENT: {type: Number, required: false}
});

const ApplicationMetricsSchema = new Schema({
    lowestBoundQuoteAmount: {type: ApplicationMetricsPremiumSchema, required: false},
    lowestQuoteAmount: {type: ApplicationMetricsPremiumSchema, required: false},
    appValue: {type: Number, default: 0}
});


const AdditionalInsuredSchema = new Schema({
    namedInsured: {type: String, required: false},
    dba: {type: String, required: false},
    entityType: {type: String, required: false},
    ein: {type: String, required: false}
},opts);

const PricingInfoSchema = new Schema({
    gotPricing: {type: Boolean, default: false},
    price: {type: Number, required: false},
    lowPrice: {type: Number, required: false},
    highPrice: {type: Number, required: false},
    outOfAppetite: {type: Boolean, default: false},
    pricingError: {type: Boolean, default: false}
},opts);

const InsurerSelectionSchema = new Schema({
    policyTypeCd: {type: String},
    insurerIdList: [Number]
},opts);


const amsInfoSchema = new Schema({
    amsType: {type: String, required: false},
    clientId: {type: String, required: false},
    additionalInfo: {type: Object}
},opts)

// note: ein - not saved to db
const ApplicationSchema = new Schema({
    applicationId: {type: String, required: [true, 'applicationId required'], unique: true},
    uuid: {type: String, required: false},
    mysqlId: {type: Number, required: false},
    agencyNetworkId: {type: Number, required: true},
    agencyId: {type: Number, required: true},
    agencyLocationId: {type: Number, default: 0},
    lockAgencyLocationId: {type: Boolean, default: false},
    appStatusId: {type: Number, required: true, default: 0},
    lastStep: {type: Number, default: 0},
    progress: {type: String, default: "unknown"},
    status: {type: String, required: false, default: "incomplete"},
    solepro:  {type: Boolean, default: false},
    wholesale:  {type: Boolean, default: false},
    coverageLapseWC:  {type: Boolean, default: false},
    agencyPortalCreated:  {type: Boolean, required: false, default: false},
    apiCreated:  {type: Boolean, required: false, default: false},
    abandonedEmail:  {type: Boolean, default: false},
    abandonedAppEmail:  {type: Boolean, default: false},
    optedOutOnlineEmailsent:  {type: Boolean, default: false},
    optedOutOnline:  {type: Boolean, default: false},
    stoppedAfterPricingEmailSent:  {type: Boolean, default: false},
    stoppedAfterPricing:  {type: Boolean, default: false},
    processStateOld: {type: Number, default: 1},
    referrer: {type: String, required: false},
    industryCode: {type: String, required: false},
    entityType: {type: String, required: false},
    businessName: {type: String, required: false},
    dba: {type: String, required: false},
    fileNum: {type: String, required: false},
    founded: {type: Date, required: false},
    hasEin: {type: Boolean, default: true},
    ein: {type: String, required: false},
    einEncrypted: {type: String, required: false},
    einEncryptedT2: {type: String, required: false},
    einHash: {type: String, required: false},
    mailingAddress: {type: String, required: false},
    mailingAddress2: {type: String, required: false},
    mailingCity: {type: String, required: false},
    mailingState: {type: String, required: false},
    mailingZipcode: {type: String, required: false},
    mailingSameAsPrimary: {type: Boolean, required: false, default: null},
    phone: {type: String, required: false},
    primaryState: {type: String, required: false},
    website: {type: String, required: false},
    yearsOfExp: {type: Number, required: false},
    management_structure: {type: String, required: false},
    unincorporatedAssociation: {type: Boolean, required: false},
    experienceModifier: {type: Number, required: false},
    unincorporated_association: {type: String, required: false},
    ncciNumber: {type: String, required: false},
    association: {type: String, required: false},
    associationId: {type: String, required: false},
    affiliate: {type: String, required: false},
    bureauNumber: {type: String, required: false},
    numOwners: {type: Number, required: false},
    ownersCovered: {type: Boolean, required: false, default: false},
    owners: [ownerSchema],
    locations: [locationSchema],
    contacts: [contactSchema],
    policies: [PolicySchema],
    claims:  [claimSchema],
    activityCodes: [ActivtyCodePayrollSchema],
    grossSalesAmt: {type: Number, required: false},
    //additionalInsured: {type: String, required: false},
    additionalInsuredList:[AdditionalInsuredSchema],
    questions: [QuestionSchema],
    legalAcceptance: legalAcceptanceSchema,
    additionalInfo: {type: Object},
    businessDataJSON: {type: Object},
    agencyPortalCreatedUser: {type: String},
    agencyPortalModifiedUser: {type: String},
    corporationType: {type: String, required: false},
    quotingStartedDate: {type: Date},
    metrics: {type: ApplicationMetricsSchema, required: false},
    handledByTalage: {type: Boolean, default: false}, // true with application as Talage Wholesale quote(s)
    copiedFromAppId: {type: String, required: false},
    renewal: {type: Boolean, default: false},
    pricingInfo: {type:PricingInfoSchema, required: false},
    agencyCode: {type: String, required: false},
    tagString: {type: String, required: false},
    lastPage: {type: String, required: false},
    amsInfo:{type: amsInfoSchema, required: false},
    insurerList: [InsurerSelectionSchema],
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
    log.debug(`Mongoose application.model in updateOne ` + __location);
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