'use strict'

const pdftk = require('node-pdftk');
const path = require('path');

exports.create = async function(dataObj){

    const sourcePDFString = path.resolve(__dirname, '../pdf/acord-125.pdf');

    let form = null;
    try{
        form = await pdftk.
            input(sourcePDFString).
            output();
    }
    catch(err){
        log.error('Failed to generate PDF ' + err + __location);
    }
    return form;

}