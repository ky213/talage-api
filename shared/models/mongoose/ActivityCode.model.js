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

const opts = {toJSON: {virtuals: true}};

const ActivityCodeSchema = new Schema({
    talageActivityCodeUuid: {type: String, required: [true, 'talageActivityCodeUuid required'], unique: true},
    activityCodeId: {type: Number, required: [true, 'activityCodeId required']},
    ncciCode: {type: String, required: false},
    ncciSub: {type: String, required: false},
    description: {type: String, required: false},
    attributes: {type: Schema.Types.Mixed},
    talageStandard: {type: Boolean, default: false},
    activityCodeGroupList: [String],
    alternateNames: [String],
    active: {type: Boolean, default: true}
},opts)


ActivityCodeSchema.plugin(timestamps);
ActivityCodeSchema.plugin(mongooseHistory);


ActivityCodeSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.talageActivityCodeUuid) {
            this.talageActivityCodeUuid = uuid.v4();
        }
    }
    next();
});

ActivityCodeSchema.pre('save', function(next) {
    next();
});

mongoose.set('useCreateIndex', true);
mongoose.model('ActivityCode', ActivityCodeSchema);