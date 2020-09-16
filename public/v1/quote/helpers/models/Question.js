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
	 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
	 */
    set_answer(answer){
        return new Promise((fulfill, reject) => {
            // Make sure the question is loaded before continuing
            if(!this.id){
                log.warn('You must load the question before attempting to set an answer' + __location);
                reject(serverHelper.requestError(`Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)})`));
                return;
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
                    } catch (e) {
                        log.warn(`answer array conversion problem on ${answer} ` + __location);
                    }
                } else if (typeof answer === 'number') {
                    // It is a single answer ID so put it in an array by itself
                    answer = [answer];
                }
                // Every answer must be numeric, if they are not, they are wrong
                if(typeof answer !== 'object' || !answer.length){
                    const errorMessage = `Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)}) (For Checkbox questions, expecting an array of answer IDs) answer: ${answer}`
                    log.error(errorMessage + __location);
                    reject(serverHelper.requestError(errorMessage));
                    return;
                }

                // Loop through each answer and make sure they are what we are expecting
                for(const answer_id of answer){
                    // If the answer wasn't numeric, it is wrong
                    if(typeof answer_id !== 'number'){
                        const errorMessage = `Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)}) answer_id ${answer_id} typeof answer_id ${typeof answer_id}`
                        log.error(errorMessage + __location);
                        reject(serverHelper.requestError(errorMessage));
                        return;
                    }
                }

                // For text answer questions
                this.answer = 0;
                this.answer = answer;

                // For boolean and select questions, set the answer ID or find the equivalent
            } else if(this.type === 'Yes/No' || this.type === 'Select List'){

                // If the answer wasn't numeric, it is wrong
                if(typeof answer !== 'number'){
                    reject(serverHelper.requestError(`Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)})`));
                    return;
                }

                // If the answer isn't one of those that are possible
                if(!Object.prototype.hasOwnProperty.call(this.possible_answers, answer)){
                    reject(serverHelper.requestError(`Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)})`));
                    return;
                }

                // Set the answer ID and determine and set the answer text
                this.answer_id = answer;
                this.answer = this.possible_answers[answer].answer;
            } else{
                // For text answer questions
                this.answer_id = 0;
                this.answer = answer;
            }

            fulfill(true);
        });
    }

    /**
	 * Checks that the data supplied is valid
	 *
	 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
	 */
    validate(){
        return new Promise((fulfill, reject) => {
            // If this question is not required, just return true
            if(!this.required){
                fulfill(true);
                return;
            }

            // Prepare the error messages
            let type_help = '';
            switch(this.type){
                case 'Yes/No':
                    type_help = 'Only boolean values are accepted';
                    break;
                case 'Checkboxes':
                    type_help = 'Answer must match one of the available values';
                    break;
                case 'Select List':
                    type_help = 'Answer must match one of the available values';
                    break;
                case 'Text - Multiple Lines':
                    type_help = 'Blank values are not accepted';
                    break;
                case 'Text - Single Line':
                    type_help = 'Blank values are not accepted';
                    break;
                default:
                    break;
            }

            // If the question is single line text, make sure we got an answer (zero is allowed, blank is not)
            if(this.type === 'Text - Single Line' && (this.answer || this.answer === 0)){
                fulfill(true);
                return;
            }

            // If the question is multi-line text, make sure we got something for an answer (blank is not allowed)
            if(this.type === 'Text - Multiple Lines' && this.answer){
                fulfill(true);
                return;
            }

            // If the question is a checkbox, make sure we have an answer (this.answer must have an array value with one or more integer )
            if(this.type === 'Checkboxes' && this.answer && typeof this.answer === 'object' && this.answer.length > 0){

                // Check each answer within the array to make sure they are all valid possible answers
                for(const answer of this.answer){
                    // Check that the answer ID is one of those available for this question
                    if(Object.keys(this.possible_answers).indexOf(answer.toString()) < 0){
                        // Answer is invalid, return an error and stop
                        reject(serverHelper.requestError(`Answer to question ${this.id} is invalid. (${type_help})`));
                        return;
                    }
                }

                fulfill(true);
                return;
            }

            // If no answer ID is set, reject
            if(!this.answer_id){
                reject(serverHelper.requestError(`Answer to question ${this.id} is invalid. (${type_help})`));
                return;
            }

            // Check that the answer ID is one of those available for this question
            if(Object.keys(this.possible_answers).indexOf(this.answer_id.toString()) >= 0){
                fulfill(true);
                return;
            }

            reject(serverHelper.requestError(`Answer to question ${this.id} is invalid. (${type_help})`));
        });
    }
};
