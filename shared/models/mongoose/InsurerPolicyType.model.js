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

const InsurerPolicyTypeSchema = new Schema({
    insurerPolicyTypeId: {type: String, required: [true, 'insurerPolicyTypeId required'], unique: true},
    systemId: {type: Number, unique: true},
    insurerId: {type: Number},
    policy_type: {type: String, required: false},
    slug: {type: String, required: false},
    api_support: {type: Boolean, default: false},
    wheelhouse_support: {type: Boolean, default: false},
    pricing_support: {type: Boolean, default: false},
    bind_support: {type: Boolean, default: false},
    acord_support: {type: Boolean, default: false},
    territories: [String],
    active: {type: Boolean, default: true}
},opts)


// //***** Virtuals old field names ****************** */

InsurerPolicyTypeSchema.virtual('id').
    get(function() {
        if(this.systemId){
            return this.systemId;
        }
        else {
            return 0;
        }
    });

InsurerPolicyTypeSchema.virtual('insurer').
    get(function() {
        if(this.insurerId){
            return this.insurerId;
        }
        else {
            return null;
        }
    }).
    set(function(v){
        this.insurerId = v;
    });


InsurerPolicyTypeSchema.plugin(timestamps);
InsurerPolicyTypeSchema.plugin(mongooseHistory, {
    historyConnection: global.insurerMongodb
});


InsurerPolicyTypeSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.insurerPolicyTypeId) {
            this.insurerPolicyTypeId = uuid.v4();
        }
    }
    next();
});

InsurerPolicyTypeSchema.pre('save', function(next) {
    next();
});


// // Configure the 'InsurerSchema' to use getters and virtuals when transforming to JSON
// InsurerSchema.set('toJSON', {
//     getters: true,
//     virtuals: true
// });

mongoose.set('useCreateIndex', true);
mongoose.model('InsurerPolicyType', InsurerPolicyTypeSchema);