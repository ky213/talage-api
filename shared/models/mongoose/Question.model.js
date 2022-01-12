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

const Answerschema = new Schema({
    answerId: {type: Number, required: [true, 'answerId required']},
    answer: {type: String, required: true},
    default: {type: Boolean, default: false, required: false}
},opts)


const QuestionSchema = new Schema({
    talageQuestionUuid: {type: String, required: [true, 'talageQuestionUuid required'], unique: true},
    talageQuestionId: {type: Number, required: [true, 'talageQuestionId required'], unique: true},
    parent: {type: Number, required: false},
    parent_answer: {type: Number, required: false},
    typeId: {type: Number, required: true, default: 1},
    typeDesc: {type: String, required: false},
    sub_level: {type: Number, required: false},
    text: {type: String, required: false},
    hint: {type: String, required: false},
    hidden: {type: Boolean, default: false},
    acordQuestion: {type: Boolean, default: false},
    answers: [Answerschema],
    attributes: {type: Schema.Types.Mixed},
    categoryName: {type: String, required: false},
    categorySortNumber: {type: Number, required: true, default: 99},
    sortRanking: {type: Number, required: true, default: 99},
    inputType: {type: String, required: false},// number or string
    minValue: {type: Number, required: false, default: 0},
    maxValue: {type: Number, required: false},
    maxLength: {type: Number, required: false},
    inputMask: {type: String, required: false},
    active: {type: Boolean, default: true}
},opts)

QuestionSchema.virtual('id').
    get(function() {
        return this.talageQuestionId;
    });

QuestionSchema.plugin(timestamps);
QuestionSchema.plugin(mongooseHistory);


QuestionSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.talageQuestionUuid) {
            this.talageQuestionUuid = uuid.v4();
        }
    }
    if(this.answers){
        let needAnswerId = false;
        let maxAnswerId = 0;
        this.answers.forEach((answer) => {
            if(!answer.answerId){
                needAnswerId = true;
            }
            else if(answer.answerId > maxAnswerId){
                maxAnswerId = answer.answerId
            }
        })
        if(needAnswerId){
            this.answers.forEach((answer) => {
                if(!answer.answerId){
                    maxAnswerId++;
                    answer.answerId = maxAnswerId;
                }
            });
        }


    }
    next();
});

QuestionSchema.pre('save', function(next) {
    next();
});

mongoose.set('useCreateIndex', true);
mongoose.model('Question', QuestionSchema);