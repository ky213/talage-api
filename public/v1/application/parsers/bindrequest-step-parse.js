/* eslint-disable dot-notation */
/* eslint-disable array-element-newline */
'use strict';
// const moment = require('moment');
// const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// const makeInt = true;

exports.process = async function(requestJSON) {

    // move to business and contact info
    // to businessInfo
    //Clean inputs
    //look up application ID by quote
    if (requestJSON.quotes) {
        requestJSON.quotes = JSON.parse(requestJSON.quotes);
        const sql = `select id, application from clw_talage_quotes where id = ${requestJSON.quotes[0].quote}`
        log.debug(sql + __location)
        let rejected = null;
        const result = await db.query(sql).catch(function(error) {
            // Check if this was
            log.error("Database Object clw_talage_application_questions INSERT error :" + error + __location);
            rejected = true;
        });
        if (rejected) {
            return false;
        }
        try {
            log.debug('setting appicationid from quote ' + __location)
            log.debug('quote record ' + JSON.stringify(result[0]));
            requestJSON.id = result[0].application;
        }
        catch (e) {
            log.error(e + __location)
        }
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