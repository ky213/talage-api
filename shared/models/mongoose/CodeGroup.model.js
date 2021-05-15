/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */
// Invoke 'strict' JavaScript mode
/* jshint -W097 */ // don't warn about "use strict"
/*jshint esversion: 10 */


var mongoose = require('mongoose'), Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');
//var moment = require('moment');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const CodeGroupSchema = new Schema({
    codeGroupId: {type: String, required: [true, 'mappingId required'], unique: true},
    name: {type: String, required: [true, 'name required'], unique: true},
    active: {type: Boolean, default: true}
})

CodeGroupSchema.plugin(timestamps);
CodeGroupSchema.plugin(mongooseHistory);


CodeGroupSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.codeGroupId) {
            this.codeGroupId = uuid.v4();
        }
    }
    next();
});

CodeGroupSchema.pre('save', function(next) {
    next();
});


// Configure the 'CodeGroupSchema' to use getters and virtuals when transforming to JSON
CodeGroupSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('CodeGroup', CodeGroupSchema);