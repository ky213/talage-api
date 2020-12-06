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

const AcordInfoSchema = new Schema({
    sendToEmail: {type: String, required: false, default: ""}
},{_id : false})


const PolicyTypeInfoDetailsSchema = new Schema({
    enabled: {type: Boolean, required: true, default: true},
    useAcord: {type: Boolean, required: true, default: false},
    acordInfo: AcordInfoSchema
},{_id : false})


const PolicyTypeInfoSchema = new Schema({
    WC: PolicyTypeInfoDetailsSchema,
    BOP: PolicyTypeInfoDetailsSchema,
    GL: PolicyTypeInfoDetailsSchema,
    notifyTalage: {type: Boolean, required: true, default: false}
},{_id : false})

const AgencyLocationInsurersSchema = new Schema({
    insurerId: {type: Number, required: true},
    agencyId: {type: String, required: false},
    agentId: {type: String, required: false},
    policyTypeInfo: PolicyTypeInfoSchema
},{_id : false})

const AgencyLocationSchema = new Schema({
    agencyLocationId: {type: String, required: [true, 'agencyLocationId required'], unique: true},
    systemId: {type: Number, unique: true},
    mysqlId: {type: Number, unique: true},
    agencyId: {type: Number},
    primary: {type: Boolean, default: true},
    address: {type: String, required: false},
    address2: {type: String, required: false},
    city: {type: String, required: false},
    state: {type: String, required: false},
    zipcode: {type: String, required: false},
    phone: {type: String, required: false},
    email: {type: String, required: false},
    firstName: {type: String, required: false},
    lastName: {type: String, required: false},
    openTime: {type: String, required: false},
    closeTime: {type: String, required: false},
    territories: [String],
    insurers: [AgencyLocationInsurersSchema],
    additionalInfo: {type: Schema.Types.Mixed},
    agencyPortalCreatedUser: {type: String},
    agencyPortalModifiedUser: {type: String},
    agencyPortalDeletedUser: {type: String},
    active: {type: Boolean, default: true}
})

AgencyLocationSchema.plugin(timestamps);
AgencyLocationSchema.plugin(mongooseHistory);


AgencyLocationSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.agencyLocationId) {
            this.agencyLocationId = uuid.v4();
        }
    }
    next();
});

AgencyLocationSchema.pre('save', function(next) {
    next();
});


// Configure the 'AgencyLocationSchema' to use getters and virtuals when transforming to JSON
AgencyLocationSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('AgencyLocation', AgencyLocationSchema);