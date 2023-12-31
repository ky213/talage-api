/* eslint-disable no-unneeded-ternary */
const Integration = require('../Integration.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
global.requireShared('./helpers/tracker.js');
const {convertToDollarFormat} = global.requireShared('./helpers/stringFunctions.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const axios = require('axios');

const utility = global.requireShared('./helpers/utility.js');
const moment = require('moment');

const cowbellStagingHost = "https://api.morecowbell.ai";
const cowbellStagingBasePath = "/api";

const cowbellProductionHost = "https://api.cowbellcyber.ai";
const cowbellProductionBasePath = "/api";


module.exports = class cowbellCyber extends Integration {

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
	 * Requests a quote from Insurer and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        const appDoc = this.applicationDocData


        const aggregateLimits = [50000,
            100000,
            250000,
            500000,
            750000,
            1000000,
            2000000,
            3000000,
            4000000,
            5000000];


        const subLimitsMatrix = [
            {
                "AggregateLimit": 50000,
                "DeductibleAmount": 1000,
                "BusinessIncome": 50000,
                "SocialEngineeringSublimit": 50000,
                "SocialEngineeringDeductible": 5000,
                "RansomPaymentsSublimit": 50000,
                "WebsiteMedia": 50000
            },
            {
                "AggregateLimit": 50000,
                "DeductibleAmount": 5000,
                "BusinessIncome": 50000,
                "SocialEngineeringSublimit": 50000,
                "SocialEngineeringDeductible": 5000,
                "RansomPaymentsSublimit": 50000,
                "WebsiteMedia": 50000
            },
            {
                "AggregateLimit": 50000,
                "DeductibleAmount": 10000,
                "BusinessIncome": 50000,
                "SocialEngineeringSublimit": 50000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 50000,
                "WebsiteMedia": 50000
            },
            {
                "AggregateLimit": 50000,
                "DeductibleAmount": 25000,
                "BusinessIncome": 50000,
                "SocialEngineeringSublimit": 50000,
                "SocialEngineeringDeductible": 25000,
                "RansomPaymentsSublimit": 50000,
                "WebsiteMedia": 50000
            },
            {
                "AggregateLimit": 100000,
                "DeductibleAmount": 1000,
                "BusinessIncome": 100000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 100000,
                "WebsiteMedia": 100000
            },
            {
                "AggregateLimit": 100000,
                "DeductibleAmount": 5000,
                "BusinessIncome": 100000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 100000,
                "WebsiteMedia": 100000
            },
            {
                "AggregateLimit": 100000,
                "DeductibleAmount": 10000,
                "BusinessIncome": 100000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 100000,
                "WebsiteMedia": 100000
            },
            {
                "AggregateLimit": 100000,
                "DeductibleAmount": 25000,
                "BusinessIncome": 100000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 25000,
                "RansomPaymentsSublimit": 100000,
                "WebsiteMedia": 100000
            },
            {
                "AggregateLimit": 100000,
                "DeductibleAmount": 50000,
                "BusinessIncome": 100000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 50000,
                "RansomPaymentsSublimit": 100000,
                "WebsiteMedia": 100000
            },
            {
                "AggregateLimit": 250000,
                "DeductibleAmount": 1000,
                "BusinessIncome": 250000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 250000,
                "WebsiteMedia": 250000
            },
            {
                "AggregateLimit": 250000,
                "DeductibleAmount": 5000,
                "BusinessIncome": 250000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 250000,
                "WebsiteMedia": 250000
            },
            {
                "AggregateLimit": 250000,
                "DeductibleAmount": 10000,
                "BusinessIncome": 250000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 250000,
                "WebsiteMedia": 250000
            },
            {
                "AggregateLimit": 250000,
                "DeductibleAmount": 25000,
                "BusinessIncome": 250000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 25000,
                "RansomPaymentsSublimit": 250000,
                "WebsiteMedia": 250000
            },
            {
                "AggregateLimit": 250000,
                "DeductibleAmount": 50000,
                "BusinessIncome": 250000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 50000,
                "RansomPaymentsSublimit": 250000,
                "WebsiteMedia": 250000
            },
            {
                "AggregateLimit": 500000,
                "DeductibleAmount": 1000,
                "BusinessIncome": 500000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 500000,
                "WebsiteMedia": 500000
            },
            {
                "AggregateLimit": 500000,
                "DeductibleAmount": 5000,
                "BusinessIncome": 500000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 250000,
                "WebsiteMedia": 250000
            },
            {
                "AggregateLimit": 500000,
                "DeductibleAmount": 10000,
                "BusinessIncome": 500000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 250000,
                "WebsiteMedia": 250000
            },
            {
                "AggregateLimit": 500000,
                "DeductibleAmount": 25000,
                "BusinessIncome": 500000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 25000,
                "RansomPaymentsSublimit": 250000,
                "WebsiteMedia": 250000
            },
            {
                "AggregateLimit": 500000,
                "DeductibleAmount": 50000,
                "BusinessIncome": 500000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 50000,
                "RansomPaymentsSublimit": 250000,
                "WebsiteMedia": 250000
            },
            {
                "AggregateLimit": 750000,
                "DeductibleAmount": 1000,
                "BusinessIncome": 750000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 500000,
                "WebsiteMedia": 500000
            },
            {
                "AggregateLimit": 750000,
                "DeductibleAmount": 1000,
                "BusinessIncome": 750000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 500000,
                "WebsiteMedia": 500000
            },
            {
                "AggregateLimit": 750000,
                "DeductibleAmount": 5000,
                "BusinessIncome": 750000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 500000,
                "WebsiteMedia": 500000
            },
            {
                "AggregateLimit": 750000,
                "DeductibleAmount": 10000,
                "BusinessIncome": 750000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 500000,
                "WebsiteMedia": 500000
            },
            {
                "AggregateLimit": 750000,
                "DeductibleAmount": 25000,
                "BusinessIncome": 750000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 25000,
                "RansomPaymentsSublimit": 500000,
                "WebsiteMedia": 500000
            },
            {
                "AggregateLimit": 750000,
                "DeductibleAmount": 50000,
                "BusinessIncome": 750000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 50000,
                "RansomPaymentsSublimit": 500000,
                "WebsiteMedia": 500000
            },
            {
                "AggregateLimit": 1000000,
                "DeductibleAmount": 1000,
                "BusinessIncome": 750000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 1000000,
                "DeductibleAmount": 5000,
                "BusinessIncome": 750000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 1000000,
                "DeductibleAmount": 10000,
                "BusinessIncome": 750000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 1000000,
                "DeductibleAmount": 25000,
                "BusinessIncome": 750000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 25000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 1000000,
                "DeductibleAmount": 50000,
                "BusinessIncome": 750000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 50000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 2000000,
                "DeductibleAmount": 1000,
                "BusinessIncome": 1000000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 2000000,
                "DeductibleAmount": 5000,
                "BusinessIncome": 1000000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 2000000,
                "DeductibleAmount": 10000,
                "BusinessIncome": 1000000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 2000000,
                "DeductibleAmount": 25000,
                "BusinessIncome": 1000000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 25000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 2000000,
                "DeductibleAmount": 50000,
                "BusinessIncome": 1000000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 50000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 3000000,
                "DeductibleAmount": 1000,
                "BusinessIncome": 1000000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 3000000,
                "DeductibleAmount": 5000,
                "BusinessIncome": 1000000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 3000000,
                "DeductibleAmount": 10000,
                "BusinessIncome": 1000000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 10000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 3000000,
                "DeductibleAmount": 25000,
                "BusinessIncome": 1000000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 25000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            },
            {
                "AggregateLimit": 3000000,
                "DeductibleAmount": 50000,
                "BusinessIncome": 1000000,
                "SocialEngineeringSublimit": 100000,
                "SocialEngineeringDeductible": 50000,
                "RansomPaymentsSublimit": 1000000,
                "WebsiteMedia": 1000000
            }
        ];

        //////////////////////////////////////////////////////////////////////////////////////////////
        // COWBELL COVERAGE ELIGIBILITY RULE CHANGES
        //////////////////////////////////////////////////////////////////////////////////////////////

        // these apply for municipalities, education, and tech NAICS codes ($1,000,000 maximum)
        // NOTE: For now, only cutting the limit off if it exceeds $1,000,000
        // const specialCaseEligibleAggregateLimits = [
        //     "50000",
        //     "100000",
        //     "250000",
        //     "500000",
        //     "750000",
        //     "1000000"
        // ];
        const specialCaseEligibleAggregateMaximum = 1000000;

        // municipalities
        const municNAICSPrefix = "92";
        // education
        const eduNAICSPrefix = "91";
        // tech
        const techNAICSCodes = [
            "332510",
            "511210",
            "517311",
            "517312",
            "517410",
            "517911",
            "517919",
            "518210",
            "519130",
            "541511",
            "541512",
            "541513",
            "541519",
            "541690",
            "811211"
        ];

        // $0 - $25,000,000 in revenue
        const lowRevenueDeductibleMinimum = 2500;
        // $25,000,000 - $50,000,000 in revenue
        const midRevenueDeductibleMinimum = 5000;
        // $50,000,000 - $100,000,000 in revenue
        const highRevenueDeductibleMinimum = 10000;

        // Any manufacturing NAICS reduces the waitingPeriod minimum from 6 to 12
        const manuNAICSPrefixes = [
            "31",
            "32",
            "33"
        ];

        //////////////////////////////////////////////////////////////////////////////////////////////
        // END COWBELL COVERAGE ELIGIBILITY RULE CHANGES
        //////////////////////////////////////////////////////////////////////////////////////////////

        // const businessIncomeCoverageLimits = [100000,
        //     150000,
        //     200000,
        //     250000,
        //     300000,
        //     350000,
        //     400000,
        //     450000,
        //     500000,
        //     550000,
        //     600000,
        //     650000,
        //     700000,
        //     750000,
        //     800000,
        //     850000,
        //     900000,
        //     950000,
        //     1000000];


        //get Cyber policy from appDoc.
        const policy = appDoc.policies.find(p => p.policyType.toUpperCase() === "CYBER");
        if(!policy){
            log.error(`Cowbell AppId ${appDoc.applicationId} does not have a CYBER policy`, __location);
            return this.client_error(`NO Cyber policy for AppId ${appDoc.applicationId}`, __location);
        }
        const cyberPolicy = policy.cyber;
        if(!cyberPolicy){
            log.error(`Cowbell AppId ${appDoc.applicationId} does not have a CyberSchema attached to Policy`, __location);
            return this.client_error(`NO Cyber policy for AppId ${appDoc.applicationId}`, __location);
        }
        let policyaggregateLimit = cyberPolicy.aggregateLimit
        if(aggregateLimits.indexOf(policyaggregateLimit) === -1){
            //find best match
            for(let i = 0; i < aggregateLimits.length; i++){
                if(policyaggregateLimit < aggregateLimits[i]){
                    policyaggregateLimit = aggregateLimits[i]
                    break;
                }
            }
        }

        // Coverage Eligibilty Rule change - $1,000,000 maximum for these NAICS codes
        const naics = this.industry_code.naics;
        if (naics.indexOf(municNAICSPrefix) === 0 || naics.indexOf(eduNAICSPrefix) === 0 || techNAICSCodes.includes(naics)) {
            if (parseInt(policyaggregateLimit, 10) > specialCaseEligibleAggregateMaximum) {
                policyaggregateLimit = `${specialCaseEligibleAggregateMaximum}`;
            }
        }

        //Get subLimitsMatrix for policyaggregateLimit
        const limitSet = subLimitsMatrix.find((ls) => ls.AggregateLimit === policyaggregateLimit)
        if(!limitSet){
            log.error(`Cowbell AppId ${appDoc.applicationId} unable to find limit set for aggregateLimit of ${policyaggregateLimit}`, __location);
        }
        //set the cyberPolicy limits to the limitSet and default limits
        let deductible = limitSet?.DeductibleAmount
        const businessIncomeCoverage = limitSet?.BusinessIncome;
        const socialEngLimit = limitSet?.SocialEngineeringSublimit;
        const socialEngDeductible = limitSet?.SocialEngineeringDeductible;
        const ransomPaymentLimit = limitSet?.RansomPaymentsSublimit;
        //const WebsiteMediaLimit = limitSet?.WebsiteMedia;
        const postBreachRemediationLimit = 50000;
        const hardwareReplCostLimit = 50000;
        const telecomsFraudEndorsementLimit = 50000;

        // reset deductible to acceptable minimum if chosen deductible is too low for business revenue
        // const grossSales = parseInt(appDoc.grossSales, 10);
        const revenueQuestion = appDoc.questions.find(question => question.insurerQuestionIdentifier === "revenue");
        if (revenueQuestion) {
            const revenue = parseInt(revenueQuestion.answerValue, 10);
            if (!isNaN(revenue)) {
                // if grossSales (revenue) is between 50m and 100m
                if (revenue >= 50000000 && revenue <= 100000000) {
                    if (deductible < highRevenueDeductibleMinimum) {
                        deductible = highRevenueDeductibleMinimum;
                    }
                }
                // if grossSales (revenue) is between 25m and 50m
                else if (revenue >= 25000000 && revenue <= 49999999) {
                    if (deductible < midRevenueDeductibleMinimum) {
                        deductible = midRevenueDeductibleMinimum;
                    }
                }
                // if grossSales (revenue) is between 0 and 25m
                else if (revenue >= 0 && revenue <= 24999999) {
                    if (deductible < lowRevenueDeductibleMinimum) {
                        deductible = lowRevenueDeductibleMinimum;
                    }
                }
            }
            else {
                log.warn(`Cowbell AppId ${appDoc.applicationId} Revenue is required, but was not provided. ` + __location);
            }
        }
        else {
            log.warn(`Cowbell AppId ${appDoc.applicationId} Revenue is required, but was not provided. ` + __location);
        }

        //  let socialEngLimit = 1000000;
        // if(policyaggregateLimit < 1000000){
        //     socialEngLimit = policyaggregateLimit;
        // }

        //waiting period check
        // eslint-disable-next-line array-element-newline
        const waitingPeriodList = [6,8,12,24];
        if(waitingPeriodList.indexOf(cyberPolicy.waitingPeriod) === -1){
            cyberPolicy.waitingPeriod = 6;
        }

        // If naics is in manufacturing group, the minimum waiting period is 12
        for (const prefix of manuNAICSPrefixes) {
            if (naics.indexOf(prefix) === 0 && cyberPolicy.waitingPeriod < 12) {
                cyberPolicy.waitingPeriod = 12;
                break;
            }
        }

        // =========================================================================================================
        // Validation

        // Ensure we have a supported legal entity.
        const legalEntityMap = {
            'Association': 'Private',
            'Corporation': 'Private',
            'Limited Liability Company': 'Private',
            'Limited Partnership': 'Partnership',
            'Partnership': 'Partnership',
            'Sole Proprietorship': 'Non-Corporates',
            "Corporation (C-Corp)": "Private",
            "Corporation (S-Corp)": 'Private',
            "Non Profit Corporation": "Non-Profit",
            "Limited Liability Company (Member Managed)": "Private",
            "Limited Liability Company (Manager Managed)": "Private"
        };
        if (!legalEntityMap.hasOwnProperty(appDoc.entityType)) {
            log.error(`Cowbell appId ${appDoc.applicationId} the business entity type '${appDoc.entityType}' is not supported by this insurer.`, __location);
            //return this.client_error(`The business entity type '${appDoc.entityType}' is not supported by this insurer.`, __location);
        }
        //If Corporation,  check if Corporation (C-Corp)
        let naicsNumber = 0;
        if (this.industry_code.naics) {
            try{
                naicsNumber = parseInt(this.industry_code.naics, 10);
            }
            catch(err){
                log.error(`Cowbell Cyber  AppId ${appDoc.applicationId} could not convert an NAICS code ${this.industry_code.naics} for '${appDoc.industryCode}' into number.`, __location);
            }
        }
        else {
            log.error(`Cowbell Cyber  AppId ${appDoc.applicationId} requires an NAICS code '${appDoc.industryCode}' does not have one.`, __location);
        }

        let primaryContact = appDoc.contacts.find(c => c.primary);
        if(!primaryContact){
            primaryContact = {};
        }
        // fall back to outside phone IFF we cannot find primary contact phone
        const contactPhone = primaryContact.phone ? primaryContact.phone : appDoc.phone.toString();

        const primaryLocation = appDoc.locations.find(l => l.primary)


        //claims
        let claimHistory = 0 //no claims
        //look for claim question
        const claimQuestion = this.get_question_by_identifier("cyberclaim5year")
        if(!claimQuestion){
            log.error(`Cowbell AppId ${appDoc.applicationId} missing cyberclaim5year question` + __location)
        }
        if(claimQuestion && claimQuestion?.answer?.toLowerCase() === 'yes' || claimQuestion?.answer?.toLowerCase() === 'true'){
            claimHistory = 1;
        }

        //this.policy.effective_date.format('YYYY-MM-DD')
        let Surname = this.app.agencyLocation.last_name
        let GivenName = this.app.agencyLocation.first_name
        let agencyEmail = this.app.agencyLocation.agencyEmail
        let agencyName = this.app.agencyLocation.agency;
        let agencyPhone = this.app.agencyLocation.agencyPhone

        // If talageWholeSale
        if(this.app.agencyLocation.insurers[this.insurer.id].talageWholesale && this.app.agencyLocation.insurers[this.insurer.id].useAgencyPrime){
            Surname = this.quotingAgencyLocationDB.lastName;
            GivenName = this.quotingAgencyLocationDB.firstName;
            const agencyBO = new AgencyBO();
            const agencyInfo = await agencyBO.getById(this.quotingAgencyLocationDB.agencyId);
            agencyName = agencyInfo.name;
            agencyEmail = this.quotingAgencyLocationDB.email
            agencyPhone = this.quotingAgencyLocationDB.phone
        }


        // Create the quote request
        const quoteRequestData = {

            //"accountDescription": "string",
            //"accountId":
            "accountName": appDoc.businessName,
            "agencyId": this.app.agencyLocation.insurers[this.insurer.id].agency_id,
            "agencyName": agencyName,
            "agentEmail": agencyEmail,
            "agentFirstName": GivenName,
            "agentLastName": Surname,
            "agentPhone":stringFunctions.santizeNumber(agencyPhone),
            "businessIncomeCoverage": businessIncomeCoverage,
            "address1": primaryLocation.address,
            "address2": primaryLocation.address2,
            "city": primaryLocation.city,
            "state": primaryLocation.state,
            "zipCode": primaryLocation.zipcode.slice(0,5),
            "phoneNumber": stringFunctions.santizeNumber(primaryContact.phone),
            "companyType": legalEntityMap[appDoc.entityType],
            "ownershipType": legalEntityMap[appDoc.entityType],
            "claimHistory": claimHistory,
            //"daAgencyId": "string",
            // "dbaOrTradestyle": appDoc.dba,
            "deductible": deductible,
            //"domainName": mainDomain,
            //"domains": cyberPolicy.domains,
            //"dunsNumber": "string",
            "effectiveDate": moment(policy.effectiveDate).toISOString(),
            "entityType": "Independent",
            "limit": policyaggregateLimit,
            "aggregateLimit": policyaggregateLimit,
            "naicsCode": naicsNumber,
            "natureOfBusiness": this.industry_code.description,
            "noOfEmployeesAll": this.get_total_employees(),
            "numberOfEmployees": this.get_total_employees(),
            "policyContactEmail": primaryContact.email,
            "policyContactFirstName": primaryContact.firstName,
            "policyContactLastName": primaryContact.lastName,
            "policyContactPhone": stringFunctions.santizeNumber(contactPhone),
            //"hardwareReplCostEndorsement": cyberPolicy.hardwareReplCostEndorsement ? true : false,
            "hardwareReplCostEndorsement": true,
            "hardwareReplCostSubLimit": hardwareReplCostLimit,
            //"hardwareReplCostSubLimit": cyberPolicy.hardwareReplCostEndorsement ? hardwareReplCostLimit : null,
            //"computerFraudEndorsement": cyberPolicy.computerFraudEndorsement ? true : false,
            "computerFraudEndorsement": true,
            //"postBreachRemediationEndorsement": cyberPolicy.postBreachRemediationEndorsement ? true : false,
            "postBreachRemediationEndorsement":  true,
            "postBreachRemediationSubLimit": postBreachRemediationLimit,
            //"ransomPaymentEndorsement": cyberPolicy.ransomPaymentEndorsement ? true : false,
            "ransomPaymentEndorsement": true,
            "ransomPaymentLimit": ransomPaymentLimit,
            "retroactivePeriod": cyberPolicy.yearsOfPriorActs ? cyberPolicy.yearsOfPriorActs : 1,
            //"retroactiveYear": cyberPolicy.yearsOfPriorActs ? cyberPolicy.yearsOfPriorActs : 1,
            "waitingPeriod": cyberPolicy.waitingPeriod ? cyberPolicy.waitingPeriod : 6,
            //"revenue": appDoc.grossSalesAmt, // TODO: This shouldn't be gross sales, but insurer question w/ ID: "revenue". That, or we remove that question
            //"socialEngEndorsement": cyberPolicy.socialEngEndorsement ? true : false,
            "socialEngEndorsement": true,
            "socialEngLimit": socialEngLimit,
            "socialEngDeductible": socialEngDeductible,
            //"telecomsFraudEndorsement":  cyberPolicy.telecomsFraudEndorsement ? true : false,
            "telecomsFraudEndorsement": true,
            "telecomsFraudSubLimit": telecomsFraudEndorsementLimit,
            //websiteMediaContentLiabilityEndorsement: cyberPolicy.websiteMediaContentLiabilityEndorsement,
            websiteMediaContentLiabilityEndorsement: false,
            // "websiteMediaContentLiabilityLimit": WebsiteMediaLimit,
            // "url": appDoc.website,
            "yearEstablished": moment(appDoc.founded).year()
            //"yearsInBusiness": this.get_years_in_business()
            // "additionalInsureds": [
            //     {
            //         "address1": "string",
            //         "address2": "string",
            //         "businessName": "string",
            //         "city": "string",
            //         "id": "string",
            //         "naicsCode": "string",
            //         "naicsDescription": "string",
            //         "state": "string",
            //         "zipCode": "string"
            //     }
            // ]

        };

        //TODO Additional Insurered
        //Question Processing.
        for(const insurerQuestion of this.insurerQuestionList){
            if(Object.prototype.hasOwnProperty.call(this.questions, insurerQuestion.talageQuestionId)){
                if(insurerQuestion.identifier){
                    const question = this.questions[insurerQuestion.talageQuestionId];
                    if(!question){
                        continue;
                    }
                    if(question.type === 'Yes/No'){
                        quoteRequestData[insurerQuestion.identifier] = question.get_answer_as_boolean()
                    }
                    else if(question.inputType === "number"){
                        quoteRequestData[insurerQuestion.identifier] = parseInt(question.answer,10);
                    }
                    else {
                        quoteRequestData[insurerQuestion.identifier] = question.answer;
                    }
                }
            }
        }


        //"companyType": "Private" override....

        log.debug(`Cowbell submission \n ${JSON.stringify(quoteRequestData)} \n` + __location);

        // =========================================================================================================
        // request to get token
        let clientId = this.username
        let clientSecret = this.password;
        //look at AgencyNetwork.additionalInfo.cowbell for clientId and clientsecret overrides.  No need to look for wheelhouse.
        if(appDoc.agencyNetworkId > 1){
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetworkJSON = await agencyNetworkBO.getById(appDoc.agencyNetworkId).catch(function(err){
                log.error("Cowbell Cyber Get AgencyNetwork Error " + err + __location);
            });
            if(typeof agencyNetworkJSON?.additionalInfo?.cowbell === 'object'){
                if(agencyNetworkJSON?.additionalInfo?.cowbell.clientId && agencyNetworkJSON?.additionalInfo?.cowbell.clientSecret){
                    clientId = agencyNetworkJSON?.additionalInfo?.cowbell.clientId
                    clientSecret = agencyNetworkJSON?.additionalInfo?.cowbell.clientSecret
                    log.info(`Cowbell appId ${appDoc.applicationId} using agencynetwork ${agencyNetworkJSON.name} credentials ` + __location)
                }
                else {
                    log.error(`Cowbell clientId and clientSecret override are not properly configured for Agency Network (additionalInfo.cowbell) insurerId: ${this.insurer.insurerId} agencyNetwork.additionalInfo: ${JSON.stringify(agencyNetworkJSON?.additionalInfo)}` + __location);
                    return this.client_error(`The Cowbell clientId and clientSecret are not configured properly`, __location);
                }
            }
        }

        const authBody = {
            "clientId": clientId,
            "secret": clientSecret
        }
        // Send the request - use Oauth2 for with token.
        const host = this.insurer.useSandbox ? cowbellStagingHost : cowbellProductionHost;
        const basePath = this.insurer.useSandbox ? cowbellStagingBasePath : cowbellProductionBasePath;
        let responseAuth = null;
        let authToken = null;
        const authUrl = `${host}${basePath}/auth/v1/api/token`;
        try {
            const options = {headers: {Accept: 'application/json'}};

            //let responseAuth = null;
            try{
                const apiCall = await axios.post(authUrl, authBody, options);
                responseAuth = apiCall.data;
            }
            catch(err){
                //console.log(err);
                this.log += `----auth ${authUrl} -----\n`
                this.log += `<pre>${JSON.stringify(authBody, null, 2)}</pre>`;
                log.error(`Error getting token from Cowbell ${err} @ ${__location}`)
                this.log += "\nError Response: \n ";
                this.log += err;
                this.log += `<pre>Response ${JSON.stringify(err.response.data)}</pre><br><br>`;
                this.log += "\n";
                return this.client_error(`The Cowbell returned an error code of ${err.httpStatusCode} response: ${responseAuth}`, __location, {error: err});
            }

            if(responseAuth && responseAuth.accessToken){
                authToken = responseAuth.accessToken;
            }

        }
        catch (error) {
            try {
                responseAuth = JSON.stringify(error.response);
                return this.client_error(`The Cowbell returned an error code of ${error.httpStatusCode} response: ${responseAuth}`, __location, {error: error});
            }
            catch (error2) {
                return this.client_error(`The Cowbell returned an error code of ${error.httpStatusCode}`, __location, {error: error});
            }
        }
        if(authToken){
            let response = null;

            const options = {headers: {
                Accept: 'application/json',
                "Authorization": `Bearer ${authToken}`
            }};
            try {

                const quoteUrl = `${host}${basePath}/quote/v1`;

                this.log += `----quote url ${quoteUrl} -----\n`
                this.log += `<pre>${JSON.stringify(quoteRequestData, null, 2)}</pre>`;
                const apiCall = await axios.post(quoteUrl, quoteRequestData, options);
                response = JSON.parse(JSON.stringify(apiCall.data));

                this.log += `----Response -----\n`
                this.log += `<pre>${JSON.stringify(response, null, 2)}</pre>`;
            }
            catch (err) {
                try {
                    response = err.response.data;
                    if(typeof response === "object"){
                        return this.client_error(`The Cowbell returned an error code of ${err.httpStatusCode} response: ${JSON.stringify(response)}`, __location, {error: err});
                    }
                    else {
                        return this.client_error(`The Cowbell returned an error code of ${err.httpStatusCode} response: ${response}`, __location, {error: err});
                    }
                }
                catch (error2) {
                    return this.client_error(`The Cowbell returned an error code of ${err.httpStatusCode}`, __location, {error: err});
                }
            }
            let cowbellQuoteId = null
            if(response && response.id){

                this.number = response.id
                cowbellQuoteId = response.id
                this.request_id = cowbellQuoteId;
                let quotePremium = null
                const quoteLimits = {};
                quoteLimits[11] = policyaggregateLimit;
                quoteLimits[12] = this.deductible;

                const quoteCoverages = [];
                let coverageSort = 0;
                quoteCoverages.push({
                    description: `Aggregate`,
                    value: convertToDollarFormat(policyaggregateLimit, true),
                    sort: coverageSort++,
                    category: "Liability Coverages"
                });
                //  if(deductible){
                quoteCoverages.push({
                    description: `Deductible`,
                    value: convertToDollarFormat(deductible, true),
                    sort: coverageSort++,
                    category: "Liability Coverages"
                });
                // }
                //if(businessIncomeCoverage){
                quoteCoverages.push({
                    description: `Business Income Coverage`,
                    value: convertToDollarFormat(businessIncomeCoverage, true),
                    sort: coverageSort++,
                    category: "Liability Coverages"
                });
                // }
                // if(cyberPolicy.hardwareReplCostEndorsement && hardwareReplCostLimit){
                quoteCoverages.push({
                    description: `Hardware Replacement Cost Limit`,
                    value: convertToDollarFormat(hardwareReplCostLimit, true),
                    sort: coverageSort++,
                    category: "Liability Coverages"
                });
                //}

                //if(cyberPolicy.postBreachRemediationEndorsement && postBreachRemediationLimit){
                quoteCoverages.push({
                    description: `Post Breach Remediation Limit`,
                    value: convertToDollarFormat(postBreachRemediationLimit, true),
                    sort: coverageSort++,
                    category: "Liability Coverages"
                });
                //}
                //if(cyberPolicy.ransomPaymentEndorsement && ransomPaymentLimit){
                quoteCoverages.push({
                    description: `Ransom Payment Limit`,
                    value: convertToDollarFormat(ransomPaymentLimit, true),
                    sort: coverageSort++,
                    category: "Liability Coverages"
                });
                //}
                //if(cyberPolicy.socialEngEndorsement && socialEngLimit){
                quoteCoverages.push({
                    description: `Social Engineering Limit`,
                    value: convertToDollarFormat(socialEngLimit, true),
                    sort: coverageSort++,
                    category: "Liability Coverages"
                });
                quoteCoverages.push({
                    description: `Social Engineering Deductible`,
                    value: convertToDollarFormat(socialEngDeductible, true),
                    sort: coverageSort++,
                    category: "Liability Coverages"
                });
                // }
                // if(cyberPolicy.telecomsFraudEndorsement && telecomsFraudEndorsementLimit){
                quoteCoverages.push({
                    description: `Ransom Payment Limit`,
                    value: convertToDollarFormat(telecomsFraudEndorsementLimit, true),
                    sort: coverageSort++,
                    category: "Liability Coverages"
                });
                // }

                // if(cyberPolicy.websiteMediaContentLiabilityEndorsement && WebsiteMediaLimit){
                // quoteCoverages.push({
                //     description: `Website Media Content Liability Limit`,
                //     value: convertToDollarFormat(WebsiteMediaLimit, true),
                //     sort: coverageSort++,
                //     category: "Liability Coverages"
                // });
                //  }


                // Give Cowbell 5 seconds to run there process.
                await utility.Sleep(5000);
                let declined = false;
                let declientReason = null;
                let accountId = null;
                try{
                    const quoteUrl = `${host}${basePath}/quote/v1/${cowbellQuoteId}`;
                    //5 tries with 5 seconds waits
                    const NUMBER_OF_TRIES = 24;
                    for(let i = 0; i < NUMBER_OF_TRIES; i++){
                        this.log += `----quote url ${quoteUrl} ----- try count: ${i + 1}\n`
                        this.log += `GET Request`;
                        const apiCall = await axios.get(quoteUrl, options);
                        const responseQD = apiCall.data;

                        this.log += `----Response -----\n`
                        this.log += `<pre>${JSON.stringify(apiCall.data, null, 2)}</pre>`;
                        this.quoteResponseJSON = responseQD;
                        this.quoteResponseJSON.quoteId = cowbellQuoteId;
                        if(responseQD.agencyStatus === 'INVALID'){
                            declined = true;
                            declientReason = responseQD.agencyDescription
                            this.quoteResponseJSON = responseQD
                            break;
                        }
                        if(responseQD.totalPremium){
                            this.quoteResponseJSON = responseQD
                            this.number = responseQD.quoteNumber;
                            this.request_id = cowbellQuoteId;
                            quotePremium = responseQD.totalPremium;
                            this.quoteLink = responseQD.agencyDeepLinkURL
                            this.purchaseLink = responseQD.policyHolderDeepLinkURL

                            //check we got more then just "https://" for links
                            if(this.quoteLink === "https://"){
                                log.error(`Cowbell AppId ${appDoc.applicationId} did not return a FQN for agencyDeepLinkURL` + __location)
                                this.quoteLink = ''
                            }

                            if(this.purchaseLink === "https://"){
                                log.error(`Cowbell AppId ${appDoc.applicationId} did not return a FQN for policyHolderDeepLinkURL` + __location)
                                this.purchaseLink = ''
                            }

                            accountId = responseQD.accountId
                            this.isBindable = true
                            break;
                        }
                        if(i < NUMBER_OF_TRIES - 1){
                            await utility.Sleep(5000);
                        }
                    }

                }
                catch(err){
                    try {
                        response = err.response.data;
                        return this.client_error(`The Cowbell returned an error code of ${err.httpStatusCode} response: ${response} ${err}`, __location, {error: err});
                    }
                    catch (error2) {
                        return this.client_error(`The Cowbell returned an error code of ${err.httpStatusCode}`, __location, {error: err});
                    }
                }
                if(this.number && quotePremium){
                    // Get proposal doc...
                    //await utility.Sleep(2000);
                    const createdTS = moment(this.quoteResponseJSON.created).unix();
                    const quoteDocUrl = `${host}${basePath}/docs/v1/quote/${accountId}/proposal/${cowbellQuoteId}?createdDate=${createdTS}`;
                    //5 tries with 5 seconds waits
                    const NUMBER_OF_TRIES = 12;
                    for(let i = 0; i < NUMBER_OF_TRIES; i++){
                        try{
                            this.log += `----Get quote proposal url ${quoteDocUrl} ----- try count: ${i + 1}\n`
                            this.log += `GET Request`;
                            const apiCall = await axios.get(quoteDocUrl, options);
                            const responseQD = apiCall.data;

                            this.log += `----Response -----\n`
                            this.log += `<pre>${JSON.stringify(apiCall.data, null, 2)}</pre>`;
                            if(responseQD){
                                log.debug(`qoute doc response ${JSON.stringify(responseQD)}`)
                                const quoteProposalUrl = responseQD;
                                //call to get the doc.
                                try{
                                    const config = {
                                        "Content-Type": 'application/pdf',
                                        responseType: 'arraybuffer'
                                    };
                                    this.log += `----Get quote proposal doc url ${quoteProposalUrl} ----- \n`
                                    this.log += `GET Request`;
                                    const quoteDocResponse = await axios.get(quoteProposalUrl, config);
                                    const buff = Buffer.from(quoteDocResponse.data);
                                    this.quote_letter.data = buff.toString('base64');
                                }
                                catch(err){
                                    log.error(`Appid: ${this.app.id} Cowbell Cyber: Error getting quote proposal ${err} ` + __location)
                                }
                                break;
                            }
                        }
                        catch(err){
                            log.info(`Cowbell Qoute Proposal request error ${err}` + __location)
                        }
                        if(i < NUMBER_OF_TRIES - 1){
                            await utility.Sleep(5000);
                        }

                    }
                    return this.client_quoted(this.number, quoteLimits, quotePremium, null,null, quoteCoverages);
                }
                else if (declined){
                    return this.client_declined(declientReason);
                }
                else {

                    return this.client_error(`The Cowbell did not return totalPremium `, __location);
                }
            }
            else if(response && response.message) {
                return this.client_declined(response.message);
                //return this.client_error(`The Cowbell returned unexpected response ${JSON.stringify(response)}`, __location);
            }
            else {
                return this.client_error(`The Cowbell returned unexpected response ${JSON.stringify(response)}`, __location);
            }


        }
        else {
            return this.client_error(`Cowbell request failure - no authToken is response `, __location);
        }

    }
};