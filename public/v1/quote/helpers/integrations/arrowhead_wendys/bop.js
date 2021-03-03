/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * This is a Wendy's specific integration for Arrowhead. 
 * 
 * NOTE: This integration treats Arrowhead Wendy's as a unique insurer
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

        logPrefix = `Arrowhead Wendys (Appid: ${applicationDocData.mysqlId}): `;

        // reducing questions to a separate questionmap keyed off identifier
        const questions = {};
        applicationDocData.questions.forEach(question => {
            questions[question.insurerQuestionIdentifier] = question.answerValue;
        });

        // reducing and injecting question maps for location and building into each location 
        // NOTE: This will need to change once buildings get their own questions
        applicationDocData.locations.forEach(location => {
            location.locationQuestions = {};
            location.buildingQuestions = {};

            location.questions.forEach(question => {
                if (question.insurerQuestionIdentifier.includes("location.")) {
                    // location specific questions
                    location.locationQuestions[question.insurerQuestionIdentifier.replace("location.", "")] = question.answerValue;
                } else if (question.insurerQuestionIdentifier.includes("building.")){ // purposefully being explicit w/ this if statement
                    // building specific questions
                    location.buildingQuestions[question.insurerQuestionIdentifier.replace("building.", "")] = question.answerValue;
                }
            });
        });

        let locationList = null;
        try {
            locationList = await this.getLocationList();
        } catch (e) {
            return this.client_error(e, __location);
        }

        // hydrate the request JSON object with generic info
        const requestJSON = {
            insuredSet: {
                firstName: primaryContact.firstName,
                lastName: primaryContact.lastName,
                address: {
                    zip: applicationDocData.mailingZipcode,
                    address: applicationDocData.mailingAddress,
                    city: applicationDocData.mailingCity,
                    state: applicationDocData.mailingState
                },
                instype: supportedEntityTypes.includes(applicationDocData.entityType) ? applicationDocData.entityType : "Other",
                companyName: applicationDocData.businessName,
                wphone: `+1-${primaryContact.phone.substring(0, 3)}-${primaryContact.phone.substring(primaryContact.phone.length - 7)}`,
                email: primaryContact.email
            },
            controlSet: {
                leadid: this.generate_uuid(),
                prodcode: "111111", // <--- TODO: Get the producer code
                prodsubcode: "qatest"
            },
            policy: {
                effectiveProduct: "BBOP",
                state: applicationDocData.mailingState,
                company: applicationDocData.businessName,
                agentid: "qatest", // <--- TODO: Do we need this? If so, how do we get it?
                commonSet: {
                    stateOfDomicile: applicationDocData.mailingState,
                    naicsCode: this.industry_code.attributes.naics,
                    classCode: this.industry_code.code, 
                    yearBizStarted: `${moment(applicationDocData.founded).year()}`,
                    sicCode: this.industry_code.attributes.sic, 
                    effective: moment(BOPPolicy.effectiveDate).format("YYYYMMDD"), 
                    expiration: moment(BOPPolicy.effectiveDate).add(1, "year").format("YYYYMMDD"), 
                    state: applicationDocData.mailingState, 
                    quoteType: "NB"
                },
                bbopSet: {
                    classCodes: "",
                    finalized: true,
                    GLOccurrenceLimit: limits[0],
                    productsCOA: limits[2],
                    liabCovInd: false, // documentation states this should be hardcoded to true, yet example wendy's request has as false?
                    propCovInd: false,
                    locationList: locationList,
                    otherCOA: limits[1],
                    addtlIntInd: false,
                    coverages: {
                        terror: {
                            includeInd: BOPPolicy.addTerrorismCoverage
                        }
                    }
                }
            }
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
            const errorMessage = 
            log.error(`${logPrefix}Error sending request: ${e}.`);
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

            log.error(errorMessage, __location);
            return this.client_error(errorMessage, __location, additionalDetails.length > 0 ? additionalDetails : null);
        }

        // handle successful quote
        log.info("=================== QUOTE RESULT ===================");
        log.info(`${logPrefix}\n${JSON.stringify(result.data, null, 4)}`);
        log.info("=================== QUOTE RESULT ===================");
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////
    // HELPER FUNCTIONS
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////

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
                countyName: smartyStreetsResponse.addressInformation.county_name,
                city: location.city,
                classCodes: this.industry_code.code,
                address: applicationDocData.mailingAddress,
                rawProtectionClass: "", // hardset value expected by Arrowhead
                state: location.state,
                countyName: smartyStreetsResponse.addressInformation.county_name,
                zip: applicationDocData.mailingZipcode,
                addressLine: applicationDocData.mailingAddress,
                buildings: 1, // Assumed as such until we work building information into the quote app and API
                finalProtectionClass: "",
                buildingList: [ // TODO: Break this out into a separate call once we have notion of buildings in quote app
                    {
                        LOI: `${applicationDocData.grossSalesAmt}`,
                        classTag: "SALES", // hardcode to SALES and set liab coverage sales amount to application gross sales
                        industrySegment: "",
                        premOpsILF: "", 
                        classCode: this.industry_code.code,
                        sicCode: `${this.industry_code.sic}`,
                        naicsCode: this.industry_code.attributes.naics,
                        coverages: {
                            // this is required because classTag is set to "SALES"
                            liab: {
                                includeInd: true,
                                sales: `${applicationDocData.grossSalesAmt}`
                            }
                        }
                    }
                ]
            };

            this.injectLocationQuestions(locationObj, location.locationQuestions, location.buildingQuestions);

            locationList.push(locationObj);
        };

        return locationList;
    }

    injectGeneralQuestions(requestJSON, questions) {
        // hydrate the request JSON object with general question data
        // NOTE: Add additional general questions here if more get imported  
        
        // parent questions
        const datcom = [];
        const compf = [];
        const cyber = [];

        const bbopSet = requestJSON.policy.bbopSet;

        for (const [id, answer] of Object.entries(questions)) {
            switch (id) {
                case "eqpbrk":
                    bbopSet.coverages.eqpbrk = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break;
                case "automaticIncr":
                    bbopSet.automaticIncr = this.convertToInteger({id, answer});
                    break;
                case "medicalExpenses":
                    bbopSet.medicalExpenses = answer;
                    break;        
                case "liaDed":
                    bbopSet.liaDed = answer;
                    break;       
                case "fixedPropDeductible":
                    bbopSet.fixedPropDeductible = this.convertToInteger({id, answer});
                    break;  
                case "compf":
                    bbopSet.coverages.compf = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break;
                case "compf.limit":
                    compf.push({id: id.replace("compf.", ""), answer}); 
                    break;
                case "cyber":
                    bbopSet.coverages.cyber = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break; 
                case "cyber.compAttackLimDed":
                case "cyber.networkSecLimDed":
                    cyber.push({id: id.replace("cyber.", ""), answer});
                    break;
                case "datcom":
                    bbopSet.coverages.datcom = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break; 
                case "datcom.limit":
                case "datcom.tier.100000":
                case "datcom.tier.250000":
                case "datcom.tier.500000":
                case "datcom.tier.1000000":
                    datcom.push({id, answer});
                    break;
                default:
                    log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions with no defined case. This could mean we have a new question that needs to be handled in the integration.`);
                    break;
            }
        }

        // hydrate cyber with child question data, if any exist
        if (cyber.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("cyber")) {
                bbopSet.coverages.cyber = {
                    includedInd: true
                };
            }

            cyber.forEach(({id, answer}) => {
                switch (id) {
                    case "compAttackLimDed":
                        bbopSet.coverages.cyber[id] = answer;
                        break;
                    case "networkSecLimDed":
                        bbopSet.coverages.cyber[id] = answer;
                        break;
                    default: 
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for cyber coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.`);
                        break;
                }
            });
        }

        // hydrate compf with child question data, if any exist
        if (compf.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("compf")) {
                bbopSet.coverages.compf = {
                    includeInd: true
                };
            }

            compf.forEach(({id, answer}) => {
                switch (id) {
                    case "limit":
                        bbopSet.coverages.compf[id] = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for compf coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.`);
                        break;
                }
            });
        }

        // hydrate datcom with child question data, if any exist
        if (datcom.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("datcom")) {
                bbopSet.coverages.datcom = {
                    includeInd: true
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

            bbopSet.coverages.datcom.limit = datcomLimit;
            bbopSet.coverages.datcom.tier = datcomTier;
        }
    }

    injectLocationQuestions(location, locationQuestions, buildingQuestions) {
        // hydrate the request JSON object with location question data
        // NOTE: Add additional location questions here if more get imported   

        for (const [id, answer] of Object.entries(locationQuestions)) {
            switch (id) {
                case "WHDeductiblePcnt":
                    location[id] = answer;
                    break;
                case "perilType":
                    location[id] = answer;
                    break;
                case "deductiblePcnt":
                    location[id] = answer;
                    break;
                default: 
                    log.warn(`${logPrefix}Encountered key [${id}] in injectLocationQuestions with no defined case. This could mean we have a new question that needs to be handled in the integration.`);
                    break;
            }
        }

        this.injectBuildingQuestions(location.buildingList, buildingQuestions);
    }

    // NOTE: Currently this has an object pre-seeded into the buildingList because we only work with 1 building by default. When we allow multiple buildings
    //       per location, that can be defined in the quote app, this will need to be refactored to handle that (questions will be tied to specific buildings). 
    injectBuildingQuestions(buildings, buildingQuestions) {
        // hydrate the request JSON object with building question data
        // NOTE: Add additional building questions here if more get imported   

        for (const building of buildings) {
            // parent questions
            const uw = [];
            const pp = [];
            const bld = [];

            for (const [id, answer] of Object.entries(buildingQuestions)) {
                switch (id) {
                    case "construction":
                        building[id] = answer;
                        break;
                    case "sprinklered":
                        building[id] = this.convertToBoolean(answer);
                        break;
                    case "description":
                        building[id] = answer;
                        break;
                    case "numStories":
                        building[id] = this.convertToInteger({id, answer});
                        break;
                    case "occupancy":
                        building[id] = answer;
                        break;
                    case "occupiedSqFt":
                        building[id] = this.convertToInteger({id, answer});
                        break;
                    case "totalSqFt":
                        building[id] = this.convertToInteger({id, answer});
                        break;
                    case "yearBuilt":
                        building[id] = this.convertToInteger({id, answer});
                        break;
                    case "uw.roofUpdates":
                    case "uw.hvacUpdates":
                    case "uw.plumbingUpdates":
                    case "uw.electricalUpdates":
                        uw.push({id: id.replace("uw.", ""), answer});
                        break;
                    case "PP":
                        building.coverages[id] = {
                            includeInd: this.convertToBoolean(answer)
                        };
                        break;
                    case "PP.limit":
                    case "PP.seasonalIncrease":
                    case "PP.valuationInd":
                        pp.push({id: id.replace("PP.", ""), answer});
                        break;
                    case "bld":
                        building.coverages[id] = {
                            includeInd: this.convertToBoolean(answer)
                        };
                        break;
                    case "bld.valuation":
                    case "bld.limit":
                    case "bld.automaticIncr":
                        bld.push({id: id.replace("bld.", ""), answer});
                        break;
                    default: 
                        log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions with no defined case. This could mean we have a new question that needs to be handled in the integration.`);
                        break;
                }
            }

            // injection of uw child question data
            // all building underwrite questions are "year xx was updated" format
            if (uw.length > 0) {
                building.uw = {};
                uw.forEach(({id, answer}) => {
                    switch (id) {
                        case "roofUpdates":
                        case "hvacUpdates":
                        case "plumbingUpdates":
                        case "electricalUpdates":
                            building.uw[id] = this.convertToInteger({id, answer});
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for PP coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.`);
                            break;
                    }
                });
            }

            // injection of PP child question data
            if (pp.length > 0) {
                if (!building.coverages.hasOwnProperty("PP")) {
                    building.coverages.PP = {
                        includeInd: true
                    };
                }

                pp.forEach(({id, answer}) => {
                    switch (id) {
                        case "limit":
                            building.coverages.PP[id] = answer;
                            break;
                        case "seasonalIncrease":
                            building.coverages.PP[id] = answer;
                            break;
                        case "valuationInd":
                            building.coverages.PP[id] = this.convertToBoolean(answer);
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for PP coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.`);
                            break;
                    }
                });
            }

            // injection of bld child question data
            if (bld.length > 0) {
                if (!building.coverages.hasOwnProperty("bld")) {
                    building.coverages.bld = {
                        includeInd: true
                    };
                }

                bld.forEach(({id, answer}) => {
                    switch (id) {
                        case "valuation":
                            building.coverages.bld[id] = answer;
                            break;
                        case "limit":
                            building.coverages.bld[id] = this.convertToInteger({id, answer});
                            break;
                        default: 
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for bld coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.`);
                            break;                   
                    }
                });
            }
        }
    }

    convertToBoolean(value) {
        if (typeof value === "string") {
            if (value.toLowerCase() === "yes" || value.toLowerCase() === "no") {
                return value.toLowerCase() === "yes";
            }
        }

        // add more special conversions here as they come up...

        log.warn(`No match was found, unable to convert value: ${value} to boolean. Returning null.`);
        return null;
    }

    convertToInteger({id, answer}) {
        let parsedAnswer = parseInt(answer);

        if (isNaN(parsedAnswer)) {
            log.warn(`${logPrefix}Couldn't parse "${answer}" for question property "${id}". Result was NaN, leaving as-is.`);
            parsedAnswer = question.answerValue;
        }

        return parsedAnswer;
    }
}