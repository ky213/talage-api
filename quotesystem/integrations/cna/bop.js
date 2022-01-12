/* eslint-disable object-shorthand */
/* eslint-disable no-shadow */
/* eslint-disable object-curly-newline */
/* eslint-disable prefer-const */
/* eslint-disable multiline-ternary */
/* eslint-disable array-element-newline */
/* eslint-disable space-before-function-paren */
/* eslint-disable no-trailing-spaces */
/* eslint-disable eol-last */
/* eslint-disable function-paren-newline */
/* eslint-disable no-console */
/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */
const axios = require('axios');
const moment = require('moment');


const Integration = require('../Integration.js');
const IndustryCodeBO = global.requireShared('./models/IndustryCode-BO.js')
const InsurerIndustryCodeBO = global.requireShared('./models/InsurerIndustryCode-BO.js');
const {convertToDollarFormat} = global.requireShared('./helpers/stringFunctions.js');

/**
 * BOP Integration for CNA
 */

/*
 * Quote URL
 *  Required Headers: 
 *  branch-producer-cd - combination of branch code and producer code (test: 010000000)
 *  agentId - (test: TALAGAPI, prod: TLAGEAPI)
 *  Content-Type - application/json
 *  Accept - application/json
*/
let host = "";
const QUOTE_URL = '/policy/small-business/full-quote';
const AUTH_URL = '/security/external-token/small-business';

let industryCode = null;

const specialCaseQuestions = [
    "cna.general.prevCarrier",
    "cna.general.yearsWithCarrier",
    "cna.general.havePrevCarrier",
    "cna.general.yearsManagementExp",
    "cna.general.choiceEndorsementPartial",
    "cna.general.choiceEndorsementFull"
];

const lossTypes = {
    "Fire": "Fire",
    "Water": "Internal Water",
    "Hail": "Weather/Winter",
    "Vandalism": "Vandalism/Theft",
    "Collapse": "Other-Property",
    "Windstorm": "Weather/Winter",
    "Theft/Burglary": "Vandalism/Theft",
    "Food Spoilage": "Other-Liability",
    "Inland Marine": "Other-Property",
    "Slip/Fall - Inside": "Other-Liability",
    "Slip/Fall - Outside": "Other-Liability",
    "Products": "Other-Liability",
    "Personal Injury": "Other-Liability",
    "Property Damage": "Other-Property",
    "Weather/Winter": "Weather/Winter",
    "Other": "Other-Property"
};

const limitIneligibility = [
    "89990_50",
    "80939_51",
    "80936_50",
    "80920_50",
    "80713_50",
    "73130_50",
    "59996_50",
    "59995_51",
    "59995_50",
    "59611_50",
    "59418_56",
    "59411_50",
    "58128_50",
    "56411_50",
    "55311_50",
    "54991_50",
    "54990_55",
    "54613_50",
    "54612_53",
    "54612_51",
    "54612_50",
    "54610_50",
    "54514_50",
    "54512_50",
    "54411_50",
    "53311_51",
    "53111_50",
    "52512_51",
    "52512_50",
    "52511_50",
    "50471_50",
    "48993_50",
    "48412_50",
    "48139_50",
    "48130_50",
    "27541_50",
    "27410_50",
    "27112_50"
]

const dynamicExposures = {
    "07420_50": "PAYRL",
    "07522_50": "Kennel",
    "07522_51": "Kennel",
    "07821_50": "PAYRL",
    "07821_51": "PAYRL",
    "17112_52": "PAYRL",
    "17113_50": "PAYRL",
    "17114_50": "PAYRL",
    "17115_50": "PAYRL",
    "17214_50": "PAYRL",
    "17216_50": "PAYRL",
    "17311_50": "PAYRL",
    "17312_50": "PAYRL",
    "17430_50": "PAYRL",
    "17512_50": "PAYRL",
    "17520_50": "PAYRL",
    "17712_50": "PAYRL",
    "17990_50": "PAYRL",
    "17990_51": "PAYRL",
    "17991_50": "PAYRL",
    "17994_50": "PAYRL",
    "17995_50": "PAYRL",
    "47241_50": "PAYRL",
    "51910_50": "PAYRL",
    "62111_50": "PAYRL",
    "62111_51": "PAYRL",
    "62111_52": "PAYRL",
    "64111_50": "PAYRL",
    "64111_51": "PAYRL",
    "64111_52": "PAYRL",
    "64111_53": "PAYRL",
    "64111_54": "PAYRL",
    "65310_50": "PAYRL",
    "65312_50": "PAYRL",
    "65312_51": "PAYRL",
    "65312_52": "PAYRL",
    "67990_50": "PAYRL",
    "72170_50": "PAYRL",
    "72170_51": "PAYRL",
    "72910_50": "PAYRL",
    "73110_50": "PAYRL",
    "73110_51": "PAYRL",
    "73110_52": "PAYRL",
    "73110_53": "PAYRL",
    "73110_54": "PAYRL",
    "73121_50": "PAYRL",
    "73300_50": "PAYRL",
    "73360_50": "PAYRL",
    "73493_50": "PAYRL",
    "73780_50": "PAYRL",
    "73890_50": "PAYRL",
    "73890_51": "PAYRL",
    "73890_52": "PAYRL",
    "73890_53": "PAYRL",
    "73890_54": "PAYRL",
    "73890_55": "PAYRL",
    "73890_56": "PAYRL",
    "73890_57": "PAYRL",
    "73890_58": "PAYRL",
    "73892_50": "PAYRL",
    "73894_50": "PAYRL",
    "73898_50": "PAYRL",
    "73899_50": "PAYRL",
    "76290_50": "PAYRL",
    "76290_52": "PAYRL",
    "76290_53": "PAYRL",
    "76291_50": "PAYRL",
    "76292_51": "PAYRL",
    "76992_50": "PAYRL",
    "76993_50": "PAYRL",
    "78922_50": "PAYRL",
    "79220_50": "PAYRL",
    "81111_50": "Court",
    "82431_50": "NumStudents",
    "82491_50": "NumStudents",
    "82491_51": "NumStudents",
    "82491_53": "NumStudents",
    "82491_54": "NumStudents",
    "86110_50": "Member",
    "86110_51": "Member",
    "86110_52": "Member",
    "86110_53": "Member",
    "86110_54": "Member",
    "86110_55": "Member",
    "86110_56": "PAYRL",
    "86415_50": "Member",
    "87110_51": "PAYRL",
    "87110_52": "PAYRL",
    "87120_50": "PAYRL",
    "87130_50": "PAYRL",
    "87210_50": "PAYRL",
    "87210_52": "PAYRL",
    "87210_53": "PAYRL",
    "87210_54": "PAYRL",
    "87210_55": "PAYRL",
    "87310_50": "PAYRL",
    "87340_50": "PAYRL",
    "89990_50": "PAYRL"
};

const constructionCodes = {
    Frame: "F",
    "Joisted Masonry": "JM",
    "Fire Resistive": "R",
    "Masonry Non Combustible": "MNC",
    "Non Combustible": "LNC"
    // "Modified Fire Resistive": "MFR"
};

// eslint-disable-next-line no-unused-vars
const LIMIT_CODES = [
    'BIEachOcc',
    'DisPol',
    'DisEachEmpl'
];

const explanationQuestions = [
    "com.cna_WORK20293"
];

