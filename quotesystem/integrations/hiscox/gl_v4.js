/* eslint-disable array-element-newline */
/**
 * General Liability Integration for Hiscox
 */

"use strict";

const Integration = require("../Integration.js");
const moment = require("moment");
const momentTimezone = require("moment-timezone");
const stringFunctions = global.requireShared("./helpers/stringFunctions.js"); // eslint-disable-line no-unused-vars
const smartystreetSvc = global.requireShared('./services/smartystreetssvc.js');
const InsurerIndustryCodeBO = global.requireShared('./models/InsurerIndustryCode-BO.js');
const InsurerQuestionBO = global.requireShared('./models/InsurerQuestion-BO.js');

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
        // let carrierLimits = ["300000/600000", "500000/1000000", "1000000/2000000", "2000000/2000000"]; // zy debug determine whether this is still needed

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
            // carrierLimits = ["300000/300000", "500000/500000", "1000000/2000000", "2000000/2000000"]; // zy determine if this is still needed
        }
        this.log_debug(`Insurer Industry Code: ${JSON.stringify(this.insurerIndustryCode, null, 4)}`); // zy debug remove

        // Look up the insurer industry code, make sure we got a hit.
        // If it's BOP, check if the code we have is used for BOP,
        // if not lookup the policy.bopCode
        if (this.policy.type === 'BOP') {
            if (!this.insurerIndustryCode.attributes.codeIsUsedForBOP) {
                const policyEffectiveDate = moment(this.policy.effective_date).format('YYYY-MM-DD HH:mm:ss');
                const bopCodeQuery = {
                    active: true,
                    territoryList: this.applicationDocData.mailingState,
                    policyTypeList: 'BOP',
                    effectiveDate: {$lte: policyEffectiveDate},
                    expirationDate: {$gte: policyEffectiveDate}
                }
                const bopPolicy = this.applicationDocData.policies.find((p) => p.policyType === "BOP")
                if(bopPolicy && bopPolicy.bopIndustryCodeId){
                    bopCodeQuery.talageIndustryCodeIdList = bopPolicy.bopIndustryCodeId;
                }
                try {
                    const insurerIndustryCodeBO = new InsurerIndustryCodeBO();
                    const insurerIndustryCodeList = await insurerIndustryCodeBO.getList(bopCodeQuery);
                    if(insurerIndustryCodeList && insurerIndustryCodeList.length > 0){
                        const insurerIndustryCode = insurerIndustryCodeList[0];
                        this.insurerIndustryCode = insurerIndustryCode;
                        this.industry_code = JSON.parse(JSON.stringify(insurerIndustryCode));
                        this.log_debug(`Insurer Industry Code used for BOP: ${JSON.stringify(this.insurerIndustryCode, null, 4)}`); // zy debug remove
                    }
                    else {
                        this.industry_code = null;
                        if (this.requiresInsurerIndustryCodes) {
                            this.reasons.push("An insurer industry class code was not found for the given industry and territory.");
                            log.warn(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} _insurer_supports_industry_codes required insurer mapping for this industry code was not found. query ${JSON.stringify(bopCodeQuery)} ` + __location);
                            return this.client_error(`An insurer industry class code was not found for the given industry and territory.`);
                        }
                    }

                }
                catch (err) {
                    this.log_error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Problem getting insurer industry code: ${err} ${__location}`);
                    return this.client_error(`Trouble retrieving insurer industry class code.`)
                }
            }

        }
        this.log_debug(`This.policy: ${JSON.stringify(this.policy, null, 4)}`); // zy debug remove

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
        // ***** Anyway, limits needs to be revisited and set correctly
        this.bestLimits = ['1000000', '1000000'];
        // this.bestLimits = this.getBestLimits(carrierLimits);
        // if (!this.bestLimits) {
        //     this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
        //     return this.return_result("autodeclined");
        // }


        // Make a local copy of locations so that any Hiscox specific changes we make don't affect other integrations
        const locations = [...this.applicationDocData.locations];

        // Hiscox requires a county be supplied in three states, in all other states, remove the county
        for (const location of locations) {
            if (["FL", "MO", "TX"].includes(location.territory)) {
                // Hiscox requires a county in these states
                if (location.county) {
                    const addressInfoResponse = await smartystreetSvc.checkAddress(this.app.business.locations[0].address,
                        location.city,
                        location.state,
                        location.zipcode);
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
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.PostalCode = this.primaryLocation.zipcode;
        if (this.primaryLocation.county){
            reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.County = this.primaryLocation.county.substring(0,250);
        }

        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs = {ApplicationRatingInfo: {}};

        const appDoc = this.applicationDocData;
        const experience = moment(appDoc.founded).format('YYYY-MM-DD');
        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.ApplicationRatingInfo.ProfessionalExperience = experience;
        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.ApplicationRatingInfo.SupplyManufactDistbtGoodsOrProductsPercent3 = 0; // zy debug fix hard-coded value. Need to add this as a question

        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements = {};

        // Check and format the effective date (Hiscox only allows effective dates in the next 60 days, while Talage supports 90 days)
        if (this.policy.effective_date.isAfter(moment().startOf("day").add(60, "days"))) {
            this.reasons.push(`${this.insurer.name} does not support effective dates more than 60 days in the future`);
            return this.return_result("autodeclined");
        }

        this.effectiveDate = this.policy.effective_date.format("YYYY-MM-DD");

        let questionDetails = null;
        try {
            questionDetails = await this.get_question_details();
        }
        catch (error) {
            this.log_error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Unable to get question identifiers or details: ${error}`, __location);
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

        const sharedQuoteRqStructure = {};
        sharedQuoteRqStructure.QuoteID = "";

        sharedQuoteRqStructure.QuoteRqDt = moment().format('YYYY-MM-DD');

        sharedQuoteRqStructure.StateOrProvCd = this.primaryLocation.territory;

        sharedQuoteRqStructure.CoverageStartDate = this.effectiveDate;

        // Set primary location
        sharedQuoteRqStructure.Locations = {Primary: {AddrInfo: {}}};

        sharedQuoteRqStructure.Locations.Primary.AddrInfo.Addr1 = this.primaryLocation.address.substring(0,250);
        if (this.primaryLocation.address2){
            sharedQuoteRqStructure.Locations.Primary.AddrInfo.Addr2 = this.primaryLocation.address2.substring(0,250);
        }
        sharedQuoteRqStructure.Locations.Primary.AddrInfo.City = stringFunctions.capitalizeName(this.primaryLocation.city).substring(0,250);
        sharedQuoteRqStructure.Locations.Primary.AddrInfo.StateOrProvCd = this.primaryLocation.territory;
        sharedQuoteRqStructure.Locations.Primary.AddrInfo.PostalCode = this.primaryLocation.zipcode;

        if (this.primaryLocation.county){
            sharedQuoteRqStructure.Locations.Primary.AddrInfo.County = this.primaryLocation.county.substring(0,250);
        }

        sharedQuoteRqStructure.Locations.Primary.AddrInfo.PostalCode = this.primaryLocation.zipcode;

        sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo = {};

        if (appDoc.grossSalesAmt && appDoc.grossSalesAmt > 0){
            sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.EstimatedAnnualRevenue = appDoc.grossSalesAmt;
            sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.EstmtdPayrollExpense = this.totalPayroll;
        }

        if (this.primaryLocation.square_footage){
            sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.SquareFeetOccupiedByYou = this.primaryLocation.square_footage;
        }

        // Set request secondary locations
        if (this.secondaryLocationsCount > 0) {
            sharedQuoteRqStructure.Locations.Secondary = [];

            for (const secondaryLocation of this.secondaryLocations) {
                const location = {AddrInfo: {}};
                location.AddrInfo.Addr1 = secondaryLocation.address.substring(0,250);
                if (secondaryLocation.address2){
                    location.AddrInfo.Addr2 = secondaryLocation.address2.substring(0,250);
                }
                location.City = stringFunctions.capitalizeName(secondaryLocation.city).substring(0,250);
                location.StateOrProvCd = secondaryLocation.territory;
                location.PostalCode = secondaryLocation.zipcode;
                sharedQuoteRqStructure.Locations.Secondary.push(location);
            }
        }

        sharedQuoteRqStructure.CoverQuoteRq = {RatingInfo: {
            AggLOI: this.bestLimits[1],
            LOI: this.bestLimits[0],
            Deductible: 0
        }};

        if (this.policy.type === 'GL') {
            const generalLiabilityQuoteRq = sharedQuoteRqStructure;


            generalLiabilityQuoteRq.RatingInfo = {};
            // zy debug fix hard-coded values
            generalLiabilityQuoteRq.RatingInfo.SCForbiddenProjects = {NoneOfTheAbove: 'Yes'}; // zy debug fix hard-coded value

            generalLiabilityQuoteRq.ProductAcknowledgements = {
                "CGLStatement1": "Agree",
                "ExcludedActivities": "Agree"
            };

            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq = generalLiabilityQuoteRq;
        }

        if (this.policy.type === 'BOP') {
            const bopQuoteRq = sharedQuoteRqStructure

            bopQuoteRq.Locations.Primary.AddrInfo.RatingInfo.ReplacementCost = this.primaryLocation.buildingLimit;
            bopQuoteRq.Locations.Primary.AddrInfo.RatingInfo.BsnsPrsnlPropertyLimit = this.getHiscoxBusinessPersonalPropertyLimit(this.primaryLocation.businessPersonalPropertyLimit);
            bopQuoteRq.Locations.Primary.AddrInfo.RatingInfo.AgeOfBldng = this.primaryLocation.yearBuilt;
            bopQuoteRq.Locations.Primary.AddrInfo.RatingInfo.BuildingConstruction = this.primaryLocation.constructionType;
            bopQuoteRq.Locations.Primary.AddrInfo.RatingInfo.NumOfStoriesInBldng = this.primaryLocation.numStories >= 4 ? '4 or more' : this.primaryLocation.numStories;

            // zy HACK Fix these hard-coded values
            bopQuoteRq.Locations.Primary.AddrInfo.RatingInfo.Roof = 'Metal'; // zy debug fix hard-coded value
            bopQuoteRq.Locations.Primary.AddrInfo.RatingInfo.StrctrlAlterationsPlan = 'No'; // zy debug fix hard-coded value
            bopQuoteRq.Locations.Primary.AddrInfo.RatingInfo.MultipleOccupants = 'No'; // zy debug fix hard-coded value
            bopQuoteRq.Locations.Primary.AddrInfo.RatingInfo.Basement = 'None'; // zy debug fix hard-coded value

            bopQuoteRq.RatingInfo = {};
            bopQuoteRq.ProductAcknowledgements = {
                DisciplinaryActionAcknowledgements: {},
                PropertyLossIncurredAcknowledgements: {}
            };

            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.BusinessOwnersPolicyQuoteRq = bopQuoteRq;
        }


        this.log_debug(`Begin this.questions: ${JSON.stringify(this.questions, null, 4)} End this.questions`); // zy debug remove
        // Add questions
        this.questionList = [];
        this.additionalCOBs = [];
        for (const question of Object.values(this.questions)) {
            let questionAnswer = this.determine_question_answer(question, question.required);
            let elementName = questionDetails[question.id].attributes.elementName;
            if (questionAnswer !== false) {
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
                else if (elementName === 'SecondaryCOBSmallContractors') {
                    const cobDescriptionList = questionAnswer.split(", ");
                    const insurerIndustryCodeBO = new InsurerIndustryCodeBO();
                    for (const cobDescription of cobDescriptionList) {
                        const cobDescQuery = {
                            active: true,
                            insurerId: this.insurer.id,
                            description: cobDescription
                        }
                        let cob = null;
                        try {
                            cob = await insurerIndustryCodeBO.getList(cobDescQuery);
                        }
                        catch (err) {
                            this.log_error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Problem getting insurer industry code: ${err} ${__location}`);
                        }
                        if (!cob || cob.length === 0) {
                            this.log_warn(`Could not locate COB code for COB description '${cobDescription}'`, __location);
                            continue;
                        }
                        this.additionalCOBs.push(cob[0].attributes.v4Code);
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
                let attributes = null;
                if (question.type === 'Checkboxes') {
                    // Checkbox questions require that each checked answer turns into another object property underneath the main question property
                    // The code here grabs the attributes from the insurer question to map the question answer text to the element name expected by Hiscox
                    const insurerQuestionBO = new InsurerQuestionBO();
                    const insurerQuestionQuery = {
                        active: true,
                        talageQuestionId: question.id
                    };
                    let insurerQuestionList = null;
                    try {
                        insurerQuestionList = await insurerQuestionBO.getList(insurerQuestionQuery);
                    }
                    catch (err) {
                        this.log_error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Problem getting associated insurer question for talage question ID ${question.id} ${__location}`);
                    }
                    if (!insurerQuestionList || insurerQuestionList.length === 0) {
                        this.log_error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Did not find insurer question linked to talage question id ${question.id}. This can stop us from putting correct properties into request ${__location}`);
                        continue;
                    }
                    if (!insurerQuestionList[0].attributes) {
                        this.log_error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} No attributes present on insurer question: ${insurerQuestionList[0].identifier}: ${insurerQuestionList[0].text} ${__location}`)
                        continue;
                    }
                    attributes = insurerQuestionList[0].attributes;
                }
                this.questionList.push({
                    nodeName: elementName,
                    answer: questionAnswer,
                    attributes: attributes,
                    type: question.type
                });
            }
            else if (question.type === 'Checkboxes' && !questionAnswer) {
                this.questionList.push({
                    nodeName: elementName,
                    answer: '',
                    attributes: null,
                    type: question.type
                })
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

        const BOPRatingInfoQuestions = [
            "BeautyServices2BOP",
            "CargoLimitOfLiability",
            "ConsultantEligibilityEnvBOP",
            "ConsultantEligibilityConGLBOP",
            "ConsultantEligibilityEDUGLBOP",
            "ConsultantEligibilityHRGLBOP",
            "EstmtdPayrollSC",
            "ForbiddenProjects",
            "ForbiddenProjects2",
            "ForbiddenProjects4",
            "ForbiddenProjectsJanitorial1",
            "ForbiddenProjectsJanitorial2",
            "ForbiddenProjectsLandscapers",
            "ForbiddenProjectsRetail",
            "HomeHealthForbiddenSrvcs",
            "MarketingEligibilityGLBOP",
            "MFSForbiddenProducts",
            "MFSForbiddenProductsBOP",
            "MFSForbiddenServices",
            "MFSForbiddenServices1",
            "MobileEquipExcludedSnowBlowing",
            "NumofCargoVehicles",
            "PCEligibilityGLBOP",
            "PetSrvs",
            "PrinterSrvs",
            "ResearchConsultingEligibilityGLBOP",
            "RetailSrvs",
            "SCForbiddenProjects",
            "SpaOwnership2",
            "SpaOwnership3",
            "SupplyManufactDistbtGoodsOrProducts",
            "SupplyManufactDistbtGoodsOrProducts2",
            "SupplyManufactDistbtGoodsOrProductsAandE",
            "SupplyManufactDistbtGoodsOrProductsActivity1",
            "SupplyManufactDistbtGoodsOrProductsActivity2",
            "SupplyManufactDistbtGoodsOrProductsAssocWebsite",
            "SupplyManufactDistbtGoodsOrProductsDescribe",
            "SupplyManufactDistbtGoodsOrProductsDescribe1",
            "SupplyManufactDistbtGoodsOrProductsDescribeAandE",
            "SupplyManufactDistbtGoodsOrProductsDetailProcedures",
            "SupplyManufactDistbtGoodsOrProductsDetailProcedures1",
            "SupplyManufactDistbtGoodsOrProductsDetailRecalls",
            "SupplyManufactDistbtGoodsOrProductsDetailRecalls1",
            "SupplyManufactDistbtGoodsOrProductsDetailRecallsDescribe",
            "SupplyManufactDistbtGoodsOrProductsDetailRecallsDescribe1",
            "SupplyManufactDistbtGoodsOrProductsLimited",
            "SupplyManufactDistbtGoodsOrProductsLimitedPhoto",
            "SupplyManufactDistbtGoodsOrProductsManOthers",
            "SupplyManufactDistbtGoodsOrProductsManufactured",
            "SupplyManufactDistbtGoodsOrProductsManufacturedDescribe",
            "SupplyManufactDistbtGoodsOrProductsManWhere",
            "SupplyManufactDistbtGoodsOrProductsManWhere1",
            "SupplyManufactDistbtGoodsOrProductsOwnership",
            "SupplyManufactDistbtGoodsOrProductsPercent",
            "SupplyManufactDistbtGoodsOrProductsPercent1",
            "SupplyManufactDistbtGoodsOrProductsPercent2",
            "SupplyManufactDistbtGoodsOrProductsProceduresDescribe",
            "SupplyManufactDistbtGoodsOrProductsProceduresDescribe1",
            "SupplyManufactDistbtGoodsOrProductsUsed",
            "SupplyManufactDistbtGoodsOrProductsUsed1",
            "SupplyManufactDistbtGoodsOrProductsUsed2",
            "SupplyManufactDistbtGoodsOrProductsWebsite",
            "SupplyManufactDistbtGoodsOrProductsWebsite1",
            "SupplyManufactDistbtGoodsOrProductsWebsite3",
            "SupplyManufactDistbtGoodsOrProductsWhoManu",
            "SupplyManufactDistbtGoodsOrProductsWhoManu1",
            "TangibleGoodPctCustService",
            "TangibleGoodWork1",
            "TangibleGoodWorkDescribe1",
            "TangibleGoodWorkIT",
            "TangibleGoodWorkTradesmen1",
            "TechSpclstActvty"
        ];

        const acknowledgementElements = [
            "BusinessOwnership",
            "InsuranceDecline",
            "MergerAcquisitions",
            "AgreeDisagreeStatements",
            "ApplicationAgreementStatement",
            "ApplicantAuthorized",
            "ClaimsAgainstYou",
            "DeductibleStatement",
            "EmailConsent",
            "EmailConsent2",
            "EmailDeliveryStatement",
            "FraudWarning",
            "HiscoxStatement",
            "InformationConfirmAgreement",
            "StateSpcfcFraudWarning"
        ];

        const glProductAcknowledgementElements = [
            "CGLStatement1",
            "ExcludedActivities"
        ];

        const bopProductAcknowledgementElements = [
            "BOPStatement1",
            "ExcludedActivities",
            "Flood"
        ];
        const bopDisciplinaryActionAcknowledgements = [
            "DisciplinaryActionCrime",
            "DisciplinaryActionBankruptcy",
            "DisciplinaryActionForeclosure"
        ];
        const bopPropertyLossIncurredAcknowledgements = [
            "PropertyLossIncurred",
            "PropertyLossIncurredDesc",
            "PropertyLossIncurredDate",
            "PropertyLossIncurredAmount",
            "PropertyLossIncurredResolved",
            "PropertyLossIncurredAvoid"
        ]

        let policyRequestType = null;
        if (this.policy.type === 'GL') {
            policyRequestType = 'GeneralLiabilityQuoteRq';
        }
        else if (this.policy.type === 'BOP'){
            policyRequestType = 'BusinessOwnersPolicyQuoteRq';
        }

        for (const question of this.questionList) {
            if (applicationRatingInfoQuestions.includes(question.nodeName)) {
                if (question.type === 'Checkboxes') {
                    // Get the element names from the attributes for each answer that was checked and build the object
                    // with each element as an object property under the parent property
                    const questionElementObj = {};
                    if (!question.answer) {
                        questionElementObj.NoneOfTheAbove = "Yes";
                    }
                    else {
                        const answers = question.answer.split(', ');
                        const possibleAnswers = question.attributes.answersToElements;
                        for (const [possibleAnswer, subElementName] of Object.entries(possibleAnswers)){
                            if (answers.includes(possibleAnswer)){
                                questionElementObj[subElementName] = 'Yes';
                            }
                            else {
                                questionElementObj[subElementName] = 'No';
                            }
                        }
                    }
                    reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.ApplicationRatingInfo[question.nodeName] = questionElementObj;
                }
                else {
                    reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.ApplicationRatingInfo[question.nodeName] = question.answer;
                }
                if (this.policy.type === 'BOP' && question.nodeName === 'TangibleGoodWork') {
                    // TangibleGoodWork1 shares an answer with TangibleGoodWork but when we have two questions linked to the same Talage Question
                    // we only get one answer. This fixes that issue
                    reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs[policyRequestType].RatingInfo.TangibleGoodWork1 = question.answer; // zy Possibly refactor this if we can get the answer to both questions from the application
                }
            }
            const glRatingQuestion = this.policy.type === 'GL' && generalLiabilityRatingInfoQuestions.includes(question.nodeName);
            const bopRatingQuestion = this.policy.type === 'BOP' && BOPRatingInfoQuestions.includes(question.nodeName);
            if (glRatingQuestion || bopRatingQuestion) {
                if (question.nodeName === "SupplyManufactDistbtGoodsOrProductsOwnership") {
                    reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs[policyRequestType].RatingInfo[question.nodeName] = question.answer === 'No' ? 'My business does this' : 'A third-party does this';
                }
                else if (question.type === 'Checkboxes') {
                    // Get the element names from the attributes for each answer that was checked and build the object
                    // with each element as an object property under the parent property
                    const questionElementObj = {};
                    if (!question.answer) {
                        questionElementObj.NoneOfTheAbove = "Yes";
                    }
                    else {
                        const answers = question.answer.split(', ');
                        const possibleAnswers = question.attributes.answersToElements;
                        for (const [possibleAnswer, subElementName] of Object.entries(possibleAnswers)){
                            if (answers.includes(possibleAnswer)){
                                questionElementObj[subElementName] = 'Yes';
                            }
                            else {
                                questionElementObj[subElementName] = 'No';
                            }
                        }
                    }
                    reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs[policyRequestType].RatingInfo[question.nodeName] = questionElementObj;
                }
                else {
                    reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs[policyRequestType].RatingInfo[question.nodeName] = question.answer;
                }
            }

            if (question.nodeName === 'TriaAgreeContent' && question.answer === 'Yes') {
                reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs[policyRequestType].TRIACoverQuoteRq = {CoverId: 'TRIA'};
            }

            // Acknowledgements
            if (acknowledgementElements.includes(question.nodeName)) {
                if (['BusinessOwnership','InsuranceDecline','ClaimsAgainstYou'].includes(question.nodeName)) {
                    // Some acknowledgements elements have a structure like this -> "BusinessOwnership": {"BusinessOwnership": "Agree"},
                    reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements[question.nodeName] = {};
                    if (question.nodeName === 'InsuranceDecline') {
                        // Need to 'No' for 'Disagree' on this one
                        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements[question.nodeName][question.nodeName] = question.answer === 'No' ? 'Agree' : 'Disagree';
                    }
                    else {
                        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements[question.nodeName][question.nodeName] = question.answer === 'Yes' ? 'Agree' : 'Disagree';
                    }
                }
                else if (question.nodeName === 'MergerAcquisitions') {
                    reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements[question.nodeName] = {'MergerAcquisition': question.answer === 'No' ? 'Agree' : 'Disagree'};
                }
                else {
                    reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements[question.nodeName] = question.answer === 'Yes' ? 'Agree' : 'Disagree';
                }
            }

            // Product Acknowledgements
            if (this.policy.type === 'BOP') {
                if (bopDisciplinaryActionAcknowledgements.includes(question.nodeName)) {
                    if (question.nodeName === 'DisciplinaryActionBankruptcy' || question.nodeName === 'DisciplinaryActionCrime') {
                        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs[policyRequestType].ProductAcknowledgements.DisciplinaryActionAcknowledgements[question.nodeName] = question.answer === 'No' ? 'Agree' : 'Disagree';
                    }
                    else {
                        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs[policyRequestType].ProductAcknowledgements.DisciplinaryActionAcknowledgements[question.nodeName] = question.answer === 'Yes' ? 'Agree' : 'Disagree';
                    }
                }
                else if (bopPropertyLossIncurredAcknowledgements.includes(question.nodeName)) {
                    reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs[policyRequestType].ProductAcknowledgements.PropertyLossIncurredAcknowledgements[question.nodeName] = question.answer === 'Yes' ? 'Agree' : 'Disagree';
                }
                else if (bopProductAcknowledgementElements.includes(question.nodeName)) {
                    reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs[policyRequestType].ProductAcknowledgements[question.nodeName] = question.answer === 'Yes' ? 'Agree' : 'Disagree';
                }
            }

            if (this.policy.type === 'GL' && glProductAcknowledgementElements.includes(question.nodeName)) {
                reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs[policyRequestType].ProductAcknowledgements[question.nodeName] = question.answer === 'Yes' ? 'Agree' : 'Disagree';
            }
        }
        // // zy HACK Get these from questions
        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements.AgreeDisagreeStatements = "Agree";
        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements.ApplicationAgreementStatement = "Agree";
        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements.DeductibleStatement = "Agree";
        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements.EmailDeliveryStatement = "Agree";
        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements.FraudWarning = "Agree";
        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements.HiscoxStatement = "Agree";
        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements.InformationConfirmAgreement = "Agree";
        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements.StateSpcfcFraudWarning = "Agree";

        // zy HACK get these from questions
        if (this.policy.type === 'BOP') {
            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.BusinessOwnersPolicyQuoteRq.ProductAcknowledgements.BOPStatement1 = 'Agree';
            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.BusinessOwnersPolicyQuoteRq.ProductAcknowledgements.ExcludedActivities = 'Agree';
        }

        // zy HACKS Remove this assignment of TRIACoverQuoteRq. Handle it in the question loop above
        if (this.policy.type === 'GL') {
            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.TRIACoverQuoteRq = {CoverId: 'TRIA'}; // zy debug remove
        }
        if (this.policy.type === 'BOP') {
            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.BusinessOwnersPolicyQuoteRq.TRIACoverQuoteRq = {CoverId: 'TRIA'}; // zy HACK debug remove
        }

        this.log_debug(`Question List ${JSON.stringify(this.questionList, null, 4)}`);

        if (this.policy.type === 'GL'){
            // Add additional COBs to JSON if necessary
            if (this.additionalCOBs?.length > 0) {
                reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.RatingInfo.SecondaryCOBSmallContractors = [];
                for (const additionalCOB of this.additionalCOBs){
                    reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.RatingInfo.SecondaryCOBSmallContractors.push({'ClassOfBusinessCd': additionalCOB});
                }
            }
            else {
                reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq.RatingInfo.SecondaryCOBSmallContractors = {ClassOfBusinessCd: 'None of the above'};
            }

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
        const path = "/partner/v4/quote";

        this.log_info(`Sending application to https://${host}${path}. This can take up to 30 seconds.`, __location);

        this.log_debug(`Request: ${JSON.stringify(reqJSON, null, 4)}`, __location); // zy debug remove
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

        let policyResponseType = null;
        if (this.policy.type === 'GL') {
            policyResponseType = 'GeneralLiabilityQuoteRs';
        }
        if (this.policy.type === 'BOP') {
            policyResponseType = 'BusinessOwnersPolicyQuoteRs';
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

            const response = JSON.parse(requestError.response);
            // Check for errors
            const responseErrors = response?.ProductQuoteRs?.[policyResponseType]?.Errors;
            this.log_debug(`Response Errors: ${responseErrors}`);
            let errorResponseList = null;
            if (responseErrors && !responseErrors.length) {
                // If responseErrors is just an object, make it an array
                errorResponseList = [responseErrors];
            }
            else {
                errorResponseList = responseErrors;
            }

            if (errorResponseList) {
                let errors = "";
                for (const errorResponse of errorResponseList) {
                    if (errorResponse.Code && errorResponse.Description) {
                        if (errorResponse === "Declination") {
                            // Return an error result
                            return this.client_declined(`${errorResponse.Code}: ${errorResponse.Description}`);
                        }
                        else {
                            // Non-decline error
                            const reason = `${errorResponse.Description} (${errorResponse.Code})`;
                            errors += (errors.length ? ", " : "") + reason;
                        }
                    }
                }
                return this.client_error(`The Hiscox server returned the following errors: ${errors}`, __location);
            }
            // Check for validation errors
            let validationErrorList = null;
            const validations = response.InsuranceSvcRs?.QuoteRs?.Validations?.Validation;
            this.log_debug(`Validations: ${JSON.stringify(validations, null, 4)}`);
            if (validations && !validations.length) {
                // if validation is just an object, make it an array
                validationErrorList = [validations];
            }
            else {
                validationErrorList = validations;
            }
            this.log_debug(`Validations Error List: ${JSON.stringify(validationErrorList, null, 4)}`);

            if (validationErrorList && validationErrorList.length > 0) {
                // Loop through and capture each validation message
                let validationMessage = "Validation errors: ";
                for (const validationError of validationErrorList) {
                    validationMessage += `${validationError.Status} (${validationError.DataItem}) at ${validationError.XPath}, `;
                }
                return this.client_error(validationMessage, __location, {validationErrorList: validationErrorList});
            }
            // Check for a fault string (unknown node name)
            const faultString = response?.fault?.faultstring;
            this.log_debug(`Fault String: ${JSON.stringify(response, null, 4)}`);
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
        const loi = result?.InsuranceSvcRs?.QuoteRs?.ProductQuoteRs?.[policyResponseType]?.RatingResult?.LOI;
        if (!loi) {
            return this.client_error("Hiscox quoted the application, but the limits could not be found in the response.", __location, {result: result});
        }
        this.limits[4] = parseInt(loi, 10);

        const aggLOI = result?.InsuranceSvcRs?.QuoteRs?.ProductQuoteRs?.[policyResponseType]?.RatingResult?.AggLOI;
        if (!aggLOI) {
            return this.client_error("Hiscox quoted the application, but the limits could not be found in the response.", __location, {result: result});
        }
        this.limits[8] = parseInt(aggLOI, 10);

        // Get the premium amount (required)
        const premium = result?.InsuranceSvcRs?.QuoteRs?.ProductQuoteRs?.[policyResponseType]?.Premium?.Annual;
        if (!premium) {
            return this.client_error("Hiscox quoted the application, but the premium amount could not be found in the response.", __location, {result: result});
        }
        this.amount = premium;

        // Get the quote link
        const retrieveURL = result?.InsuranceSvcRs?.QuoteRs?.ReferenceNumberRetrieveURL;
        if (retrieveURL) {
            this.quoteLink = retrieveURL;
        }

        // Always a $0 deductible
        this.deductible = 0
        this.limits[12] = 0;
        // Get the request ID (optional)
        const requestId = result?.InsuranceSvcRs?.QuoteRs?.RqUID;
        if (!requestId) {
            this.log_error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Could not locate the request ID (RqUID) node. This is non-fatal. Continuing.`);
        }
        else {
            this.request_id = requestId;
        }

        // Get the quote ID (optional)
        const quoteId = result?.InsuranceSvcRs?.QuoteRs?.ReferenceNumberID;
        if (!quoteId) {
            this.log_error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Could not locate the quote ID (QuoteID) node. This is non-fatal. Continuing.`);
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

    /**
     * Fits the entered business personal property limit to the next highest Hiscox supported value
     * @param {number} appLimit - Limit from the application location
     * @returns {number} Hiscox Supported Limit in String Format
     */
    getHiscoxBusinessPersonalPropertyLimit(appLimit) {
        const hiscoxLimits = [
            10000,
            15000,
            20000,
            25000,
            30000,
            35000,
            40000,
            45000,
            50000,
            60000,
            70000,
            80000,
            90000,
            100000,
            125000,
            150000,
            175000,
            200000,
            250000,
            300000,
            350000,
            400000,
            450000,
            500000
        ];
        const higherLimits = hiscoxLimits.filter(limit => limit > appLimit);
        return Math.min(...higherLimits);
    }
};