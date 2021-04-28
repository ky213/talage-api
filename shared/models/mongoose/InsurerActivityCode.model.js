/* eslint-disable strict */
/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */

var mongoose = require('mongoose'), Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const opts = {toJSON: {virtuals: true}};
const optsNoId = {toJSON: {virtuals: true}, _id : false}

//Used to override main list for special cases.
const InsurerTerritoryQuestionSchema = new Schema({
    territory: {type: String, required: true},
    insurerQuestionIdList: [String]
},optsNoId)


const InsurerActivityCodeSchema = new Schema({
    insurerActivityCodeId: {type: String, required: [true, 'insurerActivityCodeId required'], unique: true},
    insurerId: {type: Number},
    code: {type: String, required: false},
    sub: {type: String, required: false},
    description: {type: String, required: false},
    attributes: {type: Schema.Types.Mixed},
    effectiveDate: {type: Date, required: true},
    expirationDate: {type: Date, required: true},
    talageActivityCodeIdList: [Number],
    territoryList: [String],
    insurerQuestionIdList: [String],
    insurerTerritoryQuestionList: [InsurerTerritoryQuestionSchema],
    oldSystemIdList: [Number],
    active: {type: Boolean, default: true}
},opts)


InsurerActivityCodeSchema.index({insurerId: 1}); // Insurer Index
InsurerActivityCodeSchema.index({insurerId: 1, code: 1, sub: 1});
//InsurerActivityCodeSchema.index({talageActivityCodeIdList: 1});


// //***** Virtuals old field names ****************** */

InsurerActivityCodeSchema.plugin(timestamps);
InsurerActivityCodeSchema.plugin(mongooseHistory);


InsurerActivityCodeSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.insurerActivityCodeId) {
            this.insurerActivityCodeId = uuid.v4();
        }
    }
    next();
});

InsurerActivityCodeSchema.pre('save', function(next) {
    next();
});


// // Configure the 'InsurerActivityCodeSchema' to use getters and virtuals when transforming to JSON
// InsurerActivityCodeSchema.set('toJSON', {
//     getters: true,
//     virtuals: true
// });

mongoose.set('useCreateIndex', true);
mongoose.model('InsurerActivityCode', InsurerActivityCodeSchema);