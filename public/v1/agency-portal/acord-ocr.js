const axios = require("axios");
const _ = require('lodash');
const InsurerBO = require("../../../shared/models/Insurer-BO");
const AgencyBO = require("../../../shared/models/Agency-BO");

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
                url: `https://${global.settings.ENV}ocrapi.internal.talageins.com/ocr/status/${file.requestId}`
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
async function performOcrOnAcodPdfFile(req, res, next) {
    // Check for user permission
    if(!req.authentication?.permissions?.applications?.manage){
        return serverHelper.forbiddenError('Do not have Permission');
    }

    // Check for data
    const applicationUploadBO = new ApplicationUploadBO();
    const agencyBO = new AgencyBO();
    const agency = await agencyBO.getAgencyByMysqlId(req.body.agencyId);
    const agencyMetadata = {
        agencyLocationId: parseInt(req.body.agencyLocationId, 10),
        agencyNetworkId: agency.agencyNetworkId,
        agencyId: parseInt(req.body.agencyId, 10),
        insurerId: parseInt(req.body.insurerId, 10),
        tag: req.body.tag,
        markAsPending: req.body?.markAsPending === 'true',
        advanceDate: req.body?.advanceDate === 'true',
        agencyPortalUserId: req.authentication.userID
    };

    if (_.isEmpty(req.files)) {
        log.info("Bad Request: No data received" + __location);
        return next(serverHelper.requestError("Bad Request: No data received"));
    }

    // Check for number of files
    if (req.files?.length > 500) {
        log.info("Bad Request: exceeded number of files (500)" + __location);
        return next(serverHelper.requestError("Bad Request: Max number of files is 500"));
    }

    try {
        const initFiles = [];

        for (const file of Object.values(req.files)) {
            try {
                initFiles.push(applicationUploadBO.submitFile(agencyMetadata, req.body.type, file));
            }
            catch (error) {
                log.warn(`Error processing acord application file: ${file.name} ${error.message} ${__location}`);
            }
        }

        const results = await Promise.all(initFiles);
        res.send(results);
    }
    catch (ex) {
        log.error("Bad Request: error when reading file " + ex.message + __location);
        return next(serverHelper.requestError("Error during OCR upload"));
    }
    next();
}

/**
 * Get insurer list
 *
 * @param {*} req req
 * @param {*} res res
 * @param {*} next next
 * @return {*} out
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
    server.addPostAuth("POST acord files for OCR", `${basePath}/acord-ocr`, performOcrOnAcodPdfFile);
    server.addPostAuth("GET acord files status", `${basePath}/acord-ocr/status`, getAcordStatus);
    server.addGetAuth("GET insurer list", `${basePath}/insurer-list`, getInsurerList);
};
