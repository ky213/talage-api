'use strict';

const moment = require('moment');
const path = require('path');

const signature = require('./signature.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const pdftk = require('node-pdftk');

const applicationBO = global.requireShared('./models/Application-BO.js');
const agencyBO = global.requireShared('./models/Agency-BO.js');
const insurerBO = global.requireShared('./models/Insurer-BO.js');
const businessBO = global.requireShared('./models/Business-model.js');
const businessAddressBO = global.requireShared('./models/BusinessAddress-model.js');
const applicationQuestionBO = global.requireShared('./models/ApplicationQuestion-BO.js');
const questionBO

const helpers = require('./helpers.js');

exports.createGL = async function(application_id, insurer_id){

    // Retrieve data
    const app = new applicationBO();
    await app.getById(application_id);
    await app.getAgencyNewtorkIdById(application_id);

    const agency = new agencyBO();
    await agency.loadFromId(app.agency);

    const insurer = new insurerBO();
    await insurer.loadFromId(insurer_id);

    const business = new businessBO();
    await business.loadFromId(app.business);

    const businessAddresses = new businessAddressBO();
    const addresses = await businessAddresses.loadFromBusinessId(app.business);

    const questionsBO = new applicationQuestionBO();
    const questions = await questionsBO.loadFromApplicationId(application_id);

    console.log('SANITY CHECK')
    console.log(questions);

    

    // console.log(insurer);
    // console.log(agency);
    // console.log(app);
    // console.log(business);
    // console.log(addresses);

    

    if(app.gl_effective_date !== '0000-00-00'){
        pdfDataFieldsObj.Policy_EffectiveDate_A = moment(app.gl_effective_date).format('L');
    }

    let sourcePDFString = path.resolve(__dirname, 'pdf/acord-gl.pdf');

    console.log(sourcePDFString);

    let form = null;
    try{
        form = await pdftk.
            input(sourcePDFString).
            fillForm(pdfDataFieldsObj).
            output();
    }
    catch(err){
        log.error('Failed to generate PDF ' + err + __location);
    }
    return form;
}