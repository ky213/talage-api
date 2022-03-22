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
const { v4: uuid } = require("uuid");
const Integration = require("../Integration.js");

global.requireShared("./helpers/tracker.js");

let logPrefix = "";
let applicationDocData = null;
let industryCode = null;

// TODO: Once you get a response, fill out these values for quote submission within our system
// quote response properties
let quoteNumber = null;
let quoteProposalId = null;
let premium = null;
const quoteLimits = {};
let quoteLetter = null;
const quoteMIMEType = "BASE64";
let policyStatus = null;
const quoteCoverages = [];

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
    const applicationDocData = this.applicationDocData;
    const entityTypes = {
      Corporation: { abbr: "CP", id: "CORPORATION" },
      Partnership: { abbr: "PT", id: "PARTNERSHIP" },
      "Non Profit Corporation": { abbr: "NP", id: "NON PROFIT CORPORATION" },
      "Limited Liability Company": { abbr: "LL", id: "LIMITED LIABILITY COMPANY" },
    };

    const ignoredQuestionIds = [
      "usli.building.roofingMaterial",
      "usli.building.roofingMaterial",
      "usli.general.terrorismCoverage",
      "usli.building.fireProtectionClassCd",
      "usli.building.requestedValuationTypeCd",
      "usli.building.yearOccupiedLocation",
    ];

    const supportedLimitsMap = {
      "1000000/1000000/1000000": ["1000000", "2000000", "2000000"],
      "1000000/2000000/1000000": ["1000000", "2000000", "2000000"],
      "1000000/2000000/2000000": ["1000000", "2000000", "2000000"],
      "2000000/4000000/4000000": ["2000000", "4000000", "4000000"],
    };

    const limits = supportedLimitsMap[this.policy.limits] || [];

    // const GLPolicy = applicationDocData.policies.find((p) => p.policyType === "GL");
    // logPrefix = `USLI Monoline GL (Appid: ${applicationDocData.applicationId}): `;

    // industryCode = await this.getUSLIIndustryCodes();

    // if (!industryCode) {
    //   const errorMessage = `No Industry Code was found for GL. `;
    //   log.warn(`${logPrefix}${errorMessage} ${__location}`);
    //   return this.client_autodeclined_out_of_appetite();
    // }

    // // if there's no GL policy
    // if (!GLPolicy) {
    //   const errorMessage = `Could not find a policy with type GL.`;
    //   log.error(`${logPrefix}${errorMessage} ${__location}`);
    //   return this.client_error(errorMessage, __location);
    // }

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
              CustLoginId: this.username,
            },
            CustPswd: {
              EncryptionTypeCd: "NONE",
              Pswd: this.password,
            },
            GenSessKey: false,
          },
          CustLangPref: "en",
          ClientApp: {
            Version: "2.0",
          },
          SuppressEcho: false,
        },
        InsuranceSvcRq: {
          RqUID: uuid(),
          CommlPkgPolicyQuoteInqRq: {
            CurCd: "USD",
            Producer: {
              ItemIdInfo: {
                InsurerId: "1065",
              },
              GeneralPartyInfo: {
                NameInfo: [
                  {
                    CommlName: {
                      CommercialName: this.app?.agencyLocation?.agency,
                    },
                  },
                  {
                    PersonName: {
                      Surname: this.app?.agencyLocation?.first_name,
                      GivenName: this.app?.agencyLocation?.last_name,
                    },
                  },
                ],
                Communications: {
                  EmailInfo: {
                    EmailAddr: this.app?.agencyLocation?.agencyEmail,
                    DoNotContactInd: false,
                  },
                },
              },
              ProducerInfo: {
                ProducerRoleCd: "Agency",
              },
            },
            InsuredOrPrincipal: {
              GeneralPartyInfo: {
                NameInfo: {
                  CommlName: {
                    CommercialName: applicationDocData?.businessName,
                  },
                  LegalEntityCd: {
                    "@id": entityTypes[applicationDocData?.entityType]?.id || "OTHER",
                    "#text": entityTypes[applicationDocData?.entityType]?.abbr || "OT",
                  },
                },
                Addr: {
                  AddrTypeCd: "InsuredsAddress",
                  Addr1: applicationDocData?.mailingAddress,
                  City: applicationDocData?.mailingCity,
                  StateProvCd: applicationDocData?.mailingState,
                  PostalCode: applicationDocData?.mailingZipcode?.substring(0, 5),
                  CountryCd: "USA",
                },
                Communications: {
                  PhoneInfo: {
                    DoNotContactInd: false,
                  },
                },
              },
              InsuredOrPrincipalInfo: {
                InsuredOrPrincipalRoleCd: "Insured",
                PersonInfo: {
                  LengthTimeEmployed: {
                    NumUnits: 0,
                  },
                  LengthTimeCurrentOccupation: {
                    NumUnits: 0,
                  },
                  LengthTimeWithPreviousEmployer: {
                    NumUnits: 0,
                  },
                  LengthTimeCurrentAddr: {
                    StartTime: "00:00:00.0000000-04:00",
                    EndTime: "00:00:00.0000000-04:00",
                    LocalStandardTimeInd: false,
                    DurationPeriod: {
                      NumUnits: 0,
                    },
                    ContinuousInd: false,
                    "GB.BothDaysInclusiveInd": false,
                  },
                  DoNotSolicitInd: false,
                  NumDependents: 0,
                  CoInsuredSameAddressInsuredInd: false,
                },
                BusinessInfo: {
                  BusinessStartDt: moment(applicationDocData.founded).year(),
                  OperationsDesc:
                    applicationDocData?.questions?.find(
                      ({ insurerQuestionIdentifier }) => insurerQuestionIdentifier === "usli.general.operationsDesc"
                    )?.answerValue || "Not Provided",
                },
              },
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
                  UnitMeasurementCd: "month",
                },
              },
              PrintedDocumentsRequestedInd: false,
              TotalPaidLossAmt: {
                Amt: applicationDocData.claims?.reduce((total, { amountPaid }) => total + (amountPaid || 0), 0),
              },
              NumLosses: applicationDocData.claims?.length,
              NumLossesYrs: 0,
              FutureEffDateInd: false,
              FutureEffDateNumDays: 0,
              InsuredRequestsPrintedDocumentsInd: false,
              CommlPolicySupplement: {
                PolicyTypeCd: "OCCUR",
              },
              WrapUpInd: false,
              CommlCoverage: [
                {
                  CoverageCd: "STMPF",
                  CoverageDesc: "Stamping Fee",
                  "usli:CoverageTypeId": 0,
                  "usli:FireCoverageTypeId": 0,
                  usliIsLeasedOccupancy: 0,
                },
                {
                  CoverageCd: "SPLTX",
                  CoverageDesc: "Surplus Lines Tax",
                  "usli:CoverageTypeId": 0,
                  "usli:FireCoverageTypeId": 0,
                  "usli:IsLeasedOccupancy": 0,
                },
              ],
              AnyLossesAccidentsConvictionsInd: applicationDocData.claims?.length > 0,
              "usli:DynamicQuestion": applicationDocData.questions
                ?.map((question) => {
                  if (!ignoredQuestionIds.includes(question.insurerQuestionIdentifier)) {
                    return {
                      "usli:QuestionId": question.insurerQuestionIdentifier, // Question ID instead
                      "usli:QuestionType": "Applicant",
                      "usli:Answer": question.answerValue || "Unknown",
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
                          "usli:Answer": q.answerValue || "Unknown",
                        };
                      }
                    })
                  )
                )
                .filter((q) => q),
              "usli:Status": "Quote",
              "usli:Carrier": "MTV",
              "usli:FilingId": 0,
              "usli:IsUnsolicited": 0,
            },
            Location: applicationDocData.locations
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
                      CountryCd: "USA",
                    },
                  };
                }
              })
              .filter((l) => l),
            CommlSubLocation: applicationDocData.locations
              .map((location, index) => {
                if (!location.primary) {
                  return {
                    "@LocationRef": `${index + 1}`,
                    Construction: {
                      ConstructionCd: "OT",
                      Description: "Unknown",
                      BldgArea: {
                        NumUnits: 0,
                      },
                      "usli:PlumbingCd": "UNK",
                    },
                    BldgProtection: {
                      ProtectionDeviceBurglarCd: "NotAnswered",
                      ProtectionDeviceSmokeCd: 0,
                      ProtectionDeviceSprinklerCd: "NoSprinkler",
                      SprinkleredPct: 0,
                    },
                    BldgOccupancy: {
                      "usli:YearsAtCurrentLocation": 0,
                      "usli:YearOccupiedCurrentLocation": 0,
                    },
                    "usli:Perils": "Unknown",
                  };
                }
              })
              .filter((l) => l),
            CommlPropertyLineBusiness: {
              LOBCd: "CGL",
              MinPremInd: false,
              PropertyInfo: {
                "@LocationRef": "1",
                CommlPropertyInfo: [
                  {
                    "@LocationRef": "1",
                    ItemValueAmt: {
                      Amt: 0,
                    },
                    ClassCdDesc: "Building",
                    CommlCoverage: {
                      CoverageCd: "BLDG",
                      CoverageDesc: "Building",
                      Limit: {
                        FormatText: 500000,
                        ValuationCd: "RC",
                        LimitAppliesToCd: "Aggregate",
                      },
                      Deductible: {
                        FormatInteger: 1000,
                        DeductibleTypeCd: "WD",
                        DeductibleAppliesToCd: "AllPeril",
                      },
                      PremiumBasisCd: "Unit",
                      CommlCoverageSupplement: {
                        CoinsurancePct: 80,
                      },
                      CoverageTypeId: 1000,
                      FireCoverageTypeId: 1000,
                      IsLeasedOccupancy: 1000,
                    },
                    BlanketNumber: 0,
                    ValueReportingInd: false,
                    GroundFloorArea: {
                      NumUnits: 0,
                    },
                    BlanketInd: false,
                    TotalPayrollAmt: {
                      Amt: 0,
                    },
                  },
                  {
                    "@LocationRef": "1",
                    ItemValueAmt: {
                      Amt: 0,
                    },
                    ClassCdDesc: "Equipment Breakdown",
                    CommlCoverage: {
                      CoverageCd: "EQBK",
                      CoverageDesc: "Equipment Breakdown",
                      Limit: {
                        FormatText: 500000,
                        ValuationCd: "NotSet",
                        LimitAppliesToCd: "Aggregate",
                      },
                      Deductible: {
                        FormatInteger: 0,
                        DeductibleTypeCd: "WD",
                        DeductibleAppliesToCd: "AllPeril",
                      },
                      PremiumBasisCd: "Unit",
                      CoverageTypeId: 10010,
                      FireCoverageTypeId: 0,
                      IsLeasedOccupancy: 0,
                    },
                    BlanketNumber: 0,
                    ValueReportingInd: false,
                    GroundFloorArea: {
                      NumUnits: 0,
                    },
                    BlanketInd: false,
                    TotalPayrollAmt: {
                      Amt: 0,
                    },
                  },
                ],
              },
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
                      FormatText: limits[0] || "2000000",
                      LimitAppliesToCd: "PerOcc",
                    },
                    "usli:CoverageTypeId": 0,
                    "usli:FireCoverageTypeId": 0,
                    "usli:IsLeasedOccupancy": 0,
                  },
                  {
                    CoverageCd: "GENAG",
                    CoverageDesc: "General Aggregate Limit",
                    Limit: {
                      FormatText: limits[1] || "4000000",
                      LimitAppliesToCd: "Aggregate",
                    },
                    "usli:CoverageTypeId": 0,
                    "usli:FireCoverageTypeId": 0,
                    "usli:IsLeasedOccupancy": 0,
                  },
                  {
                    CoverageCd: "PRDCO",
                    CoverageDesc: "Products/Completed Operations Aggregate Limit",
                    Limit: {
                      FormatText: limits[2] || "4000000",
                      LimitAppliesToCd: "Aggregate",
                    },
                    "usli:CoverageTypeId": 0,
                    "usli:FireCoverageTypeId": 0,
                    "usli:IsLeasedOccupancy": 0,
                  },
                  {
                    CoverageCd: "PIADV",
                    CoverageDesc: "Personal &amp; Advertising Injury Limit",
                    Limit: {
                      FormatText: limits[2] || "4000000",
                      LimitAppliesToCd: "PerPers",
                    },
                    "usli:CoverageTypeId": 0,
                    "usli:FireCoverageTypeId": 0,
                    "usli:IsLeasedOccupancy": 0,
                  },
                  {
                    CoverageCd: "MEDEX",
                    CoverageDesc: "Medical Expense Limit",
                    Limit: {
                      FormatText: 5000,
                      LimitAppliesToCd: "PerPers",
                    },
                    "usli:CoverageTypeId": 0,
                    "usli:FireCoverageTypeId": 0,
                    "usli:IsLeasedOccupancy": 0,
                  },
                  {
                    CoverageCd: "FIRDM",
                    CoverageDesc: "Damages To Premises Rented To You",
                    Limit: {
                      FormatText: 100000,
                      LimitAppliesToCd: "PropDam",
                    },
                    "usli:CoverageTypeId": 0,
                    "usli:FireCoverageTypeId": 0,
                    "usli:IsLeasedOccupancy": 0,
                  },
                ],
                GeneralLiabilityClassification: { // to be refactored
                  "@id": "C1",
                  "@LocationRef": "1",
                  CommlCoverage: {
                    CoverageCd: "PREM",
                    ClassCd: 60010,
                    "usli:CoverageTypeId": 0,
                    "usli:IsLeasedOccupancy": 0,
                  },
                  ClassCd: 60010,
                  ClassCdDesc: "Apartment Buildings",
                  Exposure: 12, // hardcoded
                  PremiumBasisCd: "Unit",
                  IfAnyRatingBasisInd: false,
                  ClassId: 0,
                  "usli:CoverageTypeId": 5337,
                },
                EarnedPremiumPct: 0,
              },
            },
            TransactionRequestDt: moment().format(),
          },
        },
      },
    };

    // -------------- SEND XML REQUEST ----------------

    // Get the XML structure as a string
    const xml = builder.create(acord).end();

    // TODO: Send the XML request object to USLI's quote API

    const host = "services.uslistage.com"; // TODO: base API path here
    const quotePath = `/API/Quote`; // TODO: API Route path here
    const additionalHeaders = {
      "Content-Type": "application/xml",
    };

    let result = null;
    try {
      result = await this.send_xml_request(host, quotePath, xml, additionalHeaders);
    } catch (e) {
      const errorMessage = `An error occurred while trying to hit the USLI Quote API endpoint: ${e}. `;
      log.error(logPrefix + errorMessage + __location);
      return this.client_error(errorMessage, __location);
    }

    // -------------- PARSE XML RESPONSE ----------------

    // TODO: Check result structure

    // TODO: Perform necessary response parsing to determine fail/success and get appropriate quote information

    // TODO: Call the appropriate return function
    // NOTE: This will likely be determined by some policyStatus in the quote response
    // EXAMPLE BELOW
    // return result based on policy status
    if (policyStatus) {
      switch (policyStatus.toLowerCase()) {
        case "accept":
          return this.client_quoted(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType, quoteCoverages);
        case "refer":
          return this.client_referred(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType, quoteCoverages);
        default:
          const errorMessage = `USLI response error: unknown policyStatus - ${policyStatus} `;
          log.error(logPrefix + errorMessage + __location);
          return this.client_error(errorMessage, __location);
      }
    } else {
      const errorMessage = `USLI response error: missing policyStatus. `;
      log.error(logPrefix + errorMessage + __location);
      return this.client_error(errorMessage, __location);
    }
  }

  async getUSLIIndustryCode() {
    const InsurerIndustryCodeModel = global.mongoose.InsurerIndustryCode;
    const policyEffectiveDate = moment(this.policy.effective_date).format("YYYY-MM-DD HH:mm:ss");
    applicationDocData = applicationDocData;

    const industryQuery = {
      insurerId: this.insurer.id,
      talageIndustryCodeIdList: applicationDocData.industryCode,
      territoryList: applicationDocData.mailingState,
      effectiveDate: { $lte: policyEffectiveDate },
      expirationDate: { $gte: policyEffectiveDate },
      active: true,
    };

    const orParamList = [];
    const policyTypeCheck = { policyType: this.policyTypeFilter };
    const policyTypeNullCheck = { policyType: null };
    orParamList.push(policyTypeCheck);
    orParamList.push(policyTypeNullCheck);
    industryQuery.$or = orParamList;

    // eslint-disable-next-line prefer-const
    let insurerIndustryCodeList = null;
    try {
      insurerIndustryCodeList = await InsurerIndustryCodeModel.find(industryQuery);
    } catch (e) {
      log.error(`${logPrefix}Error re-retrieving USLI industry codes. Falling back to original code. ${__location}`);
      return;
    }

    let USLIIndustryCode = null;
    if (insurerIndustryCodeList && insurerIndustryCodeList.length > 0) {
      USLIIndustryCode = insurerIndustryCodeList;
    } else {
      log.warn(
        `${logPrefix}No industry codes were returned while attempting to re-retrieve USLI industry codes. Falling back to original code. ${__location}`
      );
      USLIIndustryCode = [this.industry_code];
    }

    if (insurerIndustryCodeList.length > 1) {
      log.warn(`${logPrefix}Multiple insurer industry codes returned. Picking the first result. ${__location}`);
    }

    return USLIIndustryCode[0];
  }
};
