/**
 * Defines a single industry code
 */

'use strict';

const serverHelper = require('../../../../../server.js');

module.exports = class ActivityCode{

    constructor(){
        this.appPolicyTypeList = [];
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
        this.id = locationActiviyCodeDocJson.ncciCode;
        if(locationActiviyCodeDocJson.payroll > 0){
            this.payroll += locationActiviyCodeDocJson.payroll;
        }
        if(locationActiviyCodeDocJson.ownerPayRoll > 0){
            this.payroll += locationActiviyCodeDocJson.ownerPayRoll;
        }
    }

    /**
	 * Checks that the data supplied is valid
	 *
	 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
	 */
    validate(){
        return new Promise(async(fulfill, reject) => {
            let rejected = false;

            // ID
            if(isNaN(this.id)){
                reject(serverHelper.requestError('You must supply a valid ID with each class code.'));
                return;
            }

            // Check that the ID is valid
            await db.query(`SELECT \`description\`FROM \`#__activity_codes\` WHERE \`id\` = ${this.id} LIMIT 1;`).then((rows) => {
                if(rows.length !== 1){
                    reject(serverHelper.requestError(`The activity code you selected (ID: ${this.id}) is not valid.`));
                    rejected = true;
                    return;
                }
                this.description = rows[0].description;
            }).catch(function(error){
                log.error("DB SELECT activity codes error: " + error + __location);
                //TODO Consistent error types
                reject(error);
            });

            // Payroll
            if(isNaN(this.payroll)){
                reject(serverHelper.requestError(`Invalid payroll amount (Activity Code ${this.id})`));
                return;
            }

            if(this.appPolicyTypeList.includes('WC')){
                if(this.payroll < 1){
                    reject(serverHelper.requestError(`You must provide a payroll for each activity code (Activity Code ${this.id})`));
                    return;
                }
            }

            if(!rejected){
                fulfill(true);
            }
        });
    }
};