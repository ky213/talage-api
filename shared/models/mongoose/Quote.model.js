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

global.requireShared('./helpers/tracker.js');

const QouteLimitSchema = new Schema({
    limitId: {type: Number, required: true},
    amount: {type: Number, required: true}
}, {_id: false});

/**
 * description [required]: The display name of the coverage
 * value [required]: The amount of the coverage, deductible, or rate change
 * sort [required]: A sorting integer to control ordering
 * category [required]: The category the coverage belongs to, such as Liability
 * insurerIdentifier [optional]: The identifier code, used to find the coverage in the JSON response for a quote
 */
const QuoteCoveragesSchema = new Schema({
    description: {type: String, required: true},
    value: {type: String, required: true},
    sort: {type: Number, required: true},
    category: {type: String, required: true},
    insurerIdentifier: {type: String, required: false}
}, {_id: false});

const PolicySchema = new Schema({
    policyId: {type: String, required: false},
    policyUrl: {type: String, required: false},
    policyNumber: {type: String, required: false},
    policyEffectiveDate: {type: String, required: false},
    policyPremium: {type: String, required: false}
}, {_id: false});


const TalageInsurerInvoiceSchema = new Schema({
    installmentNumber: {type: Number, required: true},
    PremiumAmount: {type: Number, required: true},
    Taxes: {type: Number, required: false, default: 0},
    Fees: {type: Number, required: false, default: 0},
    TotalBillAmount: {type: Number, required: true},
    BillDate: {type: Date},
    DueDate: {type: Date},
    IsDownPayment: {type: Boolean, default: false}
}, {_id: false});

const TalageInsurerPaymentPlanSchema = new Schema({
    paymentPlanId: {type: Number, required: true},
    insurerPaymentPlanId: {type: String, required: true},
    insurerPaymentPlanDescription: {type: String, required: false},
    NumberPayments: {type: Number, required: true},
    TotalCost: {type: Number, required: true},
    TotalPremium: {type: Number, required: true},
    TotalStateTaxes: {type: Number, required: false},
    TotalBillingFees: {type: Number, required: false},
    DepositPercent: {type: Number, required: false},
    DownPayment: {type: Number, required: true},
    installmentPayment: {type: Number, required: false},
    IsDirectDebit: {type: Boolean, default: false},
    invoices: [TalageInsurerInvoiceSchema]
}, {_id: false});


const QuoteSchema = new Schema({
    quoteId: {type: String, required: [true, 'quoteId required'], unique: true},
    mysqlId: {type: Number, unique: false},
    applicationId: {type: String},
    policyType: {type: String, required: true},
    insurerId: {type: Number, required: true},
    quoteNumber: {type: String},
    packageTypeId: {type: Number},
    requestId: {type: String},
    amount: {type: Number},
    deductible: {type: Number},
    status: {type: String},
    quoteStatusId: {type: Number},
    quoteStatusDescription: {type: String},
    apiResult: {type: String},
    isBindable: {type: Boolean, default: false},
    bound: {type: Boolean, default: false},
    boundUser: {type: String},
    boundDate: {type: Date},
    log: {type: String},
    paymentPlanId: {type: Number},
    insurerPaymentPlanId: {type: String},
    reasons: {type: String},
    quoteLetter: {type: String},
    quoteTimeSeconds: {type: Number},
    quoteResponseJSON: {type: Schema.Types.Mixed},
    writer: {type: String},
    limits: [QouteLimitSchema],
    quoteCoverages: [QuoteCoveragesSchema],
    quoteLink: {type: String},
    purchaseLink: {type: String},
    additionalInfo: {type: Schema.Types.Mixed},
    handledByTalage: {type: Boolean, default: false},
    talageWholesale: {type: Boolean, required: true, default: false},
    insurerPaymentPlans: {type: Schema.Types.Mixed},
    talageInsurerPaymentPlans: [TalageInsurerPaymentPlanSchema],
    policyInfo: PolicySchema,
    quotingStartedDate: {type: Date},
    productDesc: {type: String},
    active: {type: Boolean, default: true}
});

QuoteSchema.plugin(timestamps);
QuoteSchema.plugin(mongooseHistory);


QuoteSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.quoteId) {
            this.quoteId = uuid.v4();
        }
    }
    next();
});

QuoteSchema.pre('save', function(next) {
    next();
});


// Configure the 'QuoteSchema' to use getters and virtuals when transforming to JSON
QuoteSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('Quote', QuoteSchema);