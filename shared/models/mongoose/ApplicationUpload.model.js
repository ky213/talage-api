const mongoose = global.mongodb;

const Application = require("./Application.model");
const ApplicationUploadSchema = Application.ApplicationSchema.clone();

mongoose.model("ApplicationUpload", ApplicationUploadSchema);

// PendingApplication
//    -> add status fields
//    -> maybe remove some old status fields from Application model.
//    -> add futureRunDate
//    -> whether they want priced or quoted.
//          -> add a form field to ask them this. (default to 'priced')
//      -> tags should just be a textbox.
//      -> move 'Advance
