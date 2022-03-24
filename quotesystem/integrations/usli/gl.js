/* eslint-disable dot-location */
/* eslint-disable implicit-arrow-linebreak */
/* eslint-disable no-extra-parens */
/* eslint-disable radix */
/* eslint-disable function-paren-newline */
/* eslint-disable object-curly-newline */
/* eslint-disable no-trailing-spaces */
/* eslint-disable no-empty */
/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * GL Policy Integration for USLI
 */

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
    this.productDesc = "Commercial Package";
  }

  /**
   * Requests a quote from USLI and returns. This request is not intended to be called directly.
   *
   * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
   */
  async _insurer_quote() {
    let logPrefix = "";
    const quoteLetter = null;
    const applicationDocData = this.applicationDocData;
    const GLPolicy = applicationDocData.policies.find((p) => p.policyType === "GL");
    const entityTypes = {
      Corporation: {abbr: "CP",
id: "CORPORATION"},
      Partnership: {abbr: "PT",
id: "PARTNERSHIP"},
      "Non Profit Corporation": {abbr: "NP",
id: "NON PROFIT CORPORATION"},
      "Limited Liability Company": {abbr: "LL",
id: "LIMITED LIABILITY COMPANY"}
    };

    const ignoredQuestionIds = ["usli.general.terrorismCoverage"];

    const supportedLimitsMap = {
      "1000000/1000000/1000000": ["1000000",
"2000000",
"2000000"],
      "1000000/2000000/1000000": ["1000000",
"2000000",
"2000000"],
      "1000000/2000000/2000000": ["1000000",
"2000000",
"2000000"],
      "2000000/4000000/4000000": ["2000000",
"4000000",
"4000000"]
    };

    const supportedLimits = supportedLimitsMap[this.policy.limits] || [];

    logPrefix = `USLI Monoline GL (Appid: ${applicationDocData.applicationId}): `;

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

    const acord = {
      ACORD: {
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
          ClientApp: {
            Version: "2.0"
          },
          SuppressEcho: false
        },
        InsuranceSvcRq: {
          RqUID: uuid(),
          CommlPkgPolicyQuoteInqRq: {
            CurCd: "USD",
            Producer: {
              ItemIdInfo: {
                InsurerId: "1065"
              },
              GeneralPartyInfo: {
                NameInfo: [
                  {
                    CommlName: {
                      CommercialName: this.app?.agencyLocation?.agency
                    }
                  }, {
                    PersonName: {
                      Surname: this.app?.agencyLocation?.first_name,
                      GivenName: this.app?.agencyLocation?.last_name
                    }
                  }
                ],
                Communications: {
                  EmailInfo: {
                    EmailAddr: this.app?.agencyLocation?.agencyEmail,
                    DoNotContactInd: false
                  }
                }
              },
              ProducerInfo: {
                ProducerRoleCd: "Agency"
              }
            },
            InsuredOrPrincipal: {
              GeneralPartyInfo: {
                NameInfo: {
                  CommlName: {
                    CommercialName: applicationDocData?.businessName
                  },
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
                Communications: {
                  PhoneInfo: {
                    DoNotContactInd: false
                  }
                }
              },
              InsuredOrPrincipalInfo: {
                InsuredOrPrincipalRoleCd: "Insured",
                PersonInfo: {
                  LengthTimeEmployed: {
                    NumUnits: 0
                  },
                  LengthTimeCurrentOccupation: {
                    NumUnits: 0
                  },
                  LengthTimeWithPreviousEmployer: {
                    NumUnits: 0
                  },
                  LengthTimeCurrentAddr: {
                    StartTime: "00:00:00.0000000-04:00",
                    EndTime: "00:00:00.0000000-04:00",
                    LocalStandardTimeInd: false,
                    DurationPeriod: {
                      NumUnits: 0
                    },
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
              TotalPaidLossAmt: {
                Amt: applicationDocData.claims?.reduce((total, {amountPaid}) => total + (amountPaid || 0), 0)
              },
              NumLosses: applicationDocData.claims?.length,
              NumLossesYrs: 0,
              FutureEffDateInd: false,
              FutureEffDateNumDays: 0,
              InsuredRequestsPrintedDocumentsInd: false,
              CommlPolicySupplement: {
                PolicyTypeCd: "OCCUR"
              },
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
                      "usli:QuestionId": question.insurerQuestionIdentifier, // Question ID instead
                      "usli:QuestionType": "Applicant",
                      "usli:Answer": question.answerValue || "Unknown"
                    };
                  }
                })
                .concat(
                  applicationDocData.locations.flatMap((location, i) =>
                    location?.questions.map((q) => {
                      if (!ignoredQuestionIds.includes(q.insurerQuestionIdentifier)) {
                        return {
                          "@LocationRef": `${i + 1}`,
                          "usli:QuestionId": q.insurerQuestionIdentifier, // Question ID instead
                          "usli:QuestionType": "Location",
                          "usli:Answer": q.answerValue || "Unknown"
                        };
                      }
                    })
                  )
                )
                .filter((q) => q),
              "usli:Status": "Quote",
              "usli:Carrier": "MTV",
              "usli:FilingId": 0,
              "usli:IsUnsolicited": 0
            },
            Location: applicationDocData.locations
            // eslint-disable-next-line array-callback-return
              .map((location, index) => {
                if (location.primary) {
                  return {
                    "@id": `${index + 1}`,
                    Addr: {
                      AddrTypeCd: "PhysicalRisk",
                      Addr1: location?.address,
                      City: location?.city,
                      StateProvCd: location?.state,
                      PostalCode: location?.zipcode,
                      CountryCd: "USA"
                    }
                  };
                }
              })
              .filter((l) => l),
            CommlPropertyLineBusiness: {
              LOBCd: "CGL",
              MinPremInd: false
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
                GeneralLiabilityClassification: applicationDocData.locations.map((location, index) => ({
                    "@id": "C1",
                    "@LocationRef": `${index + 1}`,
                    ClassCd: this.industry_code?.attributes?.GLCode,
                    ClassCdDesc: this.industry_code?.attributes?.product,
                    Exposure: 12, // to be refactored
                    PremiumBasisCd: this.industry_code?.attributes?.ACORDPremiumBasisCode,
                    IfAnyRatingBasisInd: false,
                    ClassId: 0,
                    "usli:CoverageTypeId": this.industry_code?.code
                  })),
                EarnedPremiumPct: 0
              }
            },
            TransactionRequestDt: moment().format()
          }
        }
      }
    };

    // -------------- SEND XML REQUEST ----------------

    // Get the XML structure as a string
    const xml = builder.create(acord).end();

    // TODO: Send the XML request object to USLI's quote API

    const host = "services.uslistage.com"; // TODO: base API path here
    const quotePath = `/API/Quote`; // TODO: API Route path here
    const additionalHeaders = {
      "Content-Type": "application/xml"
    };

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
    const statusCode = get(response, "Status[0].StatusCd[0]");
    const msgStatusCode = get(response, "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].MsgStatusCd[0]");
    const msgStatusDescription = get(response, "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].MsgStatusDesc[0]");
    const msgErrorCode = get(response, "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].MsgErrorCd[0]");

    // Check that there was success at the root level
    if (msgStatusCode === "Rejected") {
      const errorMessage = `USLI decline error: ${msgStatusDescription} `;
      log.error(logPrefix + errorMessage + __location);
      return this.client_declined(msgStatusDescription);
    }

    if (msgErrorCode === "DataError") {
      const errorMessage = `USLI data not valid error: ${msgStatusDescription} `;
      log.error(logPrefix + errorMessage + __location);
      return this.client_error(errorMessage, __location);
    }

    if (msgErrorCode === "Error") {
      const errorMessage = `USLI error: ${msgStatusDescription} `;
      log.error(logPrefix + errorMessage + __location);
      return this.client_error(errorMessage, __location);
    }

    const quoteNumber = get(response, "CommlPkgPolicyQuoteInqRs[0].CommlPolicy[0].QuoteInfo[0].CompanysQuoteNumber[0]");
    const commlCoverage = get(
      response,
      "CommlPkgPolicyQuoteInqRs[0].GeneralLiabilityLineBusiness[0].LiabilityInfo[0].CommlCoverage"
    );
    const rates = get(
      response,
      "CommlPkgPolicyQuoteInqRs[0].GeneralLiabilityLineBusiness[0].LiabilityInfo[0].GeneralLiabilityClassification[0].CommlCoverage"
    );
    const premium = rates?.reduce((t, {Rate}) => t + Number(Rate[0] || 0), 0);
    const quoteLimits = {};

    const coverages = commlCoverage.map((coverage, index) => {
      const code = coverage.CoverageCd[0];
      const description = coverage.CoverageDesc[0];
      const limit = coverage.Limit[0]?.FormatText[0];

      return {
        description: description,
        value: convertToDollarFormat(limit, true),
        sort: index,
        category: "General Limits",
        insurerIdentifier: code
      };
    });

    if (statusCode === "0" && msgStatusCode === "Success") {
      return this.client_quoted(quoteNumber, quoteLimits, premium, quoteLetter, "base64", coverages);
    }

    if (statusCode === "434") {
      return this.client_referred(quoteNumber, quoteLimits, premium, quoteLetter, "base64", coverages);
    }
  }
};
