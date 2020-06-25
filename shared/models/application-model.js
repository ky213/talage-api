'use strict';

// const util = require('util');
// const email = global.requireShared('./services/emailsvc.js');
// const slack = global.requireShared('./services/slacksvc.js');
// const formatPhone = global.requireShared('./helpers/formatPhone.js');
// const get_questions = global.requireShared('./helpers/getQuestions.js');

const validator = global.requireShared('./helpers/validator.js');

module.exports = class Application{

	constructor(){
		this.agencyLocation = null;
		this.business = null;
		this.id = 0;
		this.insurers = [];
		this.policies = [];
		this.questions = {};
		this.test = false;
    }


    /**
	 * Load new application JSON with optional save.
     *
	 * @param {object} applicationJSON - application JSON
     * @param {boolean} save - Saves application if true
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application , or an Error if rejected
	 */
    newApplication(applicationJSON, save = false){
        return new Promise(async(resolve, reject) => {
        //validate


            //save
            if(save){
                resolve(true);
            }
            resolve(true);
        });
    }

    /**
	 * saves application.
     *
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application , or an Error if rejected
	 */

    save(asNew = false){
        return new Promise(async(resolve, reject) => {
        //validate

            resolve(true);
        });
    }

}