"use strict";
const serverHelper = global.requireRootPath("server.js");
const axios = require("axios");

/**
 * Validates data
 *
 * @param {object[]} files - arrary of acord files
 *
 * @returns {object[]}   arrary of acord files
 */
function validateFiles(files) {
    for (const file of files) {
    //Check emptiness
        if (!file.data) {
            file.valid = false;
            file.error = "empty file";

            continue;
        }

        //Check data type
        if (typeof file.data !== "string") {
            file.valid = false;
            file.error = "file data type should be of String type";

            continue;
        }

        //Check file extension
        if (!file.fileName.endsWith(".pdf") && file.extension !== "pdf") {
            file.valid = false;
            file.error = "file extension is not supported. Only pdf is suported";

            continue;
        }

        //Check file size
        const buffer = Buffer.from(file.data);

        if (buffer.byteLength > 2_000_000) {
            //2 MBs max
            file.valid = false;
            file.error = "file size should not exceed 2 MBs";

            continue;
        }
        // else {
        //     file.data = buffer.toString("binary");
        // }

        file.valid = true;
    }

    return files;
}

/**
 * Sends the valid acords list to aws OCR endpoint
 *
 * @param {object[]} files - arrary of acord files
 *
 * @returns {object[]} - arrary of acord files meta data with requestId
 */
async function submitacordsForRecognition(files) {
    for await (const file of files) {
        try {
            const response = await axios.request({
                method: "POST",
                url: "https://ufg7wet2m3.execute-api.us-east-1.amazonaws.com/production/ocr/queue/pdf/acord130/201705",
                data: Buffer.from(file.data, 'base64'),
                headers: {"Content-Type": "application/pdf"}
            });
            file.requestId = response.data?.requestId;
        }
        catch (error) {
            file.error = error.message;
            log.error(`Error processing file: ${file.fileName}`, __location);
        }

        file.data = null;
    }

    return files;
}

/**
 * Sends the valid acords list to aws OCR endpoint
 *
 * @param {object} ocrResult -  OCR result object
 *
 * @returns {object} - application object 
 */
async function mapResultToApplicationObject(ocrResult) {
    // extract required application fields

    // create application object

    //return result

}

/**
 * Sends the valid acords list to aws OCR endpoint
 *
 * @param {object[]} resultObjects - arrary of OCR acord files objects
 *
 * @returns {void} 
 */
async function saveApplications(resultObjects) {
   // map result to application object
   const applicationObjects = []

    for (const object of resultObjects) {
        if(object.data?.status === "SUCCESS" && object.data?.ocrResponse?.length !== 0){
            applicationObjects.push(mapResultToApplicationObject(object))
        }
        
    }
   // save application 
}

/**
 * Get the acord status and data after OCR request submission
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getacordsStatuses(req, res, next) {
    const files = req.body.acords;
    // Check for data
    if (!files?.length) {
        log.info("Bad Request: No data received" + __location);
        return next(serverHelper.requestError("Bad Request: No data received"));
    }

    for (const file of files) {
        try {
            const response = await axios.request({
                method: "GET",
                url: `https://ufg7wet2m3.execute-api.us-east-1.amazonaws.com/production/ocr/status/${file.requestId}`
            });

            file.data = response?.data;
        }
        catch (error) {
            file.data = null;
            file.error = error.message;
            log.error(`Error getting file status: ${file.fileName}`, __location);
        }
    }

    res.send(files);
    next();
}

/**
 * Receives a list of scanned acord files, parse them with an OCR api and then send back the json format version.
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getacordOCR(req, res, next) {
    // Check for data
    if (!req.body.files?.length) {
        log.info("Bad Request: No data received" + __location);
        return next(serverHelper.requestError("Bad Request: No data received"));
    }

    // Check for number of files
    if (req.body.files.length > 10) {
        log.info("Bad Request: exceeded number of files (10)" + __location);
        return next(serverHelper.requestError("Bad Request: Max number of files is 10"));
    }

    //validateFiles
    const acords = validateFiles(req.body.files);
    const validFiles = acords.filter(({valid}) => valid);

    if (validFiles.length === 0) {
        log.info("Bad Request: No valid files received" + __location);
        return next(serverHelper.requestError("Bad Request: No valid files received"));
    }

    // submit acords for OCR recognition
    const result = await submitacordsForRecognition(validFiles);

    //save application
    await saveApplications(result)

    res.send(result);

    next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addPostAuth("POST acord files for OCR", `${basePath}/acord-ocr`, getacordOCR);
    server.addPostAuth("GET acord files statuses", `${basePath}/acord-ocr/status`, getacordsStatuses);
};
