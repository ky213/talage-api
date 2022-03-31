const mongoose = global.mongodb, Schema = require('mongoose').Schema;
const timestamps = require('mongoose-timestamp');

const ApplicationUploadStatus = new Schema({
    agencyId: {
        type: String,
        required: [true, "agencyId required"]
    },
    agencyNetworkId: {
        type: String,
        required: [true, "agencyNetworkId required"]
    },
    requestId: {
        type: String,
        required: [true, "requestId required"],
        unique: true
    },
    status: {
        type: String,
        enum: ["QUEUED",
            "SUCCESS",
            "ERROR"],
        default: ""
    },
    fileName: {
        type: String,
        default: ""
    },
    tag: {
        type: String,
        default: ""
    },
    type: {
        type: String,
        default: ""
    }
});

ApplicationUploadStatus.plugin(timestamps);

mongoose.model("ApplicationUploadStatus", ApplicationUploadStatus); // OcrRequest

// PendingApplication
//    -> add status fields
//    -> maybe remove some old status fields from Application model.
//    -> add futureRunDate
//    -> whether they want priced or quoted.
//          -> add a form field to ask them this. (default to 'priced')
//      -> tags should just be a textbox.
//      -> move 'Advance 
