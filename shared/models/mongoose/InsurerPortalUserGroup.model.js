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

const mongoose = global.insurerMongodb, Schema = require('mongoose').Schema;
var timestamps = require('mongoose-timestamp');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


const PermissionRightsSchema = new Schema({
    manage: {type: Boolean, required: false, default: false},
    view: {type: Boolean, required: true, default: true},
    delete: {type: Boolean, required: false}
},{_id : false})


const PermissionSchema = new Schema({
    agencies: PermissionRightsSchema,
    analytics: PermissionRightsSchema,
    applications: PermissionRightsSchema,
    dashboard: PermissionRightsSchema,
    owner: PermissionRightsSchema,
    settings: PermissionRightsSchema
},{_id : false})

const InsurerPortalUserGroupSchema = new Schema({
    insurerPortalUserGroupId: {type: String, required: [true, 'insurerPortalUserGroupId required'], unique: true},
    systemId: {type: Number, required: true, unique: true},
    name: {type: String, required:[true, 'name required']},
    permissions: PermissionSchema,
    active: {type: Boolean, default: true}
})

InsurerPortalUserGroupSchema.plugin(timestamps);
InsurerPortalUserGroupSchema.plugin(mongooseHistory, {
    historyConnection: global.insurerMongodb
});


InsurerPortalUserGroupSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.insurerPortalUserGroupId) {
            this.insurerPortalUserGroupId = uuid.v4();
        }
    }
    next();
});


// Configure the 'MessageSchema' to use getters and virtuals when transforming to JSON
InsurerPortalUserGroupSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('InsurerPortalUserGroup', InsurerPortalUserGroupSchema);