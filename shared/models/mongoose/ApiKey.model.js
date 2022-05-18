/* eslint-disable strict */
/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */

const mongoose = global.mongodb, Schema = require('mongoose').Schema;
const timestamps = require('mongoose-timestamp');
const mongooseHistory = require('mongoose-history');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const opts = {toJSON: {virtuals: true}};

const ApiKey = new Schema({
    keyId: {type: String, required: true},
    keySecret: {type: String, required: true},
    expirationDate: {type: Date, required: true},
    lastUsedDate: {type: Date, required: false},
    agencyPortalUserId: {type: Number, required: true}
}, opts);

ApiKey.plugin(timestamps);
ApiKey.plugin(mongooseHistory, {
    historyConnection: global.mongodb
});

mongoose.set('useCreateIndex', true);
mongoose.model('ApiKey', ApiKey);