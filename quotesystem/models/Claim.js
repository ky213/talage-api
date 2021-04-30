/**
 * Defines a single industry code
 */

'use strict';

const moment = require('moment');
const validator = global.requireShared('./helpers/validator.js');

module.exports = class Claim{

    constructor(){
        this.amountPaid = 0;
        this.amountReserved = 0;
        this.date = '';

        // Worker's Compensation Claims
        this.missedWork = false;
        this.open = false;
    }

    /**
	 * Populates this object with data from the request
	 *
	 * @param {object} claimJSON - The business data
	 * @returns {void}
	 */
    load(claimJSON){

        this.amountPaid = claimJSON.amountPaid;
        this.amountReserved = claimJSON.amountReserved;
        this.date = moment(claimJSON.eventDate);

        // Worker's Compensation Claims
        this.missedWork = claimJSON.missedWork;
        this.open = claimJSON.open;
    }
};