'use strict';

const Integration = require('../Integration.js');
global.requireShared('./helpers/tracker.js');

// const amtrustTestHost = "utgateway.amtrustgroup.com";
// const amtrustTestBasePath = "/DigitalAPI_Usertest";

// const amtrustProductionHost = "gateway.amtrustgroup.com";
// const amtrustProductionBasePath = "/DigitalAPI";

const travelersStagingHost = "swi-qa.travelers.com";
const travelersProductionHost = "swi.travelers.com";
const travelersBasePath = "/biswi/api/qi/wc/1-0-0";

const travelersTalageProducerCode = "0XL023";
const travelersTalageUploadVendorCode = "TALG";

module.exports = class AcuityWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = false;
        this.requiresInsurerActivityCodes = false;
    }

    /**
     * Formats a phone number as an AmTrust expected phone number
     * @param  {number} phoneNumber - The phone number
     * @returns {string} Formatted phone number of XXX-XXX-XXXX
     */
    // formatPhoneNumber(phoneNumber) {
    //     const phoneNumberString = phoneNumber.toString();
    //     return `${phoneNumberString.substring(0, 3)}-${phoneNumberString.substring(3, 6)}-${phoneNumberString.substring(6, 10)}`;
    // }

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
            if (!child.hasOwnProperty(childName)) {
                return null;
            }
            child = child[childName];
        }
        return child;
    }

    /**
     * Gets a list of classifications for a given location
     * @param {object} location - Location
     * @returns {object} Array of classifications with code, payroll, and full/part time employees for each
     */
    getLocationClassificationList(location) {
        const locationClassificationList = [];

        // Aggregate activity codes for this location, summing payroll and full/part time employees
        const activityCodeMap = {};
        for (const locationActivityCode of location.activity_codes) {
            if (!activityCodeMap.hasOwnProperty(locationActivityCode.ncciCode)) {
                activityCodeMap[locationActivityCode.ncciCode] = {
                    payroll: 0,
                    partTimeEmployees: 0,
                    fullTimeEmployees: 0
                };
            }
            activityCodeMap[locationActivityCode.ncciCode].payroll += locationActivityCode.payroll;
            // activityCodeMap[locationActivityCode.ncciCode].fullTimeEmployees += ;
            // activityCodeMap[locationActivityCode.ncciCode].partTimeEmployees += ;
            activityCodeMap[locationActivityCode.ncciCode].fullTimeEmployees = 1;
            activityCodeMap[locationActivityCode.ncciCode].partTimeEmployees = 0;
        }
        // Build the location classification list array
        for (const activityCode of Object.keys(activityCodeMap)) {
            locationClassificationList.push({
                classCode: activityCode.toString(),
                totalAnnualPayroll: activityCodeMap[activityCode].payroll,
                numberFullTimeEmployees: activityCodeMap[activityCode].fullTimeEmployees,
                numberPartTimeEmployees: activityCodeMap[activityCode].partTimeEmployees
            });
        }
        return locationClassificationList;
    }

    /**
     * Gets a list of locations
     * @returns {object} Array of locations
     */
    getLocationList() {
        const locationList = [];
        for (let i = 0; i < this.app.business.locations.length; i++) {
            const location = this.app.business.locations[i];
            locationList.push({
                address: {
                    "address": location.address,
                    "addressLine2": location.address2 || "",
                    "city": location.city,
                    "state": location.state_abbr,
                    "zipcode": location.zip
                    // "phone": "1" + location.phone ?Required?
                },
                primaryLocationInd: i === 0,
                classification: this.getLocationClassificationList(location)
            });
        }
        return locationList;
    }


    /**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {

        // =========================================================================================================
        // Validation

        // Ensure we have a supported legal entity.
        const legalEntityMap = {
            'Association': 'AS',
            'Corporation': 'CP',
            'Limited Liability Company': 'LL',
            'Limited Partnership': 'LP',
            'Partnership': 'GP',
            'Sole Proprietorship': 'SolePrp',
            'Other': 'OT'
        };
        if (!legalEntityMap.hasOwnProperty(this.app.business.locations[0].business_entity_type)) {
            return this.client_error(`The business entity type '${this.app.business.locations[0].business_entity_type}' is not supported by this insurer.`, __location);
        }

        // Ensure we have a valid SIC code
        if (!this.industry_code.sic) {
            return this.client_error(`Could not determine the SIC code for industry code ${this.industry_code.id}: '${this.industry_code_description}'`, __location);
        }

        // Ensure we have valid NCCI code mappings
        for (const location of this.app.business.locations) {
            for (const activityCode of location.activity_codes) {
                const ncciCode = await this.get_national_ncci_code_from_activity_code(location.territory, activityCode.id);
                if (!ncciCode) {
                    return this.client_error(`Could not determine the NCCI code for activity code ${activityCode.id} in ${location.territory}.`, __location);
                }
                activityCode.ncciCode = ncciCode;
            }
        }

        // =========================================================================================================
        // Create the quote request
        const quoteRequestData = {
            "requestId": this.generate_uuid(),
            "sessionId": this.generate_uuid(),
            "policyEffectiveDate": this.policy.effective_date.format("YYYY-MM-DD"),
            "policyExpirationDate": this.policy.expiration_date.format("YYYY-MM-DD"),
            "lineOfBusinessCode": "WC",
            "SICCode": this.industry_code.sic.toString(),
            "crossSellInd": false,
            "producer": {
                "producerCode": this.app.agencyLocation.insurers[this.insurer.id].agency_id,
                "uploadVendorCode": travelersTalageUploadVendorCode
            },
            "customer": {
                // "externalCustomerId": "string", ?? Unsure what this is
                "primaryNameInsured": this.app.business.name,
                "tradeDBALine1": this.app.business.dba ? this.app.business.dba : "",
                "tradeDBALine2": "",
                "FEIN": this.app.business.locations[0].identification_number,
                "legalEntity": legalEntityMap[this.app.business.locations[0].business_entity_type],
                "address": {
                    "mailingAddress": this.app.business.mailing_address,
                    "mailingAddressLine2": this.app.business.mailing_address2 ? this.app.business.mailing_address2 : "",
                    "mailingCity": this.app.business.mailing_city,
                    "mailingState": this.app.business.mailing_state_abbr,
                    "mailingZipcode": this.app.business.mailing_zipcode,
                    "insuredPhoneNumber": "1" + this.app.business.contacts[0].phone.toString()
                },
                "contact": {
                    "firstName": this.app.business.contacts[0].first_name,
                    "lastName": this.app.business.contacts[0].last_name,
                    "middleInitial": ""
                }
            },
            "businessInfo": {"locations": this.getLocationList()},
            "basisOfQuotation": {
                // "pricing": {
                //     "experienceMod": "string",
                //     "modStatus": "string",
                //     "riskId": "string",
                //     "experienceModEffectiveDate": "string"
                // },
                "eligibility": {},
                //     "hoursOfOperation": [
                //         "OP10PM  No later than 10 pm",
                //         "OP24HRS 24 Hours",
                //         "OP2AM No later than 2 am",
                //         "OPAFT2AM  Past 2 am",
                //         "OPMIDNT No later than Midnight"
                //     ],
                //     "deliveryProvidedInd": true,
                //     "aircraftInd": true,
                //     "towingServicesInd": true,
                //     "numberEmployeesPerShift": 0,
                //     "vehicleWorkExLightMedTrucksInd": true,
                //     "ownedBusinessAutos": 0
                // },
                "yearBusinessEstablished": this.app.business.founded.format("YYYY"),
                "claimCountCurrentPolicy": 0,
                "claimCountPriorThreePolicy": 0,
                "totalAnnualWCPayroll": this.get_total_payroll(),
                "employersLiabilityLimit": "100000/500000/100000"
                // "threeYearsManagementExperienceInd": true,
                // "operateAsGeneralContractorInd": true
            }
        };
        if (this.insurer.useSandbox) {
            quoteRequestData.testTransaction = true;
        }

        console.log("quoteRequestData", JSON.stringify(quoteRequestData, null, 4));
        return null;

        // =========================================================================================================
        // Send the request

        console.log("Authorization", (this.username + ":" + this.password).toString('base64'));

        const host = this.useSandbox ? travelersStagingHost : travelersProductionHost;
        let response = null;
        try {
            response = await this.send_json_request(host, travelersBasePath + "/quote",
                JSON.stringify(quoteRequestData),
                {"Authorization": 'Basic ' + (this.username + ":" + this.password).toString('base64')},
                "POST");
        }
        catch (error) {
            return this.client_error(`The quote could not be submitted to the insurer: ${error}`, __location, {error: error});
        }

        console.log("response", JSON.stringify(response, null, 4));

        // =========================================================================================================
        // Process the quote information response

        const quoteStatus = this.getChildProperty(response, "quoteStatus");
        if (!quoteStatus) {
            return this.client_error(`Could not locate the quote status in the response.`, __location);
        }
        // Extract all optional and required information
        const quoteStatusReasons = this.getChildProperty(response, "quoteStatusReasons") || [];
        const quoteId = this.getChildProperty(response, "eQuoteId");
        const premium = this.getChildProperty(response, "totalAnnualPremiumSurchargeTaxAmount");
        const validationDeepLink = this.getChildProperty(response, "validationDeeplink");
        const employersLiabilityLimit = this.getChildProperty(response, "employersLiabilityLimit");

        // Process the limits
        const limits = [];
        if (employersLiabilityLimit) {
            const individualLimitList = employersLiabilityLimit.split("/");
            if (individualLimitList.length !== 3) {
                // Continue without the limits but log it
                this.log_error(`Returned unrecognized limits of '${employersLiabilityLimit}'. Continuing.`);
            }
            else {
                limits[1] = individualLimitList[0];
                limits[2] = individualLimitList[1];
                limits[3] = individualLimitList[2];
            }
        }
        // Log debug messages
        const debugMessageList = this.getChildProperty(response, "debugMessages");
        for (const debugMessage of debugMessageList) {
            this.log_debug(`${debugMessage.code}: ${debugMessage.description}`);
        }
        // Handle the status
        switch (quoteStatus) {
            case "DECLINE":
                let declineReason = '';
                for (const quoteStatusReason of quoteStatusReasons) {
                    declineReason += `${declineReason.length ? ", " : ""}${quoteStatusReason.description} (${quoteStatusReason.code})`;
                }
                return this.client_declined('The insurer reported: ' + declineReason);
            case "UNQUOTED":
                let errorReason = '';
                for (const quoteStatusReason of quoteStatusReasons) {
                    errorReason += `${errorReason.length ? ", " : ""}${quoteStatusReason.description} (${quoteStatusReason.code})`;
                }
                return this.client_declined('The insurer reported: ' + errorReason);
            case "AVAILABLE":
                if (!validationDeepLink) {
                    this.log_error("Could not locate validationDeepLink property in response.", __location);
                }
                else {
                    console.log("validationDeepLink", validationDeepLink);
                }
                return this.client_quoted(quoteId, limits, premium);
            default:
                break;
        }

        // Unrecognized quote status
        return this.client_error(`Received an unknown quote status of '${quoteStatus}`);
    }
};