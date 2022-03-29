/* eslint-disable array-element-newline */
/**
 * General Liability Integration for Hiscox
 */

"use strict";

const Integration = require("../Integration.js");
const moment = require("moment");
const momentTimezone = require("moment-timezone");
const json2xml = require('json2xml');
const xmlParser = require('xml2json');


const paymentPlanSVC = global.requireShared('./services/paymentplansvc');
const stringFunctions = global.requireShared("./helpers/stringFunctions.js"); // eslint-disable-line no-unused-vars
const smartystreetSvc = global.requireShared('./services/smartystreetssvc.js');
const InsurerIndustryCodeBO = global.requireShared('./models/InsurerIndustryCode-BO.js');


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
        const logPrefix = `Appid: ${this.app.id} Hiscox GL/BOP qouting `

        log.debug(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} _insurer_quote ` + __location)
        const appDoc = this.applicationDocData

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
        const bopCarrierLimits = ['300000/300000', '500000/500000', '500000/1000000', '1000000/1000000', '1000000/2000000', '2000000/2000000', '2000000/4000000'];

        // GL: Land Surveyor
        const landSurveyorCOBs = ['54137000_17102200_00000000'];

        // GL: Landscape/Janitorial/Retail COBs, Mobile Food Services, Small Contractor COBs
        const cobGroup1 = [
            "23814000_47205100_00000000",
            "23815000_47212100_01000000",
            "23821000_47211100_01000100",
            "23822000_47215200_00010000",
            "23822000_47215200_00020000",
            "23822000_49902100_01000000",
            "23822000_49902100_02000000",
            "23831000_47208100_01000000",
            "23831000_47208100_02000000",
            "23832000_47214100_00000100",
            "23833000_47204200_01000000",
            "23834000_47204400_00000100",
            "23835000_47203100_01000100",
            "23835000_47203100_02000300",
            "23835000_47203100_03000100",
            "23839000_49907100_01000000",
            "23899000_47403100_00000000",
            "23899000_47409100_00000000",
            "42349000_11101100_00000000",
            "44131000_11101100_00000000",
            "44211000_11101100_00000001",
            "44211000_11101100_00000002",
            "44221000_11101100_00000000",
            "44229100_11101100_00000001",
            "44229100_11101100_00000002",
            "44229900_11101100_00000001",
            "44229900_11101100_00000002",
            "44229900_11101100_00000003",
            "44229900_11101100_00000004",
            "44229900_11101100_00000005",
            "44229900_11101100_00000006",
            "44229900_11101100_00000007",
            "44229900_11101100_00000008",
            "44229900_11101100_00000009",
            "44229900_11101100_00000010",
            "44311100_11101100_00000000",
            "44314100_11101100_00000002",
            "44314100_11101100_00000003",
            "44314200_11101100_00000001",
            "44314200_11101100_00000002",
            "44314200_11101100_00000003",
            "44314200_11101100_00000004",
            "44314200_11101100_00000005",
            "44314200_11101100_00000006",
            "44411000_11101100_00000000",
            "44412000_11101100_00000000",
            "44413000_11101100_00000000",
            "44422000_11101100_00000001",
            "44422000_11101100_00000002",
            "44511000_11101100_00000000",
            "44521000_11101100_00000001",
            "44521000_11101100_00000002",
            "44521000_51302200_00000000",
            "44522000_11101100_00000000",
            "44529200_11101100_00000001",
            "44529200_11101100_00000002",
            "44529900_11101100_00000001",
            "44529900_11101100_00000002",
            "44529900_11101100_00000003",
            "44529900_11101100_00000004",
            "44529900_11101100_00000005",
            "44529900_11101100_00000006",
            "44529900_11101100_00000007",
            "44531000_11101100_00000000",
            "44611000_11101100_00000000",
            "44612000_11101100_00000000",
            "44613000_11101100_00000000",
            "44619100_11101100_00000000",
            "44811000_11101100_00000000",
            "44812000_11101100_00000001",
            "44812000_11101100_00000002",
            "44813000_11101100_00000000",
            "44814000_11101100_00000001",
            "44814000_11101100_00000002",
            "44814000_11101100_00000003",
            "44815000_11101100_00000001",
            "44815000_11101100_00000002",
            "44815000_11101100_00000003",
            "44815000_11101100_00000004",
            "44819000_11101100_00000001",
            "44819000_11101100_00000002",
            "44819000_11101100_00000003",
            "44819000_11101100_00000004",
            "44819000_11101100_00000005",
            "44819000_11101100_00000006",
            "44821000_11101100_00000000",
            "44831000_11101100_00000001",
            "44831000_11101100_00000002",
            "44831000_11101100_00000003",
            "44832000_11101100_00000001",
            "44832000_11101100_00000002",
            "45111000_11101100_00000000",
            "45113000_11101100_00000001",
            "45113000_11101100_00000002",
            "45113000_11101100_00000003",
            "45114000_11101100_00000001",
            "45114000_11101100_00000002",
            "45121100_11101100_00000000",
            "45231900_11101100_00000001",
            "45231900_11101100_00000002",
            "45231900_11101100_00000003",
            "45231900_11101100_00000004",
            "45231900_11101100_00000005",
            "45231900_11101100_00000006",
            "45231900_11101100_00000007",
            "45311000_27102300_00000000",
            "45321000_11101100_00000001",
            "45321000_11101100_00000002",
            "45321000_11101100_00000003",
            "45322000_11101100_00000001",
            "45322000_11101100_00000002",
            "45322000_11101100_00000003",
            "45322000_11101100_00000004",
            "45322000_11101100_00000005",
            "45331000_11101100_00000000",
            "45392000_11101100_00000000",
            "45399800_11101100_00000001",
            "45399800_11101100_00000002",
            "45399800_11101100_00000003",
            "45399800_11101100_00000004",
            "45399800_11101100_00000005",
            "45399800_11101100_00000006",
            "45399800_11101100_00000007",
            "45399800_11101100_00000008",
            "53228100_11101100_00000000",
            "53228200_11101100_00000000",
            "53242000_11101100_00000000",
            "54189000_51912300_00000100",
            "54189000_51912300_00000200",
            "56162200_49909400_00000000",
            "56172000_37201100_01000000",
            "56172000_37201100_02000000",
            "56173000_37301100_01000000",
            "56173000_37301100_02000000",
            "56174000_51601100_00010000",
            "56179000_37201900_02000200",
            "56179000_37301100_01000000",
            "72233000_11101100_01000000",
            "72233000_11101100_02000000",
            "72233000_11101100_03000000",
            "72233000_11101100_04000000",
            "72233000_11101100_05000000",
            "72233000_11101100_06000000",
            "72233000_11101100_07000000",
            "72233000_11101100_08000000",
            "72233000_11101100_09000000",
            "72233000_11101100_10000000",
            "72233000_11101100_11000000",
            "72233000_11101100_12000000",
            "72233000_11101100_13000000",
            "72233000_11101100_14000000",
            "72251500_11101100_04000000",
            "72251500_11101100_09000000",
            "72251500_11101100_10000000",
            "81141200_49909900_00000000",
            "81142000_51609300_00000000",
            "81149000_49906400_00000000"
        ];

        // GL: ARCHITECTS & ENGINEERS COBs Except Land Surveyor, Home health aide, Insurance inspector, Manufacturer sales representative, Personal care aide, Safety consultant
        const cobGroup2 = [
            "42512000_41401200_00000000",
            "52429800_13103100_02000000",
            "54131000_17101100_00000000",
            "54132000_17101200_00000000",
            "54133000_11902100_01000000",
            "54133000_13111100_00000000",
            "54133000_17201100_00000000",
            "54133000_17202100_00000000",
            "54133000_17203100_00000000",
            "54133000_17204100_00000000",
            "54133000_17205100_00000000",
            "54133000_17206100_00000000",
            "54133000_17207100_00000000",
            "54133000_17208100_00000000",
            "54133000_17211100_00000000",
            "54133000_17211200_00000000",
            "54133000_17212100_00000000",
            "54133000_17213100_00000000",
            "54133000_17214100_00000000",
            "54133000_17215100_00000000",
            "54133000_17216100_00000000",
            "54133000_17217100_00000000",
            "54133000_17219900_01000000",
            "54133000_17219900_02000000",
            "54134000_17301100_00000000",
            "54134000_17301200_00000000",
            "54134000_17301300_00000000",
            "54134000_17301900_01000000",
            "54135000_47401100_00000000",
            "54137000_17102000_00000000",
            "54141000_27102500_01000100",
            "54141000_27102500_02000100",
            "54151200_51916200_00000000",
            "54169000_11912100_02000000",
            "62161000_31112100_01000000",
            "62161000_31112100_02000000"
        ]

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


        let glCarrierLimits = null;
        if (landSurveyorCOBs.includes(this.insurerIndustryCode.attributes.v4Code)) {
            // GL: Land Surveyor
            glCarrierLimits = ['300000/300000','300000/500000', '500000/500000', '500000/1000000', '1000000/1000000'];
        }
        else if (cobGroup1.includes(this.insurerIndustryCode.attributes.v4Code)) {
            // GL: Landscape/Janitorial/Retail COBs, Mobile Food Services, Small Contractor COBs
            glCarrierLimits = ['300000/300000', '300000/500000', '500000/500000', '500000/1000000', '1000000/1000000', '1000000/2000000'];
        }
        else if (cobGroup2.includes(this.insurerIndustryCode.attributes.v4Code)) {
            // GL: ARCHITECTS & ENGINEERS COBs Except Land Surveyor, Home health aide, Insurance inspector, Manufacturer sales representative, Personal care aide, Safety consultant
            glCarrierLimits = ['300000/600000', '500000/600000', '500000/1000000', '1000000/1000000', '1000000/2000000', '2000000/2000000'];
        }
        else {
            // Gl: All other COBs have
            glCarrierLimits = ['300000/600000', '500000/600000', '500000/1000000', '1000000/1000000', '1000000/2000000', '2000000/2000000'];
        }


        // GL Deductible
        //Hiscox UI guidelines only list 0, 1000  from XSD
        const glDeductibles = [0,1000];
        const propMgmtRealEstateAgentCOBs = [
            "53121000_41902100_00000000",
            "53131100_11914100_00000000"
        ];

        // BOP Deductible from XSD
        const bopDeductibles = [0, 1000, 2500, 5000, 7500, 10000, 15000, 200000, 250000];

        // Choose Carrier Limits based on Policy Type
        let carrierLimits = null;
        if (this.policy.type === 'GL') {
            carrierLimits = glCarrierLimits;
            this.deductible = this.getBestDeductible(this.policy.deductible, glDeductibles);

            // log.debug(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} propMgmtRealEstateAgentCOBs ` + __location)
            if (propMgmtRealEstateAgentCOBs.includes(this.insurerIndustryCode?.attributes?.v4Code)) {
                this.deductible = 1000;
            }

        }
        else if (this.policy.type === 'BOP') {
            carrierLimits = bopCarrierLimits;
            this.deductible = this.getBestDeductible(this.policy.deductible, bopDeductibles);
        }
        else {
            log.error(`Unsupported Policy type "${this.policy.type}" is neither GL nor BOP`);
        }


        // log.debug(`Insurer Industry Code: ${JSON.stringify(this.insurerIndustryCode, null, 4)}`); // zy debug remove

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
                        if(insurerIndustryCode){
                            try{
                                this.industry_code = JSON.parse(JSON.stringify(insurerIndustryCode));
                            }
                            catch(err){
                                this.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} cannot parse insurerIndustryCode: ${err}` + __location);
                            }
                        }
                        // log.debug(`Insurer Industry Code used for BOP: ${JSON.stringify(this.insurerIndustryCode, null, 4)}`); // zy debug remove
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
                    log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Problem getting insurer industry code: ${err} ${__location}`);
                    return this.client_error(`Trouble retrieving insurer industry class code.`)
                }
            }

        }
        // log.debug(`This.policy: ${JSON.stringify(this.policy, null, 4)}`); // zy debug remove


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
        //this.agency_id = this.app.agencyLocation.insurers[this.insurer.id].agency_id;

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


        if (this.app.agencyLocation.insurers[this.insurer.id].agentId){
            reqJSON.InsuranceSvcRq.QuoteRq.ProducerInfo.ProducerClient = this.app.agencyLocation.insurers[this.insurer.id].agentId;
        }
        else {
            // not setup assign to Talage as the partner
            reqJSON.InsuranceSvcRq.QuoteRq.ProducerInfo.ProducerClient = 'Talage';
        }

        reqJSON.InsuranceSvcRq.QuoteRq.ProducerInfo.EmailInfo = {EmailAddr: this.agencyEmail};

        reqJSON.InsuranceSvcRq.QuoteRq.AgentInfo = {AgencyName: this.agency};

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
            log.error(`AppId: ${this.app.id} Agency Location ${this.app.agencyLocation.id} does not have an email address and/or phone number. Hiscox requires both to quote. Talage Wholesale ${this.app.agencyLocation.insurers[this.insurer.id].talageWholesale}`, __location);
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
        if (this.insurerIndustryCode?.attributes?.v4Code) {
            reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.ClassOfBusinessCd = this.insurerIndustryCode.attributes.v4Code;
        }
        else {
            log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Missing Hiscox industry code on insurerIndustryCodeId ${this.insurerIndustryCode.insurerIndustryCodeId}` + __location);
        }
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
        // ***** Need to revisit how to determine limits as Hiscox doesn't seem to like the results of our getBestLimits
        // ***** V3 request with 250000/250000 was fine but V4 doesn't like it. Not sure how bestLimits even resulted in 250000/250000
        // ***** Anyway, limits needs to be revisited and set correctly
        //log.debug(`Carrier Limits: ${carrierLimits}`);
        this.bestLimits = this.getBestLimits(carrierLimits);
        if (!this.bestLimits) {
            this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
            return this.return_result("autodeclined");
        }

        // Make a local copy of locations so that any Hiscox specific changes we make don't affect other integrations
        const locations = [...this.applicationDocData.locations];


        // Determine the primary and secondary locations
        // cannot not count on the order of locations.
        //this.primaryLocation = locations.shift();
        //this.secondaryLocations = locations;
        this.secondaryLocations = [];
        // Hiscox requires a county be supplied in three states, in all other states, remove the county
        for (const location of locations) {
            if(location.primary){
                this.primaryLocation = location
            }
            else {
                this.secondaryLocations.push(location)
            }
            if (["FL", "MO", "TX"].includes(location.territory) && this.app?.business?.locations[0]) {
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

        this.secondaryLocationsCount = this.secondaryLocations?.length >= 5 ? "5+" : this.secondaryLocations?.length.toString();
        if(!this.secondaryLocationsCount){
            this.secondaryLocationsCount = 0;
        }
        if(!this.primaryLocation && this.applicationDocData.locations.length > 0){
            this.primaryLocation = this.applicationDocData.locations[0];
        }

        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress = {AddrInfo: {}};
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.Addr1 = this.primaryLocation?.address.substring(0,250);
        if (this.primaryLocation?.address2){
            reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.Addr2 = this.primaryLocation.address2.substring(0,250);
        }
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.City = stringFunctions.capitalizeName(this.primaryLocation.city).substring(0,250);
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.StateOrProvCd = this.primaryLocation.territory;
        reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.PostalCode = this.primaryLocation.zipcode;
        if (this.primaryLocation.county){
            reqJSON.InsuranceSvcRq.QuoteRq.BusinessInfo.MailingAddress.AddrInfo.County = this.primaryLocation.county.substring(0,250);
        }

        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs = {ApplicationRatingInfo: {}};

        const experience = moment(appDoc.founded).format('YYYY-MM-DD');
        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.ApplicationRatingInfo.ProfessionalExperience = experience;
        //reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.ApplicationRatingInfo.SupplyManufactDistbtGoodsOrProductsPercent3 = 0; // zy debug fix hard-coded value. Need to add this as a question

        reqJSON.InsuranceSvcRq.QuoteRq.Acknowledgements = {};
        // log.debug(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} effective date ` + __location)
        // Check and format the effective date (Hiscox only allows effective dates in the next 60 days, while Talage supports 90 days)
        if (this.policy.effective_date.isAfter(moment().startOf("day").add(60, "days"))) {
            this.reasons.push(`${this.insurer.name} does not support effective dates more than 60 days in the future`);
            return this.return_result("autodeclined");
        }

        this.effectiveDate = this.policy.effective_date.format("YYYY-MM-DD");
        //log.debug(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Question detail 1 ` + __location)
        let questionDetails = null;
        try {
            questionDetails = await this.get_question_details();
        }
        catch (error) {
            log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Unable to get question identifiers or details: ${error}`, __location);
            return this.return_result('error', "Could not retrieve the Hiscox question identifiers");
        }

        //log.debug(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} payroll ` + __location)

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
                log.warn(`Could not convert custom total payroll '${this.questions[totalPayrollQuestionId].answer}' to a number.` + __location);
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

        sharedQuoteRqStructure.Locations.Primary.AddrInfo.Addr1 = this.primaryLocation?.address.substring(0,250);
        if (this.primaryLocation?.address2){
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

        if (this.policy.type === 'BOP'){
            if (isNaN(this.primaryLocation.businessPersonalPropertyLimit)) {
                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Required field Primary Location Business Personal Property Limit missing ${__location}`);
            }
            else {
                sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.BsnsPrsnlPropertyLimit = this.getHiscoxBusinessPersonalPropertyLimit(this.primaryLocation.businessPersonalPropertyLimit);
            }
            sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.BuildingOwnership = this.primaryLocation.own ? 'Yes' : 'No';
            sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.OperatedFromHome = this.get_question_anwser_by_identifier("77a3c1f78d8b4107dcc1ac7352d57baae2530433")
            sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.NumOfEmployees = this.get_total_location_employees(this.primaryLocation)

            if (this.primaryLocation.own) {
                if (isNaN(this.primaryLocation.buildingLimit)) {
                    log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Required field Primary Location Building Limit missing ${__location}`);
                }
                else {
                    sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.ReplacementCost = this.primaryLocation.buildingLimit;
                }
                sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.AgeOfBldng = this.primaryLocation.yearBuilt;
                sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.BuildingConstruction = this.primaryLocation.constructionType;
                sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.NumOfStoriesInBldng = this.primaryLocation.numStories >= 4 ? '4 or more' : this.primaryLocation.numStories;
                if(this.primaryLocation.territory === "AL"){
                    sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.Roof = 'Metal'; // zy debug fix hard-coded value
                }
            }

        }
        // Handle Primary Location Questions
        const ownershipQuestions = [
            'Basement',
            'MultipleOccupants',
            'BuildingConstruction',
            'NumOfStoriesInBldng',
            'Roof',
            'AgeOfBldng',
            'ReplacementCost',
            'StrctrlAlterationsPlan'
        ];
        for (const question of this.primaryLocation.questions) {
            if (ownershipQuestions.includes(question.insurerQuestionAttributes.elementName) && !this.primaryLocation.own) {
                // Don't add ownership questions if applicant doesn't own the building
                continue;
            }
            sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo[question.insurerQuestionAttributes.elementName] = question.answerValue;
        }

        // Set request secondary locations
        if (this.secondaryLocationsCount > 0) {
            sharedQuoteRqStructure.Locations.Secondary = [];

            for (const secondaryLocation of this.secondaryLocations) {
                const location = {AddrInfo: {RatingInfo: {}}};
                location.AddrInfo.Addr1 = secondaryLocation?.address.substring(0,250);
                if (secondaryLocation?.address2){
                    location.AddrInfo.Addr2 = secondaryLocation.address2.substring(0,250);
                }
                location.AddrInfo.City = stringFunctions.capitalizeName(secondaryLocation.city).substring(0,250);
                location.AddrInfo.StateOrProvCd = secondaryLocation.territory;
                location.AddrInfo.PostalCode = secondaryLocation.zipcode;

                if (isNaN(secondaryLocation.businessPersonalPropertyLimit)) {
                    log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Required field Secondary Location Business Personal Property Limit missing ${__location}`);
                }
                else {
                    location.AddrInfo.RatingInfo.BsnsPrsnlPropertyLimit = this.getHiscoxBusinessPersonalPropertyLimit(this.primaryLocation.businessPersonalPropertyLimit);
                }
                if (this.policy.type === 'BOP'){
                    location.AddrInfo.RatingInfo.BuildingOwnership = secondaryLocation.own ? 'Yes' : 'No';
                    sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.OperatedFromHome = this.get_question_anwser_by_identifier("77a3c1f78d8b4107dcc1ac7352d57baae2530433")
                    sharedQuoteRqStructure.Locations.Primary.AddrInfo.RatingInfo.NumOfEmployees = this.get_total_location_employees(secondaryLocation)

                    if (secondaryLocation.own) {
                        if (isNaN(secondaryLocation.buildingLimit)) {
                            log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Required field Secondary Location Building Limit missing ${__location}`);
                        }
                        else {
                            location.AddrInfo.RatingInfo.ReplacementCost = this.primaryLocation.buildingLimit;
                        }
                        location.AddrInfo.RatingInfo.AgeOfBldng = secondaryLocation.yearBuilt;
                        location.AddrInfo.RatingInfo.BuildingConstruction = secondaryLocation.constructionType;
                        location.AddrInfo.RatingInfo.NumOfStoriesInBldng = secondaryLocation.numStories >= 4 ? '4 or more' : this.primaryLocation.numStories;
                        if(this.primaryLocation.territory === "AL"){
                            location.AddrInfo.RatingInfo.Roof = 'Metal'; // zy debug fix hard-coded value
                        }
                    }

                }

                // Handle Secondary Location Questions
                for (const question of secondaryLocation.questions) {
                    if (ownershipQuestions.includes(question.insurerQuestionAttributes.elementName) && !secondaryLocation.own) {
                        // Don't add ownership questions if applicant doesn't own the building
                        continue;
                    }
                    location.AddrInfo.RatingInfo[question.insurerQuestionAttributes.elementName] = question.answerValue;
                }

                sharedQuoteRqStructure.Locations.Secondary.push(location);
            }
        }

        sharedQuoteRqStructure.CoverQuoteRq = {RatingInfo: {
            AggLOI: this.bestLimits[1],
            LOI: this.bestLimits[0],
            Deductible: this.deductible
        }};

        if (this.policy.type === 'GL') {
            const generalLiabilityQuoteRq = sharedQuoteRqStructure;


            generalLiabilityQuoteRq.RatingInfo = {};
            generalLiabilityQuoteRq.RatingInfo.SCForbiddenProjects = {NoneOfTheAbove: 'Yes'}; // zy debug fix hard-coded value

            generalLiabilityQuoteRq.ProductAcknowledgements = {
                "CGLStatement1": "Agree",
                "ExcludedActivities": "Agree"
            };

            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.GeneralLiabilityQuoteRq = generalLiabilityQuoteRq;
        }

        if (this.policy.type === 'BOP') {
            const bopQuoteRq = sharedQuoteRqStructure

            bopQuoteRq.RatingInfo = {};
            bopQuoteRq.ProductAcknowledgements = {
                DisciplinaryActionAcknowledgements: {},
                PropertyLossIncurredAcknowledgements: {}
            };

            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.BusinessOwnersPolicyQuoteRq = bopQuoteRq;
        }


        // log.debug(`Begin this.questions: ${JSON.stringify(this.questions, null, 4)} End this.questions`); // zy debug remove
        // log.debug(`Question Details: ${JSON.stringify(questionDetails, null, 4)}`) // zy debug remove
        // Add questions
        this.questionList = [];
        this.additionalCOBs = [];
        //log.debug(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Questton setup 1 ` + __location)
        //log.debug(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Question setup 1 this.questions ${JSON.stringify(this.questions)} ` + __location)
        //log.debug(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Question setup 1 this.insurerQuestionList ${JSON.stringify(this.insurerQuestionList)} ` + __location)
        //should loop on insurerQuestion and look up talage question.
        //for (const question of Object.values(this.questions)) {
        for(const insurerQuestion of this.insurerQuestionList){
            if (Object.prototype.hasOwnProperty.call(this.questions, insurerQuestion.talageQuestionId)) {

                //log.debug(`Hiscox question processing ${insurerQuestion?.attributes?.elementName}`)
                //const question = this.questions[question_id];
                const question = this.questions[insurerQuestion.talageQuestionId];
                if(!question){
                    log.debug(`Hiscox question processing ${insurerQuestion?.attributes?.elementName} no TalageQuestion`)
                    continue;
                }

                try{
                    //use ApplicationDocData.questions
                    let questionAnswer = this.determine_question_answer(question, question.required);
                    let elementName = insurerQuestion.attributes.elementName;

                    let attributes = null;
                    if (question.type === 'Checkboxes' || question.type === 'Select List') {
                        // Checkbox questions require that each checked answer turns into another object property underneath the main question property
                        // The code here grabs the attributes from the insurer question to map the question answer text to the element name expected by Hiscox

                        if (!insurerQuestion.attributes) {
                            if (question.type === 'Checkboxes') {
                                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} No attributes present on insurer question: ${insurerQuestion.identifier}: ${insurerQuestion.text} ${__location}`)
                            }
                            continue;
                        }
                        attributes = insurerQuestion.attributes;
                    }

                    if (questionAnswer !== false && questionAnswer !== '') {
                        if (elementName === 'GLHireNonOwnVehicleUse') {
                            elementName = 'HireNonOwnVehclUse';
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
                                    log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Problem getting insurer industry code: ${err} ${__location}`);
                                }
                                if (!cob || cob.length === 0) {
                                    log.warn(`Could not locate COB code for COB description '${cobDescription}'` + __location);
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
                                    log.warn(`Could not convert contractor payroll '${questionAnswer}' to a number.` + __location);
                                    questionAnswer = 0;
                                }
                            }
                            // Add contractor payroll
                            if(!(questionAnswer > 0)){
                                questionAnswer = 0
                            }
                            this.questionList.push({
                                nodeName: 'EstmtdPayrollSC',
                                answer: questionAnswer
                            });
                            // Don't add more to the question list
                            continue;
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
                            attributes: attributes,
                            type: question.type
                        })
                    }
                    // else {
                    //     log.debug(`Hiscox question processing ${insurerQuestion?.attributes?.elementName} not adding question ` + __location)
                    // }
                }
                catch(err){
                    log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Error question processing: ${JSON.stringify(question)} ${err} ${__location}`)
                }
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
            'SupplyManufactDistbtGoodsOrProductsPercent3zzz',
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
            "SupplyManufactDistbtGoodsOrProductsPercent3zzz",
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
        // log.debug(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Question setup 2` + __location)
        for (const question of this.questionList) {
            try{
                if (applicationRatingInfoQuestions.includes(question.nodeName)) {
                    if (question.type === 'Checkboxes') {
                        if (!question?.attributes?.answersToElements) {
                            // Don't add to request if we don't have answersToElements
                            log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Error Checkboxes question processing ${JSON.stringify(question)} missing question.attributes.answersToElements` + __location);
                            continue;
                        }
                        // Get the element names from the attributes for each answer that was checked and build the object
                        // with each element as an object property under the parent property
                        const questionElementObj = {};
                        if (!question.answer) {
                            questionElementObj.NoneOfTheAbove = "Yes";
                        }
                        else {
                            const answers = question.answer.split(', ');
                            const possibleAnswers = question.attributes.answersToElements;
                            if(possibleAnswers){
                                for (const [possibleAnswer, subElementName] of Object.entries(possibleAnswers)){
                                    if (answers.includes(possibleAnswer)){
                                        questionElementObj[subElementName] = 'Yes';
                                    }
                                    else {
                                        questionElementObj[subElementName] = 'No';
                                    }
                                }
                            }
                            else {
                                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Error Checkboxes question processing ${JSON.stringify(question)} missing question.attributes.answersToElements` + __location);
                            }
                        }
                        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.ApplicationRatingInfo[question.nodeName] = questionElementObj;
                    }
                    else if (question.type === 'Select List' && question?.attributes?.answersToElements) {
                        const answer = question.attributes.answersToElements[question.answer];
                        if (answer) {
                            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.ApplicationRatingInfo[question.nodeName] = answer;
                        }
                        else {
                            reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.ApplicationRatingInfo[question.nodeName] = question.answer;
                        }
                    }
                    else {
                        reqJSON.InsuranceSvcRq.QuoteRq.ProductQuoteRqs.ApplicationRatingInfo[question.nodeName] = question.answer;
                    }

                    //if (this.policy.type === 'BOP' && question.nodeName === 'TangibleGoodWork') {
                    if (question.nodeName === 'TangibleGoodWork') {
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
                        if (!question?.attributes?.answersToElements) {
                            // Don't add to request if we don't have answersToElements
                            log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Error Checkboxes question processing ${JSON.stringify(question)} missing question.attributes.answersToElements` + __location);
                            continue;
                        }
                        // Get the element names from the attributes for each answer that was checked and build the object
                        // with each element as an object property under the parent property
                        const questionElementObj = {};
                        if (!question.answer) {
                            questionElementObj.NoneOfTheAbove = "Yes";
                        }
                        else {
                            const answers = question.answer.split(', ');
                            if(question.attributes?.answersToElements){
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
                            else {
                                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Error Checkboxes question processing ${JSON.stringify(question)} missing question.attributes?.answersToElements` + __location);
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
                            // Need to 'No' for 'Agree' on this one
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
            catch(err){
                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Error question processing: ${JSON.stringify(question)} ${err} ${__location}`)
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

        // log.debug(`Question List ${JSON.stringify(this.questionList, null, 4)}`); // zy debug remove

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

        // Determine which URL to use
        let host = "";
        if (this.insurer.useSandbox) {
            host = "sdbx.hiscox.com";
        }
        else {
            host = "api.hiscox.com";
        }
        // log.debug(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} getting tokenResponse` + __location)
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
            log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} error getting tokenResponse ${error}` + __location)
            return this.client_error("Could not retrieve the access token from the Hiscox server.", __location, {error: error});
        }
        let responseObject = null;
        try{
            responseObject = JSON.parse(tokenResponse);
        }
        catch(err){
            log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} tokenResponse parse error ${err}` + __location);
        }
        if(!responseObject){
            return this.client_error("Could not retrieve the access token from the Hiscox server.", __location);
        }
        // Verify that we got back what we expected
        if (responseObject?.status !== "approved" || !responseObject?.access_token) {
            return this.client_error("Could not retrieve the access token from the Hiscox server.", __location);
        }
        const token = responseObject.access_token;
        // Specify the path to the Quote endpoint
        const path = "/partner/v4/quote";

        log.debug(`Sending application to https://${host}${path}. This can take up to 30 seconds.`, __location);

        //log.debug(`Request: ${JSON.stringify(reqJSON, null, 4)}`, __location); // zy debug remove
        // Send the JSON to the insurer
        let result = null;
        let requestError = null;

        //********************XML vs JSON reqeusts */
        if(this.insurer.insurerDoc?.additionalInfo?.sendXml === true){
            try {
                log.debug(`${logPrefix} SENDING XML ` + __location);
                const result_str = await this.send_xml_request(host, path, json2xml(reqJSON), {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/xml",
                    "Content-Type": "application/xml"
                },
                false,false, true);
                const options = {object: true}
                result = xmlParser.toJson(result_str, options)
                //log.debug(`${logPrefix} JSON conversion response \n${JSON.stringify(result)}\n` + __location);
            }
            catch (error) {
                //log.debug(`${logPrefix} XML response error \n${error}\n` + __location);
                log.warn(`${logPrefix} XML response error \n${JSON.stringify(error)}\n` + __location);
                requestError = error;
            }
            if(requestError){
                try{
                    const options = {object: true}
                    //regular processing not error processing that JSON response does.
                    if(typeof requestError.response === 'string'){
                        result = xmlParser.toJson(requestError.response, options)
                    }
                    else {
                        result = xmlParser.toJson(JSON.stringify(requestError.response), options)
                    }
                    requestError = null;
                }
                catch(err){
                    log.error(`${logPrefix} Error handlingXML response error ${err}` + __location);
                }

            }
        }
        else {
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
        }

        let policyResponseTypeTag = null;
        if (this.policy.type === 'GL') {
            policyResponseTypeTag = 'GeneralLiabilityQuoteRs';
        }
        if (this.policy.type === 'BOP') {
            policyResponseTypeTag = 'BusinessOwnersPolicyQuoteRs';
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
            let errorResponse = null;
            try{
                errorResponse = JSON.parse(requestError.response);
            }
            catch(err){
                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} unable to parse error response.` + __location);
                if(typeof requestError.response === 'string'){
                    this.reasons.push(`Hiscox return error ${requestError.response}`);
                }
                else {
                    this.reasons.push(`Hiscox return unknown error`);
                }
                return this.return_result('error');
            }
            if(!errorResponse){
                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} empty error response.` + __location);
                this.reasons.push(`Hiscox return unknown error`);
                return this.return_result('error');
            }

            //Look for incomplete
            const respProductStatus = errorResponse?.InsuranceSvcRs?.QuoteRs?.ProductQuoteRs?.[policyResponseTypeTag]?.Status
            if(respProductStatus === "Incomplete"){
                this.reasons.push("Hiscox return an Incomplete status for the submission..");
                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Hiscox returned Incomplete status.` + __location);
                return this.return_result('error');
            }

            // Check for errors
            const responseErrors = errorResponse?.InsuranceSvcRs?.QuoteRs?.ProductQuoteRs?.[policyResponseTypeTag]?.Errors?.Error;
            let errorResponseList = null;
            if (responseErrors && !responseErrors.length) {
                // If responseErrors is just an object, make it an array
                errorResponseList = [responseErrors];
            }
            else {
                errorResponseList = responseErrors;
            }
            if(respProductStatus === "Referred"){
                this.reasons.push(`Hiscox reason: ${responseErrors.code}: ${responseErrors.Description}`);
                return this.return_result('referred');
            }


            if (errorResponseList) {
                let errors = "";
                for (const errorResponseItem of errorResponseList) {
                    if (errorResponseItem.Code && errorResponseItem.Description) {
                        if (errorResponseItem.Code === "Declination") {
                            // Return an error result
                            return this.client_declined(`${errorResponseItem.Code}: ${errorResponseItem.Description}`);
                        }
                        else {
                            // Non-decline error
                            const reason = `${errorResponseItem.Description} (${errorResponseItem.Code})`;
                            errors += (errors.length ? ", " : "") + reason;
                        }
                    }
                }
                return this.client_error(`The Hiscox server returned the following errors: ${errors}`, __location);
            }

            // Check for validation errors
            let validationErrorList = null;
            const validations = errorResponse.InsuranceSvcRs?.QuoteRs?.Validations?.Validation;
            //(`Validations: ${JSON.stringify(validations, null, 4)}`);
            if (validations && !validations.length) {
                // if validation is just an object, make it an array
                validationErrorList = [validations];
            }
            else {
                validationErrorList = validations;
            }
            //log.debug(`Validations Error List: ${JSON.stringify(validationErrorList, null, 4)}` + __location);

            if (validationErrorList && validationErrorList.length > 0) {
                // Loop through and capture each validation message
                let validationMessage = "Validation errors: ";
                for (const validationError of validationErrorList) {
                    validationMessage += `${validationError.Status} (${validationError.DataItem}) at ${validationError.XPath}, `;
                }
                return this.client_error(validationMessage, __location, {validationErrorList: validationErrorList});
            }
            // Check for a fault string (unknown node name)
            const faultString = errorResponse?.fault?.faultstring;
            //log.debug(`Fault String: ${JSON.stringify(errorResponse, null, 4)}`);
            if (faultString) {
                // Check for a system fault
                return this.client_error(`The Hiscox API returned a fault string: ${faultString}`, __location, {requestError: requestError});
            }
            // Return an error result
            return this.client_error(`The Hiscox API returned an error of ${requestError.httpStatusCode} without explanation`, __location, {requestError: requestError});
        }
        // End of Response Error Processing

        //check if it qouted.
        //Check status reported By Hiscox
        const QuoteRs = result?.InsuranceSvcRs?.QuoteRs
        if(!QuoteRs){
            log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Hiscox returned unexpect JSON structure. ${JSON.stringify(result)}` + __location);
            return this.client_error("Hiscox returned unexpect JSON structure.", __location);
        }
        const prolicyTypeRs = QuoteRs?.ProductQuoteRs[policyResponseTypeTag];
        const submissionStatus = prolicyTypeRs?.Status
        // referred with price status??
        if(submissionStatus === "Quoted"){
            // We have received a quote. Parse it.
            // console.log("response", JSON.stringify(result, null, 4));

            // Limit should be filled in with what was submitted.
            // in case the insurer does not return limits.
            // This is using the old structure.   New structure put into place for BOPs.
            // Get the limits (required)
            const loi = result?.InsuranceSvcRs?.QuoteRs?.ProductQuoteRs?.[policyResponseTypeTag]?.RatingResult?.LOI;
            if(loi){
                this.limits[4] = parseInt(loi, 10);
            }
            else {
                //no donot error out a submission on lack of limits being returned. Log as an error.
                // submission status does not change
                //return this.client_error("Hiscox quoted the application, but the limits could not be found in the response.", __location, {result: result});
                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Hiscox quoted the application, but the limits could not be found in the response`)
            }

            const aggLOI = result?.InsuranceSvcRs?.QuoteRs?.ProductQuoteRs?.[policyResponseTypeTag]?.RatingResult?.AggLOI;
            if (aggLOI){
                this.limits[8] = parseInt(aggLOI, 10);
            }
            else {
                // Do not error out Quote on this.  log it as an error
                //return this.client_error("Hiscox quoted the application, but the limits could not be found in the response.", __location, {result: result});
                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Hiscox quoted the application, but the limits could not be found in the response`)
            }

            // Get the premium amount (required)
            const premium = result?.InsuranceSvcRs?.QuoteRs?.ProductQuoteRs?.[policyResponseTypeTag]?.Premium?.Annual;
            if (!premium) {
                return this.client_error("Hiscox quoted the application, but the premium amount could not be found in the response.", __location, {result: result});
            }
            this.amount = premium;

            //find payment plans
            const insurerPaymentPlans = result?.InsuranceSvcRs?.QuoteRs?.ProductQuoteRs?.[policyResponseTypeTag]?.Premium;

            try {
                if (insurerPaymentPlans) {
                    const [
                        Annual,
                        SemiAnnual,
                        Quarterly,
                        TenPay,
                        Monthly
                    ] = paymentPlanSVC.getList()
                    const talageInsurerPaymentPlans = []
                    const paymentPlansMap = {
                        'Annual': Annual,
                        'SemiAnnual': SemiAnnual,
                        'Quarterly': Quarterly,
                        'Monthly': Monthly,
                        'TenPay': TenPay
                    }

                    // Raw insurer payment plans
                    this.insurerPaymentPlans = insurerPaymentPlans

                    // Talage payment plans
                    Object.keys(insurerPaymentPlans).forEach(paytype => {
                        const talagePaymentPlan = paymentPlansMap[paytype]
                        let amount = 0
                        if(paytype === 'Annual') {
                            amount = insurerPaymentPlans[paytype]
                        }
                        else {
                            amount = insurerPaymentPlans[paytype].InstallmentAmount
                        }

                        if (talagePaymentPlan) {
                            talageInsurerPaymentPlans.push({
                                paymentPlanId: talagePaymentPlan.id,
                                insurerPaymentPlanId: paytype,
                                insurerPaymentPlanDescription: paytype,
                                NumberPayments: insurerPaymentPlans[paytype].NumberOfInstallments,
                                TotalCost: amount,
                                TotalPremium: premium,
                                DownPayment: paytype === 'Annual' ? 0 : insurerPaymentPlans[paytype].DownPayment,
                                TotalStateTaxes: 0,
                                TotalBillingFees: 0,
                                DepositPercent: Number(100 * amount / premium).toFixed(2),
                                IsDirectDebit: true,
                                installmentPayment: amount
                            })
                        }
                    })
                    this.talageInsurerPaymentPlans = talageInsurerPaymentPlans
                }
            }
            catch {
                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} An error occured while building Talage Payment Plan. This is non-fatal. Continuing.`);
            }

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
                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Could not locate the request ID (RqUID) node. This is non-fatal. Continuing.`);
            }
            else {
                this.request_id = requestId;
            }

            // Get the quote ID (optional)
            const quoteId = result?.InsuranceSvcRs?.QuoteRs?.ReferenceNumberID;
            if (!quoteId) {
                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Could not locate the quote ID (QuoteID) node. This is non-fatal. Continuing.`);
            }
            else {
                this.number = quoteId;
            }

            // That we are quoted
            return this.return_result('quoted');
        }
        else if (submissionStatus === "Referred") {
            this.reasons.push("Hiscox return an Incomplete status for the submission.");
            return this.return_result('referred');
        }
        else if (submissionStatus === "Incomplete") {
            log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Hiscox returned Incomplete status.` + __location);
            this.reasons.push("Hiscox return an Incomplete status for the submission.");
            return this.return_result('error');
        }
        else if (submissionStatus === "Declined") {
            const responseErrors = prolicyTypeRs?.Errors?.Error;
            let errorResponseList = null;
            if (responseErrors && !responseErrors.length) {
                // If responseErrors is just an object, make it an array
                errorResponseList = [responseErrors];
            }
            else {
                errorResponseList = responseErrors;
            }

            let reasons = "";
            if (errorResponseList) {
                for (const errorResponseItem of errorResponseList) {
                    if (errorResponseItem.Code && errorResponseItem.Description) {
                        if (errorResponseItem.Code === "Declination") {
                            // Return an error result
                            const reason = `${errorResponseItem.Description} (${errorResponseItem.Code})`;
                            reasons += (reasons.length ? ", " : "") + reason;
                        }
                    }
                }
                this.reasons.push(`Hiscox Decline reason: ${reasons}`);
            }
            if(reasons === ""){
                log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Hiscox unable to determine decline reason.` + __location);
                this.reasons.push("Hiscox Decline reason: unknown - unexpected response structure");
            }
            return this.return_result('declined');
        }
        else {
            log.error(`AppId: ${this.app.id} InsurerId: ${this.insurer.id} Hiscox returned unexpected status - ${submissionStatus}` + __location);
            this.reasons.push(`Hiscox return an ${submissionStatus} status for the submission.`);
            return this.return_result('error');
        }

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