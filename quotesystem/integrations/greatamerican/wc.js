/* eslint-disable function-paren-newline */
/* eslint-disable dot-notation */
//const builder = require('xmlbuilder');
const moment = require('moment');
//const moment_timezone = require('moment-timezone');
const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
//const superagent = require('superagent');
const _ = require('lodash');
const GreatAmericanApi = require('./api');
const acordsvc = global.requireShared('./services/acordsvc.js');
const emailsvc = global.requireShared('./services/emailsvc.js');

module.exports = class GreatAmericanWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityClassCodes = true;
    }

    logApiCall(title, params, out) {
        this.log += `--------======= Sending ${title} =======--------<br><br>`;
        this.log += `Request:\n <pre>${JSON.stringify(params, null, 2)}</pre><br><br>\n`;
        this.log += `Response:\n <pre>${JSON.stringify(out, null, 2)}</pre><br><br>`;
        this.log += `--------======= End =======--------<br><br>`;
    }

    getInsurerAskedQuestionIds(questionnaire) {
        let questionIds = [];
        for (const group of questionnaire.groups) {
            const ids = group.questions.map(q => q.questionId);
            questionIds = questionIds.concat(ids);
        }
        return questionIds;
    }

    /**
     * Requests a quote from Great America and returns. This request is not
     * intended to be called directly.
     *
     * @returns {Promise.<object, Error>} A promise that returns an object
     *   containing quote information if resolved, or an Error if rejected
     */
    async _insurer_quote() {

        const tomorrow = moment().add(1,'d').startOf('d');
        if(this.policy.effective_date < tomorrow){
            this.reasons.push("Insurer: Does not allow effective dates before tomorrow. - Stopped before submission to insurer");
            return this.return_result('autodeclined');
        }


        const logPrefix = `Appid: ${this.app.id} Great American WC: `;
        const codes = await Promise.all(Object.keys(this.insurer_wc_codes).map(code => this.get_insurer_code_for_activity_code(this.insurer.id, code.substr(0, 2), code.substr(2))));
        let error = null
        const token = await GreatAmericanApi.getToken(this).catch((err) => {
            error = err;
            log.error(`${logPrefix}error ${err} ` + __location);
        });
        if(error){
            this.reasons.push(`WC Request Error: ${error}`);
            return this.return_result('error');
        }

        // creates the application in their system
        let session = null;
        try {
            session = await GreatAmericanApi.application(token, this);
        }
        catch (e) {
            const errorMessage = `WC Request Error ${e}. `;
            this.reasons.push(errorMessage);
            log.error(logPrefix + errorMessage + __location);
            return this.return_result('error');
        }

        if (!session?.newBusiness) {
            const errorMessage = `No new business information returned in application creation. `;
            log.error(logPrefix + errorMessage + __location);
            this.reasons.push(errorMessage);
            return this.return_result('error');
        }

        let sessionCodes = codes.map(c => ({
            id: c.code,
            value: c.attributes.classIndustry
        }));
        if(!sessionCodes[0]?.id || !sessionCodes[0]?.value){
            log.error(`${logPrefix}Bad session Code ${JSON.stringify(sessionCodes)}. ` + __location);
            this.reasons.push(`Bad session Code ${JSON.stringify(sessionCodes)}`);
        }
        // GA only wants the first activity code passed to their API endpoint.
        sessionCodes = [sessionCodes[0]];

        // creates the question session using the newBusiness ID from the application
        session = await GreatAmericanApi.getSession(this, token, session.newBusiness, sessionCodes)
        if(!session){
            log.error(`${logPrefix}getSession failed: @ ` + __location);
            this.log += `Great American getSession failed: `;
            this.reasons.push(`Great American getSession failed`);
            return this.return_result('error');
        }

        const questions = {};
        for (const q of Object.values(this.questions)) {
            // Does a question have alternative identifiers? If so, also mark
            // this as an answer for those alternatives.
            const attrs = this.question_details[q.id].attributes;

            if (attrs && attrs.alternativeQuestionIds) {
                for (const id of attrs.alternativeQuestionIds) {
                    questions[id] = q.answer;
                }
            }

            questions[this.question_identifiers[q.id]] = q.answer;
        }

        if (session.newBusiness?.workflowControl !== 'CONTINUE' ||
            session.newBusiness?.status === 'DECLINE') {
            this.log += `Great American returned a bad workflow control response: ${session.newBusiness?.workflowControl} @ ` + __location;
            return this.return_result('declined');
        }

        const questionnaireInit = session?.riskSelection.data.answerSession.questionnaire;
        let need_generalEligibility3OrMore = false;
        let need_generalEligibility3OrMoreRestManu = false;
        questionnaireInit.groups.forEach((groups) => {
            groups.questions.forEach((question) => {
                if(question.questionId === 'generalEligibility3OrMore'){
                    need_generalEligibility3OrMore = true;
                }
                if(question.questionId === 'generalEligibility3OrMoreRestManu'){
                    need_generalEligibility3OrMoreRestManu = true;
                }


            });
        });
        //Questions from appDoc Data.
        if(this.applicationDocData.founded){
            const yearsWhole = moment().diff(this.applicationDocData.founded, 'years',false);
            const years = moment().diff(this.applicationDocData.founded, 'years',true);
            questions['generalEligibilityYearsOfExperience'] = yearsWhole.toString();


            if(years < 0.16){
                //New Business/No Experience < 2 months
                questions['scheduleRatingBusinessExperience'] = 'New Business/No Experience';
            }
            else if(years < 1){
                //New Business/No Experience
                questions['scheduleRatingBusinessExperience'] = 'Less Than 1 Year';
            }
            else if(years >= 1 && years <= 3){
                questions['scheduleRatingBusinessExperience'] = '1 to 3 Years';
            }
            else {
                questions['scheduleRatingBusinessExperience'] = '3 Years or More';
            }

            //Determine if generalEligibility3OrMore or generalEligibility3OrMoreRestManu should be included.
            if(need_generalEligibility3OrMore){
                questions['generalEligibility3OrMore'] = years >= 3 ? "Yes" : "No"
            }

            if(need_generalEligibility3OrMoreRestManu){
                questions['generalEligibility3OrMoreRestManu'] = years >= 3 ? "Yes" : "No"
            }

            //log.debug(`application GreatAmerican Questions ${JSON.stringify(this.questions)}`)
        }
        else {
            questions['generalEligibilityYearsOfExperience'] = '5';
        }
        if(this.applicationDocData.yearsOfExp){
            questions['generalEligibilityYearsOfExperience'] = this.applicationDocData.yearsOfExp;
        }

        //Employee Info
        questions['generalEligibilityTotalFullTime'] = this.get_total_full_time_employees();
        questions['generalEligibilityTotalPartTime'] = this.get_total_part_time_employees();
        questions['generalEligibilityTotalEmployees'] = this.get_total_employees();

        //Claims
        questions['claimsLossesMoreThan50K'] = "No, I have not had a single loss more than $50,000";
        questions['claimsLosses4years'] = "Less than 2 losses";
        let claimOver50K = false;
        let claimCount = 0;
        let years = 5;
        this.applicationDocData.claims.forEach((claim) => {
            if(claim.eventDate){
                try{
                    years = moment().diff(claim.eventDate, 'years',false);
                }
                catch(err){
                    log.error(`${logPrefix}Claim date error: ${err} ` + __location);
                }
            }
            if(claim.policyType === "WC" && years < 5){
                let totalAmount = 0;
                claimCount++;
                if(claim.amountPaid){
                    totalAmount += claim.amountPaid
                }
                if(claim.amountReserved){
                    totalAmount += claim.amountReserved
                }
                if(totalAmount > 50000){
                    claimOver50K = true;
                }
            }

        });
        if(claimCount < 2){
            questions['claimsLosses4years'] = "Less than 2 losses";
        }
        else if(claimCount >= 2 && claimCount < 5){
            questions['claimsLosses4years'] = "2 to 4 losses";
        }
        else{
            //no insurance for you!
            questions['claimsLosses4years'] = "5 or more losses";
        }
        if(claimOver50K){
            questions['claimsLossesMoreThan50K'] = "Yes, I’ve had a single loss more than $50,000";
        }
        //PolicyQuestions
        this.applicationDocData.policies.forEach((policy) => {
            if(policy.policyType === "WC"){
                //Q: Prior Insurance?
                questions['scheduleRatingPriorInsurance'] = policy.coverageLapse ? "No" : "Yes";
            }
        });

        // begins to hydrate (udpate) the question session
        let questionnaire = session?.riskSelection.data.answerSession.questionnaire;
        let insurerAskedQuestionIds = this.getInsurerAskedQuestionIds(questionnaire);
        let missingQuestionIds = [];
        for (const insurerAskedQuestionId of insurerAskedQuestionIds) {
            if (!questions.hasOwnProperty(insurerAskedQuestionId)) {
                missingQuestionIds.push(insurerAskedQuestionId);
            }
        }
        if (missingQuestionIds && missingQuestionIds.length > 0) {
            this.reasons.push(`Missing Questions Error: Could not find answers for question IDs: ${missingQuestionIds}`)
            return this.return_result('error');
        }
        let curAnswers = await GreatAmericanApi.injectAnswers(this, token, session, questions);
        if (curAnswers?.newBusiness?.status === 'DECLINE') {
            this.reasons.push(`Great American has declined to offer you coverage at this time`);
            return this.return_result('declined');
        }

        this.logApiCall('injectAnswers', [session, questions], curAnswers);
        if(!curAnswers){
            this.reasons.push(`injectAnswers Error: No reponse`);
            return this.return_result('error');
        }
        questionnaire = curAnswers?.riskSelection.data.answerSession.questionnaire;


        // Often times follow-up questions are offered by the Great American
        // API after the first request for questions. So keep injecting the
        // follow-up questions until all of the questions are answered.
        while (questionnaire.questionsAsked !== questionnaire.questionsAnswered) {
            log.warn(`${logPrefix}There are some follow up questions (${questionnaire.questionsAsked} questions asked but only ${questionnaire.questionsAnswered} questions answered) ` + __location);
            this.log += `There are some follow up questions (${questionnaire.questionsAsked} questions asked but only ${questionnaire.questionsAnswered} questions answered)`;
            const oldQuestionsAnswered = questionnaire.questionsAnswered;

            insurerAskedQuestionIds = this.getInsurerAskedQuestionIds(questionnaire);
            missingQuestionIds = [];
            for (const insurerAskedQuestionId of insurerAskedQuestionIds) {
                if (!questions[insurerAskedQuestionId]) {
                    missingQuestionIds.push(insurerAskedQuestionId);
                }
            }
            if (missingQuestionIds && missingQuestionIds.length > 0) {
                this.reasons.push(`Missing Questions Error: Could not find answers for question IDs: ${missingQuestionIds}`)
                return this.return_result('error');
            }

            // continue to update the question session until complete
            curAnswers = await GreatAmericanApi.injectAnswers(this, token, curAnswers, questions);
            if (curAnswers?.newBusiness?.status === 'DECLINE') {
                this.reasons.push(`Great American has declined to offer you coverage at this time`);
                return this.return_result('declined');
            }

            this.logApiCall('injectAnswers', [curAnswers, questions], curAnswers);
            questionnaire = curAnswers?.riskSelection.data.answerSession.questionnaire;

            // Prevent infinite loops with this check. Every call to
            // injectAnswers should answer more questions. If we aren't getting
            // anywhere with these calls, then decline the quote.
            if (questionnaire.questionsAnswered === oldQuestionsAnswered) {
                log.error(`${logPrefix}Error: No progress is being made in answering more questions. Current session: ${JSON.stringify(questionnaire, null, 2)} ` + __location);
                this.log += `Error: No progress is being made in answering more questions. Current session: ${JSON.stringify(questionnaire, null, 2)}`;
                return this.return_result('declined');
            }
        }

        // logging should be at the raw request level.   not here. outbound logged before call.
        // response after call.[curAnswers.newBusiness.id] is not the payload......
        //this.logApiCall('getPricing', [curAnswers.newBusiness.id], quote);
        if(error){
            log.error(`${logPrefix}Request Error: ${error} ` + __location);
            this.reasons.push(`Request Error: ${error}`);
            return this.return_result('error');
        }

        let pricingResponse = null;
        try {
            pricingResponse = await GreatAmericanApi.pricing(this, token, session.newBusiness.id);
        }
        catch (err) {
            const errorMessage = `Error ${err}. `;
            this.reasons.push(errorMessage);
            log.error(logPrefix + errorMessage + __location);
            return this.return_result('error');
        }

        if (_.get(pricingResponse, 'newBusiness.pricingType')) {
            this.isBindable = _.get(pricingResponse, 'newBusiness.pricingType') === 'BINDABLE_QUOTE';
        }

        if (_.get(pricingResponse, 'newBusiness.id')) {
            this.request_id = _.get(pricingResponse, 'newBusiness.id');
        }

        if (_.get(pricingResponse, 'rating.data.policy.id')) {
            this.amount = parseFloat(_.get(pricingResponse, 'rating.data.TotalResult'));
            this.writer = _.get(pricingResponse, 'rating.data.policy.company.name');
            this.number = _.get(pricingResponse, 'rating.data.policy.id');

            if (pricingResponse.newBusiness.status === 'REFERRAL' &&
                _.get(pricingResponse, 'rating.data.policy.company.name') !== 'Great American Insurance Company') {
                return this.return_result('referred');
            }

            this.log += 'Finished quoted!';
            return this.return_result('quoted');
        }
        else {
            this.log += 'Finished declined';
            return this.return_result('declined');
        }
    }

    async generateAndSendACORD() {
        const applicationDocData = this.applicationDocData;
        const logPrefix = `Appid: ${applicationDocData.applicationId} ${this.insurer.name} WC Request Error: `;
        const recipients = `AltSubmissions@gaig.com,mdowd@gaig.com`;
        const emailSubject = `WC Application - ${this.number} - ${applicationDocData.businessName}`;
        const emailBody = `See attached PDF`;

        log.info(`Sending underwriting email to Great American with subject: ${emailSubject}.`);

        // generate the ACORD form
        let ACORDForm = null;
        try {
            ACORDForm = await acordsvc.create(this.app.id, this.insurer.id, 'wc');
        }
        catch (e) {
            log.error(`${logPrefix}An error occurred while generating the ACORD form: ${e}.`);
            return;
        }

        // Check the acord generated successfully
        if(!ACORDForm || ACORDForm.error){
            log.error(`${logPrefix}ACORD form could not be generated: ${ACORDForm.error}.`);
            return;
        }

        const attachments = [{
            'content': ACORDForm.doc.toString('base64'),
            'filename': 'acordWC.pdf',
            'type': 'application/pdf',
            'disposition': 'attachment'
        }];

        const emailResp = await emailsvc.send(
            recipients,
            emailSubject,
            emailBody,
            {}, // default keys
            1, // default agency network
            'talage', // brandOverride - this sets the template and the from email address.
            1, // default agency
            attachments
        );

        if (!emailResp) {
            log.error(`${logPrefix}email with attached ACORD form failed to send.`);
        }
    }
};