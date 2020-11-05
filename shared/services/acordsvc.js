/* eslint-disable no-return-await */
/* eslint-disable require-jsdoc */
'use strict';

const applicationBO = global.requireShared('./models/Application-BO.js');
const agencyBO = global.requireShared('./models/Agency-BO.js');
const insurerBO = global.requireShared('./models/Insurer-BO.js');
const businessBO = global.requireShared('./models/Business-model.js');
const businessAddressBO = global.requireShared('./models/BusinessAddress-model.js');
const applicationQuestionBO = global.requireShared('./models/ApplicationQuestion-BO.js');
const applicationActivityCodes = global.requireShared('./models/ApplicationActivityCodes-model.js');

const wc = require('./acord/wc.js');
const gl = require('./acord/gl.js');

const validator = global.requireShared('./helpers/validator.js');

const pdftk = require('node-pdftk');

const util = require('util');

/**
 * @typedef generatedAcord
 * @type {Object}
 * @property {Object} doc - Object containing the acord form data
 * @property {Array} missing_data - Array containing strings describing any and all data missing from the application (primarily for business team use)
 * @property {String} error - Message describing any error encountered by the service to be passed to the front end
 */

/**
 * Responds to get requests for the certificate endpoint
 *
 * @param {number} application_id - id of the application for ACORD form generation
 * @param {number} insurer_id - id of the insurer for ACORD form generation
 * @param {string} policy_type - policy type of the requested form
 *
 * @returns {generatedAcord} Generated ACORD form for selected application, insurer, and policy type
 */
exports.create = async function(application_id, insurer_id, policy_type){

    let message = '';
    // Validate the application ID
    if(!application_id || !await validator.is_valid_application(application_id)){
        message = 'ACORD form generation failed. Bad Request: Invalid application id';
        log.info(message + __location);
        return {'error': message};
    }

    if(!insurer_id || !await validator.isValidInsurer(insurer_id)){
        message = 'ACORD form generation failed. Bad Request: Invalid insurer id';
        log.info(message + __location);
        return {'error': message};
    }

    const dataObj = await dataInit(application_id, insurer_id);
    let pdfList = null;

    if(policy_type.toLowerCase() === 'wc'){
        return await wc.createWC(application_id, insurer_id);
    }
    else if(policy_type.toLowerCase() === 'gl'){
        pdfList = await gl.createGL(dataObj);
    }

    return createACORDPDF(pdfList);

}

async function dataInit(applicationId, insurerId){

    const applicationDoc = new applicationBO();
    await applicationDoc.getMongoDocbyMysqlId(applicationId);

    console.log(applicationDoc);

    const dataObj = {};

    return dataObj;

}
function createACORDPDF(pdfList){

    let pdfKey = 0;
    const pdfObj = {};
    pdfList.forEach(pdf => {
        pdfObj[String.fromCharCode(65 + pdfKey)] = pdf;
        pdfKey += 1;
    })

    const concatPdfsString = Object.keys(pdfObj).join(' ');

    let form = null

    form = pdftk.
        input(pdfObj).
        cat(concatPdfsString).
        output();

    return form;
}