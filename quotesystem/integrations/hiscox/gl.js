/* eslint-disable array-element-newline */
/**
 * General Liability Integration for Hiscox
 */

"use strict";

const Integration = require("../Integration.js");
const moment = require("moment");
const momentTimezone = require("moment-timezone");
const stringFunctions = global.requireShared("./helpers/stringFunctions.js"); // eslint-disable-line no-unused-vars
// const util = require('util');
const xmlToObj = require("xml2js").parseString;
const smartystreetSvc = global.requireShared('./services/smartystreetssvc.js');

// Read the template into memory at load
const hiscoxGLTemplate = require("jsrender").templates("./quotesystem/integrations/hiscox/gl.xmlt");

/**
 * Gets the Hiscox COB code based on the COB description
 * @param  {string} cobDescription - description of the COB
 * @returns {string} COB code
 */
async function getHiscoxCOBFromDescription(cobDescription) {
    const hiscoxCodeSvc = require('./hiscoxcodesvc.js');
    const result = hiscoxCodeSvc.getByDesc(cobDescription);
    if (result) {
        return result.code;
    }
    else {
        return null;
    }
}

module.exports = class HiscoxGL extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
    }


    /**
     * Requests a quote from Hiscox and returns. This request is not intended to be called directly.
     *
     * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
     */
    async _insurer_quote() {
        // These are the statuses returned by the insurer and how they map to our Talage statuses

        // this.possible_api_responses.DECLINE = 'declined';
        // this.possible_api_responses.INPROGRESS = 'referred';
        // this.possible_api_responses.PENDING_REFER = 'referred_with_price';
        // this.possible_api_responses.QUICKDECLINE = 'declined';
        // this.possible_api_responses.QUOTED = 'quoted';
        // this.possible_api_responses.REFER = 'referred';
        // this.possible_api_responses.RISKRESVDECLINE = 'declined';
        // CHECK SUPPORTED DEDUCTIBLES

        // Define the limits supported by this carrier
        let carrierLimits = ["300000/600000", "500000/1000000", "1000000/2000000", "2000000/2000000"];

        const validCounties = [
            "Broward county",
            "Duval county",
            "Hillsborough county",
            "Miami-Dade county",
            "Palm Beach county",
            "Pinellas county",
            "Remainder of State",
            "Bexar county",
            "Cameron county",
            "Dallas county",
            "El Paso county",
            "Galveston county",
            "Harris county (Houston)",
            "Harris county (other than Houston)",
            "Hidalgo county",
            "Jefferson county",
            "Nueces county",
            "Tarrant county",
            "Travis county",
            "Willacy county",
            "Jackson county (Kansas City)",
            "Jackson county (other than Kansas City)",
            "Clay county (Kansas City)",
            "Clay county (other than Kansas City)",
            "Cass county (Kansas City)",
            "Cass county (other than Kansas City)",
            "Platte county (Kansas City)",
            "Platte county (other than Kansas City)",
            "Saint Louis county"
        ];

        /**
         * All classes of business mapped to Hiscox's Small Contractor, Landscape/Janitorial/Retail, and Mobile Food Classes use different limits.
         * These categories are not returned by their API, but can be found in the Development Guidelines for Quote API on the Reference Data tab.
         * The following list is in the order in which items  \appear in that spreadsheet.
         */
        if (
            [
                // Small Contractors (SC)

                "DS3", // Air conditioning systems installation/repair
                "DS4", // Appliance and accessories installation/repair
                "DS5", // Carpentry (interior only)
                "DS9", // Carpet/furniture/upholstery cleaning(offsite only)
                "DS2", // Clock making/repair
                "DS6", // Door or window installation/repair
                "DSC", // Driveway or sidewalk paving/repaving
                "DSN", // Drywall or wallboard installation/repair
                "DSD", // Electrical work (interior only)
                "DSE", // Fence installation/repair
                "DSF", // Floor covering installation(no ceramic tile/stone)
                "DS7", // Glass installation/repair (no auto work)
                "DSG", // Handyperson (no roof work)
                "DSH", // Heating/air conditioning install/repair(no LPG)
                "DS8", // Interior finishing work
                "DS1", // Locksmiths
                "DSL", // Masonry work
                "DSM", // Painting (interior only)
                "DSO", // Plastering or stucco work
                "DSP", // Plumbing (commercial/industrial)
                "DSQ", // Plumbing (residential/domestic)
                "DSS", // Sign painting/lettering (exterior only)
                "DSR", // Sign painting/lettering (interior only)
                "DST", // Tile/stone/marble/mosaic/terrazzo work(int. only)
                "DSA", // Upholstery work
                "DSU", // Window cleaning (nothing above 15 feet)

                // Landscapers, Janitors and Retailers (LJR)

                "DT1", // Appliance/electronic stores (Retail)
                "DT2", // Clothing/apparel stores (Retail)
                "DSB", // Exterior cleaning services
                "DT3", // Florists (Retail)
                "DT4", // Home furnishing stores (Retail)
                "DSI", // Janitorial/cleaning services
                "DT5", // Jewelry stores (Retail)
                "DSJ", // Landscaping/gardening services
                "DSK", // Lawn care services
                "DT7", // Other stores (with food/drinks) (Retail)
                "DT6", // Other stores (without food/drinks) (Retail)
                "DT8", // Snow blowing and removal (no auto coverage)

                // Mobile Food Services
                "DSV" // Mobile food services
            ].includes(this.industry_code.hiscox)
        ) {
            carrierLimits = ["300000/300000", "500000/500000", "1000000/2000000", "2000000/2000000"];
        }

        // Define how legal entities are mapped for Hiscox
        const entityMatrix = {
            Association: "Corporation or other organization (other than the above)",
            Corporation: "Corporation or other organization (other than the above)",
            "Limited Liability Company": "Limited liability company",
            "Limited Partnership": "Partnership",
            Other: "Corporation or other organization (other than the above)",
            Partnership: "Partnership",
            "Sole Proprietorship": "Individual/sole proprietor"
        };

        // Determine which URL to use
        let host = "";
        if (this.insurer.useSandbox) {
            host = "sdbx.hiscox.com";
        }
        else {
            host = "api.hiscox.com";
        }

        // console.log(JSON.stringify(this.app, null, 4));

        // Hiscox has us define our own Request ID
        this.request_id = this.generate_uuid();

        // Fill in calculated fields
        this.requestDate = momentTimezone.tz("America/Los_Angeles").format("YYYY-MM-DD");

        this.employeeCount = this.get_total_employees();
        if (this.employeeCount === 0) {
            this.employeeCount = 1;
        }

        // Ensure we have an email and phone for this agency, both are required to quote with Hiscox
        if (!this.app.agencyLocation.agencyEmail || !this.app.agencyLocation.agencyPhone) {
            this.log_error(`Agency Location ${this.app.agencyLocation.id} does not have an email address and/or phone number. Hiscox requires both to quote.`);
            return this.return_error('error', 'Hiscox requires an agency to provide both a phone number and email address');
        }

        // Ensure this entity type is in the entity matrix above
        if (!(this.app.business.entity_type in entityMatrix)) {
            this.reasons.push(`${this.insurer.name} does not support the entity type selected by the user`);
            return this.return_result("autodeclined");
        }
        this.entityType = entityMatrix[this.app.business.entity_type];

        // Determine the best limits
        this.bestLimits = this.getBestLimits(carrierLimits);
        if (!this.bestLimits) {
            this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
            return this.return_result("autodeclined");
        }

        // Check and format the effective date (Hiscox only allows effective dates in the next 60 days, while Talage supports 90 days)
        if (this.policy.effective_date.isAfter(moment().startOf("day").add(60, "days"))) {
            this.reasons.push(`${this.insurer.name} does not support effective dates more than 60 days in the future`);
            return this.return_result("autodeclined");
        }
        this.effectiveDate = this.policy.effective_date.format("YYYY-MM-DD");

        // Make a local copy of locations so that any Hiscox specific changes we make don't affect other integrations
        const locations = [...this.app.business.locations];

        // Hiscox requires a county be supplied in three states, in all other states, remove the county
        for (const location of locations) {
            if (["FL", "MO", "TX"].includes(location.territory)) {
                // Hiscox requires a county in these states
                if (!location.county) {
                    const smartyStreetsResponse = await smartystreetSvc.checkAddress(this.app.business.locations[0].address,
                        this.app.business.locations[0].city,
                        this.app.business.locations[0].state_abbr,
                        this.app.business.locations[0].zip);
                    // If the responsee has an error property, or doesn't have addressInformation.county_name, we can't determine
                    // a county so return an error.
                    if (smartyStreetsResponse.hasOwnProperty("error") ||
                        !smartyStreetsResponse.hasOwnProperty("addressInformation") ||
                        !smartyStreetsResponse.addressInformation.hasOwnProperty("county_name")) {
                        if (smartyStreetsResponse.hasOwnProperty("error")) {
                            this.log += `Invalid business address: ${this.app.business.locations[0].address}, ${this.app.business.locations[0].city}, ${this.app.business.locations[0].state_abbr}, ${this.app.business.locations[0].zip}<br>`;
                            this.log += `${smartyStreetsResponse.error}<br>`;
                            this.log += `SmartyStreets error reason: ${smartyStreetsResponse.errorReason}<br><br>`;
                        }
                        else {
                            this.log += `SmartyStreets could not determine the county: ${this.app.business.locations[0].address}, ${this.app.business.locations[0].city}, ${this.app.business.locations[0].state_abbr}, ${this.app.business.locations[0].zip}<br>`;
                        }
                        if (smartyStreetsResponse.hasOwnProperty("errorReason")) {
                            // If SmartyStreets returned a error reason, show that to the user
                            return this.client_error(`Invalid business address: ${smartyStreetsResponse.errorReason}`);
                        }
                        else {
                            // If not, show that it was unable to validate the address
                            return this.client_error('Unable to validate address before submission.');
                        }
                    }
                    location.county = smartyStreetsResponse.addressInformation.county_name;
                }
                // We have a valid county now.

                // There are special conditions in Harris County, TX, Jackson County, MO, Clay County, MO, Cass County, MO, and Platte County, MO
                if (location.territory === "MO" && ["Cass", "Clay", "Jackson", "Platte"].includes(location.county)) {
                    // For Clay County, MO - Check whether or not we are looking at Kansas City
                    if (location.city === "KANSAS CITY") {
                        location.county = `${location.county} county (Kansas City)`;
                    }
                    else {
                        location.county = `${location.county} county (other than Kansas City)`;
                    }
                }
                else if (location.territory === "TX" && location.county === "Harris") {
                    // For Harris County, TX - Check whether or not we are looking at Houston
                    if (location.city === "HOUSTON") {
                        location.county = "Harris county (Houston)";
                    }
                    else {
                        location.county = "Harris county (other than Houston)";
                    }
                }
                else if (location.county.length > 0 && !location.county.toLowerCase().endsWith("county")) {
                    // Hiscox requires the word 'county' on the end of the county name
                    location.county += " county";
                }
                // "county" MUST be lower case. MUST.
                location.county = location.county.replace("County", "county");

                // If it isn't in the list of valid counties, set it to "Remainder of State"
                if (!validCounties.includes(location.county)) {
                    location.county = "Remainder of state";
                }
            }
            else {
                // Hiscox does not want a territory, set it to false so the integration doesn't include it
                location.county = false;
            }
        }

        // Determine the primary and secondary locations
        this.primaryLocation = locations.shift();
        this.secondaryLocations = locations;
        this.secondaryLocationsCount = this.secondaryLocations.length >= 5 ? "5+" : this.secondaryLocations.length.toString();

        let questionDetails = null;
        try {
            questionDetails = await this.get_question_details();
        }
        catch (error) {
            this.log_error(`Unable to get question identifiers or details: ${error}`, __location);
            return this.return_result('error', "Could not retrieve the Hiscox question identifiers");
        }

        // Determine total payroll
        this.totalPayroll = this.get_total_payroll();
        // eslint-disable-next-line no-extra-parens
        const totalPayrollQuestionId = Object.keys(questionDetails).find(questionId => (questionDetails[questionId].identifier.startsWith("CustomTotalPayroll") ? questionId : null));
        if (totalPayrollQuestionId) {
            //parseInt does not throw error with parse a non-number.
            //Still want to remove the questions
            try {
                const totalPayroll = parseInt(this.questions[totalPayrollQuestionId].answer, 10);
                if (!isNaN(totalPayroll)) {
                    this.totalPayroll = totalPayroll;
                }
            }
            catch (error) {
                this.log_warn(`Could not convert custom total payroll '${this.questions[totalPayrollQuestionId].answer}' to a number.`, __location);
            }
            delete this.questions[totalPayrollQuestionId];
        }

        // Add questions
        this.questionList = [];
        this.additionalCOBs = [];
        for (const question of Object.values(this.questions)) {
            let questionAnswer = this.determine_question_answer(question, question.required);
            if (questionAnswer !== false) {
                let elementName = questionDetails[question.id].attributes.elementName;
                if (elementName === 'GLHireNonOwnVehicleUse') {
                    elementName = 'HireNonOwnVehclUse';
                }
                else if (elementName === 'SCForbiddenProjects') {
                    elementName = 'ForbiddenProjectsSmallContractors';
                }
                else if (elementName === 'HNOACoverQuoteRq') {
                    if (questionAnswer !== 'No') {
                        this.hnoaAmount = questionAnswer;
                        // this.questionList.push({
                        //     nodeName: 'HireNonOwnVehclCoverage',
                        //     answer: 'Yes'
                        // });
                    }
                    // Don't add this to the question list
                    continue;
                }
                else if (elementName === 'ClassOfBusinessCd') {
                    const cobDescriptionList = questionAnswer.split(", ");
                    for (const cobDescription of cobDescriptionList) {
                        const cob = await getHiscoxCOBFromDescription(cobDescription);
                        if (!cob) {
                            this.log_warn(`Could not locate COB code for COB description '${cobDescription}'`, __location);
                            continue;
                        }
                        this.additionalCOBs.push(cob);
                    }
                    // Don't add this to the question list
                    continue;
                }
                else if (elementName === 'EstmtdPayrollSC') {
                    if (questionAnswer === null) {
                        questionAnswer = 0;
                    }
                    else {
                        try {
                            //parseInt does not throw error with parse a non-number.
                            questionAnswer = parseInt(questionAnswer, 10);
                            if(questionAnswer === "NaN"){
                                throw new Error("Not an integer");
                            }
                        }
                        catch (error) {
                            this.log_warn(`Could not convert contractor payroll '${questionAnswer}' to a number.`, __location);
                            questionAnswer = 0;
                        }
                    }
                    // Add contractor payroll
                    if(!(questionAnswer > 0)){
                        questionAnswer = 0
                    }
                    this.questionList.push({
                        nodeName: 'EstmtdPayrollSCContractors',
                        answer: questionAnswer
                    });

                    // Add total payroll
                    if(!(this.totalPayroll > 0)){
                        this.totalPayroll = 0;
                    }
                    this.questionList.push({
                        nodeName: 'EstmtdPayrollSC',
                        answer: this.totalPayroll
                    });
                    // Don't add more to the question list
                    continue;
                }
                this.questionList.push({
                    nodeName: elementName,
                    answer: questionAnswer
                });
            }
        }

        // Render the template into XML and remove any empty lines (artifacts of control blocks)
        let xml = null;
        try {
            xml = hiscoxGLTemplate.render(this, {ucwords: (val) => stringFunctions.ucwords(val.toLowerCase())}).replace(/\n\s*\n/g, "\n");
        }
        catch (error) {
            return this.client_error('An unexpected error occurred when creating the quote request.', __location, {error: "Could not render template file"});
        }

        // Get a token from their auth server
        const tokenRequestData = {
            client_id: this.username,
            client_secret: this.password
        };
        let tokenResponse = null;
        try {
            tokenResponse = await this.send_request(host, "/toolbox/auth/accesstoken", tokenRequestData, {"Content-Type": "application/x-www-form-urlencoded"});
        }
        catch (error) {
            return this.client_error("Could not retrieve the access token from the Hiscox server.", __location, {error: error});
        }
        const responseObject = JSON.parse(tokenResponse);

        // Verify that we got back what we expected
        if (responseObject.status !== "approved" || !responseObject.access_token) {
            return this.client_error("Could not retrieve the access token from the Hiscox server.", __location, {responseObject: responseObject});
        }
        const token = responseObject.access_token;

        // Specify the path to the Quote endpoint
        const path = "/partner/v3/quote";

        this.log_info(`Sending application to https://${host}${path}. This can take up to 30 seconds.`);

        // console.log("request", xml);

        // Send the XML to the insurer
        let result = null;
        let requestError = null;
        try {
            result = await this.send_xml_request(host, path, xml, {
                Authorization: `Bearer ${token}`,
                Accept: "application/xml",
                "Content-Type": "application/xml"
            });
        }
        catch (error) {
            requestError = error;
        }

        // Check if we have an HTTP status code to give us more information about the error encountered
        if (requestError) {
            if (!requestError.httpStatusCode) {
                // There is no response from the API server to help us understand the error
                return this.client_error('Unable to connect to the Hiscox API. An unknown error was encountered.', __location, {requestError: requestError});
            }
            if (requestError.httpStatusCode !== 422 || !requestError.response) {
                // An HTTP error was encountered other than a 422 error
                return this.client_error(`Unable to connect to the Hiscox server. The Hiscox API returned HTTP status code ${requestError.httpStatusCode}`, __location, {requestError: requestError});
            }

            // console.log("error", requestError.response);

            // Convert the response to XML
            let e = null;
            let xmlResponse = null;
            xmlToObj(requestError.response, (eCallback, xmlResponseCallback) => {
                e = eCallback;
                xmlResponse = xmlResponseCallback;
            });

            // console.log("xmlResponse error", JSON.stringify(xmlResponse, null, 4));
            // Check if there was an error parsing the XML
            if (e) {
                return this.client_error(`The Hiscox API returned an error: ${requestError.response}`, __location, {requestError: requestError});
            }
            // Check for errors
            const errorResponseList = this.get_xml_child(xmlResponse, "InsuranceSvcRq.Errors.Error", true);
            if (errorResponseList) {
                let errors = "";
                for (const errorResponse of errorResponseList) {
                    if (errorResponse.Code && errorResponse.Description) {
                        if (errorResponse.Code[0].startsWith("DECLINE")) {
                            // Return an error result
                            return this.client_declined(`${errorResponse.Code[0]}: ${errorResponse.Description}`);
                        }
                        else {
                            // Non-decline error
                            const reason = `${errorResponse.Description[0]} (${errorResponse.Code[0]})`;
                            errors += (errors.length ? ", " : "") + reason;
                        }
                    }
                }
                return this.client_error(`The Hiscox server returned the following errors: ${errors}`, __location);
            }
            // Check for validation errors
            const validationErrorList = this.get_xml_child(xmlResponse, "InsuranceSvcRq.Validations.Validation", true);
            if (validationErrorList) {
                // Loop through and capture each validation message
                let validationMessage = "Validation errors: ";
                for (const validationError of validationErrorList) {
                    validationMessage += `${validationError.Status} (${validationError.DataItem}) at ${validationError.XPath}, `;
                }
                return this.client_error(validationMessage, __location, {validationErrorList: validationErrorList});
            }
            // Check for a fault string (unknown node name)
            const faultString = this.get_xml_child(xmlResponse, "fault.faultstring");
            if (faultString) {
                // Check for a system fault
                return this.client_error(`The Hiscox API returned a fault string: ${faultString}`, __location, {requestError: requestError});
            }
            // Return an error result
            return this.client_error(`The Hiscox API returned an error of ${requestError.httpStatusCode} without explanation`, __location, {requestError: requestError});
        }

        // We have received a quote. Parse it.
        // console.log("response", JSON.stringify(result, null, 4));

        // Get the limits (required)
        const loi = this.get_xml_child(result, "InsuranceSvcRs.QuoteRs.ProductQuoteRs.GeneralLiabilityQuoteRs.RatingResult.LOI");
        if (!loi) {
            return this.client_error("Hiscox quoted the application, but the limits could not be found in the response.", __location, {result: result});
        }
        this.limits[4] = parseInt(loi, 10);
        const aggLOI = this.get_xml_child(result, "InsuranceSvcRs.QuoteRs.ProductQuoteRs.GeneralLiabilityQuoteRs.RatingResult.AggLOI");
        if (!aggLOI) {
            return this.client_error("Hiscox quoted the application, but the limits could not be found in the response.", __location, {result: result});
        }
        this.limits[8] = parseInt(aggLOI, 10);

        // Get the premium amount (required)
        const premium = this.get_xml_child(result, "InsuranceSvcRs.QuoteRs.ProductQuoteRs.Premium.Annual");
        if (!premium) {
            return this.client_error("Hiscox quoted the application, but the premium amount could not be found in the response.", __location, {result: result});
        }
        this.amount = premium;

        // Get the quote link
        const retrieveURL = this.get_xml_child(result, "InsuranceSvcRs.QuoteRs.RetrieveURL");
        if (retrieveURL) {
            this.quoteLink = retrieveURL;
        }

        // Always a $0 deductible
        this.deductible = 0;
        this.limits[12] = 0;
        // Get the request ID (optional)
        const requestId = this.get_xml_child(result, "InsuranceSvcRs.QuoteRs.RqUID");
        if (!requestId) {
            this.log_error('Could not locate the request ID (RqUID) node. This is non-fatal. Continuing.');
        }
        else {
            this.request_id = requestId;
        }

        // Get the quote ID (optional)
        const quoteId = this.get_xml_child(result, "InsuranceSvcRs.QuoteRs.QuoteID");
        if (!quoteId) {
            this.log_error('Could not locate the quote ID (QuoteID) node. This is non-fatal. Continuing.');
        }
        else {
            this.number = quoteId;
        }

        // That we are quoted
        return this.return_result('quoted');
    }
};