/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Simple BOP Policy Integration for Liberty Mutual
 */

'use strict';

const Integration = require('../Integration.js');
global.requireShared('./helpers/tracker.js');
const axios = require('axios');
const smartystreetSvc = global.requireShared('./services/smartystreetssvc.js');
const limitHelper = global.requireShared('./helpers/formatLimits.js');
const moment = require('moment');

// TODO: Update to toggle between test/prod 
const host = 'https://stag-api.nationalprograms.io';
const path = '/Quote/v0.2-beta/CreateQuote';
let logPrefix = "";

module.exports = class LibertySBOP extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
    }

    /**
	 * Requests a quote from Liberty and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
	async _insurer_quote() {

        // NOTE: Properties of the request object that are commented out are known optional params we are explicitly not providing

        const fieldsToParse = [
            "automaticIncr",
            "bipay.extNumDays",
            "fixedPropDeductible"
        ];

        // "Other" is not included, as anything not below is defaulted to it
        const supportedEntityTypes = [
            "Corporation",
            "Limited Liability Company",
            "Individual",
            "Joint Venture",
            "Partnership"
        ];

        const applicationDocData = this.app.applicationDocData;
        const BOPPolicy = applicationDocData.policies.find(p => p.policyType === "BOP");
        const primaryContact = applicationDocData.contacts.find(c => c.primary);
        const limits = limitHelper.getLimitsAsAmounts(BOPPolicy.limits);

        logPrefix = `Arrowhead (Appid: ${applicationDocData.mysqlId}): `;

        // NOTE: This question is required. Remove this code if we add this as a general universal question and add it to hydration function. 
        let eqpbrk = applicationDocData.questions.find(q => q.insurerQuestionIdentifier === "eqpbrk");
        if (eqpbrk) {
            eqpbrk = this.convertToBoolean(eqpbrk.answerValue);
        } else {
            eqpbrk = false;
        }

        // construct question map, massage answers into what is expected
        const questions = {};
        applicationDocData.questions.forEach(question => {
            let answer = null;
            if (fieldsToParse.includes(question.insurerQuestionIdentifier)) {
                answer = parseInt(question.answerValue);

                if (isNaN(answer)) {
                    log.error(`${logPrefix}Couldn't parse "${question.answerValue}" for question property "${question.insurerQuestionIdentifier}". Result was NaN, leaving as-is.`);
                    answer = question.answerValue;
                }
            } else {
                answer = question.answerValue;
            }

            questions[question.insurerQuestionIdentifier] = answer;
        });

        let locationList = null;
        try {
            locationList = await this.getLocationList();
        } catch (e) {
            return this.client_error(e, __location);
        }

        // hydrate the request JSON object with generic info
        const requestJSON = {
            rateCallType: "RATE_INDICATION",
            insuredSet: {
                firstName: primaryContact.firstName,
                lastName: primaryContact.lastName,
                DBA: applicationDocData.dba,
                address: {
                    zip: applicationDocData.mailingZipcode,
                    address: applicationDocData.mailingAddress,
                    city: applicationDocData.mailingCity,
                    state: applicationDocData.mailingState
                },
                mailingAddress: {
                    zip: applicationDocData.mailingZipcode,
                    address: applicationDocData.mailingAddress,
                    city: applicationDocData.mailingCity,
                    addressLine2: "",
                    state: applicationDocData.mailingState
                },
                instype: supportedEntityTypes.includes(applicationDocData.entityType) ? applicationDocData.entityType : "Other",
                companyName: applicationDocData.businessName,
                wphone: `+1-${primaryContact.phone.substring(0, 3)}-${primaryContact.phone.substring(primaryContact.phone.length - 7)}`,
                email: primaryContact.email
            },
            company: applicationDocData.businessName,
            controlSet: {
                prodcode: "111111", // <--- TODO: Get the producer code
                leadid: this.generate_uuid()
            },
            policy: {
                product: "BBOP",
                state: applicationDocData.mailingState,
                company: applicationDocData.businessName,
                agentid: "qatest", // <--- TODO: Do we need this? If so, how do we get it?
                commonSet: {
                    // dnb: {
                    //     callResult: "HIT",
                    //     message: "",
                    //     dunsNumber: "777777776"
                    // },
                    stateOfDomicile: applicationDocData.mailingState,
                    company: applicationDocData.businessName,
                    naicsCode: this.industry_code.attributes.naics,
                    classCode: this.industry_code.code, 
                    yearBizStarted: `${moment(applicationDocData.founded).year()}`,
                    sicCode: this.industry_code.attributes.sic,
                    expiration: moment(BOPPolicy.effectiveDate).add(1, "year").format("YYYYMMDD"),
                    state: applicationDocData.mailingState,
                    quoteType: "NB"
                },
                bbopSet: {
                    classCodes: this.industry_code.code,
                    finalized: true,
                    GLOccurrenceLimit: limits[0],
                    productsCOA: limits[2],
                    // removeITVProvision: false,
                    liabCovInd: true,
                    propCovInd: true,
                    locationList: locationList,
                    otherCOA: limits[1],
                    addtlIntInd: false,
                    coverages: {               
                        terror: { // required to provide this coverage object
                            includeInd: BOPPolicy.addTerrorismCoverage
                        },
                        eqpbrk: { // required to provide this coverage object
                            includeInd: eqpbrk
                        }
                    },
                },
                effectiveProduct: "BBOP"
            },
            products: "BBOP"
        };

        try {
            this.injectGeneralQuestions(requestJSON, questions);
        } catch (e) {
            return this.client_error(`${logPrefix}${e}`, __location);
        }

        // send the JSON request

        log.info("=================== QUOTE REQUEST ===================");
        log.info(`${logPrefix}\n${JSON.stringify(requestJSON, null, 4)}`);
        log.info("=================== QUOTE REQUEST ===================");

        let result = null;
        const headers = {
            "Cache-Control": "no-cache",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Ocp-Apim-Subscription-Key": "2536d916e6124279a693d11fabc07aa9" // this is Scott's Primary Key
        }
        try {
            // result = await this.send_json_request(host, path, JSON.stringify(requestJSON), headers, "POST");
            result = await axios.post(`${host}${path}`, JSON.stringify(requestJSON), {headers: headers});
        } catch(e) {
            log.error(`Arrowhead (AppID: ${applicationDocData.mysqlId}): Error sending request: ${e}.`);
        }

        // parse the error / response

        if (result.data.hasOwnProperty("error")) {
            log.info("=================== QUOTE ERROR ===================");
            log.info(`${logPrefix}\n${JSON.stringify(result.data, null, 4)}`);
            log.info("=================== QUOTE ERROR ===================");
            const error = result.data.error;
            let errorMessage = "";

            if (error.statusCode && error.code) {
                errorMessage += `[${error.statusCode}] ${error.code}: `;
            } else {
                return this.client_error(errorMessage + "An error occurred, please review the logs.", __location);
            }

            const additionalDetails = [];
            if (error.details && error.details.length > 0) {
                error.details.forEach((e, i) => {
                    if (i === 0) {
                        errorMessage += `${e}`;
                    } else {
                        additionalDetails.push(e);
                    }
                }); 
            } else {
                errorMessage += `No details were provided, please review the logs.`;
            }

            return this.client_error(errorMessage, __location, additionalDetails.length > 0 ? additionalDetails : null);
        }

        // handle successful quote
        log.info("=================== QUOTE RESULT ===================");
        log.info(`${logPrefix}\n${JSON.stringify(result.data, null, 4)}`);
        log.info("=================== QUOTE RESULT ===================");
    }

    async getLocationList() {
        const applicationDocData = this.app.applicationDocData;
        const locationList = [];
        
        for (const location of applicationDocData.locations) {
            const smartyStreetsResponse = await smartystreetSvc.checkAddress(
                applicationDocData.mailingAddress,
                applicationDocData.mailingCity,
                applicationDocData.mailingState,
                applicationDocData.mailingZipcode
            );

            // If the response has an error property, or doesn't have addressInformation.county_name, we can't determine
            // a county so return an error.
            if (smartyStreetsResponse.hasOwnProperty("error") ||
                !smartyStreetsResponse.hasOwnProperty("addressInformation") ||
                !smartyStreetsResponse.addressInformation.hasOwnProperty("county_name")) {
                let errorMessage = "";
                if (smartyStreetsResponse.hasOwnProperty("error")) {
                    errorMessage += `${smartyStreetsResponse.error}: ${smartyStreetsResponse.errorReason}. Due to this, we are unable to look up County information.`;
                } else {
                    errorMessage += `SmartyStreets could not determine the county for address: ${this.app.business.locations[0].address}, ${this.app.business.locations[0].city}, ${this.app.business.locations[0].state_abbr}, ${this.app.business.locations[0].zip}<br>`;
                }

                throw new Error(errorMessage);
            }

            const locationObj = {
                // street: "POLK",
                // zipAddOn: "",
                // based: "riskAddress1",
                // streetType: "",
                // postDir: "",
                // scrubberCalled: true,
                // recordType: "S",
                // streetNum: "",
                // confirmation: "N/A",
                // isoClassGroups: "Convenience Food/Gasoline Store/Restaurant",
                // unit: "",
                // scrubberResult: "Accepted",
                // secondaryName: "",
                // preDir: "",
                userCountryName: "USA",
                userCountyName: smartyStreetsResponse.addressInformation.county_name,
                city: location.city,
                classCodes: this.industry_code.code,
                address: applicationDocData.mailingAddress,
                rawProtectionClass: "3", // <-- TODO: ASK JAMES
                state: location.state,
                countyName: smartyStreetsResponse.addressInformation.county_name,
                zip: applicationDocData.mailingZipcode,
                addressLine: applicationDocData.mailingAddress,
                buildings: 1, // Assumed as such until we work building information into the quote app and API
                PPCAddressKey: `${applicationDocData.mailingAddress}:${applicationDocData.mailingState}:${applicationDocData.mailingZipcode}`, 
                territory: applicationDocData.mailingState,
                finalProtectionClass: "3", // <-- TODO: ASK JAMES
                // PPCCall: {
                //     fireProtectionArea: smartyStreetsResponse.addressInformation.county_name,
                //     waterSupplyType: "Hydrant", // <-- HOW TO GET THIS
                //     PPCCode: "3", // <-- WHAT IS THIS
                //     matchType: "Address Level Match",
                //     county: smartyStreetsResponse.addressInformation.county_name,
                //     respondingFireStation: "STATION 14", // <-- HOW TO GET THIS
                //     priorAlternativePPCCodes: "9/10", // <-- WHAT IS THIS
                //     driveDistanceToRespondingFireStation: "1 mile or less", // <-- HOW TO GET THIS
                //     multiplePPCInd: false // <-- WHAT IS THIS
                // },
                // bceg: {
                //     bcegCode: "99",
                //     callResult: "SUCCESSFUL",
                //     message: ""
                // },
                // fireline: {
                //     wildFireHazardScore: 0,
                //     callResult: "SUCCESSFUL",
                //     message: ""
                // },
                buildingList: [ // TODO: Break this out into a separate call once we have notion of buildings in quote app
                    {
                        classCode: this.industry_code.code,
                        uw: {
                            roofUpdates: 2015,
                            plumbingUpdates: 2015,
                            electricalUpdates: 2015,
                            playam: false,
                            hvacUpdates: 2015
                        },
                        occupancy: "Owner Occupied Bldg - More than 10%",
                        LOI: "500000",
                        classTag: "SALES",
                        industrySegment: "",
                        isoClassDescriptionId: 32,
                        isoClassDescription: "Convenience Food Stores With Fast Food Restaurant With Gasoline Sales",
                        description: "Test Building",
                        isoClassGroup: "Convenience Food/Gasoline Store/Restaurant",
                        replacementCost: {
                            bldMeetsRecommendedCost: true,
                            replacementCost: 405114,
                            callResult: "SUCCESSFUL",
                            message: ""
                        },
                        coverages: {
                            PP: {
                                seasonalIncrease: "25",
                                valuationInd: false,
                                includeInd: true,
                                limit: "200000"
                            },
                            concom: {
                                includeFormInd: true
                            },
                            lospay: {
                                includeInd: false
                            },
                            aieqip: {
                                includeInd: false
                            },
                            tenfir: {
                                coverageType: "No Coverage",
                                includeInd: false
                            },
                            osigns: {
                                includeInd: false
                            },
                            utilte: {
                                includeInd: false
                            },
                            lienholder: {
                                includeInd: false
                            },
                            liab: {
                                includeInd: true,
                                sales: "500000"
                            },
                            aiprem: {
                                includeInd: false
                            },
                            actrec: {
                                includeInd: false
                            },
                            aibown: {
                                includeInd: false
                            },
                            lcompf: {
                                includeInd: false
                            },
                            utildd: {
                                includeInd: false
                            },
                            bld: {
                                valuation: "Replacement Cost",
                                includeInd: true,
                                limit: 500000
                            },
                            spoil: {
                                breakContInd: true,
                                includeInd: true,
                                refrigerationInd: true,
                                spoilageLimit: 25000,
                                spoilageDescription: "Convenience Food Stores",
                                powerOutInd: true
                            },
                            bidp: {
                                includeInd: true,
                                limit: 50000,
                                secondaryDependentProperties: false
                            },
                            ordLaw: {
                                limit1: 500000,
                                limit2: 500000,
                                includeInd: true,
                                covType: "Coverage 1 and 2"
                            },
                            tenant: {
                                includeInd: false
                            }
                        },
                        yearBuilt: 2010,
                        numStories: 2,
                        occupiedSqFt: 5000,
                        classOverride: false,
                        sicCode: "5411",
                        construction: "Modified Fire Resistive",
                        premOpsILF: "1",
                        cspCode: "0931",
                        naicsCode: this.industry_code.attributes.naics,
                        sprinklered: true
                    }
                ]
            };

            this.injectLocationQuestions(locationObj, location.questions);

            locationList.push(locationObj);
        };

        return locationList;
    }

    injectGeneralQuestions(requestJSON, questions) {
        // hydrate the request JSON object with general question data
        // NOTE: Add additional general questions here if more get imported  
        
        // parent questions
        const additionalInsured = [];
        const conins = [];
        const datcom = [];
        const empben = [];

        const bbopSet = requestJSON.policy.bbopSet;
        for (const [id, answer] of Object.entries(questions)) {
            switch (id) {
                case "automaticIncr":
                    bbopSet.automaticIncr = answer;
                    break;
                case "flMixedBbopInd":
                    bbopSet.flMixedBbopInd = this.convertToBoolean(answer);
                    break;
                case "medicalExpenses":
                    bbopSet.medicalExpenses = answer;
                    break;        
                case "liaDed":
                    bbopSet.liaDed = answer;
                    break;       
                case "fixedPropDeductible":
                    bbopSet.fixedPropDeductible = answer;
                    break;  
                case "additionalInsured": // <---- THIS ISN'T IN THE TEMPLATE OR THEIR DOCUMENTATION
                    bbopSet.additionalInsured = {
                        includedInd: this.convertToBoolean(answer)
                    }
                    break;
                case "cown.numAI":
                case "desgpers.numAI":
                case "cgrantor.numAI":
                case "limprod.numAI":
                case "olccmp.numAI":
                case "olc.numAI":
                case "vendor.numAI":
                    additionalInsured.push({id, answer});
                    break;
                case "blanket.CovOption":
                    bbopSet.coverages.blanket = {
                        includedInd: true,
                        CovOption: answer
                    };
                    break;  
                case "bitime":
                    bbopSet.coverages.bitime = {
                        includedInd: this.convertToBoolean(answer)
                    };
                    break;  
                case "bipay.extNumDays":
                    bbopSet.coverages.bipay = {
                        includedInd: true,
                        extNumDays: answer
                    };
                    break;  
                case "blkai":
                    bbopSet.coverages.blkai = {
                        includedInd: this.convertToBoolean(answer)
                    };
                    break;  
                case "compf.limit":
                    bbopSet.coverages.compf = {
                        includedInd: true,
                        limit: answer
                    };
                    break;  
                case "conins": 
                    bbopSet.coverages.conins = {
                        includedInd: this.convertToBoolean(answer)
                    };
                    break; 
                case "conins.propOnSite": 
                case "conins.conEquipRentReimbursement":
                case "conins.conToolsCovType":
                case "conins.limit":
                case "conins.actualCashValueInd":
                case "conins.itemSubLimitText":
                // case "conins.conscd.equip.desc": IGNORED FOR NOW
                // case "conins.conscd.equip.val": IGNORED FOR NOW
                case "conins.nonownTools":
                case "conins.nonownTools.Limit":
                case "conins.empTools":
                case "conins.empTools.Limit":
                    conins.push({id, answer});
                    break;
                case "cyber":
                    bbopSet.coverages.cyber = {
                        includedInd: this.convertToBoolean(answer)
                    };
                    break; 
                case "datcom":
                    bbopSet.coverages.datcom = {
                        includedInd: this.convertToBoolean(answer)
                    };
                    break; 
                case "datcom.limit":
                case "datcom.tier.100000":
                case "datcom.tier.250000":
                case "datcom.tier.500000":
                case "datcom.tier.1000000":
                    datcom.push({id, answer});
                    break;
                case "empben":
                    bbopSet.coverages.empben = {
                        includedInd: this.convertToBoolean(answer)
                    };
                    break;
                case "empben.limit":
                case "empben.NumEmp":
                case "empben.ProgramName":
                // case "empben.RetroDate": IGNORED FOR NOW
                    empben.push({id, answer});
                    break;
                default: 
                    log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions with no defined case. This could mean we have a new question that needs to be handled in the integration.`);
                    break;
            }
        }

        // hydrate additionalInsured with child question data, if any exist
        if (additionalInsured.length > 0) {
            if (!bbopSet.hasOwnProperty("additionalInsured")) {
                bbopSet.additionalInsured = {
                    includedInd: true
                };
            }
            additionalInsured.forEach(prop => {
                const numAI = {
                    numAI: prop.answer
                };

                switch(prop.id) {
                    case "cown.numAI":
                    case "desgpers.numAI":
                    case "cgrantor.numAI":
                    case "limprod.numAI":
                    case "olccmp.numAI":
                    case "olc.numAI":
                    case "vendor.numAI":
                        bbopSet.additionalInsured[prop.id] = numAI;
                        break;
                }
            });
        }

        // hydrate conins with child question data, if any exist
        if (conins.length > 0) {
            if (!bbopSet.hasOwnProperty("conins")) {
                bbopSet.conins = {
                    includedInd: true
                };
            }

            conins.forEach(prop => {
                switch(prop.id) {
                    case "conins.propOnSite": 
                    case "conins.conEquipRentReimbursement":
                    case "conins.conToolsCovType":
                    case "conins.limit":
                    case "conins.actualCashValueInd":
                    case "conins.itemSubLimitText":
                        bbopSet.conins[prop.id] = prop.answer;
                        break;
                    case "conins.nonownTools":
                        bbopSet.conins.nonownTools = {
                            includedInd: this.convertToBoolean(prop.answer)
                        }
                        break;
                    case "conins.empTools":
                        bbopSet.conins.empTools = {
                            includedInd: this.convertToBoolean(prop.answer)
                        }
                        break;
                }
            });

            const coninsNonownToolsLimit = conins.find(prop => prop.id === "conins.nonownTools.Limit");
            if (coninsNonownToolsLimit) {
                if (!bbopSet.conins.hasOwnProperty("nonownTools")) {
                    bbopSet.conins.nonownTools = {
                        includedInd: true
                    };
                }

                bbopSet.conins.nonownTools.Limit = coninsNonownToolsLimit.answer;
            }

            const coninsEmpToolsLimit = conins.find(prop => prop.id === "conins.empTools.Limit");
            if (coninsEmpToolsLimit) {
                if (!bbopSet.conins.hasOwnProperty("empTools")) {
                    bbopSet.conins.empTools = {
                        includedInd: true
                    };
                }

                bbopSet.conins.empTools.Limit = coninsEmpToolsLimit.answer;
            }
        }

        // hydrate datcom with child question data, if any exist
        if (datcom.length > 0) {
            if (!bbopSet.hasOwnProperty("datcom")) {
                bbopSet.datcom = {
                    includedInd: true
                };
            }

            const datcomLimit = datcom.find(prop => prop.id === "datcom.limit");
            if (!datcomLimit) {
                throw new Error(`datcom is included, but no limit is provided.`);
            }

            const datcomTier = datcom.find(prop => prop.id === `datcom.tier.${datcomLimit}`);
            if (!datcomTier) {
                throw new Error(`Could not find datcom tier for provided limit.`);
            }

            bbopSet.datcom.limit = datcomLimit;
            bbopSet.datcom.tier = datcomTier;
        }

        // hydrate empben with child question data, if any exist
        if (empben.length > 0) {
            if (!bbopSet.hasOwnProperty("empben")) {
                bbopSet.empben = {
                    includedInd: true
                };
            }

            empben.forEach(prop => {
                switch(prop.id) {
                    case "empben.limit":
                    case "empben.NumEmp":
                    case "empben.ProgramName":
                        bbopSet.empben[prop.id] = prop.answer;
                        break;
                }
            });
        }
    }

    injectLocationQuestions(location, questions) {
        // hydrate the request JSON object with general question data
        // NOTE: Add additional general questions here if more get imported   

        // filter out building questions, and remove the location. prefix
        const locationQuestions = questions
            .filter(q => q.insurerQuestionIdentifier.includes("location.")
            .map(q => q.insurerQuestionIdentifier = q.insurerQuestionIdentifier.replace("location.", "")));

        for (const [id, answer] of Object.entries(locationQuestions)) {
            switch (id) {
                case "WHDeductiblePcnt":
                    location[id] = answer;
                    break;
                case "WHexclusions":
                    location[id] = this.convertToBoolean(answer);
                    break;
                case "perilType":
                    location[id] = answer;
                    break;
                case "StormPcnt":
                    location[id] = answer;
                    break;
                default: 
                    log.warn(`${logPrefix}Encountered key [${id}] in injectLocationQuestions with no defined case. This could mean we have a new question that needs to be handled in the integration.`);
                    break;
            }
        }

        this.injectBuildingQuestions(location.buildingList[0], questions);
    }

    // NOTE: Currently this has an object pre-seeded into the buildingList because we only work with 1 building by default. When we allow multiple buildings
    //       per location, that can be defined in the quote app, this will need to be refactored to handle that. 
    injectBuildingQuestions(building, questions) {
        // not yet implemented
    }

    convertToBoolean(value) {
        if (typeof value === "string") {
            if (value.toLowerCase() === "yes" || value.toLowerCase() === "no") {
                return value.toLowerCase() === "yes";
            }
        }

        // add more special conversions here...

        log.warn(`No match was found, unable to convert value: ${value} to boolean. Returning null.`);
        return null;
    }
}