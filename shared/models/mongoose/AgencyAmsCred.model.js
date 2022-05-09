
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

const opts = {toJSON: {virtuals: true}};

const AgencyAmsCredSchema = new Schema({
    agencyAmsCredId: {type: String, required: [true, 'agencyAmsCredId required'], unique: true},
    agencyId: {type: Number, required: true},
    amsType: {type: String, required: false},
    apiKey: {type: String, required: false},
    username: {type: String, required: false},
    password: {type: String, required: false},
    agencyPortalCreatedUser: {type: String},
    agencyPortalModifiedUser: {type: String},
    agencyPortalDeletedUser: {type: String},
    active: {type: Boolean, default: true}
},opts)


AgencyAmsCredSchema.plugin(timestamps);
AgencyAmsCredSchema.plugin(mongooseHistory, {
    historyConnection: global.mongodb
});


AgencyAmsCredSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.agencyAmsCredId) {
            this.agencyAmsCredId = uuid.v4();
        }
    }
    next();
});

AgencyAmsCredSchema.pre('save', function(next) {
    next();
});


mongoose.set('useCreateIndex', true);
mongoose.model('AgencyAmsCred', AgencyAmsCredSchema);