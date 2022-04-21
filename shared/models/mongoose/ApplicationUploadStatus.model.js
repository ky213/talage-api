const mongoose = global.mongodb, Schema = require('mongoose').Schema;
const timestamps = require('mongoose-timestamp');

const ApplicationUploadStatus = new Schema({
    agencyId: {
        type: String
    },
    agencyLocationId: {
        type: String
    },
    agencyNetworkId: {
        type: String
    },
    insurerId: {
        type: String
    },
    requestId: {
        type: String,
        required: [true, "requestId required"],
        unique: true
    },
    tag: {
        type: String,
        default: ""
    },
    markAsPending: {
        type: String,
        default: ""
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
    agencyPortalUserId: {
        type: Number
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
