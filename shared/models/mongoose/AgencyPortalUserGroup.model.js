// Invoke 'strict' JavaScript mode
/* jshint -W097 */ // don't warn about "use strict"
/*jshint esversion: 6 */
'use strict';

var mongoose = require('mongoose'), Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');
var moment = require('moment');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');
const { stringify } = require('csv');
const { TrustServiceProvidersApi } = require('docusign-esign');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


let PermissionRightsSchema = new Schema({
    manage: {type: Boolean, required: false, default: false},
    view: {type: Boolean, required: true, default: true},
    viewlogs: {type: Boolean, required: false},
    delete: {type: Boolean, required: false},
    requote: {type: Boolean, required: false}
},{ _id : false })



let PermissionSchema = new Schema({
    agencies: PermissionRightsSchema,
    applications: PermissionRightsSchema,
    dashboard: PermissionRightsSchema,
    owner: PermissionRightsSchema,
    talageStaff: {type: Boolean, required: true, default: false }
},{ _id : false })

let AgencyPortalUserGroupSchema = new Schema({
    agencyPortalUserGroupId: { type: String, required: [true, 'agencyPortalUserGroupId required'], unique: true },
    systemId: {type: Number, required: true, unique: true},
    name: {type: String, required:[true, 'name required']},
    permissions: PermissionSchema,
    talageAdminOnly: {type: Boolean, required: true, default: false },
    active: { type: Boolean, default: true }
})

AgencyPortalUserGroupSchema.plugin(timestamps);
AgencyPortalUserGroupSchema.plugin(mongooseHistory);


AgencyPortalUserGroupSchema.pre('validate', function (next) {
    if (this.isNew) {
         if (!this.agencyPortalUserGroupId) {
              this.agencyPortalUserGroupId = uuid.v4();
         }
    }
    next();
});



// Configure the 'MessageSchema' to use getters and virtuals when transforming to JSON
AgencyPortalUserGroupSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('AgencyPortalUserGroup', AgencyPortalUserGroupSchema);