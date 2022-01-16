/* eslint-disable array-element-newline */
/* eslint-disable no-extra-parens */
/* eslint-disable multiline-ternary */
/* eslint-disable radix */
/* eslint-disable object-curly-newline */
/* eslint-disable no-trailing-spaces */
/* eslint-disable no-console */

/**
 * Worker's Compensation Integration for Markel
 */

'use strict';

const Integration = require('../Integration.js');
const htmlentities = require('html-entities').Html5Entities;
const moment = require('moment');
global.requireShared('./helpers/tracker.js');
const {convertToDollarFormat, removeDiacritics} = global.requireShared('./helpers/stringFunctions.js');
const IndustryCodeBO = global.requireShared('./models/IndustryCode-BO.js')
const InsurerIndustryCodeBO = global.requireShared('./models/InsurerIndustryCode-BO.js');
const smartystreetSvc = global.requireShared('./services/smartystreetssvc.js');

// mine subsidence maximum limits by state
const mineSubsidenceLimits = {
    IL: 750000,
    IN: 200000,
    KY: 9999999999, // no maximum
    WV: 200000
};

// this is a map of counters per state that require Mine Subsidence Optional Endorsement
const mineSubsidenceOE = {
    IL: [
        "Bond",
        "Bureau",
        "Christian",
        "Clinton",
        "Douglas",
        "Franklin",
        "Fulton",
        "Gallatin",
        "Grundy",
        "Jackson",
        "Jefferson",
        "Knox",
        "LaSalle",
        "Logan",
        "Mcdonough",
        "Macoupin",
        "Madison",
        "Marion",
        "Marshall",
        "Menard",
        "Mercer",
        "Montgomery",
        "Peoria",
        "Perry",
        "Putnam",
        "Randolph",
        "Rock Island",
        "Saint Clair",
        "Saline",
        "Sangamon",
        "Tazewell",
        "Vermilion",
        "Washington",
        "Williamson"
    ],
    IN: [
        "Clay",
        "Crawford",
        "Daviess",
        "Dubois",
        "Fountain",
        "Gibson",
        "Greene",
        "Knox",
        "Lawrence",
        "Martin",
        "Monroe",
        "Orange",
        "Owen",
        "Parke",
        "Perry",
        "Pike",
        "Posey",
        "Putnam",
        "Spencer",
        "Sullivan",
        "Vanderburgh",
        "Vermillion",
        "Vigo",
        "Warren",
        "Warrick"
    ],
    KY: [
        "Bell",
        "Boyd",
        "Breathitt",
        "Butler",
        "Carter",
        "Christian",
        "Clay",
        "McLean",
        "Edmonson",
        "Elliott",
        "Floyd",
        "Greenup",
        "Hancock",
        "Harlan",
        "Henderson",
        "Hopkins",
        "Jackson",
        "Johnson",
        "Knott",
        "Knox",
        "Laurel",
        "Lawrence",
        "Lee",
        "Leslie",
        "Letcher",
        "Martin",
        "Mccreary",
        "McLean",
        "Morgan",
        "Muhlenberg",
        "Ohio",
        "Owsley",
        "Perry",
        "Union",
        "Webser",
        "Whitley",
        "Wolfe"
    ],
    WV: [
        "Barbour",
        "Boone",
        "Braxton",
        "Brooke",
        "Clay",
        "Doddridge",
        "Fayette",
        "Gilmer",
        "Greenbrier",
        "Hancock",
        "Harrison",
        "Kanawha",
        "Lewis",
        "Marion",
        "Marshall",
        "Mason",
        "Mcdowell",
        "Mercer",
        "Mineral",
        "Monongalia",
        "Nicholas",
        "Ohio",
        "Pocahontas",
        "Putnam",
        "Raleigh",
        "Randolph",
        "Taylor",
        "Tucker",
        "Tyler",
        "Upshur",
        "Wayne",
        "Webster",
        "Wetzel",
        "Wyoming",
        "Grant",
        "Lincoln",
        "Logan",
        "Mingo",
        "Summers"
    ]
};

const entityTypeMatrix = {
    "Association": "AS",
    // Not applicable in GA, IL, KY
    "C Corporation": "CCORP",
    // Not applicable in AK, AL, AR, CA, CO, CT, DE, FL, GA, HI, IA, IL, IN, KS, KY, LA, MD, MI, MN, MO, MS, NC, NE, NH, NJ, NM, NV, OK, RI, SC, SD, TN, TX, UT, VA, VT, WI, WV
    "Common Ownership": "CO",
    // Not applicable in DC, ID, KY, MI, MT, ND, OH, OR, WA, WI, WY
    "Corporation": "CP",
    // Applicable in all states.
    "Estate": "ES",
    // Not applicable in GA, IL, NH
    "Governmental Entity": "GE",
    // Not applicable in GA, IL, KY, LA, UT
    "Joint Venture": "JV",
    // Not applicable in DC, GA, ID, IL, ND, NY, OH, OR, WA, WY
    "Limited Liability Company": "LLC",
    // Applicable in all states.
    "Limited Partnership": "LP",
    // Not applicable in AL, AR, CO, CT, DE, FL, GA, HI, IA, IL, IN, KS, KY, LA, MA MD, MI, MN, MO, MS, NC, NE, NH, NJ, NM, NV, OK, PA, RI, SC, SD, TN, TX, UT, VA, VT, WV
    "Individual": "IN",
    // Not applicable in NY.
    "Nonprofit": "NP",
    // Not applicable in MI, NY, WI
    "Other": "OT",
    // Not applicable in GA, IL, KY, MI, VA
    "Professional Corporation": "PROF",
    // Applicable only in CA.
    "Partnership": "PT",
    // Applicable in all states.
    "Public Employer": "PUBLIC",
    // Not applicable in AZ, DC, GA, ID, IL, KY, MA, ME, MT, ND, OH, OR, UT, WA, WI, WY
    "Sole Proprietor": "SOLEPRP",
    // Applicable in all states.
    "S Corporation": "SS", // Markel's name: Subchapter S Corporation
    // Not applicable in AK, AL, AR, CO, CT, DE, FL, GA, IA, IL, IN, KS, KY, LA, MD, MI, MN, MO, MS, NC, NE, NH, NM, NV, OK, RI, SC, SD, TN, TX, UT, VA, VT, WI, WV
    "Trust": "TR",
    // Not applicable in GA, IL
    "Cooperative Corporation": "com.markel.coop",
    // Applicable only in CA.
    "Executor": "com.markel.exec",
    // Not applicable in AZ, DC, GA, ID, IL, KY, MT, NC, ND, OH, OR, WA, WI, WY
    "Limited Liability Partnership": "com.markel.llp",
    // Not applicable in AL, AR, CO, CT, DE, FL, HI, IA, IN, KS, KY, MD, MN, MO, MS, NC, NE, NH, NM, NV, OK, RI, SC, SD, TN, TX, VA, VT, WV
    "Religious Organization": "com.markel.religious",
    // Not applicable in DC, GA, ID, IL, KY, MT, ND, OH, OR, WA, WY
    "Trustee": "com.markel.trustee",
    // Not applicable in AZ, CA, DC, GA, ID, IL, KY, MI, MT, ND, OH, OR, WA, WI, WY
    "Registered Limited Liability Partnership": "com.markel.RLLP",
    // Applicable only in NY
    "Professional Service Liability Company": "com.markel.PSLC",
    // Applicable only in NY
    "Nonprofit Corporation": "com.markel.NPC",
    // Applicable only in NY
    "Unincorporated Nonprofit Association": "com.markel.UNPA"
    // Applicable only in NY
};

const contractorClassCodes = [
    "74011",
    "74021",
    "74071",
    "74081",
    "74101",
    "74111",
    "74161",
    "74171",
    "74221",
    "74231",
    "74251",
    "74261",
    "74281",
    "74291",
    "74341",
    "74351",
    "74411",
    "74421",
    "74471",
    "74481",
    "74501",
    "74511",
    "74541",
    "74561",
    "74591",
    "74601",
    "74651",
    "74661",
    "74681",
    "74691",
    "74741",
    "74751",
    "74771",
    "74781",
    "74831",
    "74841",
    "74861",
    "74871",
    "74891",
    "74901",
    "74951",
    "74961",
    "75511",
    "75521",
    "75541",
    "75551",
    "75601",
    "75611",
    "75631",
    "75641",
    "75691",
    "75701",
    "75751",
    "75761",
    "75781",
    "75791",
    "75811",
    "75821",
    "75871",
    "75881",
    "75931",
    "75941",
    "75961",
    "75971",
    "76021",
    "76031",
    "76051",
    "76061",
    "76111",
    "76121",
    "76171",
    "76181",
    "76221",
    "76231"
];

const pesticideClassCodes = [
    '74891',
    '74901'
];

const propDamageDeductibleClassCodes = [
    '75601', 
    '75611', 
    '75631', 
    '75641'
];

// Certified Safety Committee Notification
// eslint-disable-next-line no-unused-vars
const safety_committee_states = [
    'AZ',
    'DE',
    'KY',
    'NJ',
    'PA',
    'UT',
    'WI'
];

// NumberOfClaims within last 3 years
// eslint-disable-next-line no-unused-vars
const number_of_claims_states = [
    'DE',
    'HI',
    'MI',
    'PA',
    'SD',
    'VT'
];

// existing question answers don't map 1:1 to what Markel expects
const constructionTypeMatrix = {
    "Fire Resistive": "Fire-resistive",
    "Frame": "Frame Construction",
    "Joisted Masonry": "Joisted masonry",
    "Masonry Non Combustible": "Masonry Non-combustible",
    "Non Combustible": "Non-combustible"
};

// existing question answers don't map 1:1 to what Markel expects
const fireAlarmMatrix = {
    "Central Station Without Keys": "Central",
    "Local": "Local",
    "None": "None",
    "Police/Fire Connected": "Local" // check if this default is correct
};

const specialCaseQuestions = [
    "markel.policy.terrorismCoverage",
    "markel.policy.medicalLimit"
];

const medicalLimits = [
    5000,
    10000
];

module.exports = class MarkelWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        // This is false because we may not have a BOP code selected that fits this insurer and we don't want to bail out yet with an out of market
        this.requiresInsurerIndustryCodes = false;

        // this integration uses BOP codes
        this.usePolciyBOPindustryCode = true;
    }

    /**
     * Requests a quote from Markel and returns. This request is not intended to be called directly.
     *
     * @returns {result} The result of return_result()
     */

    async _insurer_quote() {
        const applicationDocData = this.applicationDocData;
        const logPrefix = `Markel BOP (Appid: ${this.app.id}): `;
        const BOPPolicy = applicationDocData.policies.find(policy => policy.policyType === "BOP");

        let host = '';
        let path = '';
        let key = '';

        //Determine API
        if (this.insurer.useSandbox) {
            host = 'api-sandbox.markelcorp.com';
            path = '/smallCommercial/v1/bop'
            key = {'apikey': `${this.password}`};
        }
        else {
            host = 'api.markelcorp.com';
            path = '/smallCommercial/v1/bop';
            key = {'apikey': `${this.password}`};
        }

        // These are the statuses returned by the insurer and how they map to our Talage statuses
        this.possible_api_responses.Declined = 'declined';
        this.possible_api_responses.Incomplete = 'error';
        this.possible_api_responses.Submitted = 'referred';
        this.possible_api_responses.Quoted = 'quoted';

        // These are the limits supported by Markel * 1000
        // eslint-disable-next-line no-unused-vars
        const carrierLimits = ['100000/500000/100000',
            '500000/500000/500000',
            '1000000/1000000/1000000',
            '1500000/1500000/1500000',
            '2000000/2000000/2000000'];
        let yearsInsured = moment().diff(this.app.business.founded, 'years');

        // eslint-disable-next-line no-unused-vars
        const mapCarrierLimits = {
            '100000/500000/100000': '100/500/100',
            '500000/500000/500000': '500/500/500',
            '1000000/1000000/1000000': '1000/1000/1000',
            '1500000/1500000/1500000': '1500/1500/1500',
            '2000000/2000000/2000000': '2000/2000/2000'
        }

        // Check for excessive losses in DE, HI, MI, PA and VT
        // eslint-disable-next-line no-unused-vars
        const excessive_loss_states = [
            'DE',
            'HI',
            'MI',
            'PA',
            'VT'
        ];

        if (yearsInsured > 10) {
            yearsInsured = 10;
        }
        else if (yearsInsured === 0) {
            yearsInsured = 1;
        }

        let industryCode = null;
        // if the BOP code selected is Markel's, we can just use it
        if (this.industry_code && !this.industry_code.talageIndustryCodeUuid) {
            industryCode = this.industry_code;
        }
        else {
            // otherwise, look it up and try to find the best match using ranking
            industryCode = await this.getIndustryCode();
        }

        if (!industryCode) {
            log.error(`${logPrefix}Unable to get Industry Code, applicantion Out of Market. ` + __location);
            return this.client_autodeclined_out_of_appetite();
        }

        // Check the number of claims
        // NOTE: Disabling this, as it's better to send to Markel anyways and let it decline on their end. 
        // if (excessive_loss_states.includes(this.app.business.primary_territory)) {
        //     if (this.policy.claims.length > 2) {
        //         log.info(`${logPrefix}Autodeclined: Insurer reports too many claims. ${__location}`);
        //         this.reasons.push(`Too many past claims`);
        //         return this.return_result('autodeclined');
        //     }
        // }

        // Check for excessive losses in South Dakota
        // NOTE: Disabling this, as it's better to send to Markel anyways and let it decline on their end. 
        // if (this.app.business.primary_territory === 'SD') {
        //     if (this.policy.claims.length > 4) {
        //         log.info(`${logPrefix}Autodeclined: Insurer reports too many claims. ${__location}`);
        //         this.reasons.push(`Too many past claims`);
        //         return this.return_result('autodeclined');
        //     }
        // }

        const primaryAddress = this.app.business.locations[0];

        let entityType = null;
        if (applicationDocData.entityType === "Corporation") {
            switch(applicationDocData.corporationType) {
                case "C":
                    entityType = "CCORP";
                    break;
                case "S":
                    entityType = "SS";
                    break;
                case "N":
                    entityType = "NP";
                    break;
                default:
                    entityType = "CP";
                    break;
            }
        } 
        else {
            entityType = entityTypeMatrix[applicationDocData.entityType];
        }

        /* ---=== Begin Questions ===--- */

        const unique_territories = [];
        const questionObj = {};
        applicationDocData.locations.forEach(location => {
            if (!unique_territories.includes(location.territory)) {
                unique_territories.push(location.territory);
            }
        });

        // filter insurer questions down to those matching answered talage questions
        const answeredQuestionList = [];
        this.insurerQuestionList.forEach(insurerQuestionDoc => {
            const talageQuestion = applicationDocData.questions.find(tq => insurerQuestionDoc._doc.talageQuestionId === tq.questionId);

            if (talageQuestion) {
                answeredQuestionList.push({
                    ...talageQuestion,
                    attributes: insurerQuestionDoc._doc.attributes
                });
            }
        });

        answeredQuestionList.forEach(question => {    
            const questionCode = question?.attributes?.QuestionCode;
            if (questionCode && !specialCaseQuestions.includes(questionCode)) {
                let questionAnswer = null;

                if (question.questionType === 'Yes/No') {
                    questionAnswer = question.answerValue.toUpperCase();

                    // some answers may be coming in as boolean or string representations of booleans, handling those cases explicitly here
                    if (questionAnswer.toLowerCase() === "true" || questionAnswer === true) {
                        questionAnswer = "YES";
                    }
                    else if (questionAnswer.toLowerCase() === "false" || questionAnswer === false) {
                        questionAnswer = "NO";
                    }
                }
                else if (questionCode === "com.markel.uw.questions.Question1399") {
                    // THIS IS A TEMPORARY FIX UNTIL MARKEL ALLOWS FOR MULTI-OPTION QUESTION ANSWERS
                    // If more occurrences are found, add them here for general questions
                    questionAnswer = question?.answerList[0]?.trim();
                }
                else {
                    questionAnswer = question.answerValue;
                }

                questionObj[questionCode] = questionAnswer;
            }
        });

        // NOTE: This isn't a great solution. If Markel has more occurrences like this, it will require further manual injection here...
        //       This is ultimately a mapping problem

        // Markel asks essentially the same question twice. We have two questions mapped to the same Talage question, so we only get one 
        // answer back, for question1956. This makes sure we answer the other question (question1233) the same way
        // Talage question:                      Do you rent or loan equipment or tools to others?
        // com.markel.uw.questions.Question1956: Does the applicant rent any equipment or tools to others?
        // com.markel.uw.questions.Question1233: Do you rent or loan equipment to others?
        if (questionObj["com.markel.uw.questions.Question1956"] && !questionObj["com.markel.uw.questions.Question1233"]) {
            questionObj["com.markel.uw.questions.Question1233"] = questionObj["com.markel.uw.questions.Question1956"];
        }

        // Populate the location list
        const locationList = [];
        // for each location, push a location object into the locationList
        // applicationDocData.locations.forEach(location => {
        for (const location of applicationDocData.locations) {
            const locationObj = {
                "Location Address1": removeDiacritics(location.address),
                "Location Zip": location.zipcode,
                "Location City": location.city,
                "Location State": location.state,
                buildings: []
            };

            let locationTotalPayroll = 0;
            location.activityPayrollList.forEach(apl => {
                locationTotalPayroll += apl.payroll;
            });

            // We currently do not support adding buildings, therefor we default to 1 building per location
            const buildingObj = {
                // optionalEndorsements: {}, // optional coverages - we are not handling these phase 1
                classCode: industryCode.code,
                classCodeDescription: industryCode.attributes.BOPDescription, 
                // naicsReferenceId: industryCode.attributes.NAICSReferenceId, // currently not supported. Can replace class code/description once it is
                personalPropertyReplacementCost: location.businessPersonalPropertyLimit, // BPP
                buildingReplacementCost: location.buildingLimit, // BL
                annualPayroll: locationTotalPayroll,
                constructionType: constructionTypeMatrix[location.constructionType],
                yearBuilt: location.yearBuilt,
                stories: location.numStories,
                fireAlarmType: fireAlarmMatrix[location.bop.fireAlarmType],
                sprinkler: location.bop.sprinkler ? "yes" : "no"
                // AdditionalInsured: { // NOTE: possibly not required
                //     natureInterestCd: "",
                //     description: "",
                //     InsuredInfo: {
                //         Name: "",
                //         Address: "",
                //         City: "",
                //         PostalCode: "",
                //         State: ""
                //     }
                // }
            };

            // if one of these specific states and building limit (building replacement cost) is greater than 0
            // we need to check for specific counties to determine if we should include mine subsidence optional endorsement
            if (Object.keys(mineSubsidenceOE).includes(location.state) && location.buildingLimit > 0) {
                const addressInfoResponse = await smartystreetSvc.checkAddress(location.address, location.city, location.state, location.zipcode);

                if (addressInfoResponse?.county && mineSubsidenceOE[location.state].includes(addressInfoResponse.county)) {
                    // set to building limit or state maximum if building limit exceeds state maximum
                    const limit = location.buildingLimit > mineSubsidenceLimits[location.state] ? mineSubsidenceLimits[location.state] : location.buildingLimit;
                    buildingObj.optionalEndorsements = {
                        mineSubsidenceLimit: limit
                    };
                }
                else {
                    log.warn(`${logPrefix}Unable to get county information from Smarty Streets. Not including Mine Subsidence Optional Endorsment with submission.`);
                }
            }
            
            location.questions.forEach(question => {
                switch (question.insurerQuestionIdentifier) {
                    case "markel.location.building.description":
                        buildingObj.description = question.answerValue;
                        break;
                    case "markel.location.building.occupiedSquareFeet":
                        //This should just use the application locations sqft.  NOT a new question.
                        const occupiedSquareFeetAnswer = parseInt(question.answerValue, 10);

                        if (!isNaN(occupiedSquareFeetAnswer)) {
                            let modifiedSqFt = occupiedSquareFeetAnswer;
                            if (occupiedSquareFeetAnswer > location.square_footage) {
                                modifiedSqFt = location.square_footage;
                            }

                            if (modifiedSqFt < 0) {
                                modifiedSqFt = 0;
                            }

                            buildingObj.occupiedSquareFeet = modifiedSqFt;

                            // implicitly answer percent occupied
                            if (location.square_footage === 0 || location.square_footage < 0) {
                                buildingObj.percentOccupied = 0;
                            }
                            else {
                                buildingObj.percentOccupied = Math.round((modifiedSqFt / location.square_footage) * 100);
                            }
                        }
                        else {
                            buildingObj.occupiedSquareFeet = question.answerValue;
                        }
                        break;
                    case "markel.location.building.grossSales":
                        buildingObj.grossSales = question.answerValue;
                        break;
                    case "markel.location.building.isSingleOccupancy":
                        buildingObj.isSingleOccupancy = question.answerValue.toLowerCase();
                        break;
                    case "markel.location.building.occupancyType":
                        buildingObj.occupancyType = question.answerValue;
                        break;
                    default:
                        //Another insurer questions...
                        //log.warn(`${logPrefix}Encountered unknown question identifier "${question.insurerQuestionIdentifier}". ${__location}`);
                        break;
                }
            });

            locationObj.buildings.push(buildingObj);
            locationList.push(locationObj);
        }

        const policyObj = {
            perOccGeneralAggregate: this.getSupportedLimits(BOPPolicy.limits),
            propertyDeductible: this.getSupportedDeductible(BOPPolicy.deductible), // currently just using policy deductible
            package: "com.markel.bop.Essential", // currently defaulting to Essential package, not asking the question
            yearsInsuredBOP: yearsInsured,
            "Aware of any losses": applicationDocData.claims.length > 0 ? 'YES' : 'NO'
            // optionalEndorsements: [] // Optional, not supporting in phase 1
        };

        if (propDamageDeductibleClassCodes.includes(industryCode.code)) {
            policyObj.propDamageDeductible = '250';
        }

        // SET OPTIONAL ENDORSEMENTS WHERE REQUIRED 

        policyObj.optionalEndorsements = {};

        // contractorsInstallationToolsEquipment endorsement required if contractor industry is selected
        if (contractorClassCodes.includes(industryCode.code)) {
            policyObj.optionalEndorsements.contractorsInstallationToolsEquipment = {
                eachJobLimitAllJobLimit: "3000/9000",
                blanketLimit: 3000,
                blanketSubLimit: 500
            };
        }

        // pesticideHerbicideApplicatorLimitedPollution endorsement required if specific industry selected and NOT in Texas (TX)
        if (pesticideClassCodes.includes(industryCode.code) && applicationDocData.mailingState !== "TX") {
            policyObj.optionalEndorsements.pesticideHerbicideApplicatorLimitedPollution = true;
        }

        // Remove optional endorsements property if none added
        if (Object.keys(policyObj.optionalEndorsements).length === 0) {
            delete policyObj.optionalEndorsements;
        }

        const medicalLimitQuestion = applicationDocData.questions.find(question => question.insurerQuestionIdentifier === "markel.policy.medicalLimit");
        if (medicalLimitQuestion) {
            let value = parseInt(medicalLimitQuestion.answerValue, 10);

            if (!isNaN(value)) {
                // if the provided option value is not a valid CNA option...
                if (!medicalLimits.find(limit => limit === value)) {
                    // find the next highest CNA-supported limit
                    let set = false;
                    for (const limit of medicalLimits) {
                        if (limit > value) {
                            value = limit;
                            set = true;
                            break;
                        }
                    }

                    // if the provided option value was greater than any CNA allowed limit, set to the highest allowed CNA limit
                    if (!set) {
                        value = medicalLimits[medicalLimits.length - 1];
                    }
                }

                policyObj.medicalLimit = value;
            }
        }

        const terrorismCoverageQuestion = applicationDocData.questions.find(question => question.insurerQuestionIdentifier === "markel.policy.terrorismCoverage");
        if (terrorismCoverageQuestion) {
            policyObj.terrorismCoverage = terrorismCoverageQuestion.answerValue.toUpperCase();
        }

        const jsonRequest = {submissions: [
            {
                RqUID: this.generate_uuid(),
                programCode: "bop",
                effectiveDate: this.policy.effective_date.format('YYYY-MM-DD'),
                agencyInformation: {
                    agencyId: this.app.agencyLocation.insurers[this.insurer.id].agency_id,
                    licensingAgentUsername: this.app.agencyLocation.insurers[this.insurer.id].agent_id
                },
                insured: {
                    address1: removeDiacritics(this.app.business.mailing_address),
                    city: this.app.business.mailing_city,
                    documentDeliveryPreference: "EM",
                    name: removeDiacritics(this.app.business.name),
                    dba: this.app.business.dba,
                    website: this.app.business.website,
                    fein: applicationDocData.ein,
                    postalCode: this.app.business.mailing_zipcode,
                    state: this.app.business.mailing_territory
                },
                application: {
                    'Location Information': {Location: locationList},
                    "Policy Info": policyObj,
                    "Additional Information": {
                        "Entity Type": entityType,
                        "Primary Contact Name": this.app.business.contacts[0].first_name,
                        "Primary Contact Last Name": this.app.business.contacts[0].last_name,
                        "Phone Number": this.app.business.contacts[0].phone,
                        "Email": this.app.business.contacts[0].email
                    },
                    "Underwriter Questions": {
                        "UWQuestions": questionObj,
                        "Description of Operations": industryCode.attributes.BOPDescription
                    },
                    "signaturePreference": "Electronic"
                }
            }
        ]};

        let response = null;
        try {
            response = await this.send_json_request(host, path, JSON.stringify(jsonRequest), key, 'POST', false);
        }
        catch (error) {
            log.error(`${logPrefix}Integration Error: ${error} ${__location}`);
            this.reasons.push(error);
            return this.return_result('error');
        }

        let rquIdKey = null;
        try {
            rquIdKey = Object.keys(response)[0];
        }
        catch (e) {
            log.error(`${logPrefix}Error parsing response structure for request ID: ${e}. ` + __location);
            return this.return_result('error');
        }

        try {
            if (response && (response[rquIdKey]?.underwritingDecisionCode === 'SUBMITTED' || response[rquIdKey]?.underwritingDecisionCode === 'QUOTED')) {

                if (response[rquIdKey]?.premium?.totalPremium) {
                    this.amount = response[rquIdKey].premium.totalPremium;
                }

                try {
                    this.request_id = this.number = response[rquIdKey].applicationID;
                }
                catch (e) {
                    log.error(`${logPrefix}Integration Error: Unable to find quote number. ${__location}`);
                }
                // null is a valid response. isBindable defaults to false.  null equals false.
                if (response[rquIdKey]?.isBindAvailable) {
                    this.isBindable = response[rquIdKey].isBindAvailable;
                }
                // Get the quote limits
                this.quoteCoverages = [];
                let coverageSort = 0;

                if (response[rquIdKey].coverage) {
                    const coverages = response[rquIdKey].coverage;
                    if (coverages.deductibles) {
                        coverages.deductibles.forEach(deductible => {
                            this.quoteCoverages.push({
                                description: deductible.appliesTo,
                                value: convertToDollarFormat(deductible.deductible, true),
                                sort: coverageSort++,
                                category: 'Deductible'
                            });
                        });
                    }

                    if (coverages.limits) {
                        coverages.limits.forEach(limit => {
                            this.quoteCoverages.push({
                                description: limit.appliesTo,
                                value: convertToDollarFormat(limit.limit, true),
                                sort: coverageSort++,
                                category: 'Limit'
                            });
                        });
                    }
                }

                if (response[rquIdKey]?.application && response[rquIdKey]?.application["Policy Info"] && response[rquIdKey]?.application["Policy Info"]?.optionalEndorsements?.contractorsInstallationToolsEquipment) {
                    const cite = response[rquIdKey].application["Policy Info"].optionalEndorsements.contractorsInstallationToolsEquipment;
                    const limitObjs = [];
                    Object.keys(cite).forEach(citeKey => {
                        switch (citeKey) {
                            case "aggregateLimit": 
                                limitObjs.push({
                                    title: "Aggregate Limit",
                                    value: cite[citeKey]
                                });
                                break;
                            case "blanketLimit":
                                limitObjs.push({
                                    title: "Blanket Limit",
                                    value: cite[citeKey]
                                });
                                break;
                            case "blanketSubLimit":
                                limitObjs.push({
                                    title: "Blanket Sub Limit",
                                    value: cite[citeKey]
                                });
                                break; 
                            case "cleanupLimit":
                                limitObjs.push({
                                    title: "Cleanup Limit",
                                    value: cite[citeKey]
                                });
                                break; 
                            case "eachJobLimitAllJobLimit":
                                if (cite[citeKey]) {
                                    const jobLimits = cite[citeKey].trim().split("/");
                                    limitObjs.push({
                                        title: "Each Job Limit",
                                        value: jobLimits[0]
                                    });
                                    limitObjs.push({
                                        title: "All Jobs Limit",
                                        value: jobLimits[1]
                                    });
                                }
                                break; 
                            case "emplToolsLimit":
                                limitObjs.push({
                                    title: "Employee Tools Limit",
                                    value: cite[citeKey]
                                });
                                break; 
                            case "jobSiteLimit":
                                limitObjs.push({
                                    title: "Job Site Limit",
                                    value: cite[citeKey]
                                });
                                break; 
                            case "nonOwnedToolsLimit":
                                limitObjs.push({
                                    title: "Non-Owned Tools Limit",
                                    value: cite[citeKey]
                                });
                                break; 
                            default:
                                log.warn(`${logPrefix}Encountered unknown key in CITE limit switch: ${citeKey}. ` + __location);
                                break;
                        }
                    });

                    limitObjs.forEach(limit => {
                        if (limit.value) {
                            this.quoteCoverages.push({
                                description: limit.title,
                                value: convertToDollarFormat(limit.value, true),
                                sort: coverageSort++,
                                category: 'Contractor Installation Tools Equipment'
                            });
                        }
                    });
                }

                // get quote link from request
                if (response[rquIdKey]?.portalUrl?.length > 0) {
                    this.quoteLink = response[rquIdKey].portalUrl;
                }

                // Return with the quote
                if(response[rquIdKey].underwritingDecisionCode === 'SUBMITTED') {
                    if (response[rquIdKey]?.errors?.length > 0) {
                        const referralReasons = response[rquIdKey].errors.find(error => error.ReferralReasons);
                        if (referralReasons?.ReferralReasons?.length > 0) {
                            this.log += `--------======= Reasons for Referral =======--------<br><br>`;
                            this.log += `<pre>${htmlentities.encode(JSON.stringify(referralReasons.ReferralReasons, null, 4))}</pre><br><br>`;
                        }
                    }

                    if (this.amount > 0) {
                        return this.return_result('referred_with_price');
                    }
                    else {
                        return this.return_result('referred');
                    }
                }
                else {
                    // collect payment information
                    if (response[rquIdKey]?.paymentOptions) {
                        this.insurerPaymentPlans = response[rquIdKey].paymentOptions;
                        const paymentPlanIdMatrix = {
                            30: 1,
                            31: 2,
                            32: 3,
                            33: 4
                        };

                        const talagePaymentPlans = [];
                        for (const paymentPlan of response[rquIdKey].paymentOptions) {
                            if (!paymentPlanIdMatrix[paymentPlan.id]) {
                                // we do not have a payment plan mapping for this insurer payment plan
                                continue;
                            }

                            try {
                                const talagePaymentPlan = {
                                    paymentPlanId: paymentPlanIdMatrix[paymentPlan.id],
                                    insurerPaymentPlanId: paymentPlan.id,
                                    insurerPaymentPlanDescription: paymentPlan.description,
                                    NumberPayments: paymentPlan.numberOfInstallments,
                                    DepositPercent: paymentPlan.downPaymentPercent,
                                    DownPayment: paymentPlan.deposit
                                };
    
                                talagePaymentPlans.push(talagePaymentPlan);
                            }
                            catch (e) {
                                log.warn(`${logPrefix}Unable to parse payment plan: ${e}. Skipping...`);
                            }
                        }

                        if (talagePaymentPlans.length > 0) {
                            this.talageInsurerPaymentPlans = talagePaymentPlans;
                        }
                    }

                    return this.return_result('quoted');
                }
            }
        }
        catch (error) {
            log.error(`${logPrefix}Error parsing response structure: ${error}. ` + __location);
            this.reasons.push(`An error occurred parsing Markel's response.`);
            return this.return_result('error');
        }

        //Check reasons for DECLINED
        if (response[rquIdKey].underwritingDecisionCode === 'DECLINED') {
            if(response[rquIdKey]?.errors?.length > 0){
                response[rquIdKey].errors.forEach((error) => {
                    if(error.DeclineReasons?.length > 0){
                        error.DeclineReasons.forEach((declineReason) => {
                            this.reasons.push(declineReason);
                        });
                    }
                });
            }
            return this.return_result('declined');
        }
        else if (response[rquIdKey].errors) {
            for (const error of response[rquIdKey].errors) {
                if(typeof error === 'string'){
                    this.reasons.push(`${error}`);
                    if(error.indexOf("class codes are Declined") > -1 || error.indexOf("class codes were not eligible.") > -1){
                        return this.client_declined(`${error}`);
                    }
                }
                else {
                    this.reasons.push(`${JSON.stringify(error)}`);
                }
            }
        }
        else {
            this.reasons.push(`Unknown error for ${this.app.business.industry_code_description} in ${primaryAddress.territory}`);
        }

        return this.return_result('error');

    }

    getSupportedLimits = (limitsStr) => {
        // we only match on per occ
        const supportedLimits = [
            300000, // 600000
            500000, // 1000000
            1000000, // 2000000
            2000000 // 4000000
        ];
        if (limitsStr === "") {
            log.warn(`Provided limits are empty, can't format for Markel.`);
            return limitsStr;
        }

        // skip first character, look for first occurance of non-zero number
        const indexes = [];
        for (let i = 1; i < limitsStr.length; i++) {
            if (limitsStr[i] !== "0") {
                indexes.push(i);
            }
        }

        // parse first limit out of limits string (per occ)
        const perOccLimit = parseInt(limitsStr.substring(0, indexes[0]));

        for (let i = 0; i < supportedLimits.length; i++) {
            if (perOccLimit < supportedLimits[i]) {
                if (i === 0) {
                    return '300000/600000';
                }
                const supportedLimit = supportedLimits[i - 1];
                return `${supportedLimit}/${supportedLimit * 2}`;
            }
        }

        // if the provided value is greater than what they support, simply send their largest supported limits
        return '2000000/4000000';
    }

    getSupportedDeductible = (deductible) => {
        const supportedDeductibles = [
            500, 
            1000, 
            2500, 
            5000, 
            7500, 
            10000
        ];

        for (let i = 0; i < supportedDeductibles.length; i++) {
            if (deductible < supportedDeductibles[i]) {
                if (i === 0) {
                    return 500;
                }
                return supportedDeductibles[i - 1];
            }
        }

        return 10000;
    }

    async getIndustryCode() {
        const insurer = this.app.insurers.find(ins => ins.name === "Markel");

        const industryCodeBO = new IndustryCodeBO();
        const insurerIndustryCodeBO = new InsurerIndustryCodeBO();

        const bopCodeQuery = {
            parentIndustryCodeId: this.applicationDocData.industryCode
        };

        // find all bop codes for this parent talage industry code
        let bopCodeRecords = null;
        try {
            bopCodeRecords = await industryCodeBO.getList(bopCodeQuery);
        }
        catch (e) {
            log.error(`There was an error grabbing BOP codes for Talage Industry Code ${this.applicationDocData.industryCode}: ${e}. ` + __location);
            return null;
        }

        if (!bopCodeRecords) {
            log.error(`There was an error grabbing BOP codes for Talage Industry Code ${this.applicationDocData.industryCode}. ` + __location);
            return null;
        }

        if (bopCodeRecords.length === 0) {
            log.warn(`There were no BOP codes for Talage Industry Code ${this.applicationDocData.industryCode}. ` + __location);
            return null;
        }

        // reduce array to code ids
        const bopCodes = bopCodeRecords.map(code => code.industryCodeId);

        const insurerIndustryCodeQuery = {
            insurerId: insurer.id,
            talageIndustryCodeIdList: {$not: {$elemMatch: {$nin: bopCodes}}}
        };

        // find all insurer industry codes whos talageIndustryCodeIdList elements contain one of the BOP codes
        let insurerIndustryCodes = null;
        try {
            insurerIndustryCodes = await insurerIndustryCodeBO.getList(insurerIndustryCodeQuery);
        }
        catch (e) {
            log.error(`There was an error grabbing Insurer Industry Codes for Markel: ${e}. ` + __location);
            return null;
        }

        if (!insurerIndustryCodes) {
            log.error(`There was an error grabbing Insurer Industry Codes for Markel. ` + __location);
            return null;
        }

        if (insurerIndustryCodes.length === 0) {
            log.warn(`There were no matching Insurer Industry Codes for the selected industry. ` + __location);
            return null;
        }

        // Return the highest ranking code
        // NOTE: Currently not using NAICS/SIC/ISOGL, since w/ Markel, all the Insurer Codes are generally 1:1 to their BOP code, and they all have 
        //       matching codes, the only difference being the NAICSReference ID, which is used for ranking
        let industryCode = null;
        insurerIndustryCodes.forEach(ic => {
            if (!industryCode || ic.ranking < industryCode.ranking) {
                industryCode = ic;
            }
        });

        return industryCode;
    }
};