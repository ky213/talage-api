/**
 * Defines a single industry code
 */

'use strict';

module.exports = class ActivityCode{

    constructor(){
        this.appPolicyTypeList = [];
        this.employeeTypeList = [];
        this.description = '';
        this.id = 0;

        // WC Only
        this.payroll = 0;
    }

    /**
	 * Populates this object with data from the request
	 *
	 * @param {object} locationActiviyCodeDocJson - The business data
	 * @returns {void}
	 */
    load(locationActiviyCodeDocJson){
        // locationActiviyCodeDocJson from Mongoose Application Model
        if(locationActiviyCodeDocJson.activityCodeId){
            this.id = locationActiviyCodeDocJson.activityCodeId;
        }

        if(locationActiviyCodeDocJson.payroll > 0){
            this.payroll += locationActiviyCodeDocJson.payroll;
        }
        if(locationActiviyCodeDocJson.ownerPayRoll > 0){
            this.payroll += locationActiviyCodeDocJson.ownerPayRoll;
        }
        if(locationActiviyCodeDocJson.employeeTypeList){
            this.employeeTypeList = locationActiviyCodeDocJson.employeeTypeList;
        }
    }
};