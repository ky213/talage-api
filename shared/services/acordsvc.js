/* eslint-disable no-return-await */
/* eslint-disable require-jsdoc */
'use strict';

//const PdfPrinter = require('pdfmake');
//const crypt = global.requireShared('./services/crypt.js');
const wc = require('./acordhelpers/wc.js');
const gl = require('./acordhelpers/gl.js');

const validator = global.requireShared('./helpers/validator.js');
//const {createLogger} = require('restify/lib/bunyan_helper');

/**
 * @typedef generatedAcord
 * @type {Object}
 * @property {Object} doc - Object containing the acord form data
 * @property {Array} missing_data - Array containing strings describing any and all data missing from the application (primarily for business team use)
 * @property {String} error - Message describing any error encountered by the service to be passed to the front end
 */

/**
 * Generate an Acord Document
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

    if(policy_type.toLowerCase() === 'wc'){
        return await wc.createWC(application_id, insurer_id);
    }
    else if(policy_type.toLowerCase() === 'gl'){
        return await gl.createGL(application_id, insurer_id);
    }

}