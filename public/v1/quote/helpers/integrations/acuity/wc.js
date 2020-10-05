/**
 * Worker's Compensation for Acuity
 *
 * This integration file has answers to the following questions hard-coded in:
 * - Any bankruptcies, tax, or credit liens in the past 5 years? (NO) - Derived from our disqualification question
 * - Insured handles, treats, stores or transports hazardous material? (NO) - Derived from our disqualification question
 * - Up to how many stories does the insured work? (1) - Derived from our disqualification question
 * - Any employees work underground? (NO) - Derived from our disqualification question
 * - Gaming devices on premises? (NO) - Per Adam
 * - Insurer operates any business not insured by Acuity? (NO) - Per Adam
 */

'use strict';

const builder = require('xmlbuilder');
const moment = require('moment');
const moment_timezone = require('moment-timezone');
const Integration = require('../Integration.js');
const acuityWCTemplate = require('jsrender').templates('./public/v1/quote/helpers/integrations/acuity/wc.xmlt');
global.requireShared('./helpers/tracker.js');

module.exports = class AcuityWC extends Integration {

    /**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        // These are the limits supported by Acuity
        const carrierLimits = [
            '100000/500000/100000',
            '500000/500000/500000',
            '500000/1000000/500000',
            '1000000/1000000/1000000'
        ];

        // Define how corporation types are mapped for Acuity
        const corporationTypeMatrix = {
            c: 'SC',
            n: 'CN',
            s: 'SS'
        };

        // Define how legal entities are mapped for Acuity
        const entityMatrix = {
            Association: 'AS',
            Corporation: 'CP',
            'Limited Liability Company': 'LLC',
            'Limited Partnership': 'LP',
            Partnership: 'PT',
            'Sole Proprietorship': 'IN'
        };

        // These are special questions that are not handled the same as other class questions. They will be skipped when generating QuestionAnswer values.
        // They are likely that they are hard-coded in below somewhere
        const skipQuestions = [1036, 1037];

        // Check Industry Code Support
        if (!this.industry_code.cgl) {
            log.error(`${this.insurer.name} ${this.policy.type} Integration File: CGL not set for Industry Code ${this.industry_code.id} ` + __location);
            return this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        }

        // Prepare limits
        const limits = this.getBestLimits(carrierLimits);
        this.limits = this.getBestLimits(carrierLimits);
        if (!limits) {
            log.warn(`autodeclined: no limits  ${this.insurer.name} ${this.policy.type} ${this.industry_code.id} ` + __location)
            this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
            return this.return_result('autodeclined');
        }

        // Transaction
        this.transactionID = this.generate_uuid();
        const now = moment_timezone.tz('America/Los_Angeles');
        this.transactionRequestDate = now.format('YYYY-MM-DDTHH:mm:ss');
        this.transactionEffectiveDate = now.format('YYYY-MM-DD');

        // Business entity/corporate structure
        this.entityID = entityMatrix[this.app.business.entity_type];
        if (!(this.app.business.entity_type in entityMatrix)) {
            this.log_error(`${this.insurer.name} WC Integration File: Invalid Entity Type ` + __location);
            return this.return_error('error', "We have no idea what went wrong, but we're on it");
        }
        if (this.app.business.corporation_type) {
            this.corporationType = corporationTypeMatrix[this.app.business.corporation_type];
        }
        if (this.app.business.management_structure) {
            this.managementStructureMember = this.app.business.management_structure === 'member' ? 'YES' : 'NO';
            this.managementStructureManager = this.app.business.management_structure === 'manager' ? 'YES' : 'NO';
        }

        // Business information
        const phone = this.app.business.contacts[0].phone.toString();
        this.primaryPhoneNumber = `+1-${phone.substring(0, 3)}-${phone.substring(phone.length - 7)}`;
        this.timeInBusiness = moment().diff(this.app.business.founded, 'months');

        // Claims
        this.claims_by_year = this.claims_to_policy_years();


        // Questions
        const question_identifiers = await this.get_question_identifiers().catch((error) => {
            log.error(`${this.insurer.name} WC is unable to get question identifiers.${error}` + __location);
            return this.return_error('error', "We have no idea what went wrong, but we're on it");
        });
        // Loop through each question
        this.questionList = [];
        for (const question_id in this.questions) {
            if (Object.prototype.hasOwnProperty.call(this.questions, question_id)) {
                const question = this.questions[question_id];
                const questionCode = question_identifiers[question.id];
                // Don't process questions without a code (not for this insurer) or ones that we have marked to skip
                if (!questionCode || skipQuestions.includes(question.id)) {
                    continue;
                }
                // Get the answer
                let answer = '';
                try {
                    answer = this.determine_question_answer(question);
                }
                catch (error) {
                    return this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
                }

                // This question was not answered
                if (!answer) {
                    continue;
                }

                let answerType = null;
                // Determine the type of answer
                if (question.type === 'Yes/No') {
                    answerType = 'YesNoCd';
                    // QuestionAnswer.ele('YesNoCd', question.get_answer_as_boolean() ? 'YES' : 'NO');
                    answer = question.get_answer_as_boolean() ? 'YES' : 'NO';
                }
                else if (/^\d+$/.test(answer)) {
                    // QuestionAnswer.ele('Num', answer);
                    answerType = 'Num';
                }
                else {
                    // QuestionAnswer.ele('Explanation', answer);
                    answerType = 'Explanation';
                }
                this.questionList.push({
                    code: questionCode,
                    answerType: answerType,
                    answer: answer
                });
            }
        }

        // ===================================================================================================
        // Render the template into XML and remove any empty lines (artifacts of control blocks)
        // ===================================================================================================
        console.log("BEFORE RENDER");
        let xml = null;
        try {
            xml = acuityWCTemplate.render(this).replace(/\n\s*\n/g, '\n');
        }
        catch (error) {
            console.log('render error', error);
            return this.result_error('error', 'Internal error when creating the request');
        }

        // Determine which URL to use
        let host = '';
        if (this.insurer.useSandbox) {
            host = 'tptest.acuity.com';
        }
        else {
            host = 'www.acuity.com';
        }
        const path = '/ws/partner/public/irate/rating/RatingService/Talage';

        console.log('request', xml);

        // Send the XML to the insurer
        let result = null;
        try {
            result = await this.send_xml_request(host, path, xml, {
                'X-IBM-Client-Id': this.username,
                'X-IBM-Client-Secret': this.password
            });
        }
        catch(error) {
            log.error(error.message + __location);
            this.reasons.push('Problem connecting to insurer');
            return this.return_error('error', "We have no idea what went wrong, but we're on it");
        }

        console.log('result', JSON.stringify(result, null, 4));

        // Check if there was an error
        if (result.hasOwnProperty('errorResponse')) {
            const error_code = parseInt(result.errorResponse.httpCode, 10);
            switch (error_code) {
                case '401':
                    this.log += '--------======= Authorization failed =======--------';
                    log.error(`${this.insurer.name} 401 - Authorization Failed, Check Headers ` + __location);
                    this.reasons.push('Unable to connect to API. Check headers.');
                    return this.return_error('error', 'We are currently unable to connect to this insurer');
                case '403':
                    this.log += '--------======= Authentication Failed =======--------';
                    log.error(`${this.insurer.name} 403 - Authentication Failed ` + __location);
                    this.reasons.push('Unable to connect to API. Check credentials.');
                    return this.return_error('error', 'We are currently unable to connect to this insurer');
                case '500':
                    this.log += '--------======= server. Error =======--------';
                    log.warn(`${this.insurer.name} 500 - server. Error ` + __location);
                    this.reasons.push('Insurer encountered a server error');
                    return this.return_error('error', 'We are currently unable to connect to this insurer');
                case '504':
                    this.log += '--------======= Insurer Timeout Error =======--------';
                    log.warn(`${this.insurer.name} 504 - Insurer Timeout Error ` + __location);
                    this.reasons.push(`Insurer's system timedout (our connection was good).`);
                    return this.return_error('error', 'We are currently unable to connect to this insurer');
                default:
                    this.log += '--------======= Unexpected API Error =======--------';
                    log.error(`${this.insurer.name} ${error_code} - Unexpected error code from API ` + __location);
                    this.reasons.push(`Unexpected HTTP error code of ${error_code} returned from API.`);
                    return this.return_error('error', 'We are currently unable to connect to this insurer');
            }
        }

        // We didn't get back an error, process the response
        let amount = 0;
        let declined = false;
        const errors = [];
        let res = result.ACORD;

        // Const util = require('util');
        // Log.error(util.inspect(res.SignonRs[0]));

        // Parse the various status codes and take the appropriate action
        const statusCode = parseInt(res.SignonRs[0].Status[0].StatusCd[0], 10);
        if (statusCode !== 0) {
            if (statusCode === 503) {
                this.log += '--------======= Insurer Down =======--------<br><br>';
                log.warn(`${this.insurer.name} - Outage in insurer's system ` + __location);
                this.reasons.push(`The insurer's system was unavailable at the time of quote.`);
                return this.return_error('error', 'We are currently unable to connect to this insurer');
            }
            this.log += '--------======= Unexpected API Error =======--------<br><br>';
            log.error(`${this.insurer.name} - Unexpected status code of ${statusCode} from API ` + __location);
            this.reasons.push(`Unknown status of '${statusCode}' recieved from API`);
            return this.return_error('error', 'We are currently unable to connect to this insurer');
        }

        // Further refine the response object
        res = res.InsuranceSvcRs[0].WorkCompPolicyQuoteInqRs[0];

        // If there are extended status messages, grab them
        if (Object.prototype.hasOwnProperty.call(res.MsgStatus[0], 'ExtendedStatus')) {
            for (const status in res.MsgStatus[0].ExtendedStatus) {
                if (Object.prototype.hasOwnProperty.call(res.MsgStatus[0].ExtendedStatus, status)) {
                    errors.push(`${res.MsgStatus[0].ExtendedStatus[status]['com.acuity_ExtendedStatusType'][0]} - ${res.MsgStatus[0].ExtendedStatus[status].ExtendedStatusDesc[0]}`);

                    // Check if this was a decline
                    if (res.MsgStatus[0].ExtendedStatus[status].ExtendedStatusDesc[0].includes('not a market for the risk')) {
                        declined = true;
                    }
                }
            }
        }

        // Additional Error Checking
        switch (res.MsgStatus[0].MsgStatusCd[0]) {
            case 'Error':
                // If a decline, just stop
                if (declined) {
                    this.log += '--------======= Application Declined =======--------';
                    return this.return_error('declined', 'This insurer has declined to offer you coverage at this time');
                }

                // An error other than decline
                this.log += `--------======= Application Error =======--------<br><br>${errors.join('<br>')}`;
                log.error(`${this.insurer.name} Integration Error(s):\n--- ${errors.join('\n--- ')} ` + __location);
                errors.forEach((error) => {
                    this.reasons.push(error);
                });
                return this.return_error('error', "We have no idea what went wrong, but we're on it");

            case 'Rejected':
                this.log += '--------======= Application Declined =======--------';
                return this.return_error('declined', `${this.insurer.name} has declined to offer you coverage at this time`);

            default:
                break;
        }

        switch (res.PolicySummaryInfo[0].PolicyStatusCd[0]) {
            case 'com.acuity_BindableQuoteIncompleteData':
                this.log += `--------======= Application Quoted But Was Missing Data =======--------<br><br>${errors.join('<br>')}`;
                log.info(`${this.insurer.name} is returning a quote, but indicates data is missing:\n--- ${errors.join('\n--- ')} `);
                // eslint-disable-line no-fallthrough

            case 'com.acuity_BindableQuote':
            case 'com.acuity_BindableQuoteIncompleteData': // eslint-disable-line no-duplicate-case
                // Get the amount of the quote
                try {
                    amount = parseInt(res.PolicySummaryInfo[0].FullTermAmt[0].Amt[0], 10);
                }
                catch (e) {
                    log.error(`${this.insurer.name} Integration Error: Quote structure changed. Unable to quote amount.` + __location);
                    this.reasons.push('A quote was generated, but our API was unable to isolate it.');
                    return this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
                }

                // Grab the limits info
                try {
                    res.WorkCompLineBusiness[0].CommlCoverage[0].Limit.forEach((limit) => {
                        switch (limit.LimitAppliesToCd[0]) {
                            case 'PerAcc':
                                this.limits[1] = limit.FormatInteger[0];
                                break;
                            case 'DisEachEmpl':
                                this.limits[2] = limit.FormatInteger[0];
                                break;
                            case 'DisPol':
                                this.limits[3] = limit.FormatInteger[0];
                                break;
                            default:
                                log.warn(`${this.insurer.name} Integration Error: Unexpected limit found in response ` + __location);
                                break;
                        }
                    });
                }
                catch (e) {
                    log.warn(`${this.insurer.name} Integration Error: Quote structure changed. Unable to find limits. ` + __location);
                }

                // Grab the file info
                try {

                    //
                    // This section needs to be updated. The policy_info field below is no longer valid. In this case, the insurer returns a URL instead of PDF data.
                    // We store the PDF data. What should we do here? Do we build in support for the URL or do we download the quote letter so we have it and know
                    // it will remain available? The data and file information needs to be stored in this.quote_letter.
                    //
                    //                             policy_info.files[0].url = res.FileAttachmentInfo[0].WebsiteURL[0];
                    //
                }
                catch (e) {
                    log.warn(`${this.insurer.name} Integration Error: Quote structure changed. Unable to quote letter.` + __location);
                }

                this.log += `--------======= Success! =======--------<br><br>Quote: ${amount}<br>Application ID: ${this.request_id}`;
                return this.return_quote(amount);
            case 'com.acuity_NonBindableQuote':
                this.log += '--------======= Application Referred =======--------<br><br>';
                if (errors) {
                    log.warn(`${this.insurer.name} referred with the following messages:\n--- ${errors.join('\n--- ')} ` + __location);
                    this.log += `Referred with the following errors:<br>${errors.join('<br>')}`;
                }
                return this.return_error('referred', `${this.insurer.name} needs a little more time to make a decision`);
            default:
                this.log += `--------======= Unknown Status	=======--------<br><br>${result.response}<br><br>`;
                log.error(`${this.insurer.name} - Unexpected status code of ${res.PolicySummaryInfo[0].PolicyStatusCd[0]} from API ` + __location);
                return this.return_error('error', "We have no idea what went wrong, but we're on it");
        }
    }
};