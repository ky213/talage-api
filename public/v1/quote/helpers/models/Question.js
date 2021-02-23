/**
 * Defines a single industry code
 */

'use strict';

const htmlentities = require('html-entities').Html5Entities;
const serverHelper = require('../../../../../server.js');

module.exports = class Question{

    constructor(){
        this.answer = null;
        this.answer_id = 0;
        this.hidden = false;
        this.id = 0;
        this.insurer_identifiers = {};
        this.insurers = [];
        this.type = '';
        this.parent = 0;
        this.parent_answer = 0;
        this.possible_answers = {};
        this.required = false;
        this.text = '';
    }

    /**
	 * Gets the answer to the current question as a boolean (true or false)
	 *
	 * @returns {Boolean} True if the user answered 'Yes' or answered at all, false otherwise
	 */
    get_answer_as_boolean(){

        if(this.type === 'Yes/No'){
            // The higher key is always 'Yes'
            let highest_id = 0;
            Object.keys(this.possible_answers).forEach((answer_id) => {
                answer_id = parseInt(answer_id, 10);
                if(answer_id > highest_id){
                    highest_id = answer_id;
                }
            });
            if(this.answer_id === highest_id){
                return true;
            }
            return false;
        }

        if(this.type === 'Checkboxes' || this.type === 'Select List'){
            return Boolean(this.answer_id);
        }

        return Boolean(this.answer);
    }

    /**
	 * Populates this object with data from the request
	 *
	 * @param {object} data - The business data
	 * @returns {void}
	 */
    load(data){
        Object.keys(this).forEach((property) => {
            if(!Object.prototype.hasOwnProperty.call(data, property)){
                return;
            }
            switch(property){
                case 'answer':
                    // Don't allow loading
                    data[property] = null;
                    break;
                case 'answer_id':
                    // Don't allow loading
                    data[property] = 0;
                    break;
                case 'id':
                    data[property] = /^\d{5}$/.test(data[property]) ? parseInt(data[property], 10) : data[property];
                    break;
                case 'insurers':
                    data[property] = data[property].split(',');
                    break;
                case 'parent':
                case 'parent_answer':
                    data[property] = parseInt(data[property], 10);
                    break;
                case 'hidden':
                case 'required':
                    data[property] = Boolean(data[property]);
                    break;
                default:
                    break;
            }
            this[property] = data[property];
        });

        // Set the default answer
        if(!this.answer && !this.answer_id && this.possible_answers){
            for(const answer_id in this.possible_answers){
                if(Object.prototype.hasOwnProperty.call(this.possible_answers, answer_id)){
                    const answer = this.possible_answers[answer_id];
                    if(Object.prototype.hasOwnProperty.call(answer, 'default') && answer.default){
                        this.answer_id = answer.id;
                        this.answer = answer.answer;
                    }
                }
            }
        }
    }

    /**
	 * Set the answer to this question
	 *
	 * @param {mixed} answer - The answer to the given question. The different data types are as follows:
	 *							Boolean: The ID of the chosen answer
	 *							Checkboxes: An array containing IDs of all chosen answers
	 *							Text: The answer provided by the user as a string
	 * 							Select: The ID of the chosen answer
	 * @returns
	 */
    set_answer(answer){
        // Make sure the question is loaded before continuing
        if (!this.id) {
            log.warn('You must load the question before attempting to set an answer' + __location);
            throw new Error(`Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)})`);
        }

        // For Checkbox questions, there may be more than one possible answer, process each
        if (this.type === 'Checkboxes') {
            if (typeof answer === 'string' && answer.indexOf("|") > -1) {
                if (answer.indexOf("|") === 0) {
                    answer = answer.substr(1);
                }
                answer = answer.split('|');
                try {
                    for (let i = 0; i < answer.length; i++) {
                        if (typeof answer[i] === 'string') {
                            answer[i] = parseInt(answer[i], 10);
                        }
                    }
                } catch(e) {
                    log.warn(`Answer array conversion problem for ${answer}: ${e}. ` + __location);
                }
            } else if (typeof answer === 'number') {
                // Only 1 checkbox was selected and it is number in the JSON
                answer = [answer];
            } else if (typeof answer === 'string') {
                // Only 1 checkbox was selected and it is string in the JSON
                //convert to number
                const answerInt = parseInt(answer, 10);
                answer = [answerInt]
            }
            // If we don't have a valid array, that means they either didn't provide an array, or we couldn't parse an array above.
            // This can happen if they don't enable any checkboxes for a question. -SF
            if (!Array.isArray(answer)) {
                answer = [];
            }

            // Loop through each answer and make sure they are what we are expecting
            for (const answer_id of answer) {
                // If the answer wasn't numeric, it is wrong
                if (typeof answer_id !== 'number') {
                    const errorMessage = `Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)}) answer_id ${answer_id} typeof answer_id ${typeof answer_id}`
                    log.error(errorMessage + __location);
                    throw new Error(errorMessage);
                }
            }

            // For text answer questions
            this.answer = 0;
            this.answer = answer;

            // For boolean and select questions, set the answer ID or find the equivalent
        } else if (this.type === 'Yes/No' || this.type === 'Select List') {

            // If the answer wasn't numeric, it is wrong
            if (typeof answer !== 'number') {
                throw new Error(`Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)})`);
            }

            // If the answer isn't one of those that are possible
            if(!Object.prototype.hasOwnProperty.call(this.possible_answers, answer)){
                throw new Error(`Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)})`);
            }

            // Set the answer ID and determine and set the answer text
            this.answer_id = answer;
            this.answer = this.possible_answers[answer].answer;
        } else{
            // For text answer questions
            this.answer_id = 0;
            this.answer = answer;
        }
    }
};