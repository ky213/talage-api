'use strict'

const pdftk = require('node-pdftk');
const path = require('path');
const helpers = require('../helpers.js');
const moment = require('moment');

exports.create = async function(dataObj){

    const sourcePDFString = path.resolve(__dirname, '../pdf/acord-126.pdf');

    const limitsArray = helpers.getLimitsAsDollarAmounts(dataObj.application.limits);

    const pdfDataFieldsObj = {
        "Form_CompletionDate_A": moment().format('L'),
        "Producer_FullName_A": dataObj.agency.name,
        "Insurer_FullName_A": dataObj.insurer.name,
        "NamedInsured_FullName_A": dataObj.business.name,
        "GeneralLiability_CoverageIndicator_A": 1,
        "GeneralLiability_GeneralAggregate_LimitAppliesPerPolicyIndicator_A": 1,
        "GeneralLiability_EachOccurrence_LimitAmount_A": limitsArray[0],
        "GeneralLiability_GeneralAggregate_LimitAmount_A": limitsArray[1],
        "GeneralLiability_ProductsAndCompletedOperations_AggregateLimitAmount_A": limitsArray[2]
    };


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