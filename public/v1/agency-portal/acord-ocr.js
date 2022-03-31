const axios = require("axios");
const _ = require('lodash');

const serverHelper = global.requireRootPath("server.js");
const ApplicationUploadBO = global.requireShared('./models/ApplicationUpload-BO.js');

/**
 * Get the acord status and data after OCR request submission
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAcordStatus(req, res, next) {
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
async function performOcrOnAccodPdfFile(req, res, next) {
    // Check for data
    const applicationUploadBO = new ApplicationUploadBO();
    const agency = {
        agencyNetworkId: req.authentication.agencyNetwork,
        agencyId: 1 // pick primary or they could tell us. If agency user, then take it from the user. Needs to work just like the application does.
        // Add a agency location selection. Work just like the application.
        // single line tag. just like application. under 30 characters
        // action: Price, Quote, Create
        // If we advance 12 months, Application Upload table
        // Otherwise goes to Application table.
    };

    // console.log('DA FILE', fs.readFileSync(req.files['0'].path));
    if (_.isEmpty(req.files)) {
        log.info("Bad Request: No data received" + __location);
        return next(serverHelper.requestError("Bad Request: No data received"));
    }

    // Check for number of files
    if (req.files?.length > 10) {
        log.info("Bad Request: exceeded number of files (10)" + __location);
        return next(serverHelper.requestError("Bad Request: Max number of files is 10"));
    }

    const initFiles = [];

    for (const file of Object.values(req.files)) {
        // eslint-disable-next-line init-declarations
        let initData;

        try {
            initFiles.push(applicationUploadBO.submitFile(agency, req.body.type, file));
        }
        catch (error) {
            initData.error = "Error processing acord application file";
            log.info(`Error processing acord application file: ${file.name} ${error.message} ${__location}`);
        }
    }
    const results = await Promise.all(initFiles);

    for (const requestId of results) {
        const result = await applicationUploadBO.getOcrResult(requestId);
        console.log('got da result!', result);
        await applicationUploadBO.saveOcrResult(requestId, result);
    }
    res.send(await Promise.all(initFiles));
    next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addPostAuth("POST acord files for OCR", `${basePath}/acord-ocr`, performOcrOnAccodPdfFile);
    server.addPostAuth("GET acord files status", `${basePath}/acord-ocr/status`, getAcordStatus);
};
