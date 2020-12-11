/* eslint-disable no-return-await */
/* eslint-disable require-jsdoc */
'use strict';

const AcordGL = require('./acord/policies/gl.js');
const AcordWC = require('./acord/policies/wc.js');
const AcordBOP = require('./acord/policies/bop.js');

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

    let acord = null;

    if(policy_type.toLowerCase() === 'wc'){
        acord = new AcordWC(application_id, insurer_id);
    }
    else if(policy_type.toLowerCase() === 'gl'){
        acord = new AcordGL(application_id, insurer_id);
    }
    else if(policy_type.toLowerCase() === 'bop'){
        acord = new AcordBOP(application_id, insurer_id);
    }

    let acordForm = null;
    try{
        acordForm = await acord.create();
    }
    catch(err){
        log.error('Acord form PDF generation failed: ' + err + __location)
        throw err;
    }

    let pdfUint8Array = null;

    try{
        pdfUint8Array = await acordForm.save();
    }
    catch(err){
        log.error('Acord for PDF save() ' + err + __location);
    }

    const pdfBuffer = new Buffer.from(pdfUint8Array.buffer);

    return {'doc': pdfBuffer};
}