"use strict";

const builder = require("xmlbuilder");
const moment = require("moment");
const {v4: uuid} = require("uuid");
const {get} = require("lodash");

const Integration = require("../Integration.js");
const {convertToDollarFormat} = global.requireShared("./helpers/stringFunctions.js");

global.requireShared("./helpers/tracker.js");

module.exports = class USLIGL extends Integration {

    /**
   * Initializes this integration.
   *
   * @returns {void}
   */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
    }

    /**
   * Requests a quote from USLI and returns. This request is not intended to be called directly.
   *
   * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
   */
    async _insurer_quote() {
        const applicationDocData = this.applicationDocData;
        const logPrefix = `USLI GL (Appid: ${applicationDocData.applicationId}): `;
        const GLPolicy = applicationDocData.policies.find((p) => p.policyType === "GL");

        if (!GLPolicy) {
            const errorMessage = `Could not find a policy with type GL.`;
            log.error(`${logPrefix}${errorMessage} ${__location}`);
            return this.client_error(errorMessage, __location);
        }

        // To do check policy
        const entityTypes = {
            Corporation: {
                abbr: "CP",
                id: "CORPORATION"
            },
            Partnership: {
                abbr: "PT",
                id: "PARTNERSHIP"
            },
            "Non Profit Corporation": {
                abbr: "NP",
                id: "NON PROFIT CORPORATION"
            },
            "Limited Liability Company": {
                abbr: "LL",
                id: "LIMITED LIABILITY COMPANY"
            }
        };

        const ignoredQuestionIds = ["usli.general.terrorismCoverage"];

        const supportedLimitsMap = {
            "1000000/1000000/1000000": [
                "1000000",
                "2000000",
                "2000000"
            ],
            "1000000/2000000/1000000": [
                "1000000",
                "2000000",
                "2000000"
            ],
            "1000000/2000000/2000000": [
                "1000000",
                "2000000",
                "2000000"
            ],
            "2000000/4000000/4000000": [
                "2000000",
                "4000000",
                "4000000"
            ]
        };

        // usli class code to usli gl code map
        // These class codes require a child classification be sent w/ the provided gl code
        // additionally, if a child classification is required, all classification questions should be provided for this child classification (denoted as ID S1 instead of C1)
        const childClassificationMap = {
            173: {
                id: "5864",
                description: "Barber Shops - Part-time employee"
            },
            191: {
                id: "5862",
                description: "Beauty Parlors and Hair Styling Salons - Part-time employee"
            },
            1082: {
                id: "5863",
                description: "Nail Salons - Part-time employee"
            },
            6547: {
                id: "6548",
                description: "Janitorial Services - Cleaning of only Residential or Office Locations (part-time worker)"
            },
            6549: {
                id: "6550",
                description: "Janitorial Services - Cleaning of only Residential, Office or Mercantile Locations (part-time worker)"
            },
            5884: {
                id: "5885",
                description: "Janitorial Services - Cleaning of only Residential Locations (part-time worker)"
            }
        };

        const supportedLimits = supportedLimitsMap[this.policy.limits] || [];
        const agencyInfo = await this.getAgencyInfo();
        const childClassificationRequired = Object.keys(childClassificationMap).includes(this.insurerIndustryCode.code);
        const terrorismCoverageQuestion = applicationDocData.questions.find(question => question.insurerQuestionIdentifier === "usli.general.terrorismCoverage");
        const terrorismCoverageIncluded = terrorismCoverageQuestion && terrorismCoverageQuestion.answerValue?.toLowerCase() === "yes"

        if (!this.industry_code?.insurerIndustryCodeId) {
            const errorMessage = `No Industry Code was found for GL. `;
            log.warn(`${logPrefix}${errorMessage} ${__location}`);
            return this.client_autodeclined_out_of_appetite();
        }

        // if there's no GL policy
        if (GLPolicy?.policyType !== "GL") {
            const errorMessage = `Could not find a policy with type GL.`;
            log.error(`${logPrefix}${errorMessage} ${__location}`);
            return this.client_error(errorMessage, __location);
        }


        // ------------- CREATE XML REQUEST ---------------

        const acord = {ACORD: {
            "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "@xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
            "@xmlns": "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/",
            "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
            SignonRq: {
                SignonPswd: {
                    CustId: {
                        SPName: "com.usli",
                        CustLoginId: this.username
                    },
                    CustPswd: {
                        EncryptionTypeCd: "NONE",
                        Pswd: this.password
                    },
                    GenSessKey: false
                },
                CustLangPref: "en",
                ClientApp: {Version: "2.0"},
                SuppressEcho: false
            },
            InsuranceSvcRq: {
                RqUID: uuid(),
                CommlPkgPolicyQuoteInqRq: {
                    CurCd: "USD",
                    Producer: {
                        ItemIdInfo: {InsurerId: agencyInfo.id},
                        GeneralPartyInfo: {
                            NameInfo: [
                                {CommlName: {CommercialName: agencyInfo.name}}, {PersonName: {GivenName: `${agencyInfo.firstName} ${agencyInfo.lastName}`}}
                            ],
                            Communications: {EmailInfo: {
                                EmailAddr: agencyInfo.email,
                                DoNotContactInd: false
                            }}
                        },
                        ProducerInfo: {ProducerRoleCd: "Agency"}
                    },
                    InsuredOrPrincipal: {
                        GeneralPartyInfo: {
                            NameInfo: {
                                CommlName: {CommercialName: applicationDocData?.businessName},
                                LegalEntityCd: {
                                    "@id": entityTypes[applicationDocData?.entityType]?.id || "OTHER",
                                    "#text": entityTypes[applicationDocData?.entityType]?.abbr || "OT"
                                }
                            },
                            Addr: {
                                AddrTypeCd: "InsuredsAddress",
                                Addr1: applicationDocData?.mailingAddress,
                                City: applicationDocData?.mailingCity,
                                StateProvCd: applicationDocData?.mailingState,
                                PostalCode: applicationDocData?.mailingZipcode?.substring(0, 5),
                                CountryCd: "USA"
                            },
                            Communications: {PhoneInfo: {DoNotContactInd: false}}
                        },
                        InsuredOrPrincipalInfo: {
                            InsuredOrPrincipalRoleCd: "Insured",
                            PersonInfo: {
                                LengthTimeEmployed: {NumUnits: 0},
                                LengthTimeCurrentOccupation: {NumUnits: 0},
                                LengthTimeWithPreviousEmployer: {NumUnits: 0},
                                LengthTimeCurrentAddr: {
                                    StartTime: "00:00:00.0000000-04:00",
                                    EndTime: "00:00:00.0000000-04:00",
                                    LocalStandardTimeInd: false,
                                    DurationPeriod: {NumUnits: 0},
                                    ContinuousInd: false,
                                    "GB.BothDaysInclusiveInd": false
                                },
                                DoNotSolicitInd: false,
                                NumDependents: 0,
                                CoInsuredSameAddressInsuredInd: false
                            },
                            BusinessInfo: {
                                BusinessStartDt: moment(applicationDocData.founded).year(),
                                OperationsDesc:
                        applicationDocData?.questions?.find(
                          ({insurerQuestionIdentifier}) => insurerQuestionIdentifier === "usli.general.operationsDesc"
                        )?.answerValue || "Not Provided"
                            }
                        }
                    },
                    CommlPolicy: {
                        CompanyProductCd: "050070",
                        LOBCd: "CGL",
                        NAICCd: this.insurerIndustryCode?.naic || "26522",
                        ControllingStateProvCd: this.policy?.primary_territory,
                        ContractTerm: {
                            EffectiveDt: this.policy?.effective_date?.format("YYYY-MM-DD"),
                            ExpirationDt: this.policy?.expiration_date?.format("YYYY-MM-DD"),
                            DurationPeriod: {
                                NumUnits: this.policy?.expiration_date?.diff(this.policy?.effective_date, "months"),
                                UnitMeasurementCd: "month"
                            }
                        },
                        PrintedDocumentsRequestedInd: false,
                        TotalPaidLossAmt: {Amt: this.get_total_amount_paid_on_claims_by_policy().GL || 0},
                        NumLosses: applicationDocData.claims?.filter(({policyType}) => policyType === "GL").length,
                        NumLossesYrs: 0,
                        FutureEffDateInd: false,
                        FutureEffDateNumDays: 0,
                        InsuredRequestsPrintedDocumentsInd: false,
                        CommlPolicySupplement: {PolicyTypeCd: "OCCUR"},
                        WrapUpInd: false,
                        CommlCoverage: [
                            {
                                CoverageCd: "STMPF",
                                CoverageDesc: "Stamping Fee",
                                "usli:CoverageTypeId": 0,
                                "usli:FireCoverageTypeId": 0,
                                usliIsLeasedOccupancy: 0
                            }, {
                                CoverageCd: "SPLTX",
                                CoverageDesc: "Surplus Lines Tax",
                                "usli:CoverageTypeId": 0,
                                "usli:FireCoverageTypeId": 0,
                                "usli:IsLeasedOccupancy": 0
                            }
                        ],
                        AnyLossesAccidentsConvictionsInd: applicationDocData.claims?.length > 0,
                        "usli:DynamicQuestion": applicationDocData.questions
                    ?.map((question) => {
                        if (!ignoredQuestionIds.includes(question.insurerQuestionIdentifier)) {
                            return {
                                "usli:QuestionId": question.insurerQuestionIdentifier,
                                "usli:QuestionType": question.insurerQuestionAttributes?.questionType,
                                "usli:Answer": question.answerValue || "Unknown"
                            };
                        }
                    })
                    .concat(
                      applicationDocData.locations.flatMap((location, i) => location?.questions.flatMap((q) => {
                          if (!ignoredQuestionIds.includes(q.insurerQuestionIdentifier)) {
                              const isClassificationQuestion =
                              q.insurerQuestionAttributes?.questionType === "Classification";

                              const classification = {
                                  "@LocationRef": `${i + 1}`,
                                  ClassificationRef: "C1",
                                  "usli:QuestionId": q.insurerQuestionIdentifier,
                                  "usli:QuestionType": q.insurerQuestionAttributes?.questionType,
                                  "usli:Answer": q.answerValue || "Unknown"
                              };

                              let childClassification = null;

                              if (isClassificationQuestion && childClassificationRequired) {
                                  childClassification = {
                                      ...classification,
                                      ClassificationRef: "S1"
                                  };
                              }
                              return [classification, childClassification];
                          }
                      }))
                    )
                    .filter((q) => q),
                        "usli:Status": "Quote",
                        "usli:Carrier": "MTV",
                        "usli:FilingId": 0,
                        "usli:IsUnsolicited": 0
                    },
                    Location: applicationDocData.locations.map((location, index) => ({
                        "@id": `${index + 1}`,
                        Addr: {
                            AddrTypeCd: "PhysicalRisk",
                            Addr1: location?.address,
                            City: location?.city,
                            StateProvCd: location?.state,
                            PostalCode: location?.zipcode?.substring(0, 5),
                            CountryCd: "USA"
                        }
                    })),
                    CommlPropertyLineBusiness: {
                        LOBCd: "CGL",
                        MinPremInd: false,
                        PropertyInfo: !terrorismCoverageIncluded ? null : {CommlPropertyInfo: {
                            "@id": "TRIA1",
                            "@LocationRef": 1,
                            ClassCd: "08811",
                            ClassCdDesc: "Terrorism Coverage",
                            "usli:CoverageTypeId": "6197"
                        }}
                    },
                    GeneralLiabilityLineBusiness: {
                        LOBCd: "CGL",
                        MinPremInd: false,
                        LiabilityInfo: {
                            CommlCoverage: [
                                {
                                    CoverageCd: "EAOCC",
                                    CoverageDesc: "Each Occurrence Limit",
                                    Limit: {
                                        FormatText: supportedLimits[0] || "2000000",
                                        LimitAppliesToCd: "PerOcc"
                                    },
                                    "usli:CoverageTypeId": 0,
                                    "usli:FireCoverageTypeId": 0,
                                    "usli:IsLeasedOccupancy": 0
                                },
                                {
                                    CoverageCd: "GENAG",
                                    CoverageDesc: "General Aggregate Limit",
                                    Limit: {
                                        FormatText: supportedLimits[1] || "4000000",
                                        LimitAppliesToCd: "Aggregate"
                                    },
                                    "usli:CoverageTypeId": 0,
                                    "usli:FireCoverageTypeId": 0,
                                    "usli:IsLeasedOccupancy": 0
                                },
                                {
                                    CoverageCd: "PRDCO",
                                    CoverageDesc: "Products/Completed Operations Aggregate Limit",
                                    Limit: {
                                        FormatText: supportedLimits[2] || "4000000",
                                        LimitAppliesToCd: "Aggregate"
                                    },
                                    "usli:CoverageTypeId": 0,
                                    "usli:FireCoverageTypeId": 0,
                                    "usli:IsLeasedOccupancy": 0
                                },
                                {
                                    CoverageCd: "PIADV",
                                    CoverageDesc: "Personal &amp; Advertising Injury Limit",
                                    Limit: {
                                        FormatText: supportedLimits[2] || "4000000",
                                        LimitAppliesToCd: "PerPers"
                                    },
                                    "usli:CoverageTypeId": 0,
                                    "usli:FireCoverageTypeId": 0,
                                    "usli:IsLeasedOccupancy": 0
                                },
                                {
                                    CoverageCd: "MEDEX",
                                    CoverageDesc: "Medical Expense Limit",
                                    Limit: {
                                        FormatText: 5000,
                                        LimitAppliesToCd: "PerPers"
                                    },
                                    "usli:CoverageTypeId": 0,
                                    "usli:FireCoverageTypeId": 0,
                                    "usli:IsLeasedOccupancy": 0
                                },
                                {
                                    CoverageCd: "FIRDM",
                                    CoverageDesc: "Damages To Premises Rented To You",
                                    Limit: {
                                        FormatText: 100000,
                                        LimitAppliesToCd: "PropDam"
                                    },
                                    "usli:CoverageTypeId": 0,
                                    "usli:FireCoverageTypeId": 0,
                                    "usli:IsLeasedOccupancy": 0
                                }
                            ],
                            GeneralLiabilityClassification: applicationDocData.locations.flatMap((location, index) => {
                                const premiseCoverage = {
                                    CoverageCd: "PREM",
                                    ClassCd: this.insurerIndustryCode.attributes.GLCode,
                                    "usli:CoverageTypeId": 0
                                };
                                const productCoverage = {
                                    CoverageCd: "PRDCO",
                                    ClassCd: this.insurerIndustryCode.attributes.GLCode,
                                    "usli:CoverageTypeId": 0
                                };

                                let exposure = null;
                                let missingExposure = false;
                                let swapPTEToParent = false;
                                // All classifications that require child classifications use FTE and PTE for exposure
                                // If either FTE or PTE is 0 on app, use the other as the primary classification
                                if (childClassificationRequired) {
                                    const exposureFTE = this.get_total_location_full_time_employees(location);
                                    const exposurePTE = this.get_total_location_part_time_employees(location);

                                    // if either FTE or PTE is 0, use the other as primary class, don't provide a child class w/ submission
                                    if (!exposureFTE || !exposurePTE) {
                                        missingExposure = true;
                                        exposure = exposureFTE ? exposureFTE : exposurePTE;

                                        // if the FTE is 0, we need to provide PTE as primary exposure
                                        if (!exposureFTE) {
                                            swapPTEToParent = true;
                                        }
                                    }
                                    else {
                                        exposure = exposureFTE;
                                    }
                                }
                                else {
                                    exposure = this.getExposure(location);
                                }

                                const classification = {
                                    "@id": "C1",
                                    "@LocationRef": `${index + 1}`,
                                    ClassCd: this.insurerIndustryCode?.attributes?.GLCode,
                                    ClassCdDesc: !swapPTEToParent ? this.insurerIndustryCode?.description : childClassificationMap[this.insurerIndustryCode.code].description,
                                    Exposure: exposure,
                                    PremiumBasisCd: this.insurerIndustryCode?.attributes?.ACORDPremiumBasisCode,
                                    IfAnyRatingBasisInd: false,
                                    ClassId: 0,
                                    "usli:CoverageTypeId": !swapPTEToParent ? this.insurerIndustryCode.code : childClassificationMap[this.insurerIndustryCode.code].id,
                                    CommlCoverage: [premiseCoverage, productCoverage]
                                };

                                let childClassification = null;
                                let TIAGeneralLiabilityClassification = null;

                                if (childClassificationRequired && !missingExposure) {
                                    childClassification = {
                                        ...classification,
                                        "@id": "S1",
                                        ClassCdDesc: childClassificationMap[this.insurerIndustryCode.code].description,
                                        Exposure: this.get_total_location_part_time_employees(location),
                                        "usli:CoverageTypeId": childClassificationMap[this.insurerIndustryCode.code].id
                                    };
                                }

                                if (terrorismCoverageIncluded && index + 1 === 1) {
                                    TIAGeneralLiabilityClassification = {
                                        "@id": "TRIA1",
                                        "@LocationRef": 1,
                                        ClassCd: "08811",
                                        ClassCdDesc: "Terrorism Coverage",
                                        "usli:CoverageTypeId": "6197"
                                    };
                                }

                                return [classification,
                                    childClassification,
                                    TIAGeneralLiabilityClassification].filter((c) => c);
                            }),
                            EarnedPremiumPct: 0
                        }
                    },
                    TransactionRequestDt: moment().format()
                }
            }
        }};

        //If this is a 'Home Business' submission the app should be promoted to a BOP policy, as per the insurer's advise
        const isHomeBusiness = this.insurerIndustryCode?.attributes?.product === 'Home Business'
        if(isHomeBusiness){
            this.productDesc = "This Home Business has been promoted to a BOP submission."
            const CommlSubLocation = []
            const nodesToBeDefaulted = {
                "usli:Perils": "Special Excluding Wind And Hail",
                "usli:RequestedCauseOfLossCd": "SPC"

            }
            acord.ACORD.InsuranceSvcRq.CommlPkgPolicyQuoteInqRq.CommlPolicy.LOBCd = "BOP"
            acord.ACORD.InsuranceSvcRq.CommlPkgPolicyQuoteInqRq.Location.forEach(location => {
                CommlSubLocation.push({
                    '@LocationRef':`${location['@id']}`,
                    ...nodesToBeDefaulted
                })
            })

            acord.ACORD.InsuranceSvcRq.CommlPkgPolicyQuoteInqRq.CommlSubLocation = CommlSubLocation
        }

        // -------------- SEND XML REQUEST ----------------

        // Get the XML structure as a string
        const xml = builder.create(acord).end();

        // Send the XML request object to USLI's quote API
        let host = "";
        if (this.insurer.useSandbox) {
            host = "services.uslistage.com";
        }
        else {
            host = "services.usli.com";
        }

        const quotePath = `/API/Quote`; // TODO: API Route path here
        const additionalHeaders = {"Content-Type": "application/xml"};

        let result = null;
        try {
            result = await this.send_xml_request(host, quotePath, xml, additionalHeaders);
        }
        catch (e) {
            const errorMessage = `An error occurred while trying to hit the USLI Quote API endpoint: ${e}. `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        // -------------- PARSE XML RESPONSE ----------------

        const response = get(result, "ACORD.InsuranceSvcRs[0]");
        const statusCd = get(response, "Status[0].StatusCd[0]");
        const statusDesc = get(response, "Status[0].StatusDesc[0]");
        const msgStatusCd = get(response, "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].MsgStatusCd[0]"); // not required
        const msgStatusDesc = get(response, "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].MsgStatusDesc[0]");
        // const msgErrorCode = get(response, "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].MsgErrorCd[0]");

        const referralCodes = [
            "434",
            "436",
            "627"
        ];

        const declineCodes = ["433"];

        let missingRespObj = false;
        const requiredResponseObjects = {
            "ACORD.InsuranceSvcRs[0]": response,
            "Status[0].StatusCd[0]": statusCd,
            "Status[0].StatusDesc[0]": statusDesc,
            "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].MsgStatusDesc[0]": msgStatusDesc
        };

        // check each part of the response we parse and ensure it exists. If it doesn't, report the error, as the response object USLI returns may have changed
        for (const [path, obj] of Object.entries(requiredResponseObjects)) {
            if (!obj) {
                missingRespObj = true;
                log.error(`${logPrefix}Response is missing path: ${path}. ` + __location);
            }
        }

        if (missingRespObj) {
            const errorMessage = `One or more required paths in the response are missing. This may be because USLI's response structure changed. `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        const errorCd = statusDesc.split(" ")[1];
        let errorReasons = [];
        if (statusDesc.indexOf("Script Errors:") !== -1) {
        // if script errors are reported, parse them a particular way
            const errorsString = statusDesc.
                substring(statusDesc.indexOf("Script Errors:") + 16).
                replace(/\n|\r|\./g, '');
            const reasonsList = errorsString.split("Description: ").filter((r) => r);

            errorReasons = [...new Set(reasonsList)];
        }
        else {
        // otherwise, look for extended status and parse into strings with the code and description pairs
            const extendedStatus = get(response, "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].ExtendedStatus");
            if (extendedStatus) {
                errorReasons = extendedStatus.map(status => `${status.ExtendedStatusCd[0]}: ${status.ExtendedStatusDesc[0]}`);
            }
            else {
            // catch all to just split any reasons provided by newline
                errorReasons = statusDesc.split("\n");
            }
        }

        // clean up reasonings to remove occasional description or submit prefix
        errorReasons = errorReasons.map(reason => reason.replace(/^Description:\s*|^Submit:\s*/ig, ''))

        // main reason is just the first reason for an error reported
        let mainReason = errorReasons.shift();

        // declined
        if (declineCodes.includes(errorCd)) {
            const declineMessage = `USLI declined the quote: ${mainReason} `;
            const additionalReasons = errorReasons.length > 0 ? `Other reasons: ${errorReasons.join(" | ")}. ` : "";
            log.info(logPrefix + declineMessage + additionalReasons + __location);
            return this.client_declined(declineMessage, errorReasons);
        }

        // if not a referred error code, it's an error
        if (!referralCodes.includes(errorCd) && !["Success", "SuccessWithInfo"].includes(msgStatusCd)) {
            if (mainReason.includes("class code with Commercial Property")) {
                mainReason = 'A property classification was not provided with the Commercial Property submission. This could be due to a missing fire code in the submission.';
            }
            else {
                this.reasons = errorReasons;
            }

            const errorMessage = `USLI returned an error: ${mainReason} `;
            const additionalReasons = errorReasons.length > 0 ? `Other reasons: ${errorReasons.join(" | ")}. ` : "";
            log.error(logPrefix + errorMessage + additionalReasons + __location);
            return this.client_error(errorMessage, __location);
        }

        // quote response properties
        let quoteNumber = null;
        // let quoteProposalId = null;
        let premium = null;
        const quoteLimits = {};
        const quoteLetter = null;
        const quoteMIMEType = "BASE64";
        let quoteCoverages = [];
        let admitted = false;

        quoteNumber = get(response, "CommlPkgPolicyQuoteInqRs[0].CommlPolicy[0].QuoteInfo[0].CompanysQuoteNumber[0]");
        const commlCoverage = get(response, "CommlPkgPolicyQuoteInqRs[0].GeneralLiabilityLineBusiness[0].LiabilityInfo[0].CommlCoverage");
        premium = get(response, "CommlPkgPolicyQuoteInqRs[0].PolicySummaryInfo[0].FullTermAmt[0].Amt[0]");
        const remarkText = get(response, "CommlPkgPolicyQuoteInqRs[0].RemarkText");

        if (premium === "0") {
            premium = null;
        }

        if (Array.isArray(remarkText) && remarkText.length > 0) {
            const admittedRemark = remarkText.find(remark => remark?.$?.id === "Admitted Status");
            admitted = admittedRemark && admittedRemark?._ === "This quote is admitted";

            // add remarkText to quote additionalInfo
            this.quoteAdditionalInfo.remarkText = remarkText.map(remark => ({
                id: remark?.$?.id,
                description: remark?._
            }));
        }

        // remove taxes from premium if quote is not admitted and taxes exist
        if (!admitted && premium) {
            const taxesAdditionalInfo = [];
            const taxCoverages = get(response, "CommlPkgPolicyQuoteInqRs[0].CommlPolicy[0].CommlCoverage");

            if (Array.isArray(taxCoverages)) {
                taxCoverages.forEach(tax => {
                    let taxAmount = tax.CurrentTermAmt[0].Amt[0];
                    const taxCode = tax.CoverageCd[0];
                    const taxDescription = tax.CoverageDesc[0];

                    if (taxAmount) {
                        premium = parseFloat(premium);
                        taxAmount = parseFloat(taxAmount);

                        if (!isNaN(premium) && !isNaN(taxAmount)) {
                            premium -= taxAmount;
                        }
                        else {
                            log.warn(`${logPrefix}Unable to remove tax ${taxDescription} from non-admitted quote premium. Reference quote additionalInfo for tax information. ` + __location);
                        }

                        premium = this.toFixed(premium, 2);
                    }

                    taxesAdditionalInfo.push({
                        code: taxCode,
                        description: taxDescription,
                        amount: taxAmount
                    });
                });
            }

            if (parseInt(premium, 10) <= 0) {
                log.warn(`${logPrefix}Tax and fee deductions resulted in a premium value at or below 0. ` + __location);
                premium = "0";
            }
            else {
                premium = this.toFixed(premium, 2);
            }

            // add tax and fees to quote additional info
            this.quoteAdditionalInfo.taxAndFeeInfo = taxesAdditionalInfo;
        }

        // TODO: Parse remarkText to see if id View Quote Letter exists, if so, use for Quote Letter

        if (commlCoverage) {
            quoteCoverages = commlCoverage?.map((coverage, index) => {
                const code = coverage.CoverageCd[0];
                const description = coverage.CoverageDesc[0];
                const limit = coverage.Limit[0]?.FormatText[0];
                let included = get(coverage, "Option[0].OptionCd[0]");
                if (included) {
                    if (included === "Incl") {
                        included = "Included"
                    }
                    else if (included === "Excl") {
                        included = "Excluded"
                    }
                    else {
                        included = "N/A";
                    }
                }

                let value = "N/A";
                if (limit) {
                    value = convertToDollarFormat(limit, true);
                }
                else if (included) {
                    value = included;
                }

                return {
                    description: description,
                    value: value,
                    sort: index,
                    category: "General Limits",
                    insurerIdentifier: code
                }
            });
        }

        // Even if quoted, any classification with GLElig of PP (Premises Preferred) must be submitted as "SUBMIT" (our referred)
        if (statusCd === "0" && msgStatusCd === "Success" && this.insurerIndustryCode.attributes?.GLElig !== "PP" && msgStatusDesc !== "Submit") {
            return this.client_quoted(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType, quoteCoverages);
        }
        else if (statusCd === "0" && referralCodes.includes(errorCd) || premium || msgStatusDesc === "Submit" || msgStatusDesc === "SuccessWithInfo") {
            errorReasons.unshift(mainReason);
            if (errorReasons[0].includes("successfully processed the request.") && this.insurerIndustryCode.attributes.GLElig === "PP") {
                this.reasons = ["The chosen classification has GL Eligibility PP (Premises Preferred)."];
            }
            else {
                this.reasons = errorReasons;
            }

            return this.client_referred(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType, quoteCoverages);
        }
        // base error catch-all
        else {
            const errorMessage = `USLI quote was unsuccessful: ${mainReason}. `;
            this.reasons = errorReasons;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }
    }

    async getAgencyInfo() {
        let id = this.app.agencyLocation.agencyId;
        let name = this.app.agencyLocation.agency;
        let phone = this.app.agencyLocation.agencyPhone;
        let email = this.app.agencyLocation.agencyEmail;
        let firstName = this.app.agencyLocation.first_name;
        let lastName = this.app.agencyLocation.last_name;
        const insurer = this.app.agencyLocation.insurers[this.insurer.id]

        // If WholeSale
        if (insurer?.talageWholesale || insurer?.useAgencyPrime) {
        //Use Wholesale Agency.
            id = this.quotingAgencyLocationDB.agencyId
            name = this.quotingAgencyLocationDB.name
            email = this.quotingAgencyLocationDB.email;
            phone = this.quotingAgencyLocationDB.phone;
            firstName = this.quotingAgencyLocationDB.firstName
            lastName = this.quotingAgencyLocationDB.lastName
        }

        return {
            id: id || "NA",
            name: name,
            phone: phone,
            email: email,
            firstName: firstName,
            lastName: lastName
        };
    }

    // https://stackoverflow.com/questions/10015027/javascript-tofixed-not-rounding
    toFixed(num, precision) {
        return Number(Math.round(Number(num + 'e' + precision)) + 'e' + -precision).toFixed(precision);
    }

    getExposure(location) {
        let exposure = null;
        let exposureEncountered = true;
        const logPrefix = `USLI GL (Appid: ${this.applicationDocData.applicationId}): `;
        const industryCode = this.insurerIndustryCode

        switch (this.insurerIndustryCode.attributes.premiumExposureBasis) {
            case "1,000 Gallons":
                const gallonsQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.totalGallonsOfFuel");
                if (gallonsQuestion) {
                    const numGallons = parseInt(gallonsQuestion.answerValue, 10);
                    if (!isNaN(numGallons)) {
                        exposure = Math.round(numGallons / 1000);
                    }
                    else {
                        log.warn(`${logPrefix}Invalid number of gallons, unable to convert ${numGallons} into an integer. ` + __location);
                        return null;
                    }
                }
                break;
            case "100 Payroll":
                const locationPayroll = parseInt(this.get_location_payroll(location), 10);
                if (!isNaN(locationPayroll)) {
                    exposure = Math.round(locationPayroll / 100);
                }
                else {
                    log.warn(`${logPrefix}Invalid number for payroll, unable to convert ${locationPayroll} into an integer. ` + __location);
                    return null;
                }
                break;
            case "Acre":
                const acreQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.numAcres");
                if (acreQuestion) {
                    exposure = acreQuestion.answerValue;
                }
                break;
            case "Admissions":
                const admissionsQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.totalAdmissions");
                if (admissionsQuestion) {
                    exposure = admissionsQuestion.answerValue;
                }
                break;
            case "Student":
                const studentQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.numStudents");
                if (studentQuestion) {
                    exposure = studentQuestion.answerValue;
                }
                break;
            case "Kennel":
                const kennelQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.numKennels");
                if (kennelQuestion) {
                    exposure = kennelQuestion.answerValue;
                }
                break;
            case "Event":
                const eventsQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.totalEvents");
                if (eventsQuestion) {
                    exposure = eventsQuestion.answerValue;
                }
                break;
            case "Exhibition":
                const exhibitionsQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.yearlyExhibitions");
                if (exhibitionsQuestion) {
                    exposure = exhibitionsQuestion.answerValue;
                }
                break;

            case "Payroll":
                exposure = this.get_location_payroll(location);
                break;
            case "Per Instructor":
                const teacherQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.numTeachersInstructors");
                if (teacherQuestion) {
                    exposure = teacherQuestion.answerValue;
                }
                break;
            case "Pool":
                const poolQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.numPoolsTubs");
                if (poolQuestion) {
                    exposure = poolQuestion.answerValue;
                }
                break;
            case "Sales":
                const salesQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.grossSales");
                if (salesQuestion) {
                    exposure = salesQuestion.answerValue;
                }
                break;
            case "Total Area":
                exposure = location.square_footage;
                break;
            case "Total Cost":
                const totalCostQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.annualSubcontractedCost");
                if (totalCostQuestion) {
                    exposure = totalCostQuestion.answerValue;
                }
                break;
            case "Flat":
            case "Dwelling":
                exposure = 1;
                break;
            case "Per Assistant":
            case "Beautician/Barber":
            case "Washer":
            case "Worker":
                exposure = this.get_total_location_employees(location);
                break;
            case "Number of Units":
                let questionIdentifier = null;
                switch (this.insurerIndustryCode.code) {
                    case "5337":
                        questionIdentifier = "usli.location.exposure.numApartments";
                        break;
                    case "7119":
                        questionIdentifier = "usli.location.exposure.numDentists";
                        break;
                    case "5852":
                    case "7100":
                        questionIdentifier = "usli.location.exposure.numMobileHomePads";
                        break;
                    case "5013":
                    case "5014":
                    case "5858":
                    case "1681":
                        questionIdentifier = "usli.location.exposure.numCondos";
                        break;
                    case "652":
                    case "1693":
                        questionIdentifier = "usli.location.exposure.numPowerUnits";
                        break;
                    case "5378":
                        questionIdentifier = "usli.location.exposure.numTanningBeds";
                        break;
                    default:
                        log.warn(`${logPrefix}Class code ${industryCode.code} is not a valid classification for the "Number of Units" exposure type, therefor no exposure can be provided. ` + __location);
                        return null;
                }

                if (!questionIdentifier) {
                    log.warn(`${logPrefix}No question identifier was found for Class code ${industryCode.code}, therefor no exposure can be provided. ` + __location);
                    return null;
                }

                const numUnitsQuestion = location.questions.find(question => question.insurerQuestionIdentifier === questionIdentifier);
                if (numUnitsQuestion) {
                    exposure = numUnitsQuestion.answerValue;
                }
                break;
            case "Fitness Center":
            case "Additional Insured":
            case "Part-Time Janitor":
            case "Part-time employee":
                log.warn(`${logPrefix}Exposure ${industryCode.attributes.premiumExposureBasis} is not supported, returning null. ` + __location);
                return null;
            case "Full-Time Janitor":
            case "Full-time employee":
                exposure = this.get_total_location_full_time_employees(location);
                break;
            case "":
                log.warn(`${logPrefix}Classification has blank exposure. This classification should be disabled. ` + __location);
                return null;
            default:
                exposureEncountered = false;
                break;
        }

        if (!exposureEncountered) {
            log.warn(`${logPrefix}No case found for ${industryCode.attributes.premiumExposureBasis} exposure. ` + __location);
        }
        else if (exposure === null) {
            log.warn(`${logPrefix}Encountered ${industryCode.attributes.premiumExposureBasis} exposure, but found no exposure question - This could be a question mapping error. ` + __location);
        }

        return exposure;
    }
};
