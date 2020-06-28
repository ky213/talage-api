/* eslint-disable prefer-const */
/* eslint-disable dot-notation */
/* eslint-disable array-element-newline */
'use strict';
const moment = require('moment');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

exports.process = async function(requestJSON) {

    // move to business and contact info
    // to businessInfo
    //Clean inputs
    //const makeInt = true;
    let claimsJSON = JSON.parse(requestJSON.claims);
    requestJSON.claims = claimsJSON;
    for(var i = 0; i < claimsJSON.length; i++){
        let claim = claimsJSON[i];
        if(claim.id){
            delete claim.id;
        }
        //claim.date = new \DateTime(stringFunctions.santizeString(claim.date);
        try{
            const claim_date = moment(claim.date , 'MM/DD/YYYY');
            claim.date = claim_date.format(db.dbTimeFormat());
        }
        catch(e){
            log.error("Claim claim.date convert error " + e + __location)
        }
        //claim.amount_paid = stringFunctions.santizeString(claim.amount_paid, makeInt);
        //claim.open = stringFunctions.santizeNumber(claim.open, makeInt);
        ///claim.amount_reserved = stringFunctions.santizeNumber(claim.amount_reserved, makeInt);
        //claim.missed_work = stringFunctions.santizeNumber(claim.missed_work, makeInt);
        claim.policy_type = stringFunctions.santizeNumber(claim.policy_type);

    }
    log.debug("Claim Parser requestJSON: " + JSON.stringify(requestJSON));
    return true;
}