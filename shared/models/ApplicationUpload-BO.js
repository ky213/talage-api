const applicationUpload = global.mongoose.ApplicationUpload;

class ApplicationUploadModel {
  constructor() {}

  async createOne(agencyId, ocrRequestId) {
    const result = await applicationUpload.create({ agencyId: agencyId, "ocr.requestId": ocrRequestId });
    return result?.applicationId;
  }
}

module.exports = ApplicationUploadModel;
