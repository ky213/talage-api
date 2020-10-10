'use strict';

const crypt = global.requireShared('./services/crypt.js');
const moment = require('moment');
const signature = require('../signature.js');
const styles = require('../document-style/certificate/styles.js');
const positions = require('../document-style/certificate/positions.js');

exports.page_2_3 = async function(data){

    let ein = '';
    if(data[0].ein.byteLength){
        ein = await crypt.decrypt(data[0].ein);
    }
    if(data[0].has_ein){
        ein = `${ein.substr(0, 2)} - ${ein.substr(2, 7)}`;
    }
    else{
        ein = `${ein.substr(0, 3)} - ${ein.substr(3, 2)} - ${ein.substr(5, 4)}`;
    }

    const exclusion = data[0].owners_covered ? 'included' : 'excluded';

    return [
        {
            'absolutePosition': positions.NY_box_1a,
            'pageBreak': 'before',
            'style': styles.address,
            'text': data[1].insured
        },
        {
            'absolutePosition': positions.NY_box_1b,
            'style': styles.address,
            'text': data[1].phone
        },
        {
            'absolutePosition': positions.NY_box_2,
            'style': styles.address,
            'text': data[1].certificate_holder
        },
        {
            'absolutePosition': positions.NY_box_1c,
            'style': styles.address,
            'text': data[0].unemployment_num
        },
        {
            'absolutePosition': positions.NY_box_3a,
            'style': styles.address,
            'text': data[0].writer
        },
        {
            'absolutePosition': positions.NY_box_3b,
            'style': styles.address,
            'text': data[0].policy_number
        },
        {
            'absolutePosition': positions.NY_box_3c_eff,
            'style': styles.address,
            'text': data[0].effective_date
        },
        {
            'absolutePosition': positions.NY_box_3c_exp,
            'style': styles.address,
            'text': data[0].expiration_date
        },
        {
            'absolutePosition': positions.NY_cancelation_checkbox,
            'style': styles.address,
            'text': 'X'
        },
        {
            'absolutePosition': positions.NY_agent_name,
            'style': styles.address,
            'text': data[1].agent_name
        },
        {
            'absolutePosition': positions.NY_date,
            'style': styles.address,
            'text': moment().format('L')
        },
        {
            'absolutePosition': positions.NY_title,
            'style': styles.address,
            'text': 'President'
        },
        {
            'absolutePosition': positions.NY_agent_phone,
            'style': styles.address,
            'text': data[1].agent_phone
        },
        {
            'absolutePosition': positions.NY_box_1d,
            'style': styles.address,
            'text': ein
        },
        {
            'absolutePosition': positions.NY_signature,
            'height': 25,
            'image': signature.talage_signature,
            'width': 85
        },
        {
            'absolutePosition': positions[`NY_box_3d_${exclusion}`],
            'style': styles.address,
            'text': 'X'
        },
        {
            'pageBreak': 'before',
            'text': ''
        }
    ];
};