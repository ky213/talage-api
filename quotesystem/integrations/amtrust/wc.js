/* eslint-disable guard-for-in */
/**
 * Worker's Compensation for AMTrust
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

const Integration = require('../Integration.js');
const amtrustClient = require('./amtrust-client.js');
global.requireShared('./helpers/tracker.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const {Sleep} = global.requireShared('./helpers/utility.js');
const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');

const amtrustTestHost = "utgateway.amtrustgroup.com";
const amtrustTestBasePath = "/DigitalAPI_Usertest";

const amtrustProductionHost = "gateway.amtrustgroup.com";
const amtrustProductionBasePath = "/DigitalAPI";

const OFFICER_MAX_RETRIES = 3; // 3 retries
const OFFICER_RETRY_TIME = 5 * 1000; // 5 seconds

module.exports = class AMTrustWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityClassCodes = true;
    }

    /**
     * Formats a phone number as an AmTrust expected phone number
     * @param  {number} phoneNumber - The phone number
     * @returns {string} Formatted phone number of XXX-XXX-XXXX
     */
    formatPhoneNumber(phoneNumber) {
        if(!phoneNumber){
            return '';
        }
        const phoneNumberString = phoneNumber.toString();
        return `${phoneNumberString.substring(0, 3)}-${phoneNumberString.substring(3, 6)}-${phoneNumberString.substring(6, 10)}`;
    }

    /**
     * Gets a child property from an object
     * @param  {object} object - the parent object
     * @param  {string} childPath - period-delimited child name ("Quote.Result.Status")
     * @returns {object} The child object or null if it could not be found
     */
    getChildProperty(object, childPath) {
        const childPathList = childPath.split('.');
        let child = object;
        for (const childName of childPathList) {
            if (!child || !child.hasOwnProperty(childName)) {
                return null;
            }
            child = child[childName];
        }
        return child;
    }

    /**
     * Gets an array of class codes to payroll/employee counts for use in an AmTrust quote
     * @param  {object} classCodeMap - Map of state -> amtrust code : payroll, employee counts
     * @returns {object} Formatted class code list
     */
    async getClassCodeList() {
        // First we need to group the AmTrust class codes by state and class code.
        const amtrustClassCodeList = [];
        for (const location of this.applicationDocData.locations) {
            for (const activityPayroll of location.activityPayrollList) {
                // Commented out because we are testing with the national NCCI codes instead of the mapped insurer class codes
                if(!activityPayroll.activityCodeId){
                    activityPayroll.activityCodeId = activityPayroll.ncciCode;
                }
                const insurerClassCodeDoc = await this.get_insurer_code_for_activity_code(this.insurer.id,location.state, activityPayroll.activityCodeId)
                if (insurerClassCodeDoc && insurerClassCodeDoc.code) {
                    let addAmtrustClassCode = false;
                    const amTrustCodeSub = insurerClassCodeDoc.code + insurerClassCodeDoc.sub;
                    let amtrustClassCode = amtrustClassCodeList.find((acc) => acc.ncciCodeFull === amTrustCodeSub && acc?.state === location.state);
                    if (!amtrustClassCode) {
                        amtrustClassCode = {
                            ncciCodeFull: amTrustCodeSub,
                            ncciCode: insurerClassCodeDoc.code,
                            subCode: insurerClassCodeDoc.sub,
                            state: location?.state,
                            payroll: 0,
                            fullTimeEmployees: 0,
                            partTimeEmployees: 0
                        };
                        addAmtrustClassCode = true;
                    }
                    for (const employeeType of activityPayroll.employeeTypeList) {
                        amtrustClassCode.payroll += employeeType.employeeTypePayroll;
                        switch (employeeType.employeeType) {
                            case "Full Time":
                                amtrustClassCode.fullTimeEmployees += employeeType.employeeTypeCount;
                                break;
                            case "Part Time":
                                amtrustClassCode.partTimeEmployees += employeeType.employeeTypeCount;
                                break;
                            default:
                                break;
                        }
                    }
                    //AMtrust will return an error if the classcode has zero for employees or zero for payroll.
                    if(addAmtrustClassCode && (amtrustClassCode.fullTimeEmployees > 0 || amtrustClassCode.partTimeEmployees > 0)
                        && amtrustClassCode.payroll > 0){
                        amtrustClassCodeList.push(amtrustClassCode);
                    }
                }
                else {
                    log.error(`AMtrust WC (application ${this.app.id}): Error no AMtrust InsurerActivityCode for: ${location.state} - ${activityPayroll.activityCodeId} ${__location}`);
                }
            }
        }
        //check for only having 8810A - CLERICAL OFFICE EMPLOYEES — N.O.C — Non–Governing Class
        // Flip it to 8810B -  CLERICAL OFFICE EMPLOYEES — N.O.C — Governing Class | 8810B - 00
        // both subcodes are "00";
        if(amtrustClassCodeList.length === 1 && amtrustClassCodeList[0].ncciCode === "8810A"){
            amtrustClassCodeList[0].ncciCode = "8810B"
        }

        // Build the class code list to return
        const classCodeList = [];
        for (const amtrustClassCode of amtrustClassCodeList) {
            classCodeList.push({
                "ClassCode": amtrustClassCode.ncciCode,
                "ClassCodeDescription": amtrustClassCode.subCode,
                "State": amtrustClassCode.state,
                "Payroll": amtrustClassCode.payroll,
                "FullTimeEmployees": amtrustClassCode.fullTimeEmployees,
                "PartTimeEmployees": amtrustClassCode.partTimeEmployees
            });
        }
        return classCodeList;
    }

    /**
     * Gets a list of additional locations
     * @returns {object} Array of additional locations
     */
    getAdditionalLocationList() {
        const additionalLocationList = [];
        for (let i = 0; i < this.app.business.locations.length; i++) {
            const location = this.app.business.locations[i];
            additionalLocationList.push({
                "Address1": location.address.slice(0,50),
                "Address2": location.address2 ? location.address2.slice(0,50) : "",
                "City": location.city,
                "State": location.state_abbr,
                "Zip": location.zip.slice(0,5),
                "TotalEmployeeNumber": location.full_time_employees + location.part_time_employees
            });
        }
        return additionalLocationList;
    }

    getOfficers(officerInformationList, primaryLocation) {
        const officersList = [];
        let validationError = `Officer Type, Endorsement ID, or Form Type were not provided in AMTrust's response.`;

        for (const owner of this.applicationDocData.owners) {
            //Need to be primary state not mailing.
            const state = primaryLocation.state;
            let officerType = null;
            let endorsementId = null;
            let formType = null;
            for (const officerInformation of officerInformationList) {
                if (officerInformation?.State === state) {
                    officerType = officerInformation.OfficerType;

                    // add validation errors if they exist - we likely didn't get the endorsement information we need to send a successful request
                    if (officerInformation.EndorsementInformation && officerInformation.EndorsementInformation.ValidationMessage) {
                        if (officerInformation.EndorsementInformation.ValidationMessage.length > 0) {
                            validationError = officerInformation.EndorsementInformation.ValidationMessage;
                        }
                    }

                    const endorsementList = this.getChildProperty(officerInformation, "EndorsementInformation.Endorsements");
                    if (endorsementList) {
                        for (const endorsement of endorsementList) {
                            if (owner.ownership >= endorsement.MinOwnershipPercentage && owner.ownership <= endorsement.MaxOwnershipPercentage) {
                                formType = endorsement.FormType;
                                endorsementId = endorsement.Id;
                                break;
                            }
                        }
                    }
                }
            }

            if (!officerType || !endorsementId || !formType) {
                return validationError;
            }
            //Amtrust has a 30 character limit.
            const officeName = `${owner.fname} ${owner.lname}`.slice(0,30);
            officersList.push({
                "Name": officeName,
                "EndorsementId": endorsementId,
                "Type": officerType,
                "State": state,
                "OwnershipPercent": owner.ownership,
                "FormType": formType,
                "OfficerDateOfBirth": moment(owner.birthdate).format("MM/DD/YYYY"),
                "OfficeHeld": owner.officerTitle
            });
        }
        return officersList;
    }

    /**
     * Calls the AmTrust API
     * @param  {string} verb - HTTP verb (GET, POST, ...)
     * @param  {string} accessToken - Access token from authorization
     * @param  {string} subscriberId - Mulesoft subscriber ID
     * @param  {string} path - Endpoint path
     * @param  {object} dataObject - Body data object to send
     * @returns {object} Response body data
     */
    async amtrustCallAPI(verb, accessToken, subscriberId, path, dataObject = null) {
        let host = null;
        let basePath = null;
        if (this.insurer.useSandbox) {
            host = amtrustTestHost;
            basePath = amtrustTestBasePath;
        }
        else {
            host = amtrustProductionHost;
            basePath = amtrustProductionBasePath;
        }
        let response = null;
        try {
            response = await this.send_json_request(host,
                basePath + path,
                dataObject ? JSON.stringify(dataObject) : null,
                {
                    "Authorization": `Bearer ${accessToken}`,
                    "subscriber_id": subscriberId
                },
                verb, true, true);
        }
        catch (error) {
            const errorMessage = `${error} ${error.response ? error.response : ""}`
            this.reasons.push(errorMessage);
            this.log_error(`Error sending Amtrust Request ${path}: ${errorMessage}`, __location);
            return null;
        }
        if (typeof response === "string" && response.startsWith("BadRequest:")) {
            const jsonStartIndex = response.indexOf('{"');
            if (jsonStartIndex >= 0) {
                try {
                    response = JSON.parse(response.substring(jsonStartIndex, response.indexOf('"}') + 2));
                    response.StatusCode = 400;
                }
                catch (e) {
                    response = null;
                }
            }
        }
        return response;
    }

    async _insurer_price(){


        const appDoc = this.app.applicationDocData

        // Load the API credentials
        let credentials = null;
        try {
            credentials = JSON.parse(this.password);

            if(appDoc.agencyNetworkId > 0){
                const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO');
                const agencyNetworkBO = new AgencyNetworkBO();
                const agencyNetworkDoc = await agencyNetworkBO.getById(appDoc.agencyNetworkId)
                if(agencyNetworkDoc?.additionalInfo?.amtrustClientId && agencyNetworkDoc?.additionalInfo?.amtrustClientSecret){
                    credentials.clientId = agencyNetworkDoc.additionalInfo.amtrustClientId;
                    credentials.clientSecret = agencyNetworkDoc.additionalInfo.amtrustClientSecret;
                    log.debug('AMTRUST using agency network ClientId')
                }
            }
        }
        catch (error) {
            log.error(`Could not load AmTrust API credentials ${error}` + __location);
            const pricingResult = {
                gotPricing: false,
                outOfAppetite: true,
                pricingError: true
            }
            return pricingResult;
        }
        log.info(`AmTrust AL insurer ${JSON.stringify(this.app.agencyLocation.insurers[this.insurer.id])}` + __location)
        let agentId = this.app.agencyLocation.insurers[this.insurer.id].agencyId.trim();
        const agentUserNamePassword = this.app.agencyLocation.insurers[this.insurer.id].agentId.trim();

        // Ensure the agent ID is a number (required for the API request)
        try {
            agentId = parseInt(agentId, 10);
        }
        catch (error) {
            log.error(`AMTrust WC error parsing AgentId ${error}` + __location)
            const pricingResult = {
                gotPricing: false,
                outOfAppetite: true,
                pricingError: true
            }
            return pricingResult;
            //return this.client_error(`Invalid AmTrust agent ID '${agentId}'`, __location, {error: error});
        }
        if (!agentId || agentId === 0) {
            log.error(`Invalid AmTrust agent ID '${agentId}'` + __location);
            const pricingResult = {
                gotPricing: false,
                outOfAppetite: true,
                pricingError: true
            }
            return pricingResult;
        }

        // Split the comma-delimited username,password field.
        const commaIndex = agentUserNamePassword.indexOf(',');
        if (commaIndex <= 0) {
            log.error(`AmTrust username and password are not comma-delimited. commaIndex ${commaIndex} ` + __location);
            const pricingResult = {
                gotPricing: false,
                outOfAppetite: true,
                pricingError: true
            }
            return pricingResult;
        }
        const agentUsername = agentUserNamePassword.substring(0, commaIndex).trim();
        const agentPassword = agentUserNamePassword.substring(commaIndex + 1).trim();

        // Authorize the client
        const accessToken = await amtrustClient.authorize(credentials.clientId, credentials.clientSecret, agentUsername, agentPassword, credentials.mulesoftSubscriberId, this.insurer.useSandbox);
        if (!accessToken) {
            log.error("Authorization with AmTrust server failed" + __location);
            const pricingResult = {
                gotPricing: false,
                outOfAppetite: true,
                pricingError: true
            }
            return pricingResult;
        }


        // Ensure we have a supported legal entity.
        // The map values were pulled from https://anypoint.mulesoft.com/exchange/portals/amtrust-financial-service-9/acf997e3-018a-45c2-bbfa-52d79acf6edb/digitalapi/minor/1.0/console/method/%235970/
        const amtrustLegalEntityMap = {
            'Association': 4,
            'Corporation': 3,
            'Limited Liability Company': 12,
            'Limited Partnership': 7,
            'Partnership': 2,
            'Sole Proprietorship': 1
            // 'Other': null <- Not supported
        };
        if (!amtrustLegalEntityMap.hasOwnProperty(appDoc.entityType)) {
            log.info(`AMtrust WC Pricing (application ${this.app.id}) The business entity type '${appDoc.entityType}' is not supported by this insurer.`, __location);
            const pricingResult = {
                gotPricing: false,
                outOfAppetite: true,
                pricingError: false
            }
            return pricingResult;
        }

        // =========================================================================================================
        // Get primary location
        const primaryLocation = appDoc.locations.find(location => location.primary);

        let primaryContact = appDoc.contacts.find(c => c.primary);
        if(!primaryContact && appDoc.contacts.length > 0){
            primaryContact = appDoc.contacts[0]
        }
        else if (!primaryContact){
            // user agency contact info.
            const AgencyBO = global.requireShared('./models/Agency-BO.js');
            const agencyBO = new AgencyBO();
            const agency = await agencyBO.getById(appDoc.agencyId);
            if(agency){
                primaryContact = {
                    firstName: agency.firstName,
                    lastName: agency.lastName,
                    email: agency.email,
                    phone: agency.phone
                };
            }
            else {
                const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
                const agencyNetworkBO = new AgencyNetworkBO();
                const agencyNetwork = await agencyNetworkBO.getById(appDoc.agencyNetworkId);
                if(agencyNetwork){
                    primaryContact = {
                        firstName: agencyNetwork.fname,
                        lastName: agencyNetwork.lname,
                        email: agencyNetwork.email,
                        phone: agencyNetwork.phone
                    };
                }
                else {
                    primaryContact = {
                        firstName: 'Adam',
                        lastName: 'Kiefer',
                        email: 'customersuccess@talageins.com',
                        phone: '8334825243'
                    };
                }
            }
        }
        let contactPhone = '';
        if(primaryContact && primaryContact.phone){
            try{
                contactPhone = primaryContact?.phone?.toString()
                contactPhone = stringFunctions.santizeNumber(contactPhone, false);
            }
            catch(err){
                log.error(`Appid: ${this.app.id} Travelers WC: Unable to get contact phone. error: ${err} ` + __location);
            }
        }
        if(contactPhone === '') {
            contactPhone = "5105555555";
        }
        let yearsInBusiness = this.get_years_in_business()
        if(!appDoc.founded){
            yearsInBusiness = 4;
        }

        const primaryAddressLine = primaryLocation.address + (primaryLocation.address2 ? ", " + primaryLocation.address2 : "");
        const mailingAddressLine = this.app.business.mailing_address + (this.app.business.mailing_address2 ? ", " + this.app.business.mailing_address2 : "");
        const quoteRequestDataV2 = {"Quote": {
            "EffectiveDate": this.policy.effective_date.format("MM/DD/YYYY"),
            "PrimaryAddress": {
                "Line1": primaryAddressLine.slice(0,50),
                "City": primaryLocation.city,
                "State": primaryLocation.state,
                "Zip": primaryLocation.zipcode.slice(0,5)
            },
            "MailingAddress": {
                "Line1": mailingAddressLine.slice(0,50),
                "City": this.app.business.mailing_city,
                "State": this.app.business.mailing_state_abbr,
                "Zip": this.app.business.mailing_zipcode.slice(0,5)
            },
            "BusinessName": this.app.business.name,
            "ContactInformation": {
                "FirstName":  primaryContact?.firstName?.slice(0,30),
                "LastName": primaryContact?.lastName?.slice(0,30),
                "Email": primaryContact?.email,
                "Phone": this.formatPhoneNumber(contactPhone),
                "AgentContactId": agentId
            },
            "NatureOfBusiness": this.industry_code?.description ? this.industry_code.description : "unknown",
            "LegalEntity": amtrustLegalEntityMap[appDoc.entityType],
            "YearsInBusiness": yearsInBusiness,
            "IsNonProfit": false,
            "IsIncumbentAgent": false,
            "CompanyWebsiteAddress": this.app.business.website,
            "ClassCodes": await this.getClassCodeList()
        }};

        // Add the rating zip if any location is in California
        let ratingZip = null;
        let ratingZipPayroll = 0;
        for (const location of this.app.business.locations) {
            if (location.state_abbr === "CA") {
                let locationPayroll = 0;
                for (const activityCode of location.activity_codes) {
                    locationPayroll += activityCode.payroll;
                }
                if (locationPayroll > ratingZipPayroll) {
                    ratingZip = location.zipcode.slice(0,5);
                    ratingZipPayroll = locationPayroll;
                }
            }
        }
        if (ratingZip) {
            quoteRequestDataV2.Quote.RatingZip = ratingZip;
        }

        // =========================================================================================================
        // Send the requests
        const successfulStatusCodes = [200, 201];
        const createQuoteMethod = 'POST';
        const createRoute = '/api/v2/quotes'
        const quoteResponse = await this.amtrustCallAPI(createQuoteMethod, accessToken, credentials.mulesoftSubscriberId, createRoute, quoteRequestDataV2);
        let pricingResult = {};
        let amount = 0;
        let apiResult = "";
        let piQuoteStatus = {};
        if (!quoteResponse) {
            //pricingResult JSON
            pricingResult = {
                gotPricing: false,
                outOfAppetite: false,
                pricingError: true
            }
            apiResult = "pi_error";
            piQuoteStatus = quoteStatus.piError;
        }
        // console.log("quoteResponse", JSON.stringify(quoteResponse, null, 4));
        const statusCode = this.getChildProperty(quoteResponse, "StatusCode");
        if (!statusCode || !successfulStatusCodes.includes(statusCode)) {
            log.error(`AMtrust WC (application ${this.app.id}) pricing returned StatusCode ${statusCode}` + __location);
            pricingResult = {
                gotPricing: false,
                outOfAppetite: false,
                pricingError: true
            }
            apiResult = "pi_error";
            piQuoteStatus = quoteStatus.piError;
            this.reasons.push(`Status Code ${statusCode} returned`);
        }

        // Check if the quote has been declined. If declined, subsequent requests will fail.
        const quoteEligibility = this.getChildProperty(quoteResponse, "Data.Eligibility.Eligibility");
        if (quoteEligibility === "Decline") {
            // A decline at this stage is based on the class codes; they are out of appetite.
            pricingResult = {
                gotPricing: false,
                outOfAppetite: true,
                pricingError: false
            }
            apiResult = "piOutOfAppetite";
            piQuoteStatus = quoteStatus.piOutOfAppetite;
            this.reasons.push("Out of Appetite");
        }
        if(quoteResponse.Data?.PremiumDetails?.PriceIndication){
            //pricingResult JSON
            pricingResult = {
                gotPricing: true,
                price: quoteResponse.Data.PremiumDetails.PriceIndication,
                outOfAppetite: false,
                pricingError: false
            }
            amount = quoteResponse.Data.PremiumDetails.PriceIndication;
            piQuoteStatus = quoteStatus.priceIndication;
            apiResult = "price_indication";
        }
        else {
            pricingResult = {
                gotPricing: false,
                outOfAppetite: true,
                pricingError: false
            }
            apiResult = "pi_error";
            piQuoteStatus = quoteStatus.piError;
            this.reasons.push("No Price info.  not declined.");
        }
        //write quote record to db. if successful write a quote record.
        if(pricingResult.gotPricing || global.settings.ALWAYS_SAVE_PRICING_QUOTE === "YES"){
            await this.record_quote(amount, apiResult, piQuoteStatus)
        }
        //currently thinking PI error or out of market in AP Applications
        // will cause confusing and agents to stop working the application
        // SIU request - we silently fail PI request.
        // appDoc will have the pricingResult info.

        return pricingResult;

    }


    //***************** QUOTING *******************************************************************************

    /**
	 * Requests a quote from AMTrust and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {

        const appDoc = this.applicationDocData
        //User Amtrust quick quote?
        const quickQuote = this.app.quickQuoteOnly
        const logPrefix = `Appid: ${this.app.id} AmTrust WC `

        // These are the limits supported AMTrust
        const carrierLimits = ['100000/500000/100000',
            '500000/500000/500000',
            '1000000/1000000/1000000'];

        const mapCarrierLimits = {
            '100000/500000/100000': '100/500/100',
            '500000/500000/500000': '500/500/500',
            '1000000/1000000/1000000': '1000/1000/1000',
            '1500000/1500000/1500000': '1500/1500/1500',
            '2000000/2000000/2000000': '2000/2000/2000'
        }

        let amTrustLimits = mapCarrierLimits[this.app.policies[0].limits];
        const limits = this.getBestLimits(carrierLimits);
        if (limits) {
            const amtrustBestLimits = limits.join("/");
            const amtrustLimitsSubmission = mapCarrierLimits[amtrustBestLimits];
            if(amtrustLimitsSubmission){
                amTrustLimits = amtrustLimitsSubmission;
            }
            else {
                amTrustLimits = '100/500/100';
            }
        }
        else {
            log.warn(`Appid: ${this.app.id} AmTrust WC autodeclined: no limits  ${this.insurer.name} does not support the requested liability limits ` + __location);
            this.reasons.push(`Appid: ${this.app.id} ${this.insurer.name} does not support the requested liability limits`);
            return this.return_result('autodeclined');
        }

        // Load the API credentials
        let credentials = null;
        try {
            credentials = JSON.parse(this.password);
            if(appDoc.agencyNetworkId > 0){
                const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO');
                const agencyNetworkBO = new AgencyNetworkBO();
                const agencyNetworkDoc = await agencyNetworkBO.getById(appDoc.agencyNetworkId)
                if(agencyNetworkDoc?.additionalInfo?.amtrustClientId && agencyNetworkDoc?.additionalInfo?.amtrustClientSecret){
                    credentials.clientId = agencyNetworkDoc?.additionalInfo?.amtrustClientId;
                    credentials.clientSecret = agencyNetworkDoc?.additionalInfo?.amtrustClientSecret;
                    log.debug('AMTRUST using agency network ClientId')
                }
            }
        }
        catch (error) {
            return this.client_error("Could not load AmTrust API credentials", __location);
        }
        log.info(`AmTrust AL insurer ${JSON.stringify(this.app.agencyLocation.insurers[this.insurer.id])}` + __location)
        let agentId = this.app.agencyLocation.insurers[this.insurer.id].agencyId.trim();
        const agentUserNamePassword = this.app.agencyLocation.insurers[this.insurer.id].agentId.trim();

        // Ensure the agent ID is a number (required for the API request)
        try {
            agentId = parseInt(agentId, 10);
        }
        catch (error) {
            log.error(`${logPrefix} error parsing AgentId ${error}` + __location)
            //return this.client_error(`Invalid AmTrust agent ID '${agentId}'`, __location, {error: error});
        }
        if (!agentId || agentId === 0) {
            return this.client_error(`Invalid AmTrust agent ID '${agentId}'`, __location);
        }

        // Split the comma-delimited username,password field.
        const commaIndex = agentUserNamePassword.indexOf(',');
        if (commaIndex <= 0) {
            return this.client_error(`AmTrust username and password are not comma-delimited. commaIndex ${commaIndex} `, __location);
        }
        const agentUsername = agentUserNamePassword.substring(0, commaIndex).trim();
        const agentPassword = agentUserNamePassword.substring(commaIndex + 1).trim();

        // Authorize the client
        const accessToken = await amtrustClient.authorize(credentials.clientId, credentials.clientSecret, agentUsername, agentPassword, credentials.mulesoftSubscriberId, this.insurer.useSandbox);
        if (!accessToken) {
            return this.client_error("Authorization with AmTrust server failed", __location);
        }

        // =========================================================================================================
        // Validation

        // Get primary location
        let primaryLocation = appDoc.locations.find(location => location.primary);
        if(!primaryLocation && appDoc.locations.length === 1){
            primaryLocation = appDoc.locations[0]
            log.debug(`${logPrefix}  Setting Primary location to the ONLY location \n ${JSON.stringify(primaryLocation)}` + __location)
        }
        else if(!primaryLocation) {
            return this.client_error("Missing a location being marked as the primary location");
        }

        // Per AmTrust e-mail from 2/4/2021, Partnerships in CA require at least 2 partners/owners
        if (appDoc.entityType === "Partnership" &&
            primaryLocation?.state === "CA" &&
            this.app.business.owners.length < 2) {
            return this.client_declined("AmTrust requires partnerships in CA to have at least 2 partners.");
        }

        // Ensure we have a supported legal entity.
        // The map values were pulled from https://anypoint.mulesoft.com/exchange/portals/amtrust-financial-service-9/acf997e3-018a-45c2-bbfa-52d79acf6edb/digitalapi/minor/1.0/console/method/%235970/
        const amtrustLegalEntityMap = {
            'Association': 4,
            'Corporation': 3,
            'Limited Liability Company': 12,
            'Limited Partnership': 7,
            'Partnership': 2,
            'Sole Proprietorship': 1
            // 'Other': null <- Not supported
        };
        if (!amtrustLegalEntityMap.hasOwnProperty(appDoc.entityType)) {
            return this.client_error(`The business entity type '${appDoc.entityType}' is not supported by this insurer.`, __location);
        }

        // Format the FEIN
        const fein = appDoc.ein ? appDoc.ein.replace(/\D/g, '') : "";

        let useQuotePut_OldQuoteId = false;
        // Check the status of the FEIN.
        if(fein){
            const einCheckResponse = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, '/api/v2/fein/validation', {fein: fein});
            if (einCheckResponse) {
                // Don't stop quoting if the EIN check fails.
                const feinErrors = this.getChildProperty(einCheckResponse, "Errors.Fein");
                if (feinErrors && feinErrors.includes("This FEIN is not available for this product.")) {
                    return this.client_declined("The EIN is blocked");
                }

                log.debug(`einCheckResponse ${JSON.stringify(einCheckResponse)}`)
                if (einCheckResponse.AdditionalMessages && einCheckResponse.AdditionalMessages[0]
                    && einCheckResponse.AdditionalMessages[0].includes("Please use PUT Quote Information to make any changes to the existing quote.")) {
                    useQuotePut_OldQuoteId = true;
                }
            }
        }
        //find old quoteID
        let quoteId = '';
        if(useQuotePut_OldQuoteId){
            try{
                log.debug(`${logPrefix}  getting old quoteId` + __location)
                const QuoteBO = global.requireShared('models/Quote-BO.js');
                const quoteBO = new QuoteBO();

                const quoteQuery = {
                    applicationId: appDoc.applicationId,
                    insurerId: this.insurer.id
                }
                const quoteList = await quoteBO.getList(quoteQuery);
                for(const quote of quoteList){
                    if(quote.quoteNumber){
                        quoteId = quote.quoteNumber;
                    }
                }
                if(!quoteId && appDoc.copiedFromAppId){
                    const quoteQuery2 = {
                        applicationId: appDoc.copiedFromAppId,
                        insurerId: this.insurer.id
                    }
                    const quoteList2 = await quoteBO.getList(quoteQuery2);
                    for(const quote of quoteList2){
                        if(quote.quoteNumber){
                            quoteId = quote.quoteNumber;
                        }
                    }
                }
                if(!quoteId){
                    useQuotePut_OldQuoteId = false;
                }
            }
            catch(err){
                log.error(`${logPrefix} Error get old quote ID: ${err} ${__location}`);
                return this.client_declined("The EIN is blocked By earlier application");
            }


        }

        // =========================================================================================================
        // Create the quote request
        if (!this.app.business.contacts[0].phone || this.app.business.contacts[0].phone.length === 0) {
            log.error(`AMtrust WC (application ${this.app.id}): Phone number is required for AMTrust submission.`);
            return this.client_error(`AMTrust submission requires phone number.`);
        }

        const primaryAddressLine = primaryLocation?.address + (primaryLocation?.address2 ? ", " + primaryLocation?.address2 : "");
        const mailingAddressLine = this.app.business.mailing_address + (this.app.business.mailing_address2 ? ", " + this.app.business.mailing_address2 : "");
        const quoteRequestDataV2 = {"Quote": {
            "EffectiveDate": this.policy.effective_date.format("MM/DD/YYYY"),
            "Fein": fein,
            "PrimaryAddress": {
                "Line1": primaryAddressLine.slice(0,50),
                "City": primaryLocation.city,
                "State": primaryLocation.state,
                "Zip": primaryLocation.zipcode.slice(0,5)
            },
            "MailingAddress": {
                "Line1": mailingAddressLine.slice(0,50),
                "City": this.app.business.mailing_city,
                "State": this.app.business.mailing_state_abbr,
                "Zip": this.app.business.mailing_zipcode.slice(0,5)
            },
            "BusinessName": this.app.business.name,
            "ContactInformation": {
                "FirstName": this.app.business.contacts[0].first_name,
                "LastName": this.app.business.contacts[0].last_name,
                "Email": this.app.business.contacts[0].email,
                "Phone": this.formatPhoneNumber(this.app.business.contacts[0].phone),
                "AgentContactId": agentId
            },
            "NatureOfBusiness": this.industry_code?.description ? this.industry_code.description : "unknown",
            "LegalEntity": amtrustLegalEntityMap[appDoc.entityType],
            "YearsInBusiness": this.get_years_in_business() > 99 ? 99 : this.get_years_in_business(),
            "IsNonProfit": false,
            "IsIncumbentAgent": false,
            //"IsIncumbantAgent": false,
            // "ExpiredPremium": 10000,
            "CompanyWebsiteAddress": this.app.business.website,
            "ClassCodes": await this.getClassCodeList()
        }};
        //it will error if fein is "".  It will price indicate without FEIN
        if(!fein){
            delete quoteRequestDataV2.Quote.Fein;
        }
        // Add the unemployment number if required
        const requiredUnemploymentNumberStates = ["MN",
            "HI",
            "RI",
            "ME"];
        if (requiredUnemploymentNumberStates.includes(primaryLocation.state)) {
            if (primaryLocation.unemployment_num === 0) {
                return this.client_error("AmTrust requires an unemployment number if located in MN, HI, RI, or ME.", __location);
            }
            quoteRequestDataV2.Quote.UnemploymentId = primaryLocation.unemployment_num.toString();
        }

        // Add the rating zip if any location is in California
        let ratingZip = null;
        let ratingZipPayroll = 0;
        for (const location of this.app.business.locations) {
            if (location.state_abbr === "CA") {
                let locationPayroll = 0;
                for (const activityCode of location.activity_codes) {
                    locationPayroll += activityCode.payroll;
                }
                if (locationPayroll > ratingZipPayroll) {
                    ratingZip = location.zipcode.slice(0,5);
                    ratingZipPayroll = locationPayroll;
                }
            }
        }
        if (ratingZip) {
            quoteRequestDataV2.Quote.RatingZip = ratingZip;
        }

        // =========================================================================================================
        // Create the additional information request
        const additionalInformationRequestData = {};
        if(this.app.business && appDoc.owners[0] && primaryLocation){
            //Officer may be replaced below if we get a response back from /officer-information
            additionalInformationRequestData.Officers = [];
            additionalInformationRequestData.AdditionalInsureds = [];
            appDoc.owners.forEach((owner) => {
                // do not send null; errors out at Amtrust
                // do not auto set percent ownership.
                // it may be an officer/Manager who does
                // not own any part of Crop (LLC that has hired a manager)
                if(!owner.ownership){
                    owner.ownership = 0;
                }
                const officerJSON = {
                    "Name": owner.fname + " " + owner.lname,
                    //"EndorsementId": "WC040303C",
                    "Type": "Officers",
                    "State": primaryLocation.state,
                    "OwnershipPercent": owner.ownership//,
                    //  "FormType": owner.include  ? "I" : "E"
                }
                try{
                    if(owner.DateOfBirth){
                        owner.DateOfBirth = moment(owner.birthdate).format("MM/DD/YYYY");
                    }
                }
                catch(err){
                    log.error(`owner DateOfBirth error ${err}` + __location)
                }
                additionalInformationRequestData.Officers.push(officerJSON)
                if(owner.included){
                    const additionalInsurerJSON = {
                        "Name": owner.fname + " " + owner.lname,
                        "TaxId": fein,
                        "State": primaryLocation.state,
                        "LegalEntity": amtrustLegalEntityMap[appDoc.entityType],
                        "DbaName": this.app.business.dba,
                        "AdditionalLocations": this.getAdditionalLocationList()
                    };
                    additionalInformationRequestData.AdditionalInsureds.push(additionalInsurerJSON)
                }
            });
        }
        // console.log("questionRequestData", JSON.stringify(questionRequestData, null, 4));

        // =========================================================================================================
        // Send the requests
        const successfulStatusCodes = [200, 201];
        let createQuoteMethod = 'POST';
        let createRoute = '/api/v2/quotes'

        let quoteRequestJSON = JSON.parse(JSON.stringify(quoteRequestDataV2));
        if(useQuotePut_OldQuoteId){
            log.debug(`AMTrust WC using PUT with old quoteId ${quoteId}` + __location)
            createQuoteMethod = "PUT";
            createRoute = `/api/v1/quotes/${quoteId}`
            this.number = quoteId;

            //V1 JSON
            quoteRequestJSON = quoteRequestJSON.Quote;
            // if(quoteRequestJSON.ContactInformation && quoteRequestJSON.ContactInformation.AgentContactId){
            //     delete quoteRequestJSON.ContactInformation.AgentContactId
            // }
            if(quoteRequestJSON.MailingAddress){
                quoteRequestJSON.MailingAddress1 = quoteRequestJSON.MailingAddress.Line1;
                quoteRequestJSON.MailingCity = quoteRequestJSON.MailingAddress.City;
                quoteRequestJSON.MailingState = quoteRequestJSON.MailingAddress.State;
                quoteRequestJSON.MailingZip = quoteRequestJSON.MailingAddress.Zip.slice(0,5);

                delete quoteRequestJSON.MailingAddress;

            }
            if(quoteRequestJSON.ClassCodes){
                quoteRequestJSON.ClassCodes.forEach((classCode) => {
                    if(classCode.Payroll){
                        classCode.Payroll = classCode.Payroll.toString();
                    }
                });
            }


        }
        // Send the quote request
        const quoteResponse = await this.amtrustCallAPI(createQuoteMethod, accessToken, credentials.mulesoftSubscriberId, createRoute, quoteRequestJSON);
        if (!quoteResponse) {
            log.error(`${logPrefix}  returned no response on Quote Post` + __location)
            return this.client_error("The Amtrust server returned an unexpected empty response when submitting the quote information.", __location);
        }

        // console.log("quoteResponse", JSON.stringify(quoteResponse, null, 4));
        let statusCode = this.getChildProperty(quoteResponse, "StatusCode");
        if(useQuotePut_OldQuoteId){
            statusCode = this.getChildProperty(quoteResponse, "HttpStatusCode");
        }

        if (!statusCode || !successfulStatusCodes.includes(statusCode)) {
            if (quoteResponse.error) {
                return this.client_error(quoteResponse.error, __location, {statusCode: statusCode})
            }
            else if(typeof quoteResponse === 'string'){
                if(quoteResponse.indexOf('creating quote.ClassCode') > 0){
                    let declineMessage = quoteResponse;
                    const messageParts = quoteResponse.split(':');
                    if(messageParts?.length > 1){
                        declineMessage = messageParts[1];
                    }
                    return this.client_declined(`The insurer reports ${declineMessage}`);
                }
                log.error(`Amtrust WC Application ${this.app.id} returned unexpected response of ${quoteResponse} on Quote Post` + __location)
                return this.client_error(`The AmTrust's server returned: ${quoteResponse}.`, __location, {statusCode: statusCode});
            }
            else {
                //check declinereasons
                const respString = JSON.stringify(quoteResponse);
                if(respString.indexOf("Quote has been declined, and cannot be edited") > -1){
                    log.info(`Amtrust WC Application ${this.app.id} quote already delcined ${quoteResponse} on Quote Post` + __location)
                    return this.client_declined("Amtrust: Quote has been declined, and cannot be edited");
                }

                log.error(`Amtrust WC Application ${this.app.id} returned unexpected response of ${JSON.stringify(quoteResponse)} on Quote Post` + __location)
                return this.client_error(`The AmTrust's server returned an unspecified error when submitting the quote information.  ${JSON.stringify(quoteResponse)}`, __location, {statusCode: statusCode});
            }

        }

        // Check if the quote has been declined. If declined, subsequent requests will fail.
        let quoteEligibility = this.getChildProperty(quoteResponse, "Data.Eligibility.Eligibility");
        if (quoteEligibility === "Decline") {
            // A decline at this stage is based on the class codes; they are out of appetite.
            if(quoteResponse.Data.AdditionalMessages?.length > 0){
                return this.client_declined(`The insurer reports ${quoteResponse.Data.AdditionalMessages[0]}`);
            }
            return this.client_declined(`The insurer reports that they will not write a policy with the selected state and one of class codes`);

        }


        if(useQuotePut_OldQuoteId === false){
            // Extract the quote ID
            if(useQuotePut_OldQuoteId === false){
                quoteId = this.getChildProperty(quoteResponse, "Data.AccountInformation.QuoteId");
                if (!quoteId) {
                    return this.client_error(`Could not find the quote ID in the response.`, __location);
                }
            }
            this.number = quoteId;
        }
        else {
            quoteResponse.Data = JSON.parse(JSON.stringify(quoteResponse));
        }
        let isPriceIndicated = false;
        let priceIndicationAmount = null
        if(quoteResponse.Data?.PremiumDetails?.PriceIndication > 0){
            isPriceIndicated = true;
            priceIndicationAmount = quoteResponse.Data.PremiumDetails.PriceIndication
        }
        else if(quoteResponse.PremiumDetails?.PriceIndication > 0){
            isPriceIndicated = true;
            priceIndicationAmount = quoteResponse.PremiumDetails.PriceIndication
        }
        else if(quoteResponse.EstimatedAnnualPremium > 0){
            isPriceIndicated = true;
            priceIndicationAmount = quoteResponse.EstimatedAnnualPremium
        }
        //If quickQuote were are done.
        if(quickQuote){
            if(!useQuotePut_OldQuoteId){
                //get price_indication
                if(quoteEligibility === "Refer") {
                    return this.client_referred(quoteId, {}, priceIndicationAmount);
                }
                else if (quoteEligibility === 'BindEligible'){
                    return this.client_quoted(quoteId, {}, priceIndicationAmount);
                }
                else {
                    if(quoteResponse.Data.AdditionalMessages?.length > 0){
                        log.error(`Amtrust WC Application ${this.app.id} The insurer reports ${quoteResponse.Data.AdditionalMessages[0]}` + __location);
                        return this.client_declined(`The insurer reports ${quoteResponse.Data.AdditionalMessages[0]}`);
                    }
                    return this.client_error(`AmTrust returned an unknown eligibility type of '${quoteEligibility}`, __location);
                }
            }
            else if (isPriceIndicated) {
                return this.client_referred(quoteId, {}, priceIndicationAmount);
            }
        }

        // ************ SEND LIMITS - Must use the quoteReponse.data to send limits.
        //   Anything not in the update PUT will be deleted.  per AMtrust docs
        //
        // ***************************************************************
        //
        //

        //Get available limites

        const quoteAvailableLlimitesResponse = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/available-liability-limits`);
        if (!quoteAvailableLlimitesResponse) {
            if(priceIndicationAmount && isPriceIndicated){
                log.error(`${logPrefix} Unexpected GET limits response - no response` + __location);
                this.reasons.push(`The insurer's server returned an unspecified error when get the quote available limits information`);
                return this.client_referred(quoteId, {}, priceIndicationAmount);
            }
            return this.client_error("The insurer's server returned an unspecified error when get the quote available limits information.", __location);
        }
        const availableLimitsArray = quoteAvailableLlimitesResponse.Data;
        if(availableLimitsArray && availableLimitsArray.length > 0){
            if(availableLimitsArray.indexOf(amTrustLimits) === -1){
                //not in array.  select last postion is array. assuming it it the biggest
                amTrustLimits = availableLimitsArray[availableLimitsArray.length - 1]
            }
        }

        //LiabilityLimits
        // eslint-disable-next-line prefer-const
        let amTrustApplicationJSON = quoteResponse.Data;
        amTrustApplicationJSON.LiabilityLimits = amTrustLimits;

        const quoteUpdateResponse = await this.amtrustCallAPI('PUT', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}`, amTrustApplicationJSON);
        if (!quoteUpdateResponse) {
            if(priceIndicationAmount && isPriceIndicated){
                log.error(`${logPrefix} Unexpected Quote limits update response - no response` + __location);
                this.reasons.push(`The insurer's server returned an unspecified error when submitting the quote update information.`);
                return this.client_referred(quoteId, {}, priceIndicationAmount);
            }
            return this.client_error("The insurer's server returned an unspecified error when submitting the quote update information.", __location);
        }

        // ==============================================================================================================

        // Get the required questions list to ensure we are submitting the correct questions and to resolve question IDs
        const requiredQuestionList = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/questions`);
        // If this fails, we can still quote (referred)
        if (requiredQuestionList) {
            // =========================================================================================================
            // Create the questions request
            const questionRequestData = [];
            for (const questionId in this.questions) {
                const question = this.questions[questionId];
                // Get the answer
                let answer = null;
                try {
                    answer = this.determine_question_answer(question);
                }
                catch (error) {
                    log.error(`AMtrust WC (application ${this.app.id}): Could not determine question ${questionId} answer: ${error} ${__location}`);
                    //return this.client_error('Could not determine the answer for one of the questions', __location, {questionId: questionId});
                }
                //this.question_details - contains some the insurerQuestion details.
                // This question was not answered
                if (!answer || !this.question_details[questionId]) {
                    continue;
                }

                for (const requiredQuestion of requiredQuestionList.Data) {
                    if (requiredQuestion.Question.toLowerCase().trim() === this.question_details[questionId].insurerText.toLowerCase().trim()) {
                        questionRequestData.push({
                            QuestionId: requiredQuestion.Id,
                            AnswerValue: answer
                        });
                    }
                }
            }
            // Send the question request
            if (questionRequestData.length > 0) {
                // console.log("questionRequest", questionRequestData);
                await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/questions-answers`, questionRequestData);
                // We can still quote if this fails. Continue...
            }
        }

        // check eligibility of quote after answer submit before proceeding. If declined, send decline here
        let eligibilityResponse = null;
        try {
            eligibilityResponse = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/eligibility`);
            quoteEligibility = this.getChildProperty(eligibilityResponse, "Data.Eligibility");

            if (quoteEligibility === 'Decline') {
                return this.client_declined(`The client has declined to offer you coverage at this time.`);
            }
        }
        catch (e) {
            log.error(`AMtrust WC (application ${this.app.id}): Unable to check quote eligibility after submitting question answers: ${e}.`);
            if(priceIndicationAmount && isPriceIndicated){
                this.reasons.push("The insurer's server returned an unspecified error after submitting question answers.");
                //we got a price indication above probably errored in questions.
                return this.client_referred(quoteId, {}, priceIndicationAmount);
            }
        }

        // Get the available officer information
        let attempts = 0;
        let retry = false;
        let sendOfficers = false;
        do {
            retry = false;
            // wait before making officer call (first attempt is instant)
            await Sleep(attempts === 0 ? 0 : OFFICER_RETRY_TIME);

            const officerInformation = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/officer-information`);
            // only process if there are endorsements available.
            if (officerInformation && officerInformation.Data && officerInformation.Data[0].EndorsementInformation?.Endorsements.length > 0) {
                // Populate the officers
                const officersResult = this.getOfficers(officerInformation.Data, primaryLocation);
                if (Array.isArray(officersResult)) {
                    additionalInformationRequestData.Officers = officersResult;
                    sendOfficers = true;
                    break;
                }
                else {
                    retry = true;
                }
            }
            else if(officerInformation && officerInformation.Data && officerInformation.Data[0].EndorsementInformation?.ValidationMessage){
                log.warn(`${logPrefix}No Endorsements for Officer information  - ${officerInformation.Data[0].EndorsementInformation?.ValidationMessage}` + __location);
                break;
            }
            else {
                retry = true;
            }

            if (retry) {
                attempts++;

                // handling exit case here so I don't have to pull scoped variables out of do while for logging
                if (attempts > OFFICER_MAX_RETRIES) {
                    if(officerInformation.Data?.EndorsementInformation?.Endorsements.length > 0){
                        log.error(`Unexpected Officer response ${JSON.stringify(officerInformation)}` + __location);
                    }
                    //do not stop the quote.  We will get here for situations that have no endorsements.
                    //return this.client_error(`Unexpected Officer response ${JSON.stringify(officerInformation)}`, __location);
                    break;
                }
                else {
                    log.warn(`${logPrefix}Failed to get Officer information (retry attempts: ${attempts}/${OFFICER_MAX_RETRIES}), retrying...` + __location);
                }
            }
        }
        while (attempts <= OFFICER_MAX_RETRIES);

        if(sendOfficers === false){
            additionalInformationRequestData.Officers = [];
        }

        // Send the additional information request
        if(additionalInformationRequestData.Officers?.length > 0 || additionalInformationRequestData.AdditionalInsureds?.length > 0){
            const additionalInformationResponse = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, `/api/v2/quotes/${quoteId}/additional-information`, additionalInformationRequestData);
            if (!additionalInformationResponse) {
                return this.client_error("The insurer's server returned an unspecified error when submitting the additional quote information.", __location);
            }
            // console.log("additionalInformationResponse", JSON.stringify(additionalInformationResponse, null, 4));
            statusCode = this.getChildProperty(additionalInformationResponse, "StatusCode");
            if (!statusCode || !successfulStatusCodes.includes(statusCode)) {
                if (additionalInformationResponse.Message) {
                    return this.client_error(additionalInformationResponse.Message, __location, {statusCode: statusCode});
                }
                else if (quoteResponse.error) {
                    return this.client_error(quoteResponse.error, __location, {statusCode: statusCode})
                }
                else {
                    if(priceIndicationAmount && isPriceIndicated){
                        log.error(`${logPrefix} Unexpected Additional information response ${statusCode}` + __location);
                        this.reasons.push("The insurer's server returned an unspecified error when updating additional-information.");
                        //we got a price indication above probably errored in questions.
                        return this.client_referred(quoteId, {}, priceIndicationAmount);
                    }
                    return this.client_error("The insurer's server returned an unspecified error when submitting the additional quote information.", __location, {statusCode: statusCode});
                }
            }
        }

        // Get the quote information
        let quoteInformationResponse = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v2/quotes/${quoteId}?loadQuestions=true`);
        if (!quoteInformationResponse) {
            log.error(`Appid: ${this.app.id} AmTrust WC insurer's server returned an unspecified error when retrieving the final quote information. `, __location, {statusCode: statusCode})
            if(priceIndicationAmount && isPriceIndicated){
                this.reasons.push("The insurer's server returned an unspecified error when retrieving the final quote information.");
                //we got a price indication above probably errored in questions.
                return this.client_referred(quoteId, {}, priceIndicationAmount);
            }
            return this.client_error("The insurer's server returned an unspecified error when retrieving the final quote information.", __location, {statusCode: statusCode});
        }
        // console.log("quoteInformationResponse", JSON.stringify(quoteInformationResponse, null, 4));
        if(quoteInformationResponse.Data){
            quoteInformationResponse = quoteInformationResponse.Data;
        }
        // =========================================================================================================
        // Process the quote information response

        // Extract the limits
        const quoteLimits = {};
        const quoteLimitPerAccident = this.getChildProperty(quoteInformationResponse, "PremiumDetails.LimitPerAccident");
        if (quoteLimitPerAccident) {
            quoteLimits[1] = quoteLimitPerAccident;
        }
        const quoteLimitDiseaseEachEmployee = this.getChildProperty(quoteInformationResponse, "PremiumDetails.BodilyInjuryFromDiseasePerEmployeeLimit");
        if (quoteLimitDiseaseEachEmployee) {
            quoteLimits[2] = quoteLimitDiseaseEachEmployee;
        }
        const quoteLimitDiseasePolicyLimit = this.getChildProperty(quoteInformationResponse, "PremiumDetails.BodilyInjuryFromDiseasePolicyLimit");
        if (quoteLimitDiseasePolicyLimit) {
            quoteLimits[3] = quoteLimitDiseasePolicyLimit;
        }

        // Extract other information
        const quotePremium = this.getChildProperty(quoteInformationResponse, "PremiumDetails.PriceIndication");
        const quoteLink = this.getChildProperty(quoteInformationResponse, "AccountInformation.AccountUrl");

        // Return the quote
        quoteEligibility = this.getChildProperty(quoteInformationResponse, "Eligibility.Eligibility");
        if(!quoteEligibility){
            quoteEligibility = this.getChildProperty(quoteInformationResponse, "Data.Eligibility.Eligibility");
        }
        if (!quoteEligibility) {
            if(priceIndicationAmount && isPriceIndicated){
                log.error(`${logPrefix} The quote elibility could not be found for quote` + __location);
                this.reasons.push("The quote elibility could not be found for quote after final update.");
                //we got a price indication above probably errored in questions.
                return this.client_referred(quoteId, quoteLimits, priceIndicationAmount);
            }
            return this.client_error(`The quote elibility could not be found for quote ${quoteId}.`);
        }
        // need to check if Refer has paymentPlans.
        if(quoteEligibility === 'BindEligible'){
            try{
                const quoteAvailablePaymentPlansResponse = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v2/quotes/${quoteId}/paymentPlans`);
                if(quoteAvailablePaymentPlansResponse && quoteAvailablePaymentPlansResponse.Data){
                    // eslint-disable-next-line prefer-const
                    let paymentPlanList = quoteAvailablePaymentPlansResponse.Data
                    // eslint-disable-next-line prefer-const
                    let directPlans = paymentPlanList.Direct;
                    if(directPlans){
                        for (let i = 0; i < directPlans.length; i++) {
                            // eslint-disable-next-line prefer-const
                            let paymentPlan = directPlans[i];
                            paymentPlan.paymentPlanId = paymentPlan.PaymentPlanId;
                            paymentPlan.paymentPlanDescription = paymentPlan.PaymentPlanDescription;
                        }
                    }
                    this.insurerPaymentPlans = directPlans;

                    //TalageInsurerPaymentPlans
                    // eslint-disable-next-line prefer-const
                    let talageInsurerPaymentPlans = JSON.parse(JSON.stringify(paymentPlanList.Direct));
                    if(talageInsurerPaymentPlans){
                        for (let i = 0; i < talageInsurerPaymentPlans.length; i++) {
                            // eslint-disable-next-line prefer-const
                            let paymentPlan = talageInsurerPaymentPlans[i];
                            paymentPlan.insurerPaymentPlanId = paymentPlan.PaymentPlanId;
                            paymentPlan.insurerPaymentPlanDescription = paymentPlan.PaymentPlanDescription;
                            paymentPlan.invoices = paymentPlan.Invoices
                            for(const invoice of paymentPlan.Invoices){
                                if(invoice.IsDownPayment === false){
                                    paymentPlan.installmentPayment = invoice.TotalBillAmount;
                                }
                            }
                            if(paymentPlan.insurerPaymentPlanId < 3){
                                paymentPlan.paymentPlanId = paymentPlan.insurerPaymentPlanId
                            }
                            else {
                                switch(paymentPlan.insurerPaymentPlanId){
                                    case 4:
                                        paymentPlan.paymentPlanId = 3;
                                        break;
                                    case 8:
                                        paymentPlan.paymentPlanId = 4;
                                        break;
                                    default:
                                        //does not mapp to Talage PaymentPlan
                                        break;
                                }
                            }

                        }
                    }
                    this.talageInsurerPaymentPlans = talageInsurerPaymentPlans;
                }
                else {
                    log.error(`Appid: ${this.app.id} AmTrust WC did not get payment plans QuoteId: ${quoteId} ` + __location);
                }
            }
            catch(err){
                log.error(`Appid: ${this.app.id} AmTrust WC error getting payment plans ${err}` + __location);
            }
        }


        switch (quoteEligibility) {
            case "BindEligible":
                this.isBindable = true
                if (quoteLink) {
                    this.quoteLink = quoteLink;
                }
                //Get Quote PDF.
                //getQuoteLetter
                await this.getQuoteLetter(quoteId,accessToken, credentials)

                return this.client_quoted(quoteId, quoteLimits, quotePremium);
            case "Refer":
                if (quoteLink) {
                    this.quoteLink = quoteLink;
                }
                return this.client_referred(quoteId, quoteLimits, quotePremium);
            case "Decline":
                // There is no decline reason in their response
                return this.client_declined("The insurer has declined to offer you coverage at this time");
            default:
                if(priceIndicationAmount && isPriceIndicated){
                    //we got a price indication above probably errored in questions.
                    return this.client_referred(quoteId, quoteLimits, priceIndicationAmount);
                }
                break;
        }

        // Unregnized quote statue
        return this.client_error(`AmTrust returned an unknown eligibility type of '${quoteEligibility}`);
    }

    async getQuoteLetter(quoteId,accessToken, credentials){
        //this.quote_letter.data;
        try{
            const quoteDocBytes = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, `/api/v1/print/${quoteId}`);
            if (quoteDocBytes) {
                this.quote_letter.data = quoteDocBytes;
            }
        }
        catch(err){
            log.error(`Appid: ${this.app.id} AMTrust WC: Error getting quote doc ${err} ` + __location)
        }
        return;

    }
};