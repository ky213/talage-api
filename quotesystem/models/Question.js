/* eslint-disable valid-jsdoc */
/**
 * Defines a single industry code
 */

const htmlentities = require('html-entities').Html5Entities;
module.exports = class Question{

    constructor(){
        this.answer = null;
        this.answer_id = 0;
        this.hidden = false;
        this.id = 0;
        this.insurer_identifiers = {};
        this.insurers = [];
        this.insurerQuestionRefList = [];
        this.type = '';
        this.parent = 0;
        this.parent_answer = 0;
        this.possible_answers = {};
        this.required = false;
        this.text = '';
        this.inputType = '';
    }

    /**
	 * Gets the answer to the current question as a boolean (true or false)
	 *
	 * @returns {Boolean} True if the user answered 'Yes' or answered at all, false otherwise
	 */
    get_answer_as_boolean(){

        if(this.type === 'Yes/No'){
            //Yes/No anwers tend to be Yes and No. A user can break the "Higher key is always yes" rule
            if(this.answer.toLowerCase() === 'yes' || this.answer.toLowerCase() === 'true'){
                return true
            }

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
	 * @param {mixed} appQuestionJSON - The answer to the given question. The different data types are as follows:
	 *							Boolean: The ID of the chosen answer
	 *							Checkboxes: An array containing IDs of all chosen answers
	 *							Text: The answer provided by the user as a string
	 * 							Select: The ID of the chosen answer
	 * @returns
	 */
    set_answer(appQuestionJSON){
        if(!appQuestionJSON){
            return;
        }
        let answer = null;
        answer = appQuestionJSON.answerValue
        // Make sure the question is loaded before continuing
        if (!this.id) {
            log.error('You must load the question before attempting to set an answer' + __location);
            throw new Error(`You must load the question before attempting to set an answer`);
        }

        // For Checkbox questions, there may be more than one possible answer, process each
        if (this.type === 'Checkboxes') {
            let answerArray = [];
            if (typeof answer === 'string' && answer.indexOf("|") > -1) {
                if (answer.indexOf("|") === 0) {
                    answer = answer.substring(1);
                }
                answerArray = answer.split('|');
                try {
                    for (let i = 0; i < answerArray.length; i++) {
                        if (typeof answerArray[i] === 'string') {
                            answerArray[i] = parseInt(answerArray[i], 10);
                        }
                    }
                }
                catch(e) {
                    log.warn(`Answer array conversion problem for ${answerArray}: ${e}. ` + __location);
                }
            }
            else if (typeof answer === 'number') {
                // Only 1 checkbox was selected and it is number in the JSON
                answerArray = [answer];
            }
            else if (typeof answer === 'string') {
                // Only 1 checkbox was selected and it is string in the JSON
                //convert to number
                const answerInt = parseInt(answer, 10);
                answerArray = [answerInt]
            }
            // If we don't have a valid array, that means they either didn't provide an array, or we couldn't parse an array above.
            // This can happen if they don't enable any checkboxes for a question. -SF
            // if (!Array.isArray(answer)) {
            //     answerArray = [];
            // }

            // Loop through each answer and make sure they are what we are expecting
            for (const answer_id of answerArray) {
                // If the answer wasn't numeric, it is wrong
                if (typeof answer_id !== 'number') {
                    const errorMessage = `Invalid answer provided - non number -  for Question ${this.id}. (${htmlentities.decode(this.text)}) answer_id ${answer_id} typeof answer_id ${typeof answer_id}`
                    log.error(errorMessage + __location);
                    //logging in calling method.
                    //throw new Error(errorMessage);
                }
            }

            // For text answer questions
            this.answer_id = 0;
            this.answer = answerArray;

            // For boolean and select questions, set the answer ID or find the equivalent
        }
        else if (this.type === 'Yes/No' || this.type === 'Select List') {
            answer = appQuestionJSON.answerId
            //issues are logged in calling methods.  It has the applicationId
            // If the answer wasn't numeric, it is wrong
            if (typeof answer !== 'number') {
                const errorMessage = `Invalid answer provided - non number -  for Question ${this.id}. (${htmlentities.decode(this.text)}) answerId ${answer} typeof answerId ${typeof answer}`
                log.error(errorMessage + __location);
                //throw new Error(`Invalid answer provided - non number - for Question ${this.id}. (${htmlentities.decode(this.text)})`);
            }

            // If the answer isn't one of those that are possible
            //possible answers is suspect....
            if(!Object.prototype.hasOwnProperty.call(this.possible_answers, answer)){
                //check answertext
                let found = false;
                // eslint-disable-next-line guard-for-in
                for(const propertyIndex in this.possible_answers){
                    if(Object.prototype.hasOwnProperty.call(this.possible_answers,propertyIndex)){
                        if(appQuestionJSON.answerValue === this.possible_answers[propertyIndex].answer){
                            found = true;
                            appQuestionJSON.answerId = this.possible_answers[propertyIndex].answerId;
                            answer = this.possible_answers[propertyIndex].answerId;
                        }
                    }
                }
                if(found === false){
                    const errorMessage = `Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)}) anwser ${answer} not in ${JSON.stringify(this.possible_answers)}`
                    log.error(errorMessage + __location);
                    //throw new Error(`Invalid answer provided for Question ${this.id}. (${htmlentities.decode(this.text)}) anwser ${answer} not in ${JSON.stringify(this.possible_answers)}`);
                }
            }

            // Set the answer ID and determine and set the answer text
            this.answer_id = answer;
            if(this.possible_answers[answer]){
                this.answer = this.possible_answers[answer].answer;
            }
        }
        else{
            // For text answer questions
            this.answer_id = 0;
            this.answer = answer;
        }
    }
};