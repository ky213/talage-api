/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Workers' Comp Integration for CNA
 */

'use strict';

const Integration = require('../Integration.js');

module.exports = class CnaWC extends Integration {

	/**
	 * Requests a quote from Employers and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        console.log("---------------- DEBUG ----------------");
        console.log("WE GOT HERE");  
        console.log(this.app);
        console.log(this.get_question_details());
        console.log(this.determine_question_answer());
        console.log(this.questions);
        console.log(
            Object.values(this.questions).forEach((question) => {
                const questionAnswer = this.determine_question_answer(question, question.required);
            })
        );
        console.log("---------------- DEBUG ----------------");
    }

}
