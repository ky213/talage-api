const axios = require("axios");
const _ = require('lodash');
const InsurerBO = require("../../../shared/models/Insurer-BO");

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
    // Check for user permission
    if(!req.authentication?.permissions?.applications?.manage){
        return serverHelper.forbiddenError('Do not have Permission');
    }

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
    // Check for user permission
    if(!req.authentication?.permissions?.applications?.manage){
        return serverHelper.forbiddenError('Do not have Permission');
    }

    // Check for data
    const applicationUploadBO = new ApplicationUploadBO();
    const agencyMetadata = {
        agencyLocationId: parseInt(req.body.agencyLocationId, 10),
        agencyNetworkId: parseInt(req.authentication.agencyNetwork, 10),
        agencyId: parseInt(req.body.agencyId, 10),
        insurerId: parseInt(req.body.insurerId, 10),
        tag: req.body.tag
    };

    if (_.isEmpty(req.files)) {
        log.info("Bad Request: No data received" + __location);
        return next(serverHelper.requestError("Bad Request: No data received"));
    }

    // Check for number of files
    if (req.files?.length > 10) {
        log.info("Bad Request: exceeded number of files (10)" + __location);
        return next(serverHelper.requestError("Bad Request: Max number of files is 10"));
    }

    const markAsPending = req.body?.markAsPending === 'true';

    try {
        const initFiles = [];

        for (const file of Object.values(req.files)) {
            // eslint-disable-next-line init-declarations
            let initData;

            try {
                initFiles.push(applicationUploadBO.submitFile(agencyMetadata, req.body.type, file));
            }
            catch (error) {
                initData.error = "Error processing acord application file";
                log.info(`Error processing acord application file: ${file.name} ${error.message} ${__location}`);
            }
        }

        // THIS IS THE TASK CODE
        const results = await Promise.all(initFiles);

        await Promise.all(results.map(async (requestId) => {
            console.log('Waiting for request...', requestId);
            const result = await applicationUploadBO.getOcrResult(requestId);
            console.log('got result:', result);
            if (_.get(result, 'status') === 'ERROR') {
                log.error(`OCR microservice error: ${result.message}`);
                console.log(`OCR microservice error: ${result.message}`)
                return;
            }
            await applicationUploadBO.saveOcrResult(requestId, result, agencyMetadata, markAsPending);
        }));
        res.send(results);
    } catch (ex) {
        log.error("Bad Request: error when reading file " + ex.message + __location);
        console.log(ex);
        return next(serverHelper.requestError("Error during OCR upload"));
    }
    // END TASK CODE
    next();
}

/**
 * 
 */
async function getInsurerList(req, res, next) {
    // Check for user permission
    if(!req.authentication?.permissions?.applications?.manage){
        return serverHelper.forbiddenError('Do not have Permission');
    }

    try {
        const insurerBO = new InsurerBO();
        const insurers = await insurerBO.getList();
        res.send(insurers.map(i => _.pick(i, ['insurerId', 'name'])));
        return next();
    }
    catch (ex) {
        log.error(ex.message + __location);
        res.send({error: true});
        return next();
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addPostAuth("POST acord files for OCR", `${basePath}/acord-ocr`, performOcrOnAccodPdfFile);
    server.addPostAuth("GET acord files status", `${basePath}/acord-ocr/status`, getAcordStatus);
    server.addGetAuth("GET insurer list", `${basePath}/insurer-list`, getInsurerList);
};
