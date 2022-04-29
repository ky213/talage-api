/* eslint-disable strict */
/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */

const mongoose = global.insurerMongodb, Schema = require('mongoose').Schema;
var timestamps = require('mongoose-timestamp');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const opts = {toJSON: {virtuals: true}};

const tableOpts = new Schema({
    compactMode: {type: Boolean, default: false},
    rowsPerPage: {type: Number, default: 10}
});

const tableOptionsSchema = new Schema({
    applicationsTable: tableOpts,
    agenciesTable: tableOpts
});

const InsurerPortalUserSchema = new Schema({
    insurerPortalUserUuidId: {type: String, required: [true, 'insurerPortalUserUuidId required'], unique: true},
    insurerPortalUserId: {type: Number, unique: true},
    insurerId: {type: Number},
    insurerPortalUserGroupId: {type: Number, required: true, default: 0},
    firstName: {type: String, required: false},
    lastName: {type: String, required: false},
    phone: {type: String, required: false},
    email: {type: String, required: true},
    password: {type: String, required: false},
    openidAuthConfigId: {type: String, required: false},
    logo: {type: String, required: false},
    tableOptions: {type: tableOptionsSchema},
    canSign: {type: Boolean, default: false},
    resetRequired: {type: Boolean, default: false},
    lastLogin: {type: Date},
    timezoneId: {type: Number, required: false, default: 0},
    timezoneName: {type: String, required: false},
    additionalInfo: {type: Schema.Types.Mixed},
    active: {type: Boolean, default: true}
},opts)

InsurerPortalUserSchema.plugin(timestamps);
InsurerPortalUserSchema.plugin(mongooseHistory, {
    historyConnection: global.insurerMongodb
});

InsurerPortalUserSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.agencyPortalUserUuidId) {
            this.agencyPortalUserUuidId = uuid.v4();
        }
    }
    next();
});

InsurerPortalUserSchema.pre('save', function(next) {
    next();
});

mongoose.set('useCreateIndex', true);
mongoose.model('InsurerPortalUser', InsurerPortalUserSchema);