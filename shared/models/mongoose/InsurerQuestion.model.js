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


const InsurerQuestionSchema = new Schema({
    insurerQuestionId: {type: String, required: [true, 'insurerQuestionId required'], unique: true},
    insurerId: {type: Number},
    talageQuestionId: {type: Number},
    policyTypeList: {type: [String], required: false, default: []},
    universal: {type: Boolean, default: false},
    text: {type: String, required: false},
    questionSubjectArea : {type: String, required: false, default: "general"},
    identifier: {type: String, required: false},
    attributes: {type: Schema.Types.Mixed},
    effectiveDate: {type: Date, required: true},
    expirationDate: {type: Date, required: true},
    allTerritories: {type: Boolean, required: true, default: true},
    territoryList: [String],
    defaultValue: {type: String, required: false},
    useDefaultValue: {type: Boolean, default: false},
    insurerQuestionType: {type: String, required: false},
    answerMap: {type: Object, required: false}, //map to checklist and select type questions
    active: {type: Boolean, default: true}
},opts)


InsurerQuestionSchema.index({insurerId: 1, type: 1}); // Insure Index
InsurerQuestionSchema.index({insurerQuestionId: 1, type: 1});
InsurerQuestionSchema.index({insurerId: 1, policyTypeList: 1}); // Insure Index

// //***** Virtuals old field names ****************** */

InsurerQuestionSchema.plugin(timestamps);
InsurerQuestionSchema.plugin(mongooseHistory, {
    historyConnection: global.insurerMongodb
});


InsurerQuestionSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.insurerQuestionId) {
            this.insurerQuestionId = uuid.v4();
        }
    }
    next();
});

InsurerQuestionSchema.pre('save', function(next) {
    next();
});


// // Configure the 'InsurerQuestionSchema' to use getters and virtuals when transforming to JSON
// InsurerQuestionSchema.set('toJSON', {
//     getters: true,
//     virtuals: true
// });

mongoose.set('useCreateIndex', true);
mongoose.model('InsurerQuestion', InsurerQuestionSchema);