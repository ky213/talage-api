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

var mongoose = require('mongoose'), Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');
const crypt = global.requireShared('./services/crypt.js');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const contactSchema = new Schema({
    email: {type: String, required: true},
    firstName: {type: String, required: false},
    lastName: {type: String, required: false},
    phone: {type: String, required: false},
    primary: {type: Boolean, required: true, default: false}
});

const ActivityCodeEmployeeTypeEntrySchema = new Schema({
    employeeTypePayroll: { type: Number, required: true },
    employeeType: { type: String, required: true },
    employeeTypeCount: { type: Number, required: true }
})

const ActivtyCodeEmployeeTypeSchema = new Schema({
    ncciCode: {type: Number, required: true},
    payroll: {type: Number, required: true},
    ownerPayRoll: {type: Number, required: false},
    employeeTypeList: [ActivityCodeEmployeeTypeEntrySchema]
})

const ActivtyCodePayrollSchema = new Schema({
    ncciCode: {type: Number, required: true},
    payroll: {type: Number, required: true},
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

const locationSchema = new Schema({
    address: {type: String, required: false},
    address2: {type: String, required: false},
    city: {type: String, required: false},
    state: {type: String, required: false},
    zipcode: {type: String, required: false},
    county: {type: String, required: false},
    phone: {type: String, required: false},
    ein: {type: String, required: false},
    full_time_employees:  {type: Number, required: false},
    part_time_employees:  {type: Number, required: false},
    square_footage:  {type: Number, required: false},
    unemployment_num:  {type: Number, required: false},
    billing: {type: Boolean, required: false, default: false},
    activityPayrollList: [ActivtyCodeEmployeeTypeSchema],
    questions: [QuestionSchema]
});

const ownerSchema = new Schema({
    birthdate: {type: Date, required: false},
    fname: {type: String, required: true},
    lname: {type: String, required: true},
    ownership: {type: Number, required: false},
    officerTitle: {type: String},
    include: {type: Boolean, required: false}
});

const legalAcceptanceSchema = new Schema({
    ip: {type: String, required: true},
    version: {type: Number, required: true}
});

const claimSchema = new Schema({
    policyType: {type: String, required: true},
    amountPaid: {type: Number, required: false},
    amountReserved: {type: Number, required: false},
    eventDate: {type: Date, required: true},
    open: {type: Boolean, default: false},
    missedWork: {type: Boolean, default: false}
});

const PolicySchema = new Schema({
    policyType: {type: String, required: true},
    effectiveDate: {type: Date, required: false},
    expirationDate: {type: Date, required: false},
    limits: {type: String, required: false},
    deductible: {type: Number, required: false}, //1500,
    addTerrorismCoverage: {type: Boolean, required: false},
    coverage: {type: Number, required: false}, // BOP field
    coverageLapse:  {type: Boolean, default: false},
    coverageLapseNonPayment: {type: Boolean, default: false},
    waiverSubrogation: {type: Boolean, default: false}
});

// note: ein - not saved to db
const ApplicationSchema = new Schema({
    applicationId: {type: String, required: [true, 'applicationId required'], unique: true},
    uuid: {type: String, required: false},
    mysqlId: {type: Number, required: false},
    agencyNetworkId: {type: Number, required: true},
    agencyId: {type: Number, required: true},
    agencyLocationId: {type: Number, default: 0},
    appStatusId: {type: Number, required: true, default: 0},
    lastStep: {type: Number, default: 0},
    progress: {type: String, default: "unknown"},
    status: {type: String, required: false, default: "incomplete"},
    solepro:  {type: Boolean, default: false},
    wholesale:  {type: Boolean, default: false},
    coverageLapseWC:  {type: Boolean, default: false},
    agencyPortalCreated:  {type: Boolean, required: false, default: false},
    abandonedEmail:  {type: Boolean, default: false},
    abandonedAppEmail:  {type: Boolean, default: false},
    optedOutOnlineEmailsent:  {type: Boolean, default: false},
    optedOutOnline:  {type: Boolean, default: false},
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
    einHash: {type: String, required: false},
    mailingAddress: {type: String, required: false},
    mailingAddress2: {type: String, required: false},
    mailingCity: {type: String, required: false},
    mailingState: {type: String, required: false},
    mailingZipcode: {type: String, required: false},
    mailingSameAsPrimary: {type: Boolean, required: false, default: null},
    phone: {type: String, required: false},
    //primaryTerritory: {type: String, required: false},
    primaryState: {type: String, required: false},
    website: {type: String, required: false},
    yearsOfExp: {type: Number, required: false},
    management_structure: {type: String, required: false},
    unincorporatedAssociation: {type: Boolean, required: false},
    experienceModifier: {type: Number, required: false},
    unincorporated_association: {type: String, required: false},
    experience_modifier: {type: Number, required: false},
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
    additionalInsured: {type: String, required: false},
    questions: [QuestionSchema],
    legalAcceptance: legalAcceptanceSchema,
    additionalInfo: {type: Schema.Types.Mixed},
    businessDataJSON: {type: Schema.Types.Mixed},
    agencyPortalCreatedUser: {type: String},
    agencyPortalModifiedUser: {type: String},
    active: {type: Boolean, default: true},
    corporationType: {type: String, required: false},
    quotingStartedDate: {type: Date}
});
// NOTE:  EIN is not ever saved to database.

/********************************** */
ApplicationSchema.plugin(timestamps);
ApplicationSchema.plugin(mongooseHistory);


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

    // Populate top-level this.activityCodes array
    populateActivityCodePayroll(this);

    next();
});

// // eslint-disable-next-line object-curly-spacing
// ApplicationSchema.pre('updateOne', async function() {
//     const einClear = this.get("ein");
//     if(einClear){
//         try{
//             log.debug("preUpdateOne app mongoose Encrypting ein fields")
//             this.set({ ein: "XXXasdf"});

//             const einEncrypted = await crypt.encrypt(einClear);
//             const einHash = await crypt.hash(einClear);
//             this.set({ einEncrypted: einEncrypted });
//             this.set({ einHash: einHash});

//         catch(err){
//             log.error("Application model einEncrypted error " + err + __location );
//         }
//     }
// });

ApplicationSchema.post('find', async function(result) {
    if(result && result.length > 0){
        // eslint-disable-next-line prefer-const
        for(let doc of result){
            if(doc && doc.einEncrypted){
                doc.ein = await crypt.decrypt(doc.einEncrypted);
            }
        }
    }
});

ApplicationSchema.post('findOne', async function(result) {
    if(result && result.einEncrypted){
        result.ein = await crypt.decrypt(result.einEncrypted);
    }
});


// Configure the 'ApplicationSchema' to use getters and virtuals when transforming to JSON
ApplicationSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('Application', ApplicationSchema);

// Utility Functions

/**
 * Populates the top-level activityCodes array property with the total payroll for all activity codes across all locations
 *
 * @param  {Object} schema - Mongoose Application schema object
 * @returns {void}
 */
function populateActivityCodePayroll(schema) {
    const application = schema.getUpdate();
    if (application.hasOwnProperty("locations")) {
        const activityCodesPayrollSumList = [];
        for (const location of application.locations) {
            for (const activityCode of location.activityPayrollList) {
                // Find the entry for this activity code
                let activityCodePayrollSum = activityCodesPayrollSumList.find((acs) => acs.ncciCode === activityCode.ncciCode);
                if (!activityCodePayrollSum) {
                    // Add it if it doesn't exist
                    activityCodePayrollSum = {
                        ncciCode: activityCode.ncciCode,
                        payroll: 0
                    };
                    activityCodesPayrollSumList.push(activityCodePayrollSum);
                }
                // Sum the payroll
                activityCodePayrollSum.payroll += activityCode.payroll;
            }
        }
        schema.set({ activityCodes: activityCodesPayrollSumList });
    }
}