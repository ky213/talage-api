const mongoose = global.mongodb, Schema = require('mongoose').Schema;
const timestamps = require('mongoose-timestamp');

const QuestionSchema = new Schema({
    question: {type: String, required: false},
    questionTag: {type: String, required: false},
    answer: {type: String, required: false},
    page: {type: Number, required: false},
});

const ApplicationUpload = new Schema({
    requestId: {type: String, required: [true, 'requestId required'], unique: true},
    questions: [QuestionSchema]
});

ApplicationUpload.plugin(timestamps);

mongoose.model("ApplicationUpload", ApplicationUpload);

// PendingApplication
//    -> add status fields
//    -> maybe remove some old status fields from Application model.
//    -> add futureRunDate
//    -> whether they want priced or quoted.
//          -> add a form field to ask them this. (default to 'priced')
//      -> tags should just be a textbox.
//      -> move 'Advance 
