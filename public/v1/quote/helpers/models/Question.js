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
	 * @param {int} answer_id - The ID of the answer the user selected
	 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
	 */
	set_answer(answer_id){
		return new Promise((fulfill, reject) => {
			// Make sure the question is loaded before continuing
			if(!this.id){
				log.warn('You must load the question before attempting to set an answer' + __location);
				reject(serverHelper.requestError(`Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)})`));
				return;
			}

			// For boolean, checkbox, and select questions, set the answer ID or find the equivalent
			if(this.type === 'Yes/No' || this.type === 'Checkboxes' || this.type === 'Select List'){

				// If the answer wasn't numeric, it is wrong
				if(typeof answer_id !== 'number'){
					reject(serverHelper.requestError(`Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)})`));
					return;
				}

				// If the answer isn't one of those that are possible
				if(!Object.prototype.hasOwnProperty.call(this.possible_answers, answer_id)){
					reject(serverHelper.requestError(`Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)})`));
					return;
				}

				// Set the answer ID and determine and set the answer text
				this.answer_id = answer_id;
				this.answer = this.possible_answers[answer_id].answer;
			}
else{
				// For text answer questions
				this.answer_id = 0;
				this.answer = answer_id;
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