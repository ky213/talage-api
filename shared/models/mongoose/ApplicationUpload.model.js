const mongoose = global.mongodb;

const { SchemaType } = require("mongoose");
const Application = require("./Application.model");

const ApplicationUploadSchema = Application.ApplicationSchema.clone();

ApplicationUploadSchema.path("ocr", {
  date: SchemaType.Date,
});

ApplicationUploadSchema.path("ocrCreated", { type: Boolean, default: true });

mongoose.model("ApplicationUpload", ApplicationUploadSchema);
