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
    applicationDocData = this.applicationDocData;
    const primaryLocation = applicationDocData.locations.find(({ primary }) => primary);
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
            "@xmlns": "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/",
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
          CustLangPref: {
            "@xmlns": "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/",
            "#text": "en",
          },
          ClientApp: {
            Version: 0,
          },
          SuppressEcho: false,
        },
        InsuranceSvcRq: {
          RqUID: {
            "@xmlns": "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/",
            "#text": uuid(),
          },
          CommlPkgPolicyQuoteInqRq: {
            CurCd: {
              "@xmlns": "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/",
              "#text": "USD",
            },
            Producer: {
              "@xmlns": "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/",
              ItemIdInfo: {
                InsurerId: 1065,
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
              "@xmlns": "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/",
              GeneralPartyInfo: {
                NameInfo: {
                  CommlName: {
                    CommercialName: this.applicationDocData?.businessName,
                  },
                  LegalEntityCd: {
                    "@id": "INDIVIDUAL",
                    "#text": "IN",
                  },
                },
                Addr: {
                  AddrTypeCd: "InsuredsAddress",
                  Addr1: this.applicationDocData?.mailingAddress,
                  City: this.applicationDocData?.mailingCity,
                  StateProvCd: this.applicationDocData?.mailingState,
                  PostalCode: this.applicationDocData?.mailingZipcode,
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
                  BusinessStartDt: -1,
                  OperationsDesc: "",
                },
              },
            },
            CommlPolicy: {
              "@xmlns": "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/",
              CompanyProductCd: 50070,
              LOBCd: "CGL",
              NAICCd: 26522,
              ControllingStateProvCd: "TX",
              ContractTerm: {
                EffectiveDt: "2022-04-17",
                ExpirationDt: "2023-04-17",
                DurationPeriod: {
                  NumUnits: 12,
                  UnitMeasurementCd: "month",
                },
              },
              PrintedDocumentsRequestedInd: false,
              TotalPaidLossAmt: {
                Amt: 0,
              },
              NumLosses: 0,
              NumLossesYrs: 0,
              FutureEffDateInd: false,
              FutureEffDateNumDays: 0,
              InsuredRequestsPrintedDocumentsInd: false,
              CommlPolicySupplement: {
                PolicyTypeCd: "SPC",
              },
              WrapUpInd: false,
              CommlCoverage: [
                {
                  CoverageCd: "STMPF",
                  CoverageDesc: "Stamping Fee",
                  CoverageTypeId: {
                    "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                    "#text": 0,
                  },
                  FireCoverageTypeId: {
                    "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                    "#text": 0,
                  },
                  IsLeasedOccupancy: {
                    "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                    "#text": 0,
                  },
                },
                {
                  CoverageCd: "SPLTX",
                  CoverageDesc: "Surplus Lines Tax",
                  CoverageTypeId: {
                    "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                    "#text": 0,
                  },
                  FireCoverageTypeId: {
                    "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                    "#text": 0,
                  },
                  IsLeasedOccupancy: {
                    "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                    "#text": 0,
                  },
                },
              ],
              AnyLossesAccidentsConvictionsInd: false,
              DynamicQuestion: [
                {
                  QuestionID: 10345,
                  QuestionType: "Applicant",
                  Answer: "Unknown",
                },
                {
                  QuestionID: 10353,
                  QuestionType: "Applicant",
                  Answer: "Unknown",
                },
                {
                  QuestionID: 10438,
                  QuestionType: "Applicant",
                  Answer: "Yes",
                },
                {
                  QuestionID: 10424,
                  QuestionType: "Location",
                  Answer: "Yes",
                },
                {
                  QuestionID: 10425,
                  QuestionType: "Location",
                  Answer: "Yes",
                },
                {
                  QuestionID: 10426,
                  QuestionType: "Location",
                  Answer: "Unknown",
                },
                {
                  QuestionID: 10428,
                  QuestionType: "Location",
                  Answer: "Unknown",
                },
                {
                  QuestionID: 10429,
                  QuestionType: "Location",
                  Answer: "Unknown",
                },
                {
                  QuestionID: 10430,
                  QuestionType: "Location",
                  Answer: "Unknown",
                },
                {
                  QuestionID: 10431,
                  QuestionType: "Location",
                  Answer: "Yes",
                },
                {
                  QuestionID: 10433,
                  QuestionType: "Location",
                  Answer: "Unknown",
                },
                {
                  QuestionID: 10434,
                  QuestionType: "Location",
                  Answer: "Unknown",
                },
                {
                  QuestionID: 10436,
                  QuestionType: "Location",
                  Answer: "Unknown",
                },
                {
                  QuestionID: 10437,
                  QuestionType: "Location",
                  Answer: "Unknown",
                },
                {
                  QuestionID: 10587,
                  QuestionType: "Location",
                  Answer: "No",
                },
                {
                  QuestionID: 1946,
                  QuestionType: "Classification",
                  Answer: "Unknown",
                },
              ],
              Status: "Quote",
              Carrier: "MTV",
              FilingId: 0,
              IsUnsolicited: 0,
            },
            Location: {
              "@id": "1",
              "@xmlns": "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/",
              Addr: {
                AddrTypeCd: "PhysicalRisk",
                Addr1: primaryLocation?.address,
                City: primaryLocation?.city,
                StateProvCd: primaryLocation?.state,
                PostalCode: primaryLocation?.zipcode,
                CountryCd: "USA",
              },
            },
            CommlSubLocation: {
              Construction: {
                ConstructionCd: "F",
                Description: "Frame",
                YearBuilt: 2010,
                BldgArea: {
                  NumUnits: 4000,
                },
                RoofingMaterial: {
                  RoofMaterialCd: "ASPHS",
                },
                PlumbingCd: "PVC",
              },
              BldgImprovements: {
                RoofingImprovementYear: 2010,
              },
              BldgProtection: {
                FireProtectionClassCd: 1,
                ProtectionDeviceBurglarCd: "NotAnswered",
                ProtectionDeviceSmokeCd: 0,
                ProtectionDeviceSprinklerCd: "Unknown",
                SprinkleredPct: 0,
              },
              BldgOccupancy: {
                YearsAtCurrentLocation: 0,
                YearOccupiedCurrentLocation: 0,
              },
              RequestedValuationTypeCd: "RC",
              Perils: "Special Excluding Wind And Hail",
              RequestedCauseOfLossCd: "SPC",
            },
            CommlPropertyLineBusiness: {
              "@xmlns": "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/",
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
                      CoverageTypeId: {
                        "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                        "#text": 1000,
                      },
                      FireCoverageTypeId: {
                        "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                        "#text": 1000,
                      },
                      IsLeasedOccupancy: {
                        "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                        "#text": 1000,
                      },
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
                      FormatText: 1000000,
                      LimitAppliesToCd: "PerOcc",
                    },
                    CoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    FireCoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    IsLeasedOccupancy: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                  },
                  {
                    CoverageCd: "PIADV",
                    CoverageDesc: "Personal &amp; Advertising Injury Limit",
                    Limit: {
                      FormatText: 1000000,
                      LimitAppliesToCd: "PerPers",
                    },
                    CoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    FireCoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    IsLeasedOccupancy: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                  },
                  {
                    CoverageCd: "MEDEX",
                    CoverageDesc: "Medical Expense Limit",
                    Limit: {
                      FormatText: 5000,
                      LimitAppliesToCd: "PerPers",
                    },
                    CoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    FireCoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    IsLeasedOccupancy: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                  },
                  {
                    CoverageCd: "FIRDM",
                    CoverageDesc: "Damages To Premises Rented To You",
                    Limit: {
                      FormatText: 100000,
                      LimitAppliesToCd: "PropDam",
                    },
                    CoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    FireCoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    IsLeasedOccupancy: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                  },
                  {
                    CoverageCd: "PRDCO",
                    CoverageDesc: "Products/Completed Operations Aggregate Limit",
                    Limit: {
                      LimitAppliesToCd: "Aggregate",
                    },
                    Option: {
                      OptionCd: "Incl",
                    },
                    CoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    FireCoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    IsLeasedOccupancy: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                  },
                  {
                    CoverageCd: "GENAG",
                    CoverageDesc: "General Aggregate Limit",
                    Limit: {
                      FormatText: 2000000,
                      LimitAppliesToCd: "Aggregate",
                    },
                    CoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    FireCoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    IsLeasedOccupancy: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                  },
                ],
                GeneralLiabilityClassification: {
                  CommlCoverage: {
                    CoverageCd: "PREM",
                    ClassCd: 60010,
                    CoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                    FireCoverageTypeId: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 101,
                    },
                    FireCode: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": "0312",
                    },
                    IsLeasedOccupancy: {
                      "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                      "#text": 0,
                    },
                  },
                  ClassCd: 60010,
                  ClassCdDesc: "Apartment Buildings",
                  Exposure: 12,
                  PremiumBasisCd: "Unit",
                  IfAnyRatingBasisInd: false,
                  ClassId: {
                    "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                    "#text": 0,
                  },
                  CoverageTypeId: {
                    "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                    "#text": 5337,
                  },
                },
                EarnedPremiumPct: {
                  "@xmlns:usli": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
                  "#text": 0,
                },
              },
            },
            TransactionRequestDt: {
              "@xmlns": "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/",
              "#text": moment().format(),
            },
          },
        },
      },
    };

    // -------------- SEND XML REQUEST ----------------

    // Get the XML structure as a string
    const xml = builder.create(acord).end({ pretty: true });

    // TODO: Send the XML request object to USLI's quote API

    const host = ""; // TODO: base API path here
    const quotePath = ``; // TODO: API Route path here
    const additionalHeaders = {};

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
    applicationDocData = this.applicationDocData;

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
