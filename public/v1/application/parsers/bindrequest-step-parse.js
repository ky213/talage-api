/* eslint-disable dot-notation */
/* eslint-disable array-element-newline */
'use strict';
// const moment = require('moment');
// const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// const makeInt = true;

exports.process = async function(requestJSON) {

    const QuoteBO = global.requireShared('models/Quote-BO.js');
    const quoteBO = new QuoteBO();
    try{
        const quoteJSON = await quoteBO.getById(requestJSON.quotes[0].quote)
        if(quoteJSON){
            requestJSON.id = quoteJSON.applicationId;
        }
    }
    catch(err){
        log.error(`Error get applicationId ${err}` +__location );
    }

    //	$additionalInsured = $_POST['additionalInsured'] === 'false' ? 0 : ($_POST['additionalInsured'] === 'true' ? 1 : null);
    // $waiverOfSubrogation = $_POST['waiverOfSubrogation'] === 'false' ? 0 : ($_POST['waiverOfSubrogation'] === 'true' ? 1 : null);
    if (requestJSON.additionalInsured) {
        requestJSON.additional_insured = requestJSON.additionalInsured === 'false' ? 0 : 1
        delete requestJSON.additionalInsured
    }
    // waiver_subrogation
    if (requestJSON.waiverOfSubrogation) {
        requestJSON.waiver_subrogation = requestJSON.waiverOfSubrogation === 'false' ? 0 : 1
        delete requestJSON.waiverOfSubrogation
    }

    log.debug("bindRequest parser requestJSON: " + JSON.stringify(requestJSON));
    return true;
}