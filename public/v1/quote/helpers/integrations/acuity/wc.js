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
            'Limited Liability Company': 'LL',
            'Limited Partnership': 'LP',
            Partnership: 'PT',
            'Sole Proprietorship': 'IN'
        };

        // These are special questions that are not handled the same as other class questions. They will be skipped when generating QuestionAnswer values.
        // They are likely that they are hard-coded in below somewhere
        const skipQuestions = [1036, 1037];

        // Check Industry Code Support
        if (!this.industry_code.cgl) {
            this.log_error(`CGL not set for Industry Code ${this.industry_code.id} `, __location);
            return this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        }

        // Check to ensure we have NCCI codes available for every provided activity code.
        for (const location of this.app.business.locations) {
            for (const activityCode of location.activity_codes) {
                const ncciCode = await this.get_ncci_code_from_activity_code(location.territory, activityCode.id);
                if (!ncciCode) {
                    this.log_error(`Could not find NCCI code for activity code ${activityCode.id}`, __location);
                    return this.return_error('error', 'Could not locate an NCCI code for the provided activity.');
                }
                activityCode.ncciCode = `${ncciCode.code}${ncciCode.sub}`;
            }
        }

        // Prepare limits
        const limits = this.getBestLimits(carrierLimits);
        if (!limits) {
            this.log_warn(`autodeclined: no limits industryCode = ${this.industry_code.id} `, __location)
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
            this.log_error(`Invalid Entity Type `, __location);
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
            this.log_error(`Unable to get question identifiers.${error}`, __location);
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
        let xml = null;
        try {
            xml = acuityWCTemplate.render(this).replace(/\n\s*\n/g, '\n');
        }
        catch (error) {
            return this.result_error('error', 'Unable to create the request.');
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
        catch (error) {
            this.log_error(error.message, __location);
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
                    this.log_error(`401 - Authorization Failed, Check Headers `, __location);
                    this.reasons.push('Unable to connect to API. Check headers.');
                    return this.return_error('error', 'We are currently unable to connect to this insurer');
                case '403':
                    this.log += '--------======= Authentication Failed =======--------';
                    this.log_error(`403 - Authentication Failed `, __location);
                    this.reasons.push('Unable to connect to API. Check credentials.');
                    return this.return_error('error', 'We are currently unable to connect to this insurer');
                case '500':
                    this.log += '--------======= server. Error =======--------';
                    this.log_warn(`500 - server. Error `, __location);
                    this.reasons.push('Insurer encountered a server error');
                    return this.return_error('error', 'We are currently unable to connect to this insurer');
                case '504':
                    this.log += '--------======= Insurer Timeout Error =======--------';
                    this.log_warn(`504 - Insurer Timeout Error `, __location);
                    this.reasons.push(`Insurer's system timedout (our connection was good).`);
                    return this.return_error('error', 'We are currently unable to connect to this insurer');
                default:
                    this.log += '--------======= Unexpected API Error =======--------';
                    this.log_error(`${error_code} - Unexpected error code from API `, __location);
                    this.reasons.push(`Unexpected HTTP error code of ${error_code} returned from API.`);
                    return this.return_error('error', 'We are currently unable to connect to this insurer');
            }
        }

        // Move down a node for convenience
        result = result.ACORD;

        // Parse the various status codes and take the appropriate action
        const statusCode = parseInt(this.get_xml_child(result, 'SignonRs.Status.StatusCd'), 10);
        if (statusCode !== 0) {
            if (statusCode === 503) {
                this.log += '--------======= Insurer Down =======--------<br><br>';
                this.log_warn(`Outage in insurer's system `, __location);
                this.reasons.push(`The insurer's system was unavailable at the time of quote.`);
                return this.return_error('error', 'We are currently unable to connect to the Acuity servers');
            }
            this.log += '--------======= Unexpected API Error =======--------<br><br>';
            this.log_error(`Unexpected status code of ${statusCode} from API `, __location);
            this.reasons.push(`Unknown status of '${statusCode}' recieved from API`);
            return this.return_error('error', 'We are currently unable to connect to the Acuity servers');
        }

        // Check if we have an error
        const msgStatusCd = this.get_xml_child(result, "InsuranceSvcRs.WorkCompPolicyQuoteInqRs.MsgStatus.MsgStatusCd");
        if (msgStatusCd === 'Error') {
            const extendedStatusDesc = this.get_xml_child(result, "InsuranceSvcRs.WorkCompPolicyQuoteInqRs.MsgStatus.ExtendedStatus.ExtendedStatusDesc");
            this.log_error(`The API returned the error '${extendedStatusDesc}'`, __location);
            return this.return_error('error', `The Acuity servers returned an error of '${extendedStatusDesc}.`);
        }

        // Check if the application was rejected or declined
        let declined = false;
        const extendedStatus = this.get_xml_child(result, "InsuranceSvcRs.WorkCompPolicyQuoteInqRs.MsgStatus.ExtendedStatus", true);
        for (const status of extendedStatus) {
            if (status.ExtendedStatusDesc[0].includes('not a market for the risk')) {
                declined = true;
            }
        }
        if (msgStatusCd === 'Rejected' || declined) {
            return this.return_error('declined', `${this.insurer.name} has declined to offer you coverage at this time`);
        }

        // Find the policy information
        const policyStatusCd = this.get_xml_child(result, "InsuranceSvcRs.WorkCompPolicyQuoteInqRs.PolicySummaryInfo.PolicyStatusCd");
        switch (policyStatusCd) {
            case 'com.acuity_BindableQuoteIncompleteData':
                this.log_info(`Reporting incomplete information for a bindable quote. The quote will be a referral. Non-fatal so continuing.`);
                // eslint-disable-line no-fallthrough
            case 'com.acuity_BindableQuote':
            case 'com.acuity_NonBindableQuote':
                // Retrieve and populate the quote amount
                const amt = this.get_xml_child(result, "InsuranceSvcRs.WorkCompPolicyQuoteInqRs.PolicySummaryInfo.FullTermAmt.Amt");
                if (amt) {
                    this.amount = parseFloat(amt, 10);
                }
                // Retrieve and populate the quote limits
                const quoteLimits = this.get_xml_child(result, "InsuranceSvcRs.WorkCompPolicyQuoteInqRs.WorkCompLineBusiness.CommlCoverage.Limit", true);
                quoteLimits.forEach((limit) => {
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
                            break;
                    }
                });

                // Retrieve and save the quote letter
                const fileAttachmentInfo = this.get_xml_child(result, 'InsuranceSvcRs.WorkCompPolicyQuoteInqRs.FileAttachmentInfo');
                if (fileAttachmentInfo) {
                    this.log_info(`Found a quote letter and saving it.`);
                    // Try to save the letter. This is a non-fatal event if we can't save it, but we log it as an error.
                    try {
                        this.quote_letter = {
                            content_type: fileAttachmentInfo.MIMEContentTypeCd[0],
                            data: fileAttachmentInfo.cData[0],
                            file_name: `${this.insurer.name}_ ${this.policy.type}_quote_letter.pdf`
                        };
                    }
                    catch (error) {
                        this.log_error(`Quote letter node exists, but could not extract it. Continuing.`);
                    }
                }

                // Only bindable is a quote. Bindable incomplete and non bindable are referred.
                const status = policyStatusCd === "com.acuity_BindableQuote" ? "quoted" : "referred";
                this.log_info(`Returning ${status} ${amt ? "with price" : ""}`);
                return this.return_result(status);
            default:
                this.log += `--------======= Unknown Status	=======--------<br><br>${result.response}<br><br>`;
                this.log_error(`Unknown policy status code of ${policyStatusCd ? policyStatusCd : "null"}.`, __location);
                return this.return_error('error', "The Acuity servers returned an unrecognized policy status.");
        }
    }
};