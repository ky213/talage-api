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

const constructionCodes = {
    Frame: "F",
    "Joisted Masonry": "JM",
    "Fire Resistive": "R",
    "Masonry Non Combustible": "MNC",
    "Non Combustible": "LNC"
    // "Modified Fire Resistive": "MFR"
};

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
const ssnLegalEntities = [
    "SP",
    "IN"
];

// TODO: Should we use these?
// Deductible by state
// eslint-disable-next-line no-unused-vars
const stateDeductables = {
    "AL": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500],     
    "AR": [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000],     
    "CO": [500, 1000, 1500, 2000, 2500, 5000, 10000, 13500],  
    "CT": [1000, 5000, 10000],
    "DE": [500],
    "FL": [500, 1000, 1500, 2000, 2500, 5000, 10000, 15000, 20000, 21000],  
    "GA": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 10000, 20000],
    "HI": [100, 150, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 10000],  
    "IA": [100, 150, 200, 250, 300, 400, 500, 1000, 1500, 2000, 2500],
    "IL": [1000],
    "IN": [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 21000],
    "KS": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 10000],
    "KY": [100, 200, 300, 400, 500, 1000, 1500, 2500, 5000, 7500, 10000],
    "MA": [500, 1000, 2000, 2500, 5000],
    "MD": [500, 1500, 2500],
    "ME": [250, 500, 1000, 5000],
    "MN": [100, 150, 200, 250, 500, 1000, 1500, 2000, 2500, 5000, 10000, 25000, 50000],
    "MO": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 10000, 15000, 20000],
    "MT": [500, 1000, 1500, 2000, 2500, 5000, 10000],
    "NC": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000],
    "NE": [500, 1000, 1500, 2000, 2500],
    "NH": [500, 1000, 1500, 2000, 2500, 5000],
    "NM": [500, 1000, 1500, 2000, 2500, 5000, 10000],
    "NV": [100, 250, 500, 1000, 1500, 2000, 2500, 5000, 10000, 15000, 20000],
    "SC": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500],
    "SD": [500, 1000, 1500, 2000, 2500],
    "TX": [500, 1000, 1500, 2000, 2500, 5000, 10000, 25000],
    "UT": [500, 1000, 1500, 2000, 2500, 5000],
    "VA": [100, 250, 500, 1000, 2500, 5000, 7500, 10000],
    "WV": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 7500, 10000]
};

