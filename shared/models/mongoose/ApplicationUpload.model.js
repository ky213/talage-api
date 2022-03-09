const mongoose = global.mongodb

const Application = require('./Application.model')

const ApplicationUploadSchema = Application.ApplicationSchema.clone()


mongoose.model('ApplicationUpload', ApplicationUploadSchema);
