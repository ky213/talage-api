/* eslint-disable implicit-arrow-linebreak */
/**
 * Provides functions for validating data
 */

'use strict';

// Regular expressions for validating certain things
const positive_integer = /^[1-9]\d*$/;
const zip = /^("|')?[0-9]{5}([0-9]{4})?("|')?$/;
const bureau_number_CA = /[0-9]{2}-[0-9]{2}-[0-9]{2}/;
const bureau_number_not_CA = /[0-9]{9}/;
const business_name = /^[a-zA-Z0-9'’.&+|, \-\(\)]*$/;
const effective_date = /((0[1-9])|(1[0-2]))[-](0[1-9]|[12][0-9]|3[01])[-]20\d\d/;
const founded_date = /^((0[1-9])|(1[0-2]))-(\d{4})$/;
const full_name = /^[a-zA-Z\.\'\-]{2,30}(?: [a-zA-Z\.\'\-]{2,30})+$/;
const insurerID = /[0-9]/;
const name = /^[a-zA-Z' -]*$/;
const sqFtg = /[0-9]/;
const website = /^(https?:\/\/)?(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=])*)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(\d*)?)(\/((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=])+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=])*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=])|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=])|\/|\?)*)?$/i;
const year = /^[1|2]{1}[7|8|9|0]{1}[0-9]{2}/;

// ============================================================
// Most repos

// Load in validators from the sub file
const normalizedPath = require('path').join(global.sharedPath, 'helpers', 'validators');
require('fs').readdirSync(normalizedPath).forEach(function(file){
    module.exports[file.replace('.js', '')] = global.requireShared(`helpers/validators/${file}`);
});

// ============================================================
// Agency-portal/api

exports.is_valid_id = function(id){
    if(typeof id === 'string'){
        return Number.isInteger(parseInt(id, 10));
    }
    else if(typeof id === 'number'){
        return Number.isInteger(id);
    }
    return false;
};


exports.is_valid_zip = function(given_zip){
    return positive_integer.test(given_zip) && zip.test(given_zip);
};

// ============================================================
// Auth-api, code-api, quote-api (different), slack-api

exports.isID = val =>
    !isNaN(val) && val >= 1;

exports.isUuid = uuid =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);


// ============================================================
// Quote-api

exports.isBusinessName = function(val){
    return Boolean(business_name.test(val));
};

exports.isEffectiveDate = function(val){
    return Boolean(effective_date.test(val));
};

exports.isFoundedDate = function(val){
    return Boolean(founded_date.test(val));
};

exports.isFullName = function(val){
    return Boolean(full_name.test(val));
};

exports.isInYearRange = function(minimumYear, maximumYear, testYear){
    return Boolean(testYear <= maximumYear && testYear > minimumYear);
};

exports.isName = function(val){
    return Boolean(name.test(val));
};

exports.isSqFtg = function(val){
    return Boolean(sqFtg.test(val));
};

exports.isWebsite = function(val){
    return Boolean(website.test(val));
};

exports.isValidYear = function(val){
    return Boolean(year.test(val));
};

exports.isZip = function(val){
    return Boolean(zip.test(val));
};

exports.isBureauNumberCA = function(val){
    return Boolean(bureau_number_CA.test(val));
};

exports.isBureauNumberNotCA = function(val){
    return Boolean(bureau_number_not_CA.test(val));
};

exports.isInsurerId = function(val){
    return Boolean(insurerID.test(val));
};