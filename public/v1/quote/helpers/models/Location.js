/* eslint-disable prefer-const */
/**
 * Defines a single industry code
 */

'use strict';

const ActivityCode = require('./ActivityCode.js');
const validator = global.requireShared('./helpers/validator.js');
//const ZipCodeBO = global.requireShared('./models/ZipCode-BO.js');

module.exports = class Location {

    constructor() {
        // set by from parent business
        this.appPolicyTypeList = [];
        this.business_entity_type = '';


        this.activity_codes = [];
        this.address = '';
        this.address2 = '';
        this.city = '';
        this.county = '';
        this.full_time_employees = 0;
        this.identification_number = '';
        this.identification_number_type = null;
        this.part_time_employees = 0;
        this.square_footage = 0;
        this.territory = '';
        this.zipcode = '';
        this.state = '';
        this.state_abbr = '';

        // WC Only
        //this.unemployment_num = 0;
        this.unemployment_number = 0;
    }

    /**
	 * Populates this object with data from the request
	 *
	 * @param {object} locationDocJson - The Location from Mongoose Application Model
	 * @returns {void}
	 */
    async load(locationDocJson) {
        Object.keys(this).forEach((property) => {
            if (!Object.prototype.hasOwnProperty.call(locationDocJson, property)) {
                return;
            }

            // Trim whitespace
            if (typeof locationDocJson[property] === 'string') {
                locationDocJson[property] = locationDocJson[property].trim();
            }

            // Perform property specific tasks
            if (locationDocJson[property] && typeof locationDocJson[property] !== 'object') {
                switch (property) {
                    case "identification_number":
                        this[property] = locationDocJson.ein;
                        break;

                    case 'full_time_employees':
                    case 'part_time_employees':
                    case 'square_footage':
                    case 'year_built':
                        this[property] = parseInt(locationDocJson[property], 10);
                        break;
                    default:
                        if(locationDocJson[property]){
                            this[property] = locationDocJson[property];
                        }
                        break;
                }
            }
        }); //object loop
        //backward compatible for integration code.
        this.zip = locationDocJson.zipcode;
        this.territory = locationDocJson.state;
        this.state_abbr = locationDocJson.state;
        this.state = locationDocJson.state;
        this.county = locationDocJson.county;
        if(locationDocJson.unemployment_num){
            try{
                this.unemployment_number = parseInt(locationDocJson.unemployment_num, 10);
            }
            catch(err){
                log.error(`Int Parse error on unemployment_num s${locationDocJson.unemployment_num} ` + err + __location)
            }
        }
        //log.debug("Location finished load " + JSON.stringify(this));
        // 'activity_codes':
        if (locationDocJson.activityPayrollList && locationDocJson.activityPayrollList.length > 0) {
            locationDocJson.activityPayrollList.forEach((actvityPayroll) => {
                // Check if we have already seen this activity code
                let match = false;
                const tmp_id = parseInt(actvityPayroll.ncciCode, 10);
                this.activity_codes.forEach(function(modelActivityCode) {
                    if (tmp_id === modelActivityCode.ncciCode) {
                        match = true;
                        modelActivityCode.load(actvityPayroll);
                    }
                });

                // If the activity code is new, add it
                if (!match) {
                    const activity_code = new ActivityCode();
                    activity_code.load(actvityPayroll);
                    this.activity_codes.push(activity_code);
                }
            });
        }
    }

    setPolicyTypeList(appPolicyTypeList){
        this.appPolicyTypeList = appPolicyTypeList;
        this.activity_codes.forEach(function(activity_code) {
            activity_code.appPolicyTypeList = appPolicyTypeList;
        });
    }
}