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

module.exports = class HiscoxGL extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
        // Do not require BOP field as the BOP connection may come from industry code
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

        // Look up the insurer industry code, make sure we got a hit. //zy
        // If it's BOP, check that the link is made at industry code, 
        // if not lookup the policy.bopCode
        // Set the code that we're using here. No longer using industry_code.hiscox

        // Define how legal entities are mapped for Hiscox
        const entityMatrix = {
            'Association': 'Professional Association',
            'Corporation': 'Corporation',
            'Corporation (C-Corp)': 'Corporation',
            'Corporation (S-Corp)': 'Corporation',
            'Limited Liability Company': 'Limited Liability Company',
            'Limited Partnership': 'Partnership',
            'Limited Liability Company (Member Managed)': 'Limited Liability Company',
            'Limited Liability Company (Manager Managed)': 'Limited Liability Company',
            'Partnership': 'Partnership',
            'Sole Proprietorship': 'Sole Proprietor',
            'Other': 'Other'
        };

        // Determine which URL to use
        let host = "";
        if (this.insurer.useSandbox) {
            host = "sdbx.hiscox.com";
        }
        else {
            host = "api.hiscox.com";
        }

        const reqJSON = {InsuranceSvcRq: {QuoteRq: {}}};

        // Hiscox has us define our own Request ID. Try application ID
        this.request_id = this.generate_uuid();
        reqJSON.InsuranceSvcRq.QuoteRq.RqUID = this.request_id;
        reqJSON.InsuranceSvcRq.QuoteRq.ReferenceNumberID = "";

        // Fill in calculated fields
        this.requestDate = momentTimezone.tz("America/Los_Angeles").format("YYYY-MM-DD");

        this.employeeCount = this.get_total_employees();
        if (this.employeeCount === 0) {
            this.employeeCount = 1;
        }
        //Wholesale swap already done if necessary.
        this.agency_id = this.app.agencyLocation.insurers[this.insurer.id].agency_id;

        this.agencyId = this.app.agencyLocation.agencyId;
        this.agency = this.app.agencyLocation.agency;
        this.agencyPhone = this.app.agencyLocation.agencyPhone;
        this.agencyEmail = this.app.agencyLocation.agencyEmail;
        this.first_name = this.app.agencyLocation.first_name;
        this.last_name = this.app.agencyLocation.last_name;
        // If talageWholeSale
        if(this.app.agencyLocation.insurers[this.insurer.id].talageWholesale){
            //Use Talage Agency.
            const talageAgencyId = 1;
            this.agencyId = talageAgencyId

            const AgencyBO = global.requireShared('./models/Agency-BO.js');
            const agencyBO = new AgencyBO();
            const agencyInfo = await agencyBO.getById(this.agencyId);
            this.agency = agencyInfo.name;
            const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
            const agencyLocationBO = new AgencyLocationBO();
            const talageAgencyLocationId = 1;

            const agencyLocationInfo = await agencyLocationBO.getById(talageAgencyLocationId);

            this.agencyEmail = agencyLocationInfo.email;
            this.agencyPhone = agencyLocationInfo.phone;
            this.first_name = agencyLocationInfo.firstName
            this.last_name = agencyLocationInfo.lastName
        }

        reqJSON.InsuranceSvcRq.QuoteRq.ProducerInfo = {};
        // zy TODO HACK Nothing I try is a valid ProducerClient. Hard-codign to their example for now
        // reqJSON.InsuranceSvcRq.QuoteRq.ProducerInfo.ProducerClient = this.agency;
        reqJSON.InsuranceSvcRq.QuoteRq.ProducerInfo.ProducerClient = 'APIQA'; // zy debug fix
        reqJSON.InsuranceSvcRq.QuoteRq.ProducerInfo.EmailInfo = {EmailAddr: this.agencyEmail};

        reqJSON.InsuranceSvcRq.QuoteRq.AgentInfo = {AgencyName: this.agency};
        if (this.app.agencyLocation.insurers[this.insurer.id].agentId){
            reqJSON.InsuranceSvcRq.QuoteRq.AgentInfo.AgentID = this.app.agencyLocation.insurers[this.insurer.id].agentId;
        }
        reqJSON.InsuranceSvcRq.QuoteRq.AgentInfo.Person = {Name: {}};

        if (this.first_name){
            reqJSON.InsuranceSvcRq.QuoteRq.AgentInfo.Person.Name.FirstName = this.first_name;
        }
        if (this.last_name){
            reqJSON.InsuranceSvcRq.QuoteRq.AgentInfo.Person.Name.LastName = this.last_name;
        }

        reqJSON.InsuranceSvcRq.QuoteRq.AgentInfo.Person.CommunicationsInfo = {
            PhoneInfo: {},
            EmailInfo: {}
        };

        // Ensure we have an email and phone for this agency, both are required to quote with Hiscox
        if (!this.agencyEmail || !this.agencyPhone) {
            this.log_error(`AppId: ${this.app.id} Agency Location ${this.app.agencyLocation.id} does not have an email address and/or phone number. Hiscox requires both to quote. Talage Wholesale ${this.app.agencyLocation.insurers[this.insurer.id].talageWholesale}`, __location);
            this.reasons.push(`Hiscox requires an agency to provide both a phone number and email address`);
            return this.return_error('error', 'Hiscox requires an agency to provide both a phone number and email address');
        }
        if (this.agencyPhone) {
            reqJSON.InsuranceSvcRq.QuoteRq.AgentInfo.Person.CommunicationsInfo.PhoneInfo.PhoneNumber = this.agencyPhone;
        }
        if (this.agencyEmail) {
            reqJSON.InsuranceSvcRq.QuoteRq.AgentInfo.Person.CommunicationsInfo.EmailInfo.EmailAddr = this.agencyEmail;
        }

        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo = {};
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.CommercialName = this.app.business.name.substring(0, 250);

        // Ensure this entity type is in the entity matrix above
        // Set to other if we don't find in matrix. Log an error and set to 'other'
        if (!(this.app.business.entity_type in entityMatrix)) {
            this.reasons.push(`${this.insurer.name} does not support the entity type selected by the user`);
            return this.return_result("autodeclined");
        }
        this.entityType = entityMatrix[this.app.business.entity_type];
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.BusinessOwnershipStructure = this.entityType;
        // Use the IIC set above
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.ClassOfBusinessCd = this.insurerIndustryCode.attributes.v4Code; // zy Use the code that we find at the top. Revisit this
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.Person = {
            Name: {},
            CommunicationsInfo: {
                PhoneInfo: {},
                EmailInfo: {}
            }
        };

        const businessContactFirstName = this.app.business.contacts[0].first_name.substring(0, 250);
        if (businessContactFirstName) {
            reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.Person.Name.FirstName = businessContactFirstName;
        }
        const businessContactLastName = this.app.business.contacts[0].last_name.substring(0, 250);
        if (businessContactLastName) {
            reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.Person.Name.LastName = businessContactLastName;
        }

        const businessContactPhone = this.app.business.contacts[0].phone.toString().substring(0,10);
        if (businessContactPhone) {
            reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.Person.CommunicationsInfo.PhoneInfo.PhoneNumber = businessContactPhone;
        }

        const businessContactEmail = this.app.business.contacts[0].email.substring(0,60);
        if (businessContactEmail) {
            reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.Person.CommunicationsInfo.EmailInfo.EmailAddr = businessContactEmail;
        }




        // Determine the best limits
        // ***** HACK TODO ****** Temporarily hard-coded limits to 1000000/1000000 for testing. 
        // ***** Need to revisit how to determine limits as Hiscox doesn't seem to like the results of our getBestLimits 
        // ***** V3 request with 250000/250000 was fine but V4 doesn't like it. Not sure how bestLimits even resulted in 250000/250000
        this.bestLimits = ['1000000', '1000000'];
        // this.bestLimits = this.getBestLimits(carrierLimits);
        // if (!this.bestLimits) {
        //     this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
        //     return this.return_result("autodeclined");
        // }


        // Make a local copy of locations so that any Hiscox specific changes we make don't affect other integrations
        const locations = [...this.app.business.locations];

        // Hiscox requires a county be supplied in three states, in all other states, remove the county
        for (const location of locations) {
            if (["FL", "MO", "TX"].includes(location.territory)) {
                // Hiscox requires a county in these states
                if (location.county) {
                    const addressInfoResponse = await smartystreetSvc.checkAddress(this.app.business.locations[0].address,
                        this.app.business.locations[0].city,
                        this.app.business.locations[0].state_abbr,
                        this.app.business.locations[0].zip);
                    // If the responsee has an error property, or doesn't have addressInformation.county_name, we can't determine
                    // a county so return an error.
                    if(addressInfoResponse.county){
                        location.county = addressInfoResponse.county;
                    }
                    else {
                        if (addressInfoResponse.hasOwnProperty("error")) {
                            this.log += `Invalid business address: ${this.app.business.locations[0].address}, ${this.app.business.locations[0].city}, ${this.app.business.locations[0].state_abbr}, ${this.app.business.locations[0].zip}<br>`;
                            this.log += `${addressInfoResponse.error}<br>`;
                            this.log += `SmartyStreets error reason: ${addressInfoResponse.errorReason}<br><br>`;
                        }
                        else {
                            this.log += `SmartyStreets could not determine the county: ${this.app.business.locations[0].address}, ${this.app.business.locations[0].city}, ${this.app.business.locations[0].state_abbr}, ${this.app.business.locations[0].zip}<br>`;
                        }
                        if (addressInfoResponse.hasOwnProperty("errorReason")) {
                            // If SmartyStreets returned a error reason, show that to the user
                            log.error(`AppId: ${this.app.id} Smarty Streets - Invalid business address: ${addressInfoResponse.errorReason}` + __location);
                            return this.client_error(`Invalid business address: ${addressInfoResponse.errorReason}`);
                        }
                        else {
                            // If not, show that it was unable to validate the address
                            log.error(`AppId: ${this.app.id} Smarty Streets - Invalid business address` + __location);
                            return this.client_error('Unable to validate address before submission.');
                        }
                    }
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
                else if (location.county?.length > 0 && !location.county?.toLowerCase().endsWith("county")) {
                    // Hiscox requires the word 'county' on the end of the county name
                    location.county += " county";
                }
                // "county" MUST be lower case. MUST.
                location.county = location.county?.replace("County", "county");

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
        this.secondaryLocationsCount = this.secondaryLocations?.length >= 5 ? "5+" : this.secondaryLocations?.length.toString();
        if(!this.secondaryLocationsCount){
            this.secondaryLocationsCount = 0;
        }

        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress = {AddrInfo: {}};
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.Addr1 = this.primaryLocation.address.substring(0,250);
        if (this.primaryLocation.address2){
            reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.Addr2 = this.primaryLocation.address2.substring(0,250);
        }
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.City = stringFunctions.capitalizeName(this.primaryLocation.city).substring(0,250);
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.StateOrProvCd = this.primaryLocation.territory;
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.PostalCode = this.primaryLocation.zip;
        if (this.primaryLocation.county){
            reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.County = this.primaryLocation.county.substring(0,250);
        }

        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs = {
            ApplicationRatingInfo: {},
            GeneralLiabilityQuoteRq: {}
        };

        const appDoc = this.applicationDocData;
        const experience = moment(appDoc.founded).format('YYYY-MM-DD');
        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.ApplicationRatingInfo.ProfessionalExperience = experience;

        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq = {};
        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.QuoteID = "";

        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.QuoteRqDt = moment().format('YYYY-MM-DD');

        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.StateOrProvCd = this.primaryLocation.territory;

        // Check and format the effective date (Hiscox only allows effective dates in the next 60 days, while Talage supports 90 days)
        if (this.policy.effective_date.isAfter(moment().startOf("day").add(60, "days"))) {
            this.reasons.push(`${this.insurer.name} does not support effective dates more than 60 days in the future`);
            return this.return_result("autodeclined");
        }
        this.effectiveDate = this.policy.effective_date.format("YYYY-MM-DD");
        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.CoverageStartDate = this.effectiveDate;

        // Set primary location
        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations = {Primary: {AddrInfo: {}}};

        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Primary.AddrInfo.Addr1 = this.primaryLocation.address.substring(0,250);
        if (this.primaryLocation.address2){
            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Primary.AddrInfo.Addr2 = this.primaryLocation.address2.substring(0,250);
        }
        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Primary.AddrInfo.City = stringFunctions.capitalizeName(this.primaryLocation.city).substring(0,250);
        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Primary.AddrInfo.StateOrProvCd = this.primaryLocation.territory;
        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Primary.AddrInfo.PostalCode = this.primaryLocation.zip;

        if (this.primaryLocation.county){
            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Primary.AddrInfo.County = this.primaryLocation.county.substring(0,250);
        }

        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Primary.AddrInfo.PostalCode = this.primaryLocation.zip;

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

        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Primary.AddrInfo.RatingInfo = {};

        if (appDoc.grossSalesAmt && appDoc.grossSalesAmt > 0){
            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Primary.AddrInfo.RatingInfo.EstimatedAnnualRevenue = appDoc.grossSalesAmt;
            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Primary.AddrInfo.RatingInfo.EstmtdPayrollExpense = this.totalPayroll;
        }

        if (this.primaryLocation.square_footage){
            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Primary.AddrInfo.RatingInfo.SquareFeetOccupiedByYou = this.primaryLocation.square_footage;
        }

        // Set request secondary locations
        if (this.secondaryLocationsCount > 0) {
            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Secondary = [];

            for (const secondaryLocation of this.secondaryLocations) {
                const location = {AddrInfo: {}};
                location.AddrInfo.Addr1 = secondaryLocation.address.substring(0,250);
                if (secondaryLocation.address2){
                    location.AddrInfo.Addr2 = secondaryLocation.address2.substring(0,250);
                }
                location.City = stringFunctions.capitalizeName(secondaryLocation.city).substring(0,250);
                location.StateOrProvCd = secondaryLocation.territory;
                location.PostalCode = secondaryLocation.zip;
                reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.Locations.Secondary.push(location);
            }
        }

        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.CoverQuoteRq = {
            RatingInfo: {
                AggLOI: this.bestLimits[1],
                LOI: this.bestLimits[0],
                Deductible: 0
            }
        };

        if (this.policy.type === 'GL') {
            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.RatingInfo = {};
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
                        const cob = await this.getHiscoxCOBFromDescription(cobDescription);
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

        // Add questions to JSON
        const applicationRatingInfoQuestions = [
            'AnEConstructionSrvcs',
            'AnEForbiddenProjects1',
            'ChiroPhysicalTherapy',
            'ConsultantEligibilitySafety',
            'EventPlanningSrvcs',
            'ForbiddenProjects3',
            'ForbiddenProjects5',
            'ForbiddenProjectsMSR',
            'MSRBranchesOPS',
            'MSRIndpntCtrctr',
            'MSRInvntry',
            'PMRealEstateServices',
            'ProfessionalExperience',
            'ProfessLicensesHealthSrvcs',
            'PrptyMgrHotelHealthcare',
            'PrptyMgrRenovation',
            'PrptyMgrServices1',
            'PrptyMgrServices2',
            'PrsnlTrnYogaInstrc',
            'RealEstateServices1',
            'RealEstateServices2',
            'REPropManServices',
            'SafetyForbiddenProjects',
            'SimilarInsurance',
            'SpaOwnership',
            'SubcontractDesign',
            'SubcontractInsurance',
            'SubcontractOtherSrvcs',
            'SubcontractProfSrvcs',
            'SubcontractRepair',
            'SubcontractSrvcsDescribe',
            'SupplyManufactDistbtGoodsOrProductsPercent3',
            'SupplyManufactDistbtGoodsOrProductsWebsite2',
            'SupplyManufactDistbtGoodsOrProductsWebsite4',
            'TangibleGoodWork',
            'TangibleGoodWorkDescribe',
            'TangibleGoodWorkTradesmen',
            'TrainingEligibility' ,
            'TrainingEligibility1'
        ];

        const generalLiabilityRatingInfoQuestions = [
            'BeautyServices2GL',
            'ConsultantEligibilityConGLBOP',
            'ConsultantEligibilityEDUGLBOP',
            'ConsultantEligibilityHRGLBOP',
            'EstmtdPayrollSC',
            'ForbiddenProjectsJanitorial',
            'ForbiddenProjectsJanitorial1',
            'ForbiddenProjectsLandscapers',
            'ForbiddenProjectsRetail',
            'HomeHealthForbiddenSrvcs',
            'MarketingEligibilityGLBOP',
            'MFSForbiddenProducts',
            'MFSForbiddenServices',
            'MobileEquipExcludedSnowBlowing',
            'OperatedFromHome',
            'PCEligibilityGLBOP',
            'ResearchConsultingEligibilityGLBOP',
            'SCForbiddenProjects',
            'SecondaryCOBSmallContractors',
            'SpaOwnership2',
            'SpaOwnership3',
            'SupplyManufactDistbtGoodsOrProducts',
            'SupplyManufactDistbtGoodsOrProducts2',
            'SupplyManufactDistbtGoodsOrProductsAandE',
            'SupplyManufactDistbtGoodsOrProductsActivity1',
            'SupplyManufactDistbtGoodsOrProductsActivity2',
            'SupplyManufactDistbtGoodsOrProductsAssocWebsite',
            'SupplyManufactDistbtGoodsOrProductsDescribe',
            'SupplyManufactDistbtGoodsOrProductsDescribe1',
            'SupplyManufactDistbtGoodsOrProductsDescribeAandE',
            'SupplyManufactDistbtGoodsOrProductsDetailProcedures',
            'SupplyManufactDistbtGoodsOrProductsDetailProcedures1',
            'SupplyManufactDistbtGoodsOrProductsDetailRecalls',
            'SupplyManufactDistbtGoodsOrProductsDetailRecalls1',
            'SupplyManufactDistbtGoodsOrProductsDetailRecallsDescribe',
            'SupplyManufactDistbtGoodsOrProductsDetailRecallsDescribe1',
            'SupplyManufactDistbtGoodsOrProductsLimited',
            'SupplyManufactDistbtGoodsOrProductsLimitedPhoto',
            'SupplyManufactDistbtGoodsOrProductsManOthers',
            'SupplyManufactDistbtGoodsOrProductsManufactured',
            'SupplyManufactDistbtGoodsOrProductsManufacturedDescribe',
            'SupplyManufactDistbtGoodsOrProductsManWhere',
            'SupplyManufactDistbtGoodsOrProductsManWhere1',
            'SupplyManufactDistbtGoodsOrProductsOwnership',
            'SupplyManufactDistbtGoodsOrProductsPercent',
            'SupplyManufactDistbtGoodsOrProductsPercent1',
            'SupplyManufactDistbtGoodsOrProductsPercent2',
            'SupplyManufactDistbtGoodsOrProductsPercent4',
            'SupplyManufactDistbtGoodsOrProductsProceduresDescribe',
            'SupplyManufactDistbtGoodsOrProductsProceduresDescribe1',
            'SupplyManufactDistbtGoodsOrProductsUsed',
            'SupplyManufactDistbtGoodsOrProductsUsed1',
            'SupplyManufactDistbtGoodsOrProductsUsed2',
            'SupplyManufactDistbtGoodsOrProductsWebsite',
            'SupplyManufactDistbtGoodsOrProductsWebsite1',
            'SupplyManufactDistbtGoodsOrProductsWebsite5',
            'SupplyManufactDistbtGoodsOrProductsWhoManu',
            'SupplyManufactDistbtGoodsOrProductsWhoManu1',
            'TangibleGoodWork1',
            'TangibleGoodWorkDescribe1',
            'TangibleGoodWorkIT',
            'TangibleGoodWorkTradesmen1',
            'TechSpclstActvty'
        ];
        for (const question of this.questionList) {
            if (applicationRatingInfoQuestions.includes(question.nodeName)) {
                this.log_debug(`Application Rating Info Question: ${JSON.stringify(question, null, 4)}`);
                reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.ApplicationRatingInfo[question.nodeName] = question.answer;
            }
            if (this.policy.type === 'GL' && generalLiabilityRatingInfoQuestions.includes(question.nodeName)) {
                this.log_debug(`General Liability Rating Info Question: ${JSON.stringify(question, null, 4)}`);
                switch (question.nodeName) {
                    case 'BeautyServices2GL':
                        // zy TODO HACK - Hardcoding this just to get a quote through. This needs to change to use the actual question answers
                        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.RatingInfo[question.nodeName] = {NoneOfTheAbove: "Yes"};
                        break;
                    default:
                        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.RatingInfo[question.nodeName] = question.answer;
                        break;
                }
            }
        }

        this.log_debug(`Question List ${JSON.stringify(this.questionList, null, 4)}`);
        if (this.policy.type === 'GL') {
            const triaQuestion = this.questionList.find(question => question.nodeName === 'GeneralLiabilityTriaAgreeContent');
            if (triaQuestion && triaQuestion.answer === 'Yes') {
                reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.TRIACoverQuoteRq = {CoverId: 'TRIA'};
            }
            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.TRIACoverQuoteRq = {CoverId: 'TRIA'}; // zy debug remove

            // zy TODO Put only questions in each element that actually belong there. Base on list of element names from the XSD
            // for (const question of this.questionList) {
            //     reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.RatingInfo[question.nodeName] = question.answer;
            // }

            // Add additional COBs to JSON if necessary  // zy Validate that this is still necessary in request
            if (this.additionalCOBs?.length > 0) {
                reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.RatingInfo.SecondaryCOBSmallContractors = [];
                for (const additionalCOB of this.additionalCOBs){
                    reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.RatingInfo.SecondaryCOBSmallContractors.push(additionalCOB);
                }
            }

            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.ProductAcknowledgements = {
                "CGLStatement1": "Agree",
                "ExcludedActivities": "Agree"
            };
        }

        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements = {
            "BusinessOwnership": {"BusinessOwnership": "Agree"},
            "InsuranceDecline": {"InsuranceDecline": "Agree"},
            "MergerAcquisitions": {"MergerAcquisition": "Agree"},
            "AgreeDisagreeStatements": "Agree",
            "ApplicationAgreementStatement": "Agree",
            "ApplicantAuthorized": "Agree",
            "ClaimsAgainstYou": {"ClaimsAgainstYou": "Agree"},
            "DeductibleStatement": "Agree",
            "EmailConsent": "Agree",
            "EmailConsent2": "Agree",
            "EmailDeliveryStatement": "Agree",
            "FraudWarning": "Agree",
            "HiscoxStatement": "Agree",
            "InformationConfirmAgreement": "Agree",
            "StateSpcfcFraudWarning": "Agree"
        }

        // Render the template into XML and remove any empty lines (artifacts of control blocks)
        // let xml = null;
        // try {
        //     xml = hiscoxGLTemplate.render(this, {ucwords: (val) => stringFunctions.ucwords(val.toLowerCase())}).replace(/\n\s*\n/g, "\n");
        // }
        // catch (error) {
        //     return this.client_error('An unexpected error occurred when creating the quote request.', __location, {error: "Could not render template file"});
        // }

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
        const path = "/partner/v4/quote";

        this.log_info(`Sending application to https://${host}${path}. This can take up to 30 seconds.`, __location);

        this.log_debug(`Request: ${JSON.stringify(reqJSON, null, 4)}`, __location);
        // Send the JSON to the insurer
        let result = null;
        let requestError = null;
        try {
            result = await this.send_json_request(host, path, JSON.stringify(reqJSON), {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json"
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

    /**
     * Gets the Hiscox COB code based on the COB description
     * @param  {string} cobDescription - description of the COB
     * @returns {string} COB code
     */
    async getHiscoxCOBFromDescription(cobDescription) {
        const hiscoxCodeSvc = require('./hiscoxcodesvc.js');
        const result = hiscoxCodeSvc.getByDesc(cobDescription);
        if (result) {
            return result.code;
        }
        else {
            return null;
        }
    }
};