const ApplicationUploadStatus = global.mongoose.ApplicationUploadStatus;

module.exports = class ApplicationUploadBO {
    async getPendingApplications() {
        const insurerIndustryCodeObj = await ApplicationUploadStatus.find({status: 'QUEUED'});
        return insurerIndustryCodeObj;
    }
}
