const axios = require("axios");
const ApplicationUpload = global.mongoose.ApplicationUpload;
const ApplicationUploadStatus = global.mongoose.ApplicationUploadStatus;
const fs = require('fs');

module.exports = class ApplicationUploadBO {
    async submitFile(agency, fileType, acordFile) {
        // Check emptiness
        // if (!acordFile.data) {
        //     throw new Error(`${acordFile.name}: is empty.`);
        // }

        // Check file extension
        if (!acordFile.name.endsWith(".pdf") && acordFile.extension !== "pdf") {
            throw new Error(`${acordFile.name}: must have PDF extension.`);
        }

        // Must only use certain file types.
        if (fileType !== 'pdf/acord130/201705') {
            throw new Error(`${acordFile.name} / ${fileType}: Invalid file type.`);
        }

        //Check file size
        const fileData = fs.readFileSync(acordFile.path);

        // XXX Roger: Why is this here?
        // if (buffer.byteLength > 2_000_000) {
        //     //2 MBs max
        //     throw new Error(`${acordFile.name} / ${fileType}: file size should not exceed 2 MBs.`);
        // }

        // Submit Accord file to OCR.
        let requestId = '';
        try {
            const url = `https://ck2c645j29.execute-api.us-west-1.amazonaws.com/develop2/ocr/queue/${fileType}`;
            const response = await axios.request({
                method: "POST",
                url: url,
                data: fileData,
                headers: {"Content-Type": "application/pdf"}
            });
            requestId = response.data?.requestId;
        }
        catch (error) {
            log.error(`OCR Error submiting file: ${acordFile.name} ${error.message} ${__location}`);
            throw new Error(`OCR Error submiting file: ${acordFile.name} ${error.message} ${__location}`);
        }

        try {
            await ApplicationUploadStatus.create({
                agencyId: agency?.agencyId,
                agencyNetworkId: agency.agencyNetworkId,
                requestId: requestId,
                status: 'QUEUED',
                fileName: acordFile.name,
                type: fileType
            });
        }
        catch (error) {
            log.error(`Error saving application ${acordFile.name} ${error.message} ${__location}`);
            throw new Error(`Error saving application ${acordFile.name} ${error.message} ${__location}`);
        }

        return requestId;
    }

    /**
     * Waits for OCR to finish and then returns the result. Throws an error if an error occurs
     * during the OCR process or if we timeout.
     */
    async getOcrResult(requestId) {
        let status;
        try {
            let i = 0;
            do {
                if (i++ > 200) {
                    throw new Error('timeout');
                }
                // Go to sleep for 5 seconds
                await new Promise(r => setTimeout(r, 5000));

                status = await axios.request({
                    method: 'GET',
                    url: `https://ck2c645j29.execute-api.us-west-1.amazonaws.com/develop2/ocr/status/${requestId}`
                });
                console.log('Still queued... waiting...');
            } while (status.data.status === 'QUEUED');
        } catch (error) {
            try {
                await ApplicationUploadStatus.updateOne({requestId: requestId}, {status: 'ERROR'});
            } catch (err) {
                log.error(`Error setting OCR status to ERROR. requestId: ${requestId}`);
            }
            log.error(`Error retrieving OCR result. File: ${error.message}, Error: ${error.message} @ ${__location}`);
            console.log(error);
        }
        return status.data;
    }

    async saveOcrResult(requestId, ocrResult) {
        await ApplicationUploadStatus.updateOne({ requestId: requestId }, { status: 'SUCCESS'});
        await ApplicationUpload.create({
            requestId: requestId,
            form: ocrResult.form,
            questions: ocrResult.ocrResponse
        })
    }

    async updateOne(applicationId, data) {
        try {
            await ApplicationUpload.updateOne({applicationId: applicationId}, {...data});
        }
        catch (error) {
            log.error(`Database Error updating OCR app ${applicationId} ${error.message} ${__location}`);
        }
    }

    async getList(query) {
        try {
            const result = await ApplicationUpload.find(query).lean();
            return result || [];
        }
        catch (error) {
            log.error(`Database Error getting OCR list  ${error.message} ${__location}`);
        }
    }
}
