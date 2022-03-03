'use strict';

/**
 * Responds to get requests for the list of insurer logos
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAccordOCR(req, res, next){
    res.send('ok')
    next()
}

exports.registerEndpoint = (server, basePath) => {
    server.addPostAuth('POST scanned accord files for OCR', `${basePath}/accord-ocr`, getAccordOCR);
};