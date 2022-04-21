/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */
const mongoose = global.mongodb
const Schema = require('mongoose').Schema;
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
