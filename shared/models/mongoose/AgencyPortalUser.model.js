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


// const contactSchema = new Schema({
//     email: {type: String, required: true},
//     name: {type: String, required: false},
//     phone: {type: String, required: false},
//     title: {type: String, required: false},
//     type: {type: String, required: false}
// });

const legalAcceptanceSchema = new Schema({
    ip: {type: String, required: true},
    version: {type: Number, required: true},
    acceptanceDate: {type: Date, required: true}
});


const AgencyPortalUserSchema = new Schema({
    agencyPortalUserUuidId: {type: String, required: [true, 'agencyPortalUserUuidId required'], unique: true},
    agencyPortalUserId: {type: Number, unique: true},
    agencyId: {type: Number},
    agencyLocationId: {type: Number},
    agencyNetworkId: {type: Number},
    email: {type: String, required: true, unique: true},
    password: {type: String, required: false},
    openidAuthConfigId: {type: String, required: false},
    agencyPortalUserGroupId: {type: Number, required: true, default: 0},
    logo: {type: String, required: false},
    canSign: {type: Boolean, default: false},
    resetRequired: {type: Boolean, default: false},
    lastLogin: {type: Date},
    timezoneId: {type: Number, required: false, default: 0},
    timezoneName: {type: String, required: false},
    requiredLegalAcceptance: {type: Boolean, default: false},
    legalAcceptance: [legalAcceptanceSchema],
    agencyNotificationList: [Number],
    additionalInfo: {type: Schema.Types.Mixed},
    active: {type: Boolean, default: true}
},opts)


// //***** Virtuals old field names ****************** */

AgencyPortalUserSchema.virtual('id').
    get(function() {
        if(this.agencyPortalUserId){
            return this.agencyPortalUserId;
        }
        else {
            return 0;
        }
    });
AgencyPortalUserSchema.virtual('group').
    get(function() {
        if(this.agencyPortalUserGroupId){
            return this.agencyPortalUserGroupId;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.agencyPortalUserGroupId = v;
    });
AgencyPortalUserSchema.virtual('agency').
    get(function() {
        if(this.agencyId){
            return this.agencyId;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.agencyId = v;
    });

AgencyPortalUserSchema.virtual('agency_location').
    get(function() {
        if(this.agencyLocationId){
            return this.agencyLocationId;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.agencyLocationId = v;
    });

AgencyPortalUserSchema.virtual('agency_network').
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


AgencyPortalUserSchema.virtual('can_sign').
    get(function() {
        if(this.canSign){
            return this.canSign;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.canSign = v;
    });


AgencyPortalUserSchema.virtual('reset_required').
    get(function() {
        if(this.resetRequired){
            return this.resetRequired;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.resetRequired = v;
    });

AgencyPortalUserSchema.virtual('last_login').
    get(function() {
        if(this.lastLogin){
            return this.lastLogin;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.lastLogin = v;
    });

AgencyPortalUserSchema.virtual('timezone').
    get(function() {
        if(this.timezoneId){
            return this.timezoneId;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.timezoneId = v;
    });

AgencyPortalUserSchema.virtual('timezone_name').
    get(function() {
        if(this.timezoneName){
            return this.timezoneName;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.timezoneName = v;
    });

AgencyPortalUserSchema.virtual('termsOfServiceVersion').
    get(function() {
        if(this.legalAcceptance && this.legalAcceptance.length > 0){
            let maxVersion = 0;
            this.legalAcceptance.forEach((la) => {
                if(la.version > maxVersion){
                    maxVersion = la.version;
                }

            });

            return maxVersion;
        }
        else {
            return 0;
        }
    });


AgencyPortalUserSchema.plugin(timestamps);
AgencyPortalUserSchema.plugin(mongooseHistory, {
    historyConnection: global.mongodb
});


AgencyPortalUserSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.agencyPortalUserUuidId) {
            this.agencyPortalUserUuidId = uuid.v4();
        }
    }
    next();
});

AgencyPortalUserSchema.pre('save', function(next) {
    next();
});


// // Configure the 'AgencyPortalUserSchema' to use getters and virtuals when transforming to JSON
// AgencyPortalUserSchema.set('toJSON', {
//     getters: true,
//     virtuals: true
// });

mongoose.set('useCreateIndex', true);
mongoose.model('AgencyPortalUser', AgencyPortalUserSchema);