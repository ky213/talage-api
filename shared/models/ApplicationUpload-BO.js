
class ApplicationUploadModel {
    constructor() {
        this.application = global.mongoose.ApplicationUpload;
    }

    async createOne(agency, ocrRequestId) {
        try {
            const result = await this.application.create({
                agencyId: agency?.systemId,
                agencyNetworkId: agency.agencyNetworkId,
                "ocr.requestId": ocrRequestId
            });
            return result?.applicationId;
        }
        catch (error) {
            log.error(`Database Error saving OCR request ${ocrRequestId} ${error.message} ${__location}`);
        }
    }
}

module.exports = ApplicationUploadModel;
