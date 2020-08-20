/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Worker's Compensation Integration for Employers
 *
 * This integration file has answers to the following questions hard-coded in:
 * - I attest that the Insured (my client) has complied with the applicable workers' compensation laws of the states shown in Item 3.A of the policy information page, and I will maintain and make available upon request all required documentation in the Agency file.
 */

'use strict';

const Integration = require('../Integration.js');
const moment_timezone = require('moment-timezone');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

// Read the template into memory at load
const employersWCTemplate = require('jsrender').templates('./public/v1/quote/helpers/integrations/employers/wc.xmlt');

module.exports = class EmployersWC extends Integration {

	/**
	 * Requests a quote from Employers and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    _insurer_quote() {
        // These are the statuses returned by the insurer and how they map to our Talage statuses
        this.possible_api_responses.DECLINE = 'declined';
        this.possible_api_responses.INPROGRESS = 'referred';
        this.possible_api_responses.PENDING_REFER = 'referred_with_price';
        this.possible_api_responses.QUICKDECLINE = 'declined';
        this.possible_api_responses.QUOTED = 'quoted';
        this.possible_api_responses.REFER = 'referred';
        this.possible_api_responses.RISKRESVDECLINE = 'declined';

        // These are the limits supported by Employers
        const carrierLimits = ['100000/500000/100000',
            '500000/500000/500000',
            '1000000/1000000/1000000',
            '2000000/2000000/2000000'];

        // Define how legal entities are mapped for Employers
        const entityMatrix = {
            Association: 'AS',
            Corporation: 'CP',
            'Limited Liability Company': 'LL',
            'Limited Partnership': 'LP',
            Partnership: 'PT',
            'Sole Proprietorship': 'IN'
        };

        // Define a list of required questions
        const required_questions = [979];

        // Build the Promise
        return new Promise(async(fulfill) => {
            // Employers has us define our own Request ID
            this.request_id = this.generate_uuid();

            // Fill in calculated fields
            this.request_date = moment_timezone.tz('America/Los_Angeles').format('YYYY-MM-DD');
            this.entity_code = entityMatrix[this.app.business.entity_type];

            // Prepare claims by year
            if (this.policy.claims.length > 0) {
                // Get the claims organized by year
                this.claims_by_year = this.claims_to_policy_years();
            }

            // Ensure this entity type is in the entity matrix above
            if (!(this.app.business.entity_type in entityMatrix)) {
                log.warn(`autodeclined: no limits  ${this.insurer.name} does not support the selected entity type ${this.entity_code} ` + __location)
                this.reasons.push(`${this.insurer.name} does not support the selected entity type`);
                fulfill(this.return_result('autodeclined'));
                return;
            }

            // Prepare limits
            this.bestLimits = this.getBestLimits(carrierLimits);
            if (!this.bestLimits) {
                log.warn(`autodeclined: no best limits  ${this.insurer.name} does not support the requested liability limits ` + __location)
                this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
                fulfill(this.return_result('autodeclined'));
                return;
            }

            // Prepare questions
            this.validQuestions = [];
            for (const question_id in this.questions) {
                if (Object.prototype.hasOwnProperty.call(this.questions, question_id)) {
                    const question = this.questions[question_id];

                    // Don't process questions without a code (not for this insurer)
                    const questionCode = this.question_identifiers[question.id];
                    if (!questionCode) {
                        continue;
                    }

                    // For Yes/No questions, if they are not required and the user answered 'No', simply don't send them
                    if (!required_questions.includes(question.id) && question.type !== 'Yes/No' && !question.hidden && !question.required && !question.get_answer_as_boolean()) {
                        continue;
                    }

                    // Get the answer
                    let answer = '';
                    try {
                        answer = this.determine_question_answer(question, required_questions.includes(question.id));
                    }
                    catch (error) {
                        log.error(`Employers WC: Unable to determine answer for question ${question.id} error: ${error} ` + __location)
                        this.reasons.push(`Unable to determine answer for question ${question.id}`);
                        fulfill(this.return_result('error'));
                        return;
                    }

                    // This question was not answered
                    if (!answer) {
                        continue;
                    }

                    // Ensure the question is only yes/no at this point
                    if (question.type !== 'Yes/No') {
                        log.error(`Employers WC: Unknown question type supported. Employers only has Yes/No. ` + __location)
                        this.reasons.push('Unknown question type supported. Employers only has Yes/No.');
                        fulfill(this.return_result('error'));
                        return;
                    }

                    // Save this as an answered question
                    this.validQuestions.push({
                        code: questionCode,
                        entry: question
                    });
                }
            }

            // ===================================================================================================
            // Render the template into XML and remove any empty lines (artifacts of control blocks)
            // ===================================================================================================
            const xml = employersWCTemplate.render(this).replace(/\n\s*\n/g, '\n');

            // Determine which URL to use
            let host = '';
            if (this.insurer.useSandbox) {
                host = 'api-qa.employers.com';
            }
            else {
                host = 'api.employers.com';
            }
            const path = '/DigitalAgencyServices/ws/AcordServices';

            log.info(`Sending application to https://${host}${path}. Remember to connect to the VPN. This can take up to 30 seconds.`);

            // Send the XML to the insurer
            await this.send_xml_request(host, path, xml).
                then((result) => {
                    // Parse the various status codes and take the appropriate action
                    let res = result['soap:Envelope']['soap:Body'][0]['eig:getWorkCompPolicyResponse'][0].response[0];
                    const status_code = res.PolicyRs[0].MsgStatus[0].MsgStatusCd[0];

                    if (status_code.indexOf('Success') === -1) {
                        this.reasons.push(`Insurer returned status: ${status_code}`);
                        if (Object.prototype.hasOwnProperty.call(res.PolicyRs[0].MsgStatus[0], 'ExtendedStatus')) {
                            res.PolicyRs[0].MsgStatus[0].ExtendedStatus.forEach((error_obj) => {
                                this.reasons.push(error_obj.ExtendedStatusDesc[0]);
                            });
                            switch (status_code) {
                                case 'PendingNeedInformation':
                                case 'ResultPendingOutOfBand':
                                    // Referred
                                    fulfill(this.return_result('referred'));
                                    return;
                                case 'Rejected':
                                    // Declined
                                    fulfill(this.return_result('declined'));
                                    return;
                                default:
                                    log.error(`Employers WC: Unknown status code from Employers Acord Service ${status_code}` + __location)
                                    fulfill(this.return_result('error'));
                                    return;
                            }
                        }
                    }

                    res = res.PolicyRs[0];

                    let status = null;
                    let policy_number = null;

                    res.ItemIdInfo[0].OtherIdentifier.forEach(function(item) {
                        switch (item.OtherIdTypeCd[0]._) {
                            case 'PolicyNumber':
                                policy_number = item.OtherId[0];
                                break;
                            case 'PolicyStatus':
                                status = item.OtherId[0];
                                break;
                            default:
                                break;
                        }
                    });

                    // Attempt to get the policy number
                    if (policy_number) {
                        this.number = policy_number;
                    }
                    else {
                        log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find policy number.` + __location);
                    }

                    // Attempt to get the amount of the quote
                    try {
                        this.amount = parseInt(res.Policy[0].CurrentTermAmt[0].Amt[0], 10);
                    }
                    catch (e) {
                        // This is handled in return_result()
                    }

                    // Grab the limits info
                    try {
                        res.WorkCompLineBusiness[0].Coverage.forEach((coverage_block) => {
                            if (coverage_block.CoverageCd[0] === 'WCEL') {
                                coverage_block.Limit.forEach((limit) => {
                                    switch (limit.LimitAppliesToCd[0]) {
                                        case 'EachClaim':
                                            this.limits[1] = limit.FormatCurrencyAmt[0].Amt[0];
                                            break;
                                        case 'EachEmployee':
                                            this.limits[2] = limit.FormatCurrencyAmt[0].Amt[0];
                                            break;
                                        case 'PolicyLimit':
                                            this.limits[3] = limit.FormatCurrencyAmt[0].Amt[0];
                                            break;
                                        default:
                                            log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Unexpected limit found in response` + __location);
                                            break;
                                    }
                                });
                            }
                        });
                    }
                    catch (e) {
                        // This is handled in return_result()
                    }

                    // Grab the writing company
                    try {
                        this.writer = res.Policy[0].CompanyProductCd[0].split('-')[1].trim();
                    }
                    catch (e) {
                        if (status === 'QUOTE' || status === 'PENDING_REFER') {
                            log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find writing company.` + __location);
                        }
                    }

                    // Grab the file info
                    try {
                        try {
                            this.quote_letter = {
                                content_type: res.FileAttachmentInfo[0].AttachmentData[0].ContentTypeCd[0],
                                data: res.FileAttachmentInfo[0].AttachmentData[0].BinData[0],
                                file_name: `${this.insurer.name}_ ${this.policy.type}_quote_letter.pdf`,
                                length: res.FileAttachmentInfo[0].AttachmentData[0].BinLength[0]
                            };
                        }
                        catch (err) {
                            if (status === 'QUOTE') {
                                log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Changed how it returns the quote letter.` + __location);
                            }
                        }
                    }
                    catch (e) {
                        if (status === 'QUOTE') {
                            log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find files.` + __location);
                        }
                    }

                    // Grab the reasons
                    try {
                        res.MsgStatus[0].ExtendedStatus.forEach((error_obj) => {
                            this.reasons.push(`${error_obj.ExtendedStatusCd} - ${error_obj.ExtendedStatusDesc[0]}`);
                        });
                    }
                    catch (e) {
                        if (status === 'INPROGRESS') {
                            log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to reasons.` + __location);
                        }
                    }

                    // Send the result of the request
                    fulfill(this.return_result(status));
                }).
                catch(() => {
                    log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Unable to connect to insurer.` + __location);
                    fulfill(this.return_result('error'));
                });
        });
    }
};