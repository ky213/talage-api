const applicationUpload = global.mongoose.ApplicationUpload;

class ApplicationUploadModel {
  constructor() {}

  async createOne(agency, ocrRequestId) {
    try {
      const result = await applicationUpload.create({
        agencyId: agency?.systemId,
        agencyNetworkId: agency.agencyNetworkId,
        "ocr.requestId": ocrRequestId,
      });
      return result?.applicationId;
    } catch (error) {
      log.error(`Database Error saving OCR request ${ocrRequestId} ${error.message} ${__location}`);
    }
  }
}

module.exports = ApplicationUploadModel;
