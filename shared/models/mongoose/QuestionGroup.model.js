/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */
// Invoke 'strict' JavaScript mode
/* jshint -W097 */ // don't warn about "use strict"
/*jshint esversion: 10 */


const mongoose = global.insurerMongodb, Schema = require('mongoose').Schema;
var timestamps = require('mongoose-timestamp');
//var moment = require('moment');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const QuestionGroupSchema = new Schema({
    questionGroupId: {type: String, required: [true, 'questionGroupId required'], unique: true},
    name: {type: String, required: [true, 'name required'], unique: true},
    active: {type: Boolean, default: true}
})

QuestionGroupSchema.plugin(timestamps);
QuestionGroupSchema.plugin(mongooseHistory, {
    historyConnection: global.insurerMongodb
});


QuestionGroupSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.questionGroupId) {
            this.questionGroupId = uuid.v4();
        }
    }
    next();
});

QuestionGroupSchema.pre('save', function(next) {
    next();
});


// Configure the 'QuestionGroupSchema' to use getters and virtuals when transforming to JSON
QuestionGroupSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('QuestionGroup', QuestionGroupSchema);