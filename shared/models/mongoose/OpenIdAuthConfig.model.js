/* eslint-disable strict */
/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */

const mongoose = require('mongoose'), Schema = mongoose.Schema;
const uuid = require('uuid');

global.requireShared('./helpers/tracker.js');

const OpenIdAuthConfigSchema = new Schema({
    subdomain: {type: String, required: false},
    configId: {type: Number, required: true},
    discoverUrl: {type: String, required: true},
    clientId: {type: String, required: true},
    clientSecret: {type: String, required: true},
    type: {type: String, enum: ['azure'], required: true},
    agencyId: {type: Number, required: false},
    agencyNetworkId: {type: Number, required: false}
});

OpenIdAuthConfigSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.model('OpenIdAuthConfig', OpenIdAuthConfigSchema);
