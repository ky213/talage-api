const axios = require("axios");

const ApplicationUploadBO = global.requireShared("./models/ApplicationUpload-BO");

class ApplicationUpload {
    constructor(agency, acordFile = {}) {
        this.agency = agency;
        this.acordFile = acordFile;
        this.applicationObject = {};
        this.ocrResult = [];
    }

    async init() {
        try {
            this.validateAcordFile();

            if (this.acordFile.valid) {
                await this.submitAcordToOCR();
                await this.saveApplication();
            }
        }
        catch (error) {
            log.error(`Error initializing  file ${this.acordFile.fileName} ${error.message} ${__location}`);
            this.acordFile.error = "Error initializing file";
        }

        return this.acordFile;
    }

    validateAcordFile() {
    //Check emptiness
        if (!this.acordFile.data) {
            this.acordFile.valid = false;
            this.acordFile.error = "empty file";
            return;
        }

        //Check data type
        if (typeof this.acordFile.data !== "string") {
            this.acordFile.valid = false;
            this.acordFile.error = "file data type should be of String type";
            return;
        }

        //Check file extension
        if (!this.acordFile.fileName.endsWith(".pdf") && this.acordFile.extension !== "pdf") {
            this.acordFile.valid = false;
            this.acordFile.error = "file extension is not supported. Only pdf is suported";
            return;
        }

        //Check file size
        const buffer = Buffer.from(this.acordFile.data, "base64");

        if (buffer.byteLength > 2_000_000) {
            //2 MBs max
            this.acordFile.valid = false;
            this.acordFile.error = "file size should not exceed 2 MBs";
            return;
        }

        this.acordFile.valid = true;
        this.acordFile.data = buffer;
    }

    async submitAcordToOCR() {
        try {
            const response = await axios.request({
                method: "POST",
                url: "https://ufg7wet2m3.execute-api.us-east-1.amazonaws.com/production/ocr/queue/pdf/acord130/201705",
                data: this.acordFile.data,
                headers: {"Content-Type": "application/pdf"}
            });
            this.acordFile.requestId = response.data?.requestId;
        }
        catch (error) {
            this.acordFile.error = "OCR Error submiting file";
            log.error(`OCR Error submiting file: ${this.acordFile.fileName} ${error.message} ${__location}`);
        }

        this.acordFile.data = null;
    }

    async saveApplication() {
        try {
            const applicationUploadBO = new ApplicationUploadBO();
            const applicationId = await applicationUploadBO.createOne(this.agency, this.acordFile.requestId);

            if (applicationId) {
                this.acordFile.applicationId = applicationId;
            }
            else {
                this.acordFile.error = "Error saving application";
            }
        }
        catch (error) {
            this.acordFile.error = "Error saving application";
            log.error(`Error saving application ${this.acordFile.fileName} ${error.message} ${__location}`);
        }
    }
}

module.exports = ApplicationUpload;