module.exports = class CnaBOP extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
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
        const applicationDocData = this.app.applicationDocData;
        const logPrefix = `CNA BOP (App ID: ${this.app.id}): `;

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

        let industryCode = null;
        // if the BOP code selected is CNA's, we can just use it
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

        const business = this.app.business;
        const BOPPolicy = applicationDocData.policies.find(policy => policy.policyType === 'BOP');

        // NOTE: Right now this is hard-coded to the first reference
        const nameInfoRefId = "N000";

        let agencyId = null;
        try {
            agencyId = this.app.agencyLocation.insurers[this.insurer.id].agency_id.split("-");
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
        const limits = business.mailing_territory === "CA" ? 
            carrierLimits[carrierLimits.length - 1] : 
            this.getBestLimits(carrierLimits);

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
            "SignonRq": {
                "SignonPswd": {
                    "CustId": {
                        "CustLoginId": "TALAGEAPI"
                    }
                },
                "CustLangPref": "en-US",
                "ClientApp": {
                    "Org": "TALAGE",
                    "Name": "API",
                    "Version": "1"
                }
                // "ProxyClient":{
                //     "Org":"BCFTech",
                //     "Name":"TransmitXML",
                //     "Version":"V1.00"
                // }
            },
            "InsuranceSvcRq": [
                {
                    "RqUID": requestUUID,
                    "BOPPolicyQuoteInqRq": [
                        {
                            "RqUID": requestUUID,
                            "TransactionRequestDt":{
                                "value": moment().format("YYYY-MM-DD")
                            },
                            "Producer": [
                                {
                                    "GeneralPartyInfo": {
                                        "NameInfo": [
                                            {
                                                "CommlName": {
                                                    "CommercialName": {
                                                        "value": applicationDocData.businessName
                                                    }
                                                }
                                            }
                                        ],
                                        "Addr": [
                                            {
                                                "AddrTypeCd": [
                                                    {
                                                        "value":"StreetAddress"
                                                    }
                                                ],
                                                "Addr1": {
                                                    "value": applicationDocData.mailingAddress
                                                },
                                                "City": {
                                                    "value": applicationDocData.mailingState
                                                },
                                                "StateProvCd":{
                                                    "value": applicationDocData.mailingCity
                                                },
                                                "PostalCode":{
                                                    "value": applicationDocData.mailingZipcode
                                                }
                                            }
                                        ],
                                        "Communications": {
                                            "PhoneInfo": [
                                                {
                                                    "PhoneTypeCd": {
                                                        "value": "Phone"
                                                    },
                                                    "CommunicationUseCd": [
                                                        {
                                                            "value": "Business"
                                                        }
                                                    ],
                                                    "PhoneNumber":{
                                                        "value": formattedPhone
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    "ProducerInfo": {
                                        "ContractNumber": {
                                            "value": contractNumber
                                        },
                                        "ProducerRoleCd": [
                                            {
                                                "value": "Agency"
                                            }
                                        ],
                                        "FieldOfficeCd": {
                                            "value": "S" // What is this?
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
                            "InsuredOrPrincipal": [
                                {
                                    "ItemIdInfo": {
                                        "AgencyId": {
                                            "value": agencyId
                                        }
                                    },
                                    "GeneralPartyInfo": {
                                        "NameInfo": [
                                            {
                                                "CommlName": {
                                                    "CommercialName": {
                                                        "value": applicationDocData.businessName
                                                    }
                                                },
                                                "LegalEntityCd": {
                                                    "value": legalEntityCodes[applicationDocData.entityType] ? legalEntityCodes[applicationDocData.entityType] : "OT" 
                                                }
                                            }
                                        ],
                                        "Addr": this.getLocations(false),
                                        "Communications": {
                                            "PhoneInfo": [
                                                {
                                                    "PhoneTypeCd": {
                                                        "value": "Phone"
                                                    },
                                                    "CommunicationUseCd": [
                                                        {
                                                            "value": "Day" // defaulted
                                                        }
                                                    ],
                                                    "PhoneNumber": {
                                                        "value": formattedPhone
                                                    }
                                                }
                                            ],
                                            "WebsiteInfo":[
                                                {
                                                    "WebsiteURL": {
                                                        "value": applicationDocData.website
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    "InsuredOrPrincipalInfo": {
                                        "InsuredOrPrincipalRoleCd": [
                                            {
                                                "value": "Insured"
                                            }
                                        ],
                                        "BusinessInfo": {
                                            "SICCd": {
                                                "value": this.industry_code.code // may need to be sic specific on attr?
                                            },
                                            "NumEmployeesFullTime": {
                                                "value": this.get_total_full_time_employees()
                                            },
                                            "NumEmployeesPartTime": {
                                                "value": this.get_total_part_time_employees()
                                            }
                                        }
                                    }
                                }
                            ],
                            "CommlPolicy": {
                                "PolicyNumber": {
                                    // Not needed?
                                },
                                "LOBCd": {
                                    "value": "BOP"
                                },
                                "ControllingStateProvCd": {
                                    "value": applicationDocData.mailingState
                                },
                                "ContractTerm": {
                                    "EffectiveDt": {
                                        "value": moment(BOPPolicy.effectiveDate).format("YYYY-MM-DD")
                                    },
                                    "ExpirationDt": {
                                        "value": moment(BOPPolicy.expirationDate).format("YYYY-MM-DD")
                                    },
                                    "DurationPeriod": {
                                        "NumUnits": {
                                            "value": moment(BOPPolicy.expirationDate).diff(moment(BOPPolicy.effectiveDate), 'months', false)
                                        },
                                        "UnitMeasurementCd": {
                                            "value": "MON"
                                        }
                                    }
                                },
                                "Loss": this.getLosses(),
                                "NumLosses": {
                                    "value": applicationDocData.claims.filter(claim => claim.policyType === 'BOP').length
                                },
                                "OtherOrPriorPolicy": [
                                    this.getOtherOrPriorPolicy()
                                ],
                                "id": "PolicyLevel",
                                "CommlPolicySupplement": {
                                    "LengthTimeInBusiness": {
                                        "NumUnits": {
                                            "value": this.get_years_in_business()
                                        },
                                        "UnitMeasurementCd": {
                                            "value": "ANN"
                                        }
                                    }
                                }
                            },
                            "Location": this.getLocations(true),
                            "BOPLineBusiness": {
                                "LOBCd": {
                                    "value":"BOP"
                                },
                                "PropertyInfo": {
                                    "CommlPropertyInfo": this.getPropertyCoverages()
                                },
                                "LiabilityInfo": {
                                    "CommlCoverage": this.getCoverages(limits),
                                    "GeneralLiabilityClassification": this.getGLClassifications(industryCode)
                                },
                                // TODO: What is this? Is it a question? 
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
                            "CommlSubLocation": this.getBuildings()
                        }
                    ]
                }
            ]
        };

        if (applicationDocData.mailingState === 'CA' || applicationDocData.mailingState === 'FL') {
            const yearsManExp = applicationDocData.questions.find(question => question.insurerQuestionIdentifier === 'cna.general.yearsManExp');
            if (yearsManExp) {
                const value = parseInt(yearsManExp.answerValue, 10);

                if (!isNaN) {
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
            
        }

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
        }

        let result = null;

        try {
            result = await this.send_json_request(host, QUOTE_URL, JSON.stringify(requestJSON), headers, "POST");
        }
        catch (error) {
            let errorJSON = null;
            try {
                errorJSON = JSON.parse(error.response);
            }
            catch (e) {
                log.error(`${logPrefix}There was an error parsing the error object: ${e}.` + __location);
            }
            
            this.reasons.push(JSON.stringify(errorJSON));

            let errorMessage = "";
            try {
                errorMessage = `${logPrefix}status code ${error.httpStatusCode}: ${errorJSON.InsuranceSvcRs[0].WorkCompPolicyQuoteInqRs[0].MsgStatus.MsgStatusDesc.value}`;
            } 
            catch (e1) {
                try {
                    errorMessage = `${logPrefix}status code ${error.httpStatusCode}: ${errorJSON.message}`;
                } 
                catch (e2) {
                    log.error(`${logPrefix}Couldn't parse error object for description. Parsing errors: ${JSON.stringify([e1, e2], null, 4)}.` + __location);
                }
            }

            errorMessage = errorMessage ? errorMessage : "An error occurred while attempting to quote.";
            return this.client_declined(errorMessage);
        }

        let quoteNumber = null;
        let premium = null;
        let quoteLimits = {};
        let quoteLetter = null;
        let quoteMIMEType = null;
        let policyStatus = null;

        const response = result.InsuranceSvcRs[0].WorkCompPolicyQuoteInqRs[0];
        switch (response.MsgStatus.MsgStatusCd.value.toLowerCase()) {
            case "dataerror":
            case "datainvalid":
            case "error":
            case "login_error":
            case "general failure":
                log.error(`${logPrefix}response ${response.MsgStatus.MsgStatusDesc.value} ` + __location);
                return this.client_error(`${response.MsgStatus.MsgStatusDesc.value}`, __location);
            case "rejected": 
                return this.client_declined(`${response.MsgStatus.MsgStatusDesc.value}`);
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
                        try {
                            response.WorkCompLineBusiness.CommlCoverage[0].Limit.forEach(limit => {
                                switch (limit.LimitAppliesToCd[0].value) {
                                    case 'BIEachOcc':
                                        quoteLimits[1] = limit.FormatInteger.value;
                                        break;
                                    case 'DisEachEmpl':
                                        quoteLimits[2] = limit.FormatInteger.value;
                                        break;
                                    case 'DisPol':
                                        quoteLimits[3] = limit.FormatInteger.value;
                                        break;
                                    default:
                                        log.error(`${logPrefix}Unexpected limit found in quote response. ` + __location);
                                        break;
                                }
                            });
                        }
                        catch (e) {
                            log.error(`${logPrefix}Couldn't parse one or more limit values from response: ${e}.` + __location);
                            return this.client_error(`Couldn't parse one or more limit values from response: ${e}.`);
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
                return this.client_quoted(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType);
            }
            else {
                return this.client_referred(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType);
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
                    id: `L${i}` 
                };

                // only provided in GeneralPartyInfo addr field
                if (!fullLocation) {
                    locationObj.Addr.AddrTypeCd = [{value: "MailingAddress"}];
                }

                if (fullLocation) {
                    // agency information
                    locationObj.ItemIdInfo = {AgencyId: {value: `${this.app.agencyLocation.agencyId}`}},

                    // sub location information
                    locationObj.SubLocation[{...locationObj}];
                    locationObj.SubLocation[0].id += `S${i}`;

                    // location name - left blank for now
                    locationObj.locationName = {};
                }

                return locationObj;
            });
    }

    getBuildings() {
        this.app.applicationDocData.locations.forEach((location, i) => {
            const buildingObj = {
                Construction: {
                    ConstructionCd: [
                        {
                            value: constructionCodes[location.constructionType]
                        }
                    ],
                    YearBuilt: {
                        value: location.yearBuilt
                    },
                    BldgArea: {
                        NumUnits: {
                            value: location.square_footage
                        }
                    },
                    NumStories: {
                        value: location.numStories
                    }
                },
                BldgOccupancy: [
                    {
                        "com.cna_LeasedSpaceDesc": [{}]
                    }
                ],
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
                // BldgProtection: { // No explanation of value, but is optional field, so leaving out for now
                //     FireProtectionClassCd: {
                //         value: 
                //     }
                // }
                BldgFeatures: {},
                "com.cna_QuestionAnswer": this.getQuestions(location.questions),
                "com.cna_CommonAreasMaintenanceCd": {},
                LocationRef: `L${i}`,
                SubLocationRef: `L${i}S1`
            };

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
            if (hasBasements && hasBasements.answerValue.toLowerCase() === "yes") {
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
            }
            else {
                buildingObj.Construction.NumBasements = {
                    value: 0
                }
            }
            
            // BldgOccupancy question section
            const buildingOccObj = buildingObj.BldgOccupancy[0];

            const areaOccupied = location.questions.find(question => question.insurerQuestionIdentifier === "");
            if (areaOccupied) {
                const areaOccupiedValue = parseInt(areaOccupied.answerValue, 10);
                if (!isNaN(areaOccupiedValue)) {
                    buildingOccObj.AreaOccupied = {
                        NumUnits: {
                            value: areaOccupiedValue
                        }
                    }
                }
            }
        });
        {
            "BldgOccupancy":[
                {
                    "OccupiedPct":{
                        "value":100
                    },
                    "AreaOccupied":{
                        "NumUnits":{
                            "value":2000
                        },
                        "UnitMeasurementCd":{
                            "value":"Feet"
                        }
                    },
                    "VacancyInfo":{
                        "VacantArea":{
                            "value":0
                        },
                        "ReasonVacantDesc":{
                            
                        }
                    },
                    "com.cna_OccupancyTypeCd":{
                        "value":"b"
                    },
                    "com.cna_AreaLeased":[
                        {
                            "NumUnits":{
                                "value":0
                            }
                        }
                    ],

                }
            ]
        }
    }

    // generates the Loss array based off values from claims
    getLosses() {
        // NOTE: CNA supports Closed (C), Declined (D), Open (O), Other (OT), Reoponed (R), and Subrogation - Claim Open Pending Subrogation (S)
        // We only have Open (O), and Closed (C)
        const losses = [];

        this.app.applicationDocData.claims.forEach(claim => {
            // only add BOP claims
            if (claim.policyType === 'BOP') {
                const lossType = claim.questions.find(question => question.insurerQuestionIdentifier === 'cna.claim.lossType');

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

                loss["com.cna_LossTypeCd"] = lossType ? lossType.answerValue : "Other";

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
            TaxId: {value: this.app.applicationDocData.ein}
        }
    
        return [taxIdentity];
    }

    // generates the array of WorkCompRateState objects
    // getWorkCompRateStates() {
    //     const workCompRateStates = [];

    //     for (const [index, location] of Object.entries(this.app.business.locations)) {
    //         const wcrs = {
    //             StateProvCd: {value: location.territory},
    //             WorkCompLocInfo: this.getWorkCompLocInfo(location, index)
    //         }
    //         const firstNCCICode = location.activity_codes[0].ncciCode;
    //         wcrs.GoverningClassCd = {value: firstNCCICode.substring(0, firstNCCICode.length - 1)}
    //         workCompRateStates.push(wcrs);
    //     }

    //     return workCompRateStates;    
    // }

    // generates the WorkCompLocInfo objects
    // getWorkCompLocInfo(location, index) {        
    //     const wcli = {
    //         NumEmployees: {value: location.full_time_employees + location.part_time_employees},
    //         WorkCompRateClass: [],
    //         LocationRef: `L${index}`,
    //         NameInfoRef: this.getNameRef(index)
    //     }

    //     for (const activityCode of location.activity_codes) {
    //         const wcrc = {
    //             RatingClassificationCd: {value: activityCode.ncciCode}, 
    //             Exposure: `${activityCode.payroll}`
    //         }

    //         wcli.WorkCompRateClass.push(wcrc);
    //     }

    //     return [wcli];
    // }

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

    // transform our policy limit selection into limit objects array to be inserted into the BOP Request Object
    // getLimits(limits) {
    //     const limitArray = [];
        
    //     if (typeof limits === 'string') {
    //         limits = limits.split('/');
    //     }

    //     // for each limit, create a limit object with the limit value and applyTo code
    //     limits.forEach((limit, i) => {
    //         limitArray.push({
    //             FormatInteger: {value: limit},
    //             LimitAppliesToCd: [{value: LIMIT_CODES[i]}]
    //         }); 
    //     });

    //     return limitArray;
    // }

    // transform our questions into question objects array to be inserted into the BOP Request Object
    getQuestions(questions) {
        return questions.map(question => {
            // TODO: Check question.insurerQuestionAttributes to see what the QuestionCd should be
            const questionObj = {
                "com.cna_QuestionCd": {
                    value: "dummy_id"
                }
            };

            if (explanationQuestions.includes(question.insurerQuestionIdentifier)) {
                questionObj.YesNoCd = {value: "N/A"};
                questionObj.Explanation = {value: question.answerValue};
            }
            else {
                question.questionType === "Yes/No" ? 
                    questionObj.YesNoCd = {value: question.answerValue.toUpperCase()} :
                    questionObj["com.cna_QuestionCd.cna_OptionCd"] = {value: question.answerValue};
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

    getOtherOrPriorPolicy() {
        const hadPreviousCarrier = this.app.applicationDocData.questions.find(question => question.insurerQuestionIdentifier === 'cna.general.hadPrevCarrier');
        const previousCarrier = this.app.applicationDocData.questions.find(question => question.insurerQuestionIdentifier === 'cna.general.prevCarrier');
        let yearsWithCarrier = this.app.applicationDocData.questions.find(question => question.insurerQuestionIdentifier === 'cna.general.yearsWithCarrier');

        if (hadPreviousCarrier && hadPreviousCarrier.answerValue.toLowerCase() === 'no') {
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

        this.app.applicationDocData.locations.forEach((location, i) => {
            const coveragesObj = {
                CommlCoverage: [],
                LocationRef: `L${i}`,
                SubLocationRef: `L${i}S${i}`
            };

            // TODO: 
            // If desired, set BillableLostPeriod here
            // coverageObj.BusinessIncomeInfo.BillableLostPeriod.Description.value

            const glassCoverage = location.questions.find(question => question.insurerQuestionIdentifier === "cna.location.glassCoverage");
            if (glassCoverage && glassCoverage.answerValue.toLowerCase() === "yes") {
                // get child question

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
            }

            coverages.push(coveragesObj);
        });

        return coverages;
        {
            "ItemValueAmt": {
                "Amt": {
                    "value": applicationDocData.grossSales
                }
            },
            // Optional, not providing
            // "BusinessIncomeInfo": {
            //     "BillableLostPeriod": {
            //         "Description": {
            //             "value":"12"
            //         }
            //     }
            // },
            "CommlCoverage": [
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
                {
                    "CoverageCd":{
                        "value":"BPP"
                    },
                    "Limit":[
                        {
                            "FormatInteger":{
                                "value":50000
                            }
                        }
                    ]
                },
                // Optional coverage, not providing at this time
                // {
                //     "CoverageCd":{
                //         "value":"INFL"
                //     },
                //     "Limit":[
                //         {
                //             "FormatPct":{
                //                 "value":0.03
                //             }
                //         }
                //     ]
                // },
                // Optional coverage, not providing at this time
                // {
                //     "CoverageCd":{
                //         "value":"WH"
                //     },
                //     "Deductible":[
                //         {
                //             "FormatInteger":{
                //                 "value":0
                //             }
                //         }
                //     ]
                // },
                // Optional coverage, not providing at this time
                // {
                //     "CoverageCd":{
                //         "value":"SDB"
                //     },
                //     "Limit":[
                //         {
                //             "FormatInteger":{
                //                 "value":25000
                //             }
                //         }
                //     ]
                // },
                {
                    "CoverageCd":{
                        "value":"BLDG"
                    },
                    "Deductible":[
                        {
                            "FormatInteger":{
                                "value":500
                            }
                        }
                    ]
                }
            ],
            "LocationRef":"L1",
            "SubLocationRef":"L1S1"
        }
    }

    getCoverages(limits) {
        // grab general coverage questions
        const medex = this.app.applicationDocData.questions.find(question => question.insurerQuestionIdentifier === "cna.general.medex");

        const coverages = [
            {
                "CoverageCd": {
                    "value": "EAOCC"
                },
                "Limit": [
                    {
                        "FormatInteger": {
                            "value": parseInt(limits[0], 10)
                        },
                        "LimitAppliesToCd": [
                            {
                                "value": "PerOcc"
                            }
                        ]
                    }
                ]
            },
            {
                "CoverageCd": {
                    "value": "GENAG"
                },
                "Limit": [
                    {
                        "FormatInteger": {
                            "value": parseInt(limits[1], 10)
                        },
                        "LimitAppliesToCd": [
                            {
                                "value": "Aggregate"
                            }
                        ]
                    }
                ]
            }
        ];

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

    // getLimits(policy) {
    //     const limitsStr = policy.limits;

    //     if (limitsStr === "") {
    //         log.warn(`CNA: Provided limits are empty. ${__location}`);
    //         return limitsStr;
    //     }

    //     // skip first character, look for first occurance of non-zero number
    //     const indexes = [];
    //     for (let i = 1; i < limitsStr.length; i++) {
    //         if (limitsStr[i] !== "0") {
    //             indexes.push(i);
    //         }
    //     }

    //     // parse first limit out of limits string
    //     const limits = [];
    //     limits.push(limitsStr.substring(0, indexes[0])); // per occ
    //     limits.push(limitsStr.substring(indexes[0], indexes[1])); // gen agg
    //     limits.push(limitsStr.substring(indexes[1], limitsStr.length)); // agg

    //     return limits;
    // }

    getGLClassifications(industryCode) {
        return this.app.applicationDocData.locations.map((location, i) => {
            const grossSalesQuestion = location.questions.find(question => question.insurerQuestionIdentifier === 'cna.location.grossSales');
            let grossSales = 0;

            if (grossSalesQuestion) {
                grossSales = parseInt(grossSalesQuestion.answerValue, 10);

                if (isNaN(grossSales)) {
                    log.error(`CNA: Gross Sales amount for location: L${i} is not numeric, failed to parse.` + __location);
                    grossSales = 0;
                }
            }

            return {
                ClassCd: {
                    value: industryCode.code
                },
                ClassCdDesc: {
                    value: industryCode.description
                },
                Exposure: {
                    value: grossSales
                },
                PremiumBasisCd: {
                    value: "GrSales"
                },
                id: `C${i}`,
                LocationRef: `L${i}`,
                SubLocationRef: `L${i}S${i}`
            };
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
}

