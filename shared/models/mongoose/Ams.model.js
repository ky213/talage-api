
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

const AmsSchema = new Schema({
    amsId: {type: String, required: [true, 'amsTypeId required'], unique: true},
    amsType: {type: String, required: false},
    insurerMap: {type: Object},
    additionalInfo: {type: Object},
    active: {type: Boolean, default: true}
},opts)


AmsSchema.plugin(timestamps);
AmsSchema.plugin(mongooseHistory, {
    historyConnection: global.mongodb
});


AmsSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.amsTypeId) {
            this.amsTypeId = uuid.v4();
        }
    }
    next();
});

AmsSchema.pre('save', function(next) {
    next();
});


mongoose.set('useCreateIndex', true);
mongoose.model('Ams', AmsSchema);