const carrierLimits = [
    '100000/500000/100000',
    '100000/1000000/100000',
    '500000/500000/500000',
    '500000/1000000/500000',
    '1000000/1000000/1000000' // if state = CA, this is ONLY option
];

const legalEntityCodes = {
    "Government Entity": "FG",
    "Non-profit Corporation": "NP",
    "Unincorporated Association": "UA",
    "Estate": "ES",
    "Individual": "IN",
    "Corporation": "CP",
    "General Partnership": "PT",
    "Limited Partnership": "LP",
    "Trust": "TR",
    "Joint Venture": "JV",
    "Limited Liability Company": "LL",
    "Sole Proprietorship": "SP",
    "Association": "AS",
    "Partnership": "PA",
    "Other": "OT"
};

const carrierList = [
    "Acadia",
    "Allied",
    "Allstate",
    "America First",
    "Auto-Owners",
    "Chubb",
    "Colorado Casualty",
    "Employers Mutual",
    "Farmers",
    "Federated Mutual",
    "Fireman's Fund",
    "Golden Eagle",
    "Hanover",
    "Harleysville",
    "Hartford",
    "Hawkeye Security",
    "Indiana",
    "Liberty Mutual",
    "Liberty NW",
    "Montgomery",
    "Ohio Casualty",
    "One Beacon",
    "Peerless",
    "Philadelphia",
    "Safeco",
    "Selective",
    "State Farm",
    "Travelers",
    "Westfield",
    "Zurich",
    "Other"
];

// legal entities that require SSN
// eslint-disable-next-line no-unused-vars
const ssnLegalEntities = [
    "SP",
    "IN"
];

let logPrefix = null;

module.exports = class CnaBOP extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;

        // this integration uses BOP codes
        this.usePolciyBOPindustryCode = true;
    }

	/** 
	 * Requests a quote from Employers. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an error if rejected
	 */
    async _insurer_quote() {
        // swap host and creds based off whether this is sandbox or prod
        let agentId = null;
        let branchProdCd = null;
        const applicationDocData = this.applicationDocData;
        logPrefix = `CNA BOP (App ID: ${this.app.id}): `;

        //Basic Auth should be calculated with username and password set 
        // in the admin for the insurer
        // Basic Auth setup moved to Auth function
        if (this.insurer && this.insurer.useSandbox) {
            agentId = "TALAGAPI";
            host = "drt-apis.cna.com";
            branchProdCd = "010018297"
        }
        else {
            agentId = "TLAGEAPI";
            host = "apis.cna.com";
            branchProdCd = "540085091";
        }

        industryCode = await this.getIndustryCode();

        if (!industryCode) {
            log.error(`${logPrefix}Unable to get Industry Code, applicantion Out of Market. ` + __location);
            return this.client_autodeclined_out_of_appetite();
        }

        const business = this.app.business;
        const BOPPolicy = applicationDocData.policies.find(policy => policy.policyType === 'BOP');

        let agencyId = null;
        try {
            agencyId = this.app.agencyLocation.insurers[this.insurer.id].agencyId.split("-");
        }
        catch (e) {
            log.error(`${logPrefix}There was an error splitting the agency_id for insurer ${this.insurer.id}. ${e}.` + __location);
            return this.client_error(`There was an error splitting the agency_id for insurer ${this.insurer.id}: ${e}.`);
        }
        if (!Array.isArray(agencyId) || agencyId.length !== 2) {
            log.error(`${logPrefix}Could not generate branch code and contract number from Agency ID ${this.app.agencyLocation.agencyId}.` + __location);
            return this.client_error(`Could not generate branch code and contract number from Agency ID ${this.app.agencyLocation.agencyId}.`);
        }

        const branchCode = agencyId[0];
        const contractNumber = agencyId[1];
        const requestUUID = this.generate_uuid();

        // Prepare limits (if CA, only accept 1,000,000/1,000,000/1,000,000)
        let limits = business.mailing_territory === "CA" ? 
            carrierLimits[carrierLimits.length - 1] : 
            this.getBestLimits(carrierLimits);

        limits = this.getCNALimits(limits);

        if (!limits) {
            return this.client_autodeclined('Requested liability limits not supported.', {industryCode: this.industry_code.id});
        }

        let phone = applicationDocData.contacts.find(c => c.primary).phone.toString();
        // fall back to outside phone IFF we cannot find primary contact phone
        phone = phone ? phone : applicationDocData.phone.toString();
        const formattedPhone = `+1-${phone.substring(0, 3)}-${phone.substring(phone.length - 7)}`;

        // =================================================================
        //                     FILL OUT REQUEST OBJECT
        // =================================================================
        
        const requestJSON = {
            SignonRq: {
                SignonPswd: {
                    CustId: {
                        CustLoginId: "TALAGEAPI"
                    }
                },
                CustLangPref: "en-US",
                ClientApp: {
                    Org: "TALAGE",
                    Name: "API",
                    Version: "1"
                }
                // "ProxyClient":{
                //     "Org":"BCFTech",
                //     "Name":"TransmitXML",
                //     "Version":"V1.00"
                // }
            },
            InsuranceSvcRq: [
                {
                    RqUID: requestUUID,
                    BOPPolicyQuoteInqRq: [
                        {
                            RqUID: requestUUID,
                            TransactionRequestDt:{
                                value: moment().format("YYYY-MM-DD")
                            },
                            Producer: [
                                {
                                    GeneralPartyInfo: {
                                        NameInfo: [
                                            {
                                                CommlName: {
                                                    CommercialName: {
                                                        value: applicationDocData.businessName
                                                    }
                                                }
                                            }
                                        ],
                                        Addr: [
                                            {
                                                AddrTypeCd: [
                                                    {
                                                        value: "StreetAddress"
                                                    }
                                                ],
                                                Addr1: {
                                                    value: applicationDocData.mailingAddress
                                                },
                                                City: {
                                                    value: applicationDocData.mailingState
                                                },
                                                StateProvCd:{
                                                    value: applicationDocData.mailingCity
                                                },
                                                PostalCode:{
                                                    value: applicationDocData.mailingZipcode
                                                }
                                            }
                                        ],
                                        Communications: {
                                            PhoneInfo: [
                                                {
                                                    PhoneTypeCd: {
                                                        value: "Phone"
                                                    },
                                                    CommunicationUseCd: [
                                                        {
                                                            value: "Business"
                                                        }
                                                    ],
                                                    PhoneNumber:{
                                                        value: formattedPhone
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    ProducerInfo: {
                                        ContractNumber: {
                                            value: contractNumber
                                        },
                                        ProducerRoleCd: [
                                            {
                                                value: "Agency"
                                            }
                                        ],
                                        FieldOfficeCd: {
                                            value: "S" // What is this?
                                        },
                                        "com.cna_branchCode": [
                                            {
                                                "value": branchCode
                                            }
                                        ],
                                        "com.cna_branchLabel": [
                                            {
                                                "value": "AF" // What is this?
                                            }
                                        ]
                                    }
                                }
                            ],
                            InsuredOrPrincipal: [
                                {
                                    ItemIdInfo: {
                                        AgencyId: {
                                            value: `${branchCode}-${contractNumber}`
                                        }
                                    },
                                    GeneralPartyInfo: {
                                        NameInfo: [
                                            {
                                                CommlName: {
                                                    CommercialName: {
                                                        value: applicationDocData.businessName
                                                    }
                                                },
                                                LegalEntityCd: {
                                                    value: legalEntityCodes[applicationDocData.entityType] ? legalEntityCodes[applicationDocData.entityType] : "OT" 
                                                }
                                            }
                                        ],
                                        Addr: this.getLocations(false),
                                        Communications: {
                                            PhoneInfo: [
                                                {
                                                    PhoneTypeCd: {
                                                        value: "Phone"
                                                    },
                                                    CommunicationUseCd: [
                                                        {
                                                            value: "Day" // defaulted
                                                        }
                                                    ],
                                                    PhoneNumber: {
                                                        value: formattedPhone
                                                    }
                                                }
                                            ],
                                            WebsiteInfo:[
                                                {
                                                    WebsiteURL: {
                                                        value: applicationDocData.website
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    InsuredOrPrincipalInfo: {
                                        InsuredOrPrincipalRoleCd: [
                                            {
                                                value: "Insured"
                                            }
                                        ],
                                        BusinessInfo: {
                                            SICCd: {
                                                value: industryCode.attributes.SICCd // may need to be sic specific on attr?
                                            },
                                            NumEmployeesFullTime: {
                                                value: this.get_total_full_time_employees()
                                            },
                                            NumEmployeesPartTime: {
                                                value: this.get_total_part_time_employees()
                                            }
                                        }
                                    }
                                }
                            ],
                            CommlPolicy: {
                                PolicyNumber: {
                                    // Not needed?
                                },
                                LOBCd: {
                                    value: "BOP"
                                },
                                ControllingStateProvCd: {
                                    value: applicationDocData.mailingState
                                },
                                ContractTerm: {
                                    EffectiveDt: {
                                        value: moment(BOPPolicy.effectiveDate).format("YYYY-MM-DD")
                                    },
                                    ExpirationDt: {
                                        value: moment(BOPPolicy.expirationDate).format("YYYY-MM-DD")
                                    },
                                    DurationPeriod: {
                                        NumUnits: {
                                            value: moment(BOPPolicy.expirationDate).diff(moment(BOPPolicy.effectiveDate), 'months', false)
                                        },
                                        UnitMeasurementCd: {
                                            value: "MON"
                                        }
                                    }
                                },
                                Loss: this.getLosses(),
                                NumLosses: {
                                    value: applicationDocData.claims.filter(claim => claim.policyType === 'BOP').length
                                },
                                OtherOrPriorPolicy: [
                                    this.getOtherOrPriorPolicy()
                                ],
                                id: "PolicyLevel",
                                CommlPolicySupplement: {
                                    LengthTimeInBusiness: {
                                        NumUnits: {
                                            value: this.get_years_in_business()
                                        },
                                        UnitMeasurementCd: {
                                            value: "ANN"
                                        }
                                    }
                                }
                            },
                            Location: this.getLocations(true),
                            BOPLineBusiness: {
                                LOBCd: {
                                    value: "BOP"
                                },
                                PropertyInfo: {
                                    CommlPropertyInfo: this.getPropertyCoverages()
                                },
                                LiabilityInfo: {
                                    CommlCoverage: this.getCoverages(limits),
                                    GeneralLiabilityClassification: this.getGLClassifications()
                                },
                                // TODO: These are convoluted to fill out, and is tied to area leased. Leaving out for now unless CNA kicks back
                                // "com.cna_ProductInfo":[
                                //     {
                                //         "ProductDesignedDesc":{
                                //             "value":"test 1390"
                                //         },
                                //         "ProductMfgDesc":{
                                            
                                //         },
                                //         "com.cna_IntendedUse":{
                                //             "value":"test 1390"
                                //         },
                                //         "com.cna_grossSales":{
                                //             "Amt":{
                                //                 "value":0
                                //             }
                                //         },
                                //         "com.cna_NumAnnualUnitsSold":{
                                //             "value":0
                                //         },
                                //         "com.cna_YearProductFirstMade":{
                                //             "value":0
                                //         },
                                //         "com.cna_YearProductDiscontinued":{
                                //             "value":2020
                                //         },
                                //         "com.cna_ExpectedLife":{
                                //             "value":0
                                //         },
                                //         "com.cna_ProductSelfInsuredInd":{
                                //             "value":"0"
                                //         }
                                //     }
                                // ],
                                // TODO: Find out what questions should be in here, this might just be all general questions
                                "com.cna_QuestionAnswer": this.getQuestions(applicationDocData.questions)
                            },
                            CommlSubLocation: this.getBuildings()
                        }
                    ]
                }
            ]
        };

        // add Underwriting Question required for BOP submissions
        requestJSON.InsuranceSvcRq[0].BOPPolicyQuoteInqRq[0].BOPLineBusiness["com.cna_QuestionAnswer"].push({
            "com.cna_QuestionCd": {
              value: "UWSTMT"
            },
            YesNoCd: {
              value: "YES"
            }
        });

        // add choice endorsement if provided
        const partialChoiceEndorsementQuestion = applicationDocData.questions.find(question => question.insurerQuestionIdentifier === "cna.general.choiceEndorsementPartial");
        const fullChoiceEndorsementQuestion = applicationDocData.questions.find(question => question.insurerQuestionIdentifier === "cna.general.choiceEndorsementFull");
        const choiceEndorsementQuestion = partialChoiceEndorsementQuestion || fullChoiceEndorsementQuestion;

        let questionCode = null;
        if (choiceEndorsementQuestion?.answerValue) {
            switch (choiceEndorsementQuestion.answerValue) {
                case "Choice Endorsement":
                    questionCode = "com.cna_BOP04";
                    break;
                case "Choice Extra Endorsement":
                    questionCode = "com.cna_C07";
                    break;
                case "Super Choice Endorsement":
                    questionCode = "com.cna_C14";
                    break;
                case "Industry Specific Choice Endorsement":
                    questionCode = "com.cna_IndustryChoice";
                    break;
                case "None":
                    break;
                default:
                    log.warn(`${logPrefix}Unknown Choice Endorsement question answer encountered: ${choiceEndorsementQuestion.answerValue}. Not adding...` + __location);
                    break;
            }

            // if we have a question code (None wasn't selected, or answer wasn't found), add the choice endorsement
            if (questionCode) {
                requestJSON.InsuranceSvcRq[0].BOPPolicyQuoteInqRq[0].BOPLineBusiness["com.cna_QuestionAnswer"].push({
                    "com.cna_QuestionCd": {
                        value: questionCode
                      },
                      YesNoCd: {
                        value: "YES"
                      }
                });
            }
        }

        // NOTE: Although documentation states this is only applicable for CA and FL, the API doesn't not appear to follow this rule
        // if (applicationDocData.mailingState === 'CA' || applicationDocData.mailingState === 'FL') {
            const yearsManExp = applicationDocData.questions.find(question => question.insurerQuestionIdentifier === 'cna.general.yearsManagementExp');
            if (yearsManExp) {
                const value = parseInt(yearsManExp.answerValue, 10);

                if (!isNaN(value)) {
                    requestJSON.InsuranceSvcRq[0].BOPPolicyQuoteInqRq[0].CommlPolicy.CommlPolicySupplement["com.cna_LengthTimeIndustyManagement"] = {
                        NumUnits: {
                            value
                        },
                        UnitMeasurementCd:{
                            value: "ANN"
                        }
                    }
                }
                else {
                    log.warn(`${logPrefix}CNA expects years of management and industry experience for this state, but none or invalid value was provided.` + __location);
                }
            } 
        // }

        // =================================================================
        //                        START QUOTE PROCESS
        // =================================================================

        // authenticate with CNA before running quote
        const jwt = await this.auth();
        if (jwt.includes("Error")) {
            log.error(jwt + __location);
            this.client_connection_error(__location, jwt);
        }

        // create request headers using auth access token (jwt)
        const headers = {
            'authorization': `Bearer ${jwt.trim()}`,
            'branch-producer-cd': branchProdCd,
            'agentid': agentId,
            'content-type': 'application/json'
        };

        let result = null;
        try {
            result = await this.send_json_request(host, QUOTE_URL, JSON.stringify(requestJSON), headers, "POST");
        }
        catch (error) {
            // insure we got an actual response back, and not just a general error object
            let errorJSON = null;
            try {
                errorJSON = JSON.parse(error.response);
            }
            catch (e) {
                const errorMessage = `${logPrefix}There was an error parsing the error object: ${e}.`
                log.error(errorMessage + __location);
                return this.client_error(errorMessage, __location);
            }

            // following cases catch different error response structures CNA returns, since some errors do not come back in a normal response structure
            
            if (errorJSON?.message) {
                const errorMessage = `${logPrefix}${errorJSON.message}`;
                log.error(errorMessage + __location);
                return this.client_error(errorMessage, __location);
            }

            if (errorJSON?.StatusDesc) {
                const errorMessage = `${logPrefix}${errorJSON.StatusDesc}`;
                log.error(errorMessage + __location);
                return this.client_error(errorMessage, __location);
            }

            if (!errorJSON?.InsuranceSvcRs[0]?.BOPPolicyQuoteInqRs[0]?.MsgStatus) {
                const errorMessage = `There was an error parsing the response object: ${errorJSON}. The result structure may have changed.`;
                log.error(errorMessage + __location);
                return this.client_error(errorMessage, __location);
            }
            else {
                result = errorJSON;
            }
        }

        let quoteNumber = null;
        let premium = null;
        const quoteCoverages = [];
        let quoteLetter = null;
        let quoteMIMEType = null;
        let policyStatus = null;

        const response = result.InsuranceSvcRs[0].BOPPolicyQuoteInqRs[0];
        switch (response.MsgStatus.MsgStatusCd.value.toLowerCase()) {                
            case "dataerror":
            case "datainvalid":
            case "error":
            case "login_error":
            case "general failure":
                const error = response.MsgStatus;
                log.error(`${logPrefix}response ${error.MsgStatusDesc.value} ` + __location);
                if (error.ExtendedStatus && Array.isArray(error.ExtendedStatus)) {
                    error.ExtendedStatus.forEach(status => {
                        if (status.ExtendedStatusCd !== "VerifyDataAbsence") {
                            const prefix = status.ExtendedStatusCd ? status.ExtendedStatusCd.value : "";
                            const statusMsg = status.ExtendedStatusDesc ? `: ${status.ExtendedStatusDesc.value}` : "";
    
                            if (prefix + statusMsg !== "") {
                                this.reasons.push(prefix + statusMsg);
                            }
                        }
                    });
                }
                return this.client_error(`${error.MsgStatusDesc.value}`, __location);
            case "rejected": 
                const decline = response.MsgStatus;
                log.info(`${logPrefix}${decline.MsgStatusDesc.value} ` + __location);
                if (decline.ExtendedStatus && Array.isArray(decline.ExtendedStatus)) {
                    decline.ExtendedStatus.forEach(status => {
                        if (status?.ExtendedStatusCd?.value !== "VerifyDataAbsence") {
                            const prefix = status.ExtendedStatusCd.value;
                            const statusMsg = status.ExtendedStatusDesc ? `: ${status.ExtendedStatusDesc.value}` : "";
    
                            if (prefix + statusMsg !== "") {
                                this.reasons.push(prefix + statusMsg);
                            }
                        }
                    });
                }
                return this.client_declined(`${decline.MsgStatusDesc.value}`);
            case "in_progress":
                return this.client_error(`The quote request did not complete.`, __location);
            case "351":
                return this.client_declined(`The quote request is not available.`);
            case "success":
            case "successwithinfo":
            case "successwithchanges":
            case "resultpendingoutofband":
                const policySummary = response.PolicySummaryInfo;
                policyStatus = policySummary.PolicyStatusCd.value;
                switch (policySummary.PolicyStatusCd.value.toLowerCase()) {
                    case "quotednotbound":
                    case "issued":
                        // get quote number (optional)
                        try {
                            quoteNumber = response.CommlPolicy.QuoteInfo.CompanysQuoteNumber.value;
                        }
                        catch (e) {
                            log.warn(`${logPrefix}Couldn't parse quote number: ${e}` + __location);
                        }

                        // get premium (required)
                        try {
                            premium = policySummary.FullTermAmt.Amt.value;
                        }
                        catch (e) {
                            log.error(`${logPrefix}Couldn't parse premium from CNA response: ${e}.` + __location);
                            return this.client_error(`Couldn't parse premium from CNA response: ${e}.`, __location);
                        }

                        // get limits (required)
                        // TODO: Rework limit parsing to continue parsing limits even if one fails (add inner try/catch blocks)
                        let coverageSort = 0;
                        try {
                            // general limits
                            response.BOPLineBusiness.LiabilityInfo.CommlCoverage.forEach(genLim => {
                                const newCoverage = {
                                    description: genLim.Limit[0].LimitAppliesToCd[0].value,
                                    value: convertToDollarFormat(genLim.Limit[0].FormatInteger.value, true),
                                    sort: coverageSort++,
                                    category: 'General Limits',
                                    insurerIdentifier: genLim.CoverageCd.value
                                };

                                quoteCoverages.push(newCoverage);
                            });
                        }
                        catch (e) {
                            log.error(`${logPrefix}Couldn't parse one or more general limit values from the response: ${e}.` + __location);
                        }

                        try {
                            // property limits
                            response.BOPLineBusiness.PropertyInfo.CommlPropertyInfo[0].CommlCoverage.forEach(propLim => {
                                let description = propLim.CoverageCd.value;
                                switch (propLim.CoverageCd.value) {
                                    case "BLDG":
                                        description = "Building";
                                        break;
                                    case "BPP":
                                        description = "Building Personal Property";
                                        break;
                                    case "WH":
                                        description = "Wind / Hail";
                                        break;
                                    case "GLASS":
                                        description = "Glass";
                                        break;
                                    default:
                                        break;
                                }

                                if (propLim.Limit) {
                                    const newCoverage = {
                                        description: description + " Limit",
                                        value: convertToDollarFormat(propLim.Limit[0].FormatInteger.value, true),
                                        sort: coverageSort++,
                                        category: 'Property Limits',
                                        insurerIdentifier: propLim.CoverageCd.value
                                    };
    
                                    quoteCoverages.push(newCoverage);
                                }

                                if (propLim.Deductible) {
                                    let value = null;
                                    if (propLim.Deductible[0].FormatText.value && propLim.Deductible[0].FormatText.value === "Policy Level") {
                                        value = "Policy Level";
                                    }

                                    const newCoverage = {
                                        description: description + " Deductible",
                                        value: value ? value : convertToDollarFormat(propLim.Deductible[0].FormatInteger.value, true),
                                        sort: coverageSort++,
                                        category: 'Property Limits',
                                        insurerIdentifier: propLim.CoverageCd.value
                                    };
    
                                    quoteCoverages.push(newCoverage);
                                }
                            });
                        }
                        catch (e) {
                            log.error(`${logPrefix}Couldn't parse one or more property limit values from the response: ${e}.` + __location);
                        }
                        
                        // get quote letter (optional) and quote MIME type (optional)
                        let proposalURL = response.MsgStatus.ChangeStatus.find(change => change.IdRef.hasOwnProperty("AttachmentTypeCd") && change.IdRef.AttachmentTypeCd.value === "QuoteProposal");
                        if (proposalURL) {
                            proposalURL = proposalURL.IdRef.WebsiteURL.value;
                            const [quoteHost, quotePath] = this.splitUrl(proposalURL);

                            let quoteResult = null;
                            try {
                                quoteResult = await this.send_json_request(quoteHost, quotePath, null, headers, "GET");
                            }
                            catch (e) {
                                log.error(`${logPrefix}The request to retrieve the quote proposal letter failed: ${e}.` + __location);
                            }

                            try {
                                quoteLetter = quoteResult.InsuranceSvcRs[0].ViewInqRs[0].FileAttachmentInfo[0]["com.cna.AttachmentData"].value;
                            }
                            catch (e) {
                                log.error(`${logPrefix}There was an error parsing the quote letter: ${e}.` + __location);
                            }

                            try {
                                quoteMIMEType = quoteResult.InsuranceSvcRs[0].ViewInqRs[0].FileAttachmentInfo[0].MIMEEncodingTypeCd.value;
                            }
                            catch (e) {
                                log.error(`${logPrefix}There was an error parsing the quote MIME type: ${e}.` + __location);
                            }
                        }
                        else {
                            log.error(`${logPrefix}Couldn't find proposal URL with successful quote status: ${response.MsgStatus.MsgStatusCd.value}. Change Status': ${JSON.stringify(response.MsgStatus.ChangeStatus, null, 4)}` + __location);
                        }
                        break;
                    case "notquotednotbound":
                        return this.client_declined(`Application was not quoted or bound.`);
                    default: 
                        log.error(`${logPrefix}Response contains an unrecognized policy status: ${policySummary.PolicyStatusCd.value}` + __location);
                        return this.client_error(`Response contains an unrecognized policy status: ${policySummary.PolicyStatusCd.value}`, __location);
                } // end inner switch
                break;
            default: 
                log.error(`${logPrefix}Got an unknown quote status "${response.MsgStatus.MsgStatusCd.value}": "${response.MsgStatus.MsgStatusDesc.value}".` + __location);
                return this.client_error(`Got an unknown quote status "${response.MsgStatus.MsgStatusCd.value}": "${response.MsgStatus.MsgStatusDesc.value}".`, __location);
        } // end outer switch

        if (policyStatus) {
            // will either be issued or quotednotbound
            if (policyStatus === "issued") { 
                return this.client_quoted(quoteNumber, [], premium, quoteLetter, quoteMIMEType, quoteCoverages);
            }
            else {
                return this.client_referred(quoteNumber, [], premium, quoteLetter, quoteMIMEType, quoteCoverages);
            }
        }
        else {
            log.error(`${logPrefix}Response doesn't include a policy status code.` + __location);
            return this.client_error(`Response doesn't include a policy status code.`, __location);
        }
    }

    // transform our business locations array into location objects array to be inserted into the BOP request Object
    getLocations(fullLocation = false) {
        // iterate over each location and transform it into a location object
        return this.app.business.locations.map((location, i) => {
                const locationObj = {
                    Addr: {
                        Addr1: {value: `${location.address} ${location.address2}`.trim()},
                        City: {value: location.city},
                        StateProvCd: {value: location.territory},
                        PostalCode: {value: location.zipcode}
                    },
                    id: `L${i + 1}` 
                };

                // only provided in GeneralPartyInfo addr field
                if (!fullLocation) {
                    locationObj.Addr.AddrTypeCd = [{value: "MailingAddress"}];
                }

                if (fullLocation) {
                    // agency information
                    locationObj.ItemIdInfo = {AgencyId: {value: `${this.app.agencyLocation.insurers[this.insurer.id].agencyId}`}};

                    // sub location information
                    locationObj.SubLocation = [{...locationObj}];
                    locationObj.SubLocation[0].id += `S${i}`;

                    // location name - left blank for now
                    locationObj.locationName = {};
                }

                return locationObj;
            });
    }

    getBuildings() {
        const buildings = [];
        this.applicationDocData.locations.forEach((location, i) => {
            const buildingObj = {
                Construction: {
                    BldgArea: {
                        NumUnits: {
                            value: location.square_footage
                        }
                    },
                    ConstructionCd: [
                        {
                            value: constructionCodes[location.constructionType]
                        }
                    ],
                    YearBuilt: {
                        value: location.yearBuilt
                    },
                    NumStories: {
                        value: location.numStories
                    }
                },
                BldgOccupancy: [{}],
                BldgImprovements: { 
                    HeatingImprovementCd: {
                        value: "C"
                    },
                    HeatingImprovementYear: {
                        value: location.bop.heatingImprovementYear
                    },
                    PlumbingImprovementCd:{
                        value: "C"
                    },
                    PlumbingImprovementYear: {
                        value: location.bop.plumbingImprovementYear
                    },
                    RoofingImprovementCd: {
                        value: "C"
                    },
                    RoofingImprovementYear: {
                        value: location.bop.roofingImprovementYear
                    },
                    WiringImprovementCd: {
                        value: "C"
                    },
                    WiringImprovementYear:{
                        value: location.bop.wiringImprovementYear
                    }
                },
                BldgProtection: { 
                    SprinkleredPct: {
                        value: location.bop.sprinkler ? `100` : `0`
                    }
                    // FireProtectionClassCd: { // No explanation of value, but is optional field, so leaving out for now
                    //     value: 
                    // }
                },
                BldgFeatures: {},
                "com.cna_QuestionAnswer": this.getQuestions(location.questions),
                "com.cna_CommonAreasMaintenanceCd": {},
                LocationRef: `L${i + 1}`,
                SubLocationRef: `L${i + 1}S1`
            };

            // -------- BldgFeature questions --------
            // NOTE: Daycare children is currently not handled 

            // lawyers
            const numLawyers = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.numLawyers");
            if (numLawyers) {
                buildingObj.BldgFeatures["com.cna_NumOfLawyers"] = {
                    Amt: {
                        value: numLawyers.answerValue
                    }
                }
            }

            // kennels
            const numKennels = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.numKennels");
            if (numKennels) {
                buildingObj.BldgFeatures["com.cna_NumOfKennels"] = {
                    Amt: {
                        value: numKennels.answerValue
                    }
                }
            }

            // members
            const numMembers = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.numMembers");
            if (numMembers) {
                buildingObj.BldgFeatures["com.cna_NumChurchMembersOrStudents"] = {
                    value: numMembers.answerValue
                }
            }

            // pupils
            const numPupils = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.numPupils");
            if (numPupils) {
                buildingObj.BldgFeatures["com.cna_NumOfPupils"] = {
                    value: numPupils.answerValue
                }
            }


            // payroll type
            const payrollType = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.payrollType");
            if (payrollType) {
                buildingObj.FinancialInfo = {
                    "com.cna_PayrollTypeCd": {
                        value: payrollType.answerValue
                    }
                };
            }

            // Construction question section
            const hasBasements = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.hasBasements");
            if (hasBasements && (hasBasements.answerValue === true || hasBasements.answerValue.toLowerCase() === "yes")) {
                const numBasements = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.numBasements");
                if (numBasements) {
                    const basementsValue = parseInt(numBasements.answerValue, 10);
                    if (!isNaN(basementsValue) && basementsValue !== 0) {
                        buildingObj.Construction.NumBasements = {
                            value: basementsValue
                        }
    
                        const unfinishedBasementArea = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.unfinishedBasementArea");
                        if (unfinishedBasementArea) {
                            const unfinishedValue = parseInt(unfinishedBasementArea.answerValue, 10);
                            if (!isNaN(unfinishedValue)) {
                                buildingObj.Construction["com.cna_UnFinishedBasementArea"] = {
                                    NumUnits: {
                                        value: unfinishedValue
                                    }
                                }
                            }
                        }
    
                        const finishedBasementArea = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.finishedBasementArea");
                        if (finishedBasementArea) {
                            const finishedValue = parseInt(finishedBasementArea.answerValue, 10);
                            if (!isNaN(finishedValue)) {
                                buildingObj.Construction["com.cna_FinishedBasementArea"] = {
                                    NumUnits: {
                                        value: finishedValue
                                    }
                                }
                            }
                        }
                    }
                    else {
                        buildingObj.Construction.NumBasements = {
                            value: 0
                        }
                    }
                }
                else {
                    log.warn(`${logPrefix}Applicant denoted they have basements, but could not find subsequent child questions. Defaulting to 0 on submission.` + __location);
                }
            }
            else {
                buildingObj.Construction.NumBasements = {
                    value: 0
                }
            }
            
            // BldgOccupancy question section
            const buildingOccObj = buildingObj.BldgOccupancy[0];

            // temporarily adding... This is supposed to be optional but is not being treated as so
            buildingOccObj["com.cna_FinishedBasementOccupancyCd"] = {
                value: "BASEF"
            };

            const areaOccupied = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.areaOccupied");
            if (areaOccupied) {
                const areaOccupiedValue = parseInt(areaOccupied.answerValue, 10);
                if (!isNaN(areaOccupiedValue)) {
                    buildingOccObj.AreaOccupied = {
                        NumUnits: {
                            value: areaOccupiedValue > location.square_footage ? location.square_footage : areaOccupiedValue
                        },
                        UnitMeasurementCd: {
                            value: "feet"
                        }
                    }
                }

                const vacantValue = location.square_footage - areaOccupiedValue;
                if (vacantValue > 0) {
                    buildingOccObj.VacancyInfo = {
                        VacantArea: {value: vacantValue},
                        ReasonVacantDesc: {value: "N/A"} // For now, leaving this as blank, and not accepting this from applicant
                    }
                }

                if (location.square_footage > 0) {
                    const percentOcc = Math.round(areaOccupiedValue / location.square_footage * 100);

                    buildingOccObj.OccupiedPct = {
                        value: percentOcc
                    };
                }

                const isSingleOccupancy = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.singleOcc");
                if (isSingleOccupancy) {
                    if (isSingleOccupancy.answerValue === true || isSingleOccupancy.answerValue.toLowerCase() === "yes") {
                        buildingOccObj["com.cna_OccupancyTypeCd"] = {
                            value: "b"
                        }
                    }
                    else {
                        const hazard = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.multiOccHighHazard");
                        if (hazard) {
                            buildingOccObj["com.cna_OccupancyTypeCd"] = {
                                value: hazard.answerValue === true || hazard.answerValue.toLowerCase() === "yes" ? "c" : "a"
                            }
                        }
                        else {
                            buildingOccObj["com.cna_OccupancyTypeCd"] = {
                                value: "a"
                            }
                        }
                    }
                }

                const areaLeased = location.questions.find(question => question.insurerQuestionIdentifier === "cna.building.areaLeased");
                if (areaLeased) {
                    const areaLeasedValue = parseInt(areaLeased.answerValue, 10);
                    if (!isNaN(areaLeasedValue)) {
                        buildingOccObj["com.cna_AreaLeased"] = [
                            {
                                NumUnits: {
                                    value: areaLeasedValue
                                },
                                UnitMeasurementCd: {
                                    value: "Feet"
                                }
                            }  
                        ];
                        buildingOccObj["com.cna_LeasedSpaceDesc"] = [{}]; // For now, leaving this as blank, and not accepting this from applicant

                        if (areaLeasedValue > 0) {
                            buildingOccObj["com.cna_LeasedSpaceDesc"][0].value = "Description not provided";
                        }
                    }
                }
                else {
                    // if question not found, default to 0 (element is always required)
                    buildingOccObj["com.cna_AreaLeased"] = [
                        {
                            NumUnits: {
                                value: 0
                            },
                            UnitMeasurementCd: {
                                value: "Feet"
                            }
                        }  
                    ];
                }
            }

            buildings.push(buildingObj);
        });

        return buildings;
    }

    // generates the Loss array based off values from claims
    getLosses() {
        // NOTE: CNA supports Closed (C), Declined (D), Open (O), Other (OT), Reoponed (R), and Subrogation - Claim Open Pending Subrogation (S)
        // We only have Open (O), and Closed (C)
        const losses = [];

        this.applicationDocData.claims.forEach(claim => {
            // only add BOP claims
            if (claim.policyType === 'BOP') {
                const lossTypeQuestion = claim.questions.find(question => question.insurerQuestionIdentifier === 'cna.claim.lossType');

                const loss = {
                    LOBCd: [{
                        value: 'BOP'
                    }],
                    ClaimStatusCd: {
                        value: claim.open ? "O" : "C"
                    },
                    TotalPaidAmt: {
                        Amt: {
                            value: claim.amountPaid
                        }
                    },
                    LossDt: {
                        value: moment(claim.eventDate).format("YYYY-MM-DD")
                    },
                    LossDesc: {
                        value: claim.description
                    }
                }

                let lossType = lossTypeQuestion ? lossTypeQuestion.answerValue : "Other";
                lossType = lossTypes[lossType] ? lossTypes[lossType] : "Other-Property";
                loss["com.cna_LossTypeCd"] = {value: lossType};

                losses.push(loss);
            }
        });

        return losses;
    }

    // generates the tax identity object array, returns returns empty array if SSN 
    getTaxIdentity() {
        // even if hasEin is FALSE (we're provided an SSN), CNA still expects us to have the TaxTypeCd as FEIN
        const taxIdentity = {
            TaxIdTypeCd: {value: "FEIN"},
            TaxId: {value: this.applicationDocData.ein}
        }
    
        return [taxIdentity];
    }

    // generates the NameRef based off the index of the records being created
    getNameRef(index) {
        if (index >= 100) {
            return `N${index}`;
        }
        else if (index >= 10) {
            return `N0${index}`;
        }
        else {
            return `N00${index}`;
        }
    }

    // transform our questions into question objects array to be inserted into the BOP Request Object
    getQuestions() {
        // filter insurer questions down to those matching answered talage questions
        const answeredQuestionList = [];
        this.insurerQuestionList.forEach(insurerQuestionDoc => {
            const talageQuestion = this.applicationDocData.questions.find(tq => insurerQuestionDoc._doc.talageQuestionId === tq.questionId);

            if (talageQuestion) {
                answeredQuestionList.push({
                    ...talageQuestion,
                    attributes: insurerQuestionDoc._doc.attributes,
                    identifier: insurerQuestionDoc.identifier
                });
            }
        });

        return answeredQuestionList.filter(question => !specialCaseQuestions.includes(question.identifier)).map(question => {
            const questionObj = {
                "com.cna_QuestionCd": {
                    value: question.identifier
                }
            };

            if (explanationQuestions.includes(question.insurerQuestionIdentifier)) {
                questionObj["com.cna_QuestionCd"].YesNoCd = {value: "N/A"};
                questionObj["com.cna_QuestionCd"].Explanation = {value: question.answerValue};
            }
            else if (question.questionType === "Yes/No") {
                questionObj["com.cna_QuestionCd"].YesNoCd = {value: question.answerValue.toUpperCase()};
            }
            else {
                questionObj["com.cna_QuestionCd"]["com.cna_OptionCd"] = {value: question.answerValue}
            }

            return questionObj;
        });
    }

    // Basic Auth shoud be calculated basic on Insurer's
    // Admin Settings.  All assoicated logic (Sandbox vs production should be here)
    async auth() {
        //Basic Auth should be calculated with username and password set 
        // in the admin for the insurer
        // Basic Auth setup moved to Auth function
        
        let basicAuthUserName = 'TALAGAPI';
        let basicAuthPassword = 'TGs7491sd79225!?'; //production

        //Check Insurer setting exist otherwise default to poduction - BP
        if(this.username){
            basicAuthUserName = this.username
        }
        if(this.password){
            basicAuthPassword = this.password
        }

        log.debug(`Basic Auth: ${basicAuthUserName}:${basicAuthPassword}`)
        const basicAuth = Buffer.from(`${basicAuthUserName}:${basicAuthPassword}`).toString('base64')
        log.debug(`Basic Auth Calcu: ${basicAuth}`)
        const headers = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${basicAuth}`
            }
        }
        try {
            const result = await axios.post(`https://${host}${AUTH_URL}`, null, headers);
            return result.data.access_token;
        }
        catch (err) {
            return `CNA Error: Could Not Authorize: ${err}`;
        }
    }

    splitUrl(url) {
        if (!url) {
            log.warn(`CNA: Supplied url is not defined and cannot be split into host and path.`);
            return [];
        }

        let host = "";
        let path = "";

        // default to 0, no http:// or https:// included
        let protocalIndex = 0;

        try {
            if (url.indexOf("https") !== -1) {
                protocalIndex = url.indexOf("https") + 8;
            }
            else if (url.indexOf("http") !== -1) {
                protocalIndex = url.indexOf("http") + 7;
            }

            const splitIndex = url.indexOf("com") + 3;

            host = url.substring(protocalIndex, splitIndex);
            path = url.substring(splitIndex, url.length);
        }
        catch (e) {
            log.warn(`CNA: There was an error splitting the supplied url: ${e}.`);
        }

        return [host, path];
    }

    getCNALimits(limits) {
        if (!limits) {
            return limits;
        }

        // 2/4 ineligible for certain SIC -> limitIneligibility
        // accepted limits (eaocc/genag):
        // 500,000/1,000,000
        // 1,000,000/2,000,000
        // 2,000,000/4,000,000*

        let eaocc = null;
        try {
            eaocc = parseInt(limits[0], 10);
        }
        catch (e) {
            log.error(`${logPrefix}There was an error converting application genag limit to integer: ${e}. ` + __location);
            return limits;
        }

        if (eaocc <= 500000) {
            // 500,000 / 1,000,000
            return [500000, 1000000];
        }
        else if (eaocc > 500000 && eaocc < 2000000) {
            // 1,000,000 / 2,000,000
            return [1000000, 2000000];
        }
        else if (eaocc >= 2000000 && !limitIneligibility.includes(industryCode.attributes.SICCd)) {
            // 2,000,000 / 4,000,000
            return [2000000, 4000000];
        }
        else {
            // default back to 1,000,000 / 2,000,000
            log.warn(`${logPrefix}Couldn't find CNA eligible limits for GENAC and EAOCC, provided limits are: ${limits}. Defaulting to CNA supported 1,000,000/2,000,000. ` + __location);
            return [1000000, 2000000];
        }
    }

    getOtherOrPriorPolicy() {
        const hadPreviousCarrier = this.applicationDocData.questions.find(question => question.insurerQuestionIdentifier === 'cna.general.hadPrevCarrier');
        const previousCarrier = this.applicationDocData.questions.find(question => question.insurerQuestionIdentifier === 'cna.general.prevCarrier');
        let yearsWithCarrier = this.applicationDocData.questions.find(question => question.insurerQuestionIdentifier === 'cna.general.yearsWithCarrier');

        if (!hadPreviousCarrier || hadPreviousCarrier.answerValue === false || hadPreviousCarrier.answerValue.toLowerCase() === 'no') {
            return {
                InsurerName: {
                    value: "None"
                }
            };
        }

        if (yearsWithCarrier) {
            yearsWithCarrier = parseInt(yearsWithCarrier.answerValue, 10);
        }

        // using manual entry instead of select list for existing talage question, so forcing to lower for comparison
        const carrierListLowerCase = carrierList.map(carrier => carrier.toLowerCase());

        const returnObj = {
            InsurerName: {
                value: previousCarrier && carrierListLowerCase.includes(previousCarrier.answerValue.toLowerCase()) ? previousCarrier.answerValue : "Unknown"
            }
            // "PolicyAmt":{ <--- Optional, not providing
            //     "Amt":{
            //         "value":0
            //     }
            // },
            // "com.cna_TargetPolicyAmt":{ <--- Optional, not providing
            //     "Amt":{
            //         "value":0
            //     }
            // }
        };

        if (!isNaN(yearsWithCarrier)) {
            returnObj.LengthTimeWithPreviousInsurer = {
                NumUnits: {
                    value: yearsWithCarrier
                }
            };
        }

        return returnObj;
    }

    getPropertyCoverages() {
        const coverages = [];

        this.applicationDocData.locations.forEach((location, i) => {
            const coveragesObj = {
                ItemValueAmt: {
                    Amt: {
                        value: this.applicationDocData.grossSalesAmt
                    }
                },
                CommlCoverage: [],
                LocationRef: `L${i + 1}`,
                SubLocationRef: `L${i + 1}S1`
            };

            // If desired, set BillableLostPeriod here
            // coverageObj.BusinessIncomeInfo.BillableLostPeriod.Description.value
            
            const bldgCoverage = {
                CoverageCd: {
                    value: 'BLDG'
                },
                Deductible: [{
                    FormatInteger: {
                        value: this.getDeductible()
                    }
                }]
            }

            // buildingLimit
            if (location.buildingLimit) {
                bldgCoverage.Limit = [{
                    FormatInteger: {
                        value: location.buildingLimit
                    }
                }];
            }

            coveragesObj.CommlCoverage.push(bldgCoverage);

            // businessPersonalPropertyLimit
            if (location.businessPersonalPropertyLimit) {
                const bppCoverage = {
                    CoverageCd: {
                        value: 'BPP'
                    },
                    Limit: [{
                        FormatInteger: {
                            value: location.businessPersonalPropertyLimit
                        }
                    }]
                }

                coveragesObj.CommlCoverage.push(bppCoverage);
            }

            const glassCoverage = location.questions.find(question => question.insurerQuestionIdentifier === "cna.location.glassCoverage");
            if (glassCoverage && glassCoverage.answerValue.toLowerCase() === "yes") {
                // TODO: get child question

                const coverageObj = {
                    CoverageCd: {
                        value: "GLASS"
                    },
                    Deductible: [{
                        FormatInteger: {
                            value: 0 // < --- Child question answer if integer
                        },
                        FormatText: {
                            value: "Policy Level" // < --- child question answer if string
                        }
                    }]
                }

                coveragesObj.CommlCoverage.push(coverageObj);
            }

            // Windstorm / Hail Deductible (defaulted for non-FL state, left out for FL (defaulted on their end))
            if (location.territory.toUpperCase() !== "FL") {
                const coverageObj = {
                    CoverageCd: {
                        value: "WH"
                    },
                    Deductible: [{
                        FormatInteger: {
                            value: 0 // 0 = policy level deductible
                        }
                    }]
                }

                coveragesObj.CommlCoverage.push(coverageObj);
            }

            coverages.push(coveragesObj);
        });

        return coverages;

        // Optional, not providing
        // "BusinessIncomeInfo": {
        //     "BillableLostPeriod": {
        //         "Description": {
        //             "value":"12"
        //         }
        //     }
        // },
        // Optional coverage, not providing at this time
        // {
        //     "CoverageCd": {
        //         "value":"GLASS"
        //     },
        //     "Deductible":[
        //         {
        //             "FormatText":{
        //                 "value":"Policy Level"
        //             }
        //         }
        //     ]
        // },
    }

    getDeductible() {
        const supportedDeductibles = [
            250, 
            500, 
            1000, 
            2500, 
            5000, 
            10000, 
            25000, 
            50000, 
            75000, 
            100000
        ];

        const ineligibleNY = [
            50000,
            75000,
            100000
        ];

        const ineligible250 = [
            "51112_53",
            "56111_51",     
            "56210_50",
            "56211_51",  
            "56211_52",
            "56321_50",
            "56411_50",
            "56990_50",
            "56990_51",
            "56990_52",
            "56990_53"
        ];

        const ineligible500 = [
            "51112_53"
        ];

        const BOPPolicy = this.applicationDocData.policies.find(policy => policy.policyType === "BOP");
        const appDeductible = BOPPolicy.deductible;

        // find closest avialable option
        let closestDeductible = null;
        for (const deductible of supportedDeductibles) {
            if (appDeductible >= deductible) {
                closestDeductible = deductible;
                break;
            }
        }

        if (!closestDeductible) {
            closestDeductible = supportedDeductibles[supportedDeductibles.length - 1];
        }

        // apply restrictions
        if (this.applicationDocData.mailingState.toLowerCase() === "ny") {
            if (ineligibleNY.includes(closestDeductible)) {
                return 25000;
            }
        }

        if (ineligible250.includes(industryCode.attributes.SICCd) && closestDeductible === 250) {
            closestDeductible = 500;
        }

        if (ineligible500.includes(industryCode.attributes.SICCd) && closestDeductible === 500) {
            closestDeductible = 1000;
        }

        return closestDeductible;
    }

    getCoverages(limits) {
        // grab general coverage questions
        const medex = this.applicationDocData.questions.find(question => question.insurerQuestionIdentifier === "cna.general.medex");

        const coverages = [
            {
                CoverageCd: {
                    value: "GENAG"
                },
                Limit: [
                    {
                        FormatInteger: {
                            value: limits[1]
                        },
                        LimitAppliesToCd: [
                            {
                                value: "Aggregate"
                            }
                        ]
                    }
                ]
            },
            {
                CoverageCd: {
                    value: "EAOCC"
                },
                Limit: [
                    {
                        FormatInteger: {
                            value: limits[0]
                        },
                        LimitAppliesToCd: [
                            {
                                value: "PerOcc"
                            }
                        ]
                    }
                ]
            }
        ];

        // AEPLB coverage is required with 65312_51 SIC code and two questions are answered YES. Required to include number of surveyors...
        if (industryCode.attributes.SICCd === "65312_51") {
            const BOP21433 = this.applicationDocData.questions.find(question => question.insurerQuestionIdentifier === "BOP21433");
            const BOP21434 = this.applicationDocData.questions.find(question => question.insurerQuestionIdentifier === "BOP21434");

            if (BOP21433 && BOP21434) {
                if (BOP21433.answerValue === true || BOP21433.answerValue.toLowerCase() === "yes" && BOP21434.answerValue === true || BOP21434.answerValue.toLowerCase() === "yes") {
                    const numSurveyors = this.applicationDocData.questions.find(question => question.insurerQuestionIdentifier === "cna.general.numSurveyors");

                    if (numSurveyors) {
                        const coverageObj = {
                            CoverageCd: {
                                value: "AEPLB"
                            },
                            OptionTypeCd: {
                                value: "Num1"
                            },
                            OptionValue: {
                                value: numSurveyors.answerValue
                            }
                        };
    
                        coverages.push(coverageObj);
                    }
                    else {
                        log.warn(`${logPrefix}Unable to add required AEPLB coverage: Unable to find question cna.general.numSurveyors. ` + __location);
                    }
                }
            }
            else {
                log.warn(`${logPrefix}Unable to add required AEPLB coverage: Unable to find question BOP21433 and/or question BOP21434. ` + __location);
            }
        }

        if (medex) {
            const value = parseInt(medex.answerValue, 10);

            if (!isNaN(value)) {
                coverages.push({
                    "CoverageCd": {
                        "value": "MEDEX"
                    },
                    "Limit": [
                        {
                            "FormatInteger": {
                                "value": value
                            }
                        }
                    ]
                });
            }
        }

        return coverages;

        // ----------- COVERAGES NOT SUPPORTED AT THIS TIME:
        // { 
        //     "CoverageCd":{
        //         "value":"FIRDM"
        //     },
        //     "Limit":[
        //         {
        //             "FormatInteger":{
        //                 "value":1000000
        //             }
        //         }
        //     ]
        // }
    }

    getGLClassifications() {
        return this.applicationDocData.locations.map((location, i) => {
            const glClassificationObj = {
                ClassCd: {
                    value: industryCode.code
                },
                ClassCdDesc: {
                    value: industryCode.description
                },
                AlternativeExposure: {
                    value: this.get_location_payroll(location)
                },
                Exposure: {
                    value: this.applicationDocData.grossSalesAmt
                },
                PremiumBasisCd: {
                    value: "GrSales"
                },
                id: `C${i}`,
                LocationRef: `L${i + 1}`,
                SubLocationRef: `L${i + 1}S1`
            };

            // add dynamic exposure if applicable (only applicable for certain SIC)
            if (Object.keys(dynamicExposures).includes(industryCode.attributes.SICCd)) {
                glClassificationObj.AlternativePremiumBasisCd = {
                    value: dynamicExposures[industryCode.attributes.SICCd]
                };
            }

            return glClassificationObj;
        });
    }

    async getIndustryCode() {
        const insurer = this.app.insurers.find(ins => ins.name === "CNA");

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
            log.error(`There was an error grabbing Insurer Industry Codes for CNA: ${e}. ` + __location);
            return null;
        }

        if (!insurerIndustryCodes) {
            log.error(`There was an error grabbing Insurer Industry Codes for CNA. ` + __location);
            return null;
        }

        if (insurerIndustryCodes.length === 0) {
            log.warn(`There were no matching Insurer Industry Codes for the selected industry. ` + __location);
            return null;
        }

        // Return the highest ranking code
        let industryCode = null;
        insurerIndustryCodes.forEach(ic => {
            if (!industryCode || ic.ranking < industryCode.ranking) {
                industryCode = ic;
            }
        });

        return industryCode;
    }
};


