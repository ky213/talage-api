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
const acuityWCTemplate = require('jsrender').templates('./quotesystem/integrations/acuity/wc.xmlt');
const InsurerBO = global.requireShared('./models/Insurer-BO.js');
global.requireShared('./helpers/tracker.js');

/**
 * Escape a string for XML
 * @param  {string} s - The string to escape
 * @returns {string} The escaped string
 */
function escapeXML(s) {
    return s.replace(/&/g, '&amp;').
        replace(/</g, '&lt;').
        replace(/>/g, '&gt;').
        replace(/"/g, '&quot;').
        replace(/'/g, '&apos;');
}

module.exports = class AcuityWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
        this.requiresInsurerActivityCodes = true;
    }

    /**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {

        const insurerBO = new InsurerBO();
        const insurerSlug = 'acuity';
        const insurer = await insurerBO.getBySlug(insurerSlug);
        if (!insurer) {
            log.error(`Acuity not found by slug ${__location}`);
            return this.return_result('error');
        }

        // These are the limits supported by Acuity
        const carrierLimits = [
            '100000/500000/100000',
            '500000/500000/500000',
            '500000/1000000/500000',
            '1000000/1000000/1000000'
        ];

        // Define how corporation types are mapped for Acuity
        const corporationTypeMatrix = {
            C: 'SC',
            N: 'CN',
            S: 'SS'
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

        this.getAcuityTitle = function(owner) {
            switch (owner.officerTitle) {
                case "President":
                    return "Pres";
                case "Vice President":
                    return "VP";
                case "Secretary":
                    return "Sec";
                case "Treasurer":
                    return "Treas";
                case "Secy-Treas":
                    return "com.acuity_SecTreas";
                default:
                    break;
            }
            return "Ot"
        };

        // Ensure the industry code supports WC
        if (!this.industry_code.attributes.products || !this.industry_code.attributes.products.includes("wc")) {
            return this.client_autodeclined_out_of_appetite();
        }

        // Check to ensure we have NCCI codes available for every provided activity code.
        for (const location of this.app.business.locations) {
            for (const activityCode of location.activity_codes) {
                if (this.insurer_wc_codes.hasOwnProperty(`${location.territory}${activityCode.id}`)) {
                    activityCode.ncciCode = this.insurer_wc_codes[location.territory + activityCode.id];
                }
                else {
                    return this.client_autodeclined(`Insurer activity class codes were not found for all activities in the application.`, __location);
                }
            }
        }

        // Prepare limits
        const limits = this.getBestLimits(carrierLimits);
        if (!limits) {
            return this.client_autodeclined('The insurer does not support the request liability limits', {industryCode: this.industry_code.id});
        }
        this.requestLimits = limits;

        // Transaction
        const now = moment_timezone.tz('America/Los_Angeles');
        this.transactionID = this.generate_uuid();
        this.transactionRequestDate = now.format('YYYY-MM-DDTHH:mm:ss');
        this.transactionEffectiveDate = now.format('YYYY-MM-DD');

        // Business entity/corporate structure
        if (!(this.app.business.entity_type in entityMatrix)) {
            return this.client_autodeclined('The business entity type is not configured for this insurer.', {businessEntityType: this.app.business.entity_type});
        }
        this.entityType = entityMatrix[this.app.business.entity_type];
        if (this.app.business.entity_type === 'Limited Liability Company' && (this.app.business.primary_territory === 'MT' || this.app.business.primary_territory === 'VA')) {
            if (this.app.business.management_structure) {
                this.managementStructureMember = this.app.business.management_structure === 'member' ? 'YES' : 'NO';
                this.managementStructureManager = this.app.business.management_structure === 'manager' ? 'YES' : 'NO';
            }
            else {
                this.managementStructureMember = "NO";
                this.managementStructureManager = "YES";
            }
        }

        // Set the type of corporation
        if (this.entityType === "CP") {
            if (this.applicationDocData.corporationType) {
                this.corporationType = corporationTypeMatrix[this.applicationDocData.corporationType];
            }
            else if (this.applicationDocData.mailingState === "PA") {
                this.log_warn("Corporation in Pennsylvania needs corporation type, but it isn't specified. Non-fatal so continuing quote.", __location);
            }
        }

        // Business information
        const phone = this.app.business.contacts[0].phone.toString();
        this.primaryPhoneNumber = `+1-${phone.substring(0, 3)}-${phone.substring(phone.length - 7)}`;
        this.timeInBusiness = moment().diff(this.app.business.founded, 'months');

        // Claims
        this.claims_by_year = this.claims_to_policy_years();
        this.hadClaimsInPast3Years = 'NO';
        this.hadLossesInPast3Years = 'NO';
        for (let i = 1; i < 4; i++) {
            if (this.claims_by_year[i].count > 0) {
                this.hadClaimsInPast3Years = 'YES';
            }
            if (this.claims_by_year[i].amount > 0) {
                this.hadLossesInPast3Years = 'YES';
            }
        }

        // Questions
        let question_identifiers = null;
        try {
            question_identifiers = await this.get_question_identifiers();
        }
        catch (error) {
            return this.client_error('Could not determine the identifiers for the questions', __location);
        }

        // Loop through each question
        this.questionList = [];
        this.fullQuestionList = [];
        for (const question_id in this.questions) {
            if (this.questions.hasOwnProperty(question_id)) {
                const question = this.questions[question_id];
                const questionCode = question_identifiers[question.id];
                // Get the answer
                let answer = '';
                try {
                    answer = this.determine_question_answer(question);
                }
                catch (error) {
                    log.error(`AcuityWC (application ${this.app.id}): Could not determine question ${question_id} answer: ${error} ${__location}`);
                    //return this.client_error('Could not determine the answer for one of the questions', __location, {questionID: question_id});
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
                // Do not add questions to the list which are actually question node values (handled below)
                if (!questionCode.endsWith(".Num") && !questionCode.endsWith(".Explanation")) {
                    this.questionList.push({
                        code: questionCode,
                        answerType: answerType,
                        answer: answer
                    });
                }
                // Add every question to the full question list (required below)
                this.fullQuestionList.push({
                    code: questionCode,
                    answerType: answerType,
                    answer: answer
                });

            }
        }
        this.getAdditionalQuestionValues = (questionCode) => {
            // This will look at a question and determine if there is another question which should be used to populate
            // its <Num> or <Explanation> nodes. For example, question "WORK43" (Do you use subcontractors?') requires the
            // customer to enter the percent of contracted work and put it in the <Num> node for that question node. We
            // import a question named "WORK43.Num" ("What percent is subcontracted work?").
            //
            // For example: when the questionCode is "WORK43", we look for "WORK43.Num" and "WORK43.Explanation". If they
            // exist, we return XML nodes values for each of those.
            const mainQuestion = this.fullQuestionList.find((q) => q.code === questionCode);
            let additionalQuestionValues = "";
            const space = "                    ";
            for (const valueQuestion of this.fullQuestionList) {
                const valueQuestionMainCode = valueQuestion.code.substr(0, valueQuestion.code.lastIndexOf("."));
                if (valueQuestion.code.endsWith(".Num") && valueQuestionMainCode === mainQuestion.code) {
                    if (additionalQuestionValues.length !== 0) {
                        // Add leading space for XML formatting after initial value node added
                        additionalQuestionValues += space;
                    }
                    additionalQuestionValues += "<Num>" + escapeXML(valueQuestion.answer) + "</Num>\n";
                }
                else if (valueQuestion.code.endsWith(".Explanation") && valueQuestionMainCode === mainQuestion.code) {
                    if (additionalQuestionValues.length !== 0) {
                        // Add leading space for XML formatting after initial value node added
                        additionalQuestionValues += space;
                    }
                    additionalQuestionValues += "<Explanation>" + escapeXML(valueQuestion.answer) + "</Explanation>\n";
                }
            }
            return additionalQuestionValues;
        };

        // ===================================================================================================
        // Render the template into XML and remove any empty lines (artifacts of control blocks)
        // ===================================================================================================
        let xml = null;
        try {
            xml = acuityWCTemplate.render(this).replace(/\n\s*\n/g, '\n');
        }
        catch (error) {
            return this.client_error('Unable to create the request to send to the insurer', __location);
        }

        // Determine which URL to use
        let host = '';
        let path = '';
        let credentials = null;
        if (this.insurer.useSandbox) {
            host = 'tptest.acuity.com';
            path = '/ws/partner/public/irate/rating/RatingService/Talage'
            credentials = {
                'X-IBM-Client-Id': this.username,
                'X-IBM-Client-Secret': this.password
            };
        }
        else {
            host = 'services.acuity.com';
            path = '/ws/irate/rating/RatingService/Talage';
            credentials = {'x-acuity-api-key': this.password};
        }

        // Send the XML to the insurer
        let result = null;
        try {
            result = await this.send_xml_request(host, path, xml, credentials);
        }
        catch (error) {
            // console.log('error', error);
            return this.client_connection_error(__location);
        }
        // console.log('result', JSON.stringify(result, null, 4));

        // Retrieve the quote link and letter if they exist. Acuity will return a link even if it declines to give them the option to fix it.
        // We get quote letter here as well because it is convenient since they are in the same node.
        let quoteLetter = null;
        let quoteLetterMimeType = null;
        const fileAttachmentInfoList = this.get_xml_child(result.ACORD, 'InsuranceSvcRs.WorkCompPolicyQuoteInqRs.FileAttachmentInfo', true);
        if (fileAttachmentInfoList) {
            for (const fileAttachmentInfo of fileAttachmentInfoList) {
                switch (fileAttachmentInfo.AttachmentDesc[0]) {
                    case "Policy Quote Print":
                        quoteLetter = fileAttachmentInfo.cData[0];
                        quoteLetterMimeType = fileAttachmentInfo.MIMEContentTypeCd[0];
                        break;
                    case "URL":
                        this.quoteLink = fileAttachmentInfo.WebsiteURL[0];
                        break;
                    default:
                        break;
                }
            }
        }

        // Check if there was an error
        if (result.hasOwnProperty('errorResponse')) {
            const error_code = parseInt(result.errorResponse.httpCode, 10);
            switch (error_code) {
                case '401':
                case '403':
                    return this.client_error(`Authorization failed with the insurer's server.`, __location, {errorCode: error_code});
                case '500':
                    return this.client_error(`The insurer's server encountered an internal error.`, __location, {errorCode: error_code});
                case '504':
                    return this.client_error(`The insurer's server timed out on the request.`, __location, {errorCode: error_code});
                default:
                    return this.client_error(`The insurer's server returned an unknown error.`, __location, {errorCode: error_code});
            }
        }

        // Parse the various status codes and take the appropriate action
        const statusCode = parseInt(this.get_xml_child(result.ACORD, 'SignonRs.Status.StatusCd'), 10);
        if (statusCode !== 0) {
            if (statusCode === 503) {
                return this.client_error(`The insurer's server is experiencing an outage.`, __location, {statusCode: statusCode});
            }
            else {
                return this.client_error(`The insurer's server returned an unknown API error.`, __location, {statusCode: statusCode});
            }
        }

        // Check if the application was rejected or declined
        const msgStatusCd = this.get_xml_child(result.ACORD, "InsuranceSvcRs.WorkCompPolicyQuoteInqRs.MsgStatus.MsgStatusCd");
        let declined = false;
        const extendedStatus = this.get_xml_child(result.ACORD, "InsuranceSvcRs.WorkCompPolicyQuoteInqRs.MsgStatus.ExtendedStatus", true);
        let declinedReasons = '';
        for (const status of extendedStatus) {
            if (status.ExtendedStatusDesc[0].includes('not a market for the risk')) {
                declined = true;
                declinedReasons += (declinedReasons.length > 0 ? " " : "") + status.ExtendedStatusDesc[0];
            }
            else if (status.hasOwnProperty('com.acuity_ExtendedStatusType') && status['com.acuity_ExtendedStatusType'][0] === "Error") {
                declined = true;
                declinedReasons += (declinedReasons.length > 0 ? " " : "") + status.ExtendedStatusDesc[0].replace("Acuity_Decline: ", "");
            }
        }
        if (declined || msgStatusCd.toLowerCase() === 'rejected') {
            return this.client_declined(declinedReasons.length > 0 ? declinedReasons : null);
        }

        // Find the policy information
        const policyStatusCd = this.get_xml_child(result.ACORD, "InsuranceSvcRs.WorkCompPolicyQuoteInqRs.PolicySummaryInfo.PolicyStatusCd");
        switch (policyStatusCd) {
            case 'com.acuity_Incomplete':
                log.error(`AcuityWC (appId ${this.app.id}): Reporting incomplete information for quoting.` + __location);
                return this.client_declined("incomplete information to quote");
            case 'com.acuity_BindableQuoteIncompleteData':
                this.log_info(`Reporting incomplete information for a bindable quote. The quote will be a referral. Non-fatal so continuing.`, __location);
                // eslint-disable-line no-fallthrough
            case 'com.acuity_BindableQuote':
            case "com.acuity_BindableModifiedQuote":
            case 'com.acuity_BindableReferredQuote':
            case 'com.acuity_NonBindableQuote':
                // Retrieve and populate the quote amount
                const amt = this.get_xml_child(result.ACORD, "InsuranceSvcRs.WorkCompPolicyQuoteInqRs.PolicySummaryInfo.FullTermAmt.Amt");
                const premiumAmount = amt ? parseFloat(amt, 10) : 0;

                const quoteNumber = this.get_xml_child(result.ACORD, "InsuranceSvcRs.WorkCompPolicyQuoteInqRs.CommlPolicy.QuoteInfo.CompanysQuoteNumber");

                // Retrieve and populate the quote limits
                const limitNodeList = this.get_xml_child(result.ACORD, "InsuranceSvcRs.WorkCompPolicyQuoteInqRs.WorkCompLineBusiness.CommlCoverage.Limit", true);
                const quoteLimits = {};
                if(limitNodeList){
                    limitNodeList.forEach((limitNode) => {
                        switch (limitNode.LimitAppliesToCd[0]) {
                            case 'PerAcc':
                                quoteLimits[1] = limitNode.FormatInteger[0];
                                break;
                            case 'DisEachEmpl':
                                quoteLimits[2] = limitNode.FormatInteger[0];
                                break;
                            case 'DisPol':
                                quoteLimits[3] = limitNode.FormatInteger[0];
                                break;
                            default:
                                break;
                        }
                    });
                }

                // Check if it is a bindable quote
                if (policyStatusCd === 'acuity_BindableQuote') {
                    return this.client_quoted(quoteNumber, quoteLimits, premiumAmount, quoteLetter, quoteLetterMimeType);
                }
                // Nonbindable quote is referred
                return this.client_referred(quoteNumber, quoteLimits, premiumAmount, quoteLetter, quoteLetterMimeType);
            default:
                return this.client_error("The insurer returned an unrecognized policy status", __location, {policyStatusCd: policyStatusCd});
        }
    }
};