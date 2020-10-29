'use strict'

const pdftk = require('node-pdftk');
const path = require('path');
const moment = require('moment');

const limitHelper = global.requireShared('./helpers/formatLimits.js');

exports.create = async function(dataObj){

    const sourcePDFString = path.resolve(__dirname, '../pdf/acord-126.pdf');

    /*
     * Process data that needs special processing
     */

    // Get individual limits formatted as dollar amounts (ex. ['1,000,000' , '2,000,000' , '1,000,000'])
    const limitsArray = limitHelper.getLimitsAsDollarAmounts(dataObj.application.limits);

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


    /*
     * Add properties to the data fields object that are conditional
     */

    // Add effective date if there was one set for this application
    if(dataObj.application.gl_effective_date !== '0000-00-00'){
        pdfDataFieldsObj.Policy_EffectiveDate_A = moment(dataObj.application.gl_effective_date).format('L');
    }

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