const mongoose = global.mongodb;

const Application = require("./Application.model");

const ApplicationUploadSchema = Application.ApplicationSchema.clone();

ApplicationUploadSchema.path("ocr", {
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
    data: [{type: Object}],
    form: {
        type: String,
        default: ""
    },
    version: {
        type: String,
        default: ""
    },
    message: {
        type: String,
        default: ""
    }
});

ApplicationUploadSchema.path("ocrCreated", {
    type: Boolean,
    default: true
});

mongoose.model("ApplicationUpload", ApplicationUploadSchema);
