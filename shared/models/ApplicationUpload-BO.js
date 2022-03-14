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

    async updateOne(applicationId, data) {
        try {
            await this.application.updateOne({applicationId: applicationId}, {...data});
        }
        catch (error) {
            log.error(`Database Error updating OCR app ${applicationId} ${error.message} ${__location}`);
        }
    }

    async getList(query) {
        try {
            const result = await this.application.find(query).lean();
            return result || [];
        }
        catch (error) {
            log.error(`Database Error getting OCR list  ${error.message} ${__location}`);
        }
    }
}

module.exports = ApplicationUploadModel;
