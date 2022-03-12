"use strict";
const axios = require("axios");

const serverHelper = global.requireRootPath("server.js");
const ApplicationUpload = require("../../../quotesystem/models/ApplicationUpload");

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
    if (req.body.files?.length > 10) {
        log.info("Bad Request: exceeded number of files (10)" + __location);
        return next(serverHelper.requestError("Bad Request: Max number of files is 10"));
    }

    const initFiles = [];

    for (const file of req.body.files) {
        // eslint-disable-next-line init-declarations
        let initData;

        try {
            const applicationUpload = new ApplicationUpload(req.body.agency, file);
            initData = await applicationUpload.init();
        }
        catch (error) {
            initData.error = "Erro initializing acord application file";
            log.info(`Error initializing acord application file: ${file.fileName} ${error.message} ${__location}`);
        }
        initFiles.push(initData);
    }
    res.send(initFiles);
    next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addPostAuth("POST acord files for OCR", `${basePath}/acord-ocr`, getacordOCR);
    server.addPostAuth("GET acord files statuses", `${basePath}/acord-ocr/status`, getacordsStatuses);
};
