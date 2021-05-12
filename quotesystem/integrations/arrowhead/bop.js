/* eslint-disable object-curly-spacing */
/* eslint-disable radix */
/* eslint-disable no-loop-func */
/* eslint-disable object-property-newline */
/* eslint-disable object-shorthand */
/* eslint-disable function-paren-newline */
/* eslint-disable no-trailing-spaces */
/* eslint-disable object-curly-newline */
/* eslint-disable brace-style */
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
const { convertToDollarFormat } = global.requireShared('./helpers/stringFunctions.js');

// TODO: Update to toggle between test/prod 
const host = 'https://stag-api.nationalprograms.io';
const path = '/Quote/v0.2-beta/CreateQuote';
let logPrefix = "";
const MAX_RETRY_ATTEMPTS = 10;

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

        logPrefix = `Arrowhead Wendys (Appid: ${applicationDocData.applicationId}): `;

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
                effective: moment(BOPPolicy.effectiveDate).format("YYYYMMDD"), 
                expiration: moment(BOPPolicy.effectiveDate).add(1, "year").format("YYYYMMDD"), 
                commonSet: {
                    stateOfDomicile: applicationDocData.mailingState,
                    naicsCode: this.industry_code.attributes.naics,
                    classCode: this.industry_code.code, 
                    yearBizStarted: `${moment(applicationDocData.founded).year()}`,
                    sicCode: this.industry_code.attributes.sic, 
                    state: applicationDocData.mailingState,
                    effective: moment(BOPPolicy.effectiveDate).format("YYYYMMDD"), 
                    expiration: moment(BOPPolicy.effectiveDate).add(1, "year").format("YYYYMMDD"), 
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

        // TODO: Update question sheet, make this building-level question, not general question...
        // If we have computer fraud general coverage, we inject it into every building-level coverage object
        const generalCoverages = requestJSON.policy.bbopSet.coverages;
        if (generalCoverages.hasOwnProperty('compf')) {
            requestJSON.policy.bbopSet.locationList.forEach(location => {
                location.buildingList.forEach(building => {
                    building.coverages.compf = generalCoverages.compf;
                });
            });

            delete generalCoverages.compf;
        }

        // send the JSON request

        // log.info("=================== QUOTE REQUEST ===================");
        // log.info(`${logPrefix}\n${JSON.stringify(requestJSON, null, 4)}`);
        // log.info("=================== QUOTE REQUEST ===================");
        this.log += `--------======= Sending to Arrowhead =======--------<br><br>`;
        this.log += `<b>Request started at ${moment().utc().toISOString()}</b><br><br>`;
        this.log += `URL: ${host}${path}<br><br>`;
        this.log += `<pre>${JSON.stringify(requestJSON, null, 2)}</pre><br><br>`;
        this.log += `--------======= End =======--------<br><br>`;

        let result = null;
        const headers = {
            "Cache-Control": "no-cache",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Ocp-Apim-Subscription-Key": "2536d916e6124279a693d11fabc07aa9" // this is Scott's Primary Key
        }

        let calloutFailure = true;
        let retryAttempts = 0;
        while (calloutFailure) {
            try {
                // There is a problem with sending this request via this.send_json_request that should be resolved so we can take
                // advantage of the logging done implicitly by this method...
                // result = await this.send_json_request(host, path, JSON.stringify(requestJSON), headers, "POST");
                result = await axios.post(`${host}${path}`, JSON.stringify(requestJSON), {headers: headers});
            } catch(e) {
                const errorMessage = `${logPrefix}Error sending request: ${e}. `;
                log.error(errorMessage + __location);
                return this.client_error(errorMessage, __location);
            }

            if (!result.data.hasOwnProperty("error") || result.data.error.code !== "CALLOUT_FAILURE") {
                calloutFailure = false;
            } else {
                retryAttempts++;

                if (retryAttempts < MAX_RETRY_ATTEMPTS) {
                    log.warn(`${logPrefix}Recieved a [500] CALLOUT_FAILURE, retrying quote request. Attempts: ${retryAttempts}/${MAX_RETRY_ATTEMPTS}`);
                } else {
                    log.error(`${logPrefix}Recieved a [500] CALLOUT_FAILURE, reached max retry attempts.`);
                    break;
                }
            }
        }

        // parse the error / response
        if (result.data.hasOwnProperty("error")) {
            // log.info("=================== QUOTE ERROR ===================");
            // log.info(`${logPrefix}\n${JSON.stringify(result.data, null, 4)}`);
            // log.info("=================== QUOTE ERROR ===================");
            const error = result.data.error;

            this.reasons.push(`Arrowhead API Error: ${result.data}`);
            this.log += `--------======= Arrowhead Request Error =======--------<br><br>`;
            this.log += JSON.stringify(error, null, 2);

            let errorMessage = "";

            if (error.statusCode && error.code) {
                errorMessage += `[${error.statusCode}] ${error.code}: `;
            } else {
                errorMessage += "An error occurred, please review the logs. ";
                this.log += errorMessage;
                this.log += `--------======= End =======--------<br><br>`;
                return this.client_error(errorMessage, __location);
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

            this.log += errorMessage;
            this.log += `--------======= End =======--------<br><br>`;
            log.error(errorMessage, __location);
            return this.client_error(errorMessage, __location, additionalDetails.length > 0 ? additionalDetails : null);
        }

        // handle successful quote
        // log.info("=================== QUOTE RESULT ===================");
        // log.info(`${logPrefix}\n${JSON.stringify(result.data, null, 4)}`);
        // log.info("=================== QUOTE RESULT ===================");
        this.log += `--------======= ${logPrefix}  =======--------<br><br>`;
        this.log += `<pre>${JSON.stringify(result.data, null, 2)}</pre><br><br>`;
        this.log += `--------======= End =======--------<br><br>`;

        // if a decision was provided, a quote likely wasn't
        if (result.data.hasOwnProperty("decision")) {
            const decision = result.data.decision;
            const declineMessage = `Arrowhead application did not quote. Decision: "${decision}. "`;
            const extraReasons = [];
            if (result.data.hasOwnProperty("uwResults")) {
                result.data.uwResults.forEach(reason => {
                    extraReasons.push(reason.trim());
                });
            }

            return this.client_declined(declineMessage, extraReasons);
        }

        let quoteNumber = null;
        let premium = null;
        const quoteLimits = {}; 
        const quoteLetter = null; // not provided by Arrowhead
        const quoteMIMEType = null; // not provided by Arrowhead
        let policyStatus = null; // not provided by Arrowhead, either rated (quoted) or failed (error)
        const quoteCoverages = [];
        let coverageSort = 0;

        const res = result.data;

        // try to parse the message status for the quote from the response
        try {
            policyStatus = res.coreCommRatedVs.acord.insuranceSvcRsList[0].policyQuoteInqRs.additionalQuotedScenarioList[0].msgStatus.msgStatusCd;
        } catch (e) {
            log.warn(`${logPrefix}Policy status not provided, or the result structure has changed.` + __location);
        }

        // try to parse out quote number from response
        try {
            quoteNumber = res.coreCommVs.policy.quoteId;
        } catch (e) {
            log.warn(`${logPrefix}Quote number not provided, or the result structure has changed.` + __location);
        }

        // try to parse out the premium from the reponse
        try {
            // or should it be -> res.coreCommRatedVs.acord.insuranceSvcRsList[0].policyQuoteInqRs.additionalQuotedScenarioList[0].spxPremiumAmt ???
            premium = res.coreCommRatedVs.acord.insuranceSvcRsList[0].policyQuoteInqRs.additionalQuotedScenarioList[0].instecResponse.rc2.bbopResponse.spxPremiumAmt;
        } catch (e) {
            log.warn(`${logPrefix}Premium not provided, or the result structure has changed.` + __location);
        }

        // try to parse out payment information from the response
        try {
        // NOTE: This will probably change, and should be added to the client_* functions, but for now, simply storing as the following:
        /**
         * [{
         *      depositAmt: "0",
         *      downPayBop: "0",
         *      fullTermAmt: "0",
         *      numPayments: "0",
         *      paymentPlanCd: "FPDB",
         *      installmentAmt: "0.00"
         * },
         * ...
         * ]
         */
        // NOTE: No schema exists for this.paymentPlan, so leaving it as noted above for now
        this.insurerPaymentPlans = [];
            const paymentOptions = res.coreCommRatedVs.acord.insuranceSvcRsList[0].policyQuoteInqRs.additionalQuotedScenarioList[0].spxPaymentOptions;

            paymentOptions.forEach(paymentOption => {
                const paymentPlan = {};

                Object.keys(paymentOption).forEach(property => {
                    switch (property) {
                        case "depositAmt":
                        case "downPayBop":
                        case "fullTermAmt":
                            paymentPlan[property] = convertToDollarFormat(paymentOption[property]);
                            break;
                        case "numPayments":
                        case "paymentPlanCd":
                            paymentPlan[property] = paymentOption[property];
                            break;
                        case "installmentInfo":
                            paymentPlan.installmentAmt = convertToDollarFormat(paymentOption[property].installmentAmt);
                            break;
                        default:
                            break;
                    }
                });

                this.insurerPaymentPlans.push(paymentPlan);
            });
        } catch (e) {
            log.warn(`${logPrefix}Payment Options not provided, or the result structure has changed.` + __location);
        }

        // TODO: Arrowhead sends coverage information, however it is location/building specific, and they do not provide details on the 
        //       location/building those coverages apply to. Eventually, we should build out this response parsing further to parse out
        //       the coverage data they provide, instead of just providing the defaulted coverages below. 

        // 1 Employers Liability Per Occurrence
        // 2 Employers Liability Disease Per Employee
        // 3 Employers Liability Disease Policy Limit
        // 4 Each Occurrence
        // 5 Damage to Rented Premises
        // 6 Medical Expense
        // 7 Personal & Advertising Injury
        // 8 General Aggregate
        // 9 Products & Completed Operations
        // 10 Business Personal Property
        // 11 Aggregate

        // NOTE: We currently do not parse values from their response. Instead, we default to the following:
        // Each Occurrence
        quoteCoverages.push({
            description: `Each Occurrence`,
            value: convertToDollarFormat(`1000000`, true),
            sort: coverageSort++,
            category: "Liability Coverages"
        });

        // Aggregate
        quoteCoverages.push({
            description: `Aggregate`,
            value: convertToDollarFormat(`2000000`, true),
            sort: coverageSort++,
            category: "Liability Coverages"
        });

        // Products & Completed Operations
        quoteCoverages.push({
            description: `Products & Completed Operations`,
            value: convertToDollarFormat(`2000000`, true),
            sort: coverageSort++,
            category: "Liability Coverages"
        });

        // log any warnings they provided
        if (res.warnings && res.warnings.length > 0) {
            log.warn(`${logPrefix}Arrowhead reported the following warnings for this quote request:`);
            res.warnings.forEach((warning, i) => {
                log.warn(`${i}: ${warning}`);
            });
        }

        // provide their Agent Exchange portal link as a quote link on the quote
        if (res.url && res.url.length > 0) {
            this.quoteLink = res.url;
        }

        if (policyStatus === "Rated") {
            return this.client_quoted(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType, quoteCoverages);
        } else if (policyStatus !== "Rated" && premium) {
            return this.client_referred(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType, quoteCoverages);
        } else if (policyStatus && !premium) {
            return this.client_error(`${logPrefix}Quote response from carrier did not provide a premium.`, __location);
        } else {
            return this.client_error(`${logPrefix}Quote response from carrier did not provide a policy status.`, __location);
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////
    // HELPER FUNCTIONS
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////

    async getLocationList() {
        const applicationDocData = this.app.applicationDocData;
        const locationList = [];
        
        for (const location of applicationDocData.locations) {
            let smartyStreetsResponse = await smartystreetSvc.checkAddress(
                applicationDocData.mailingAddress,
                applicationDocData.mailingCity,
                applicationDocData.mailingState,
                applicationDocData.mailingZipcode
            );

            // If the response has an error property, or doesn't have addressInformation.county_name, we can't determine a county
            if (smartyStreetsResponse.hasOwnProperty("error") ||
                !smartyStreetsResponse.hasOwnProperty("addressInformation") ||
                !smartyStreetsResponse.addressInformation.hasOwnProperty("county_name")) {
                let errorMessage = "";
                if (smartyStreetsResponse.hasOwnProperty("error")) {
                    errorMessage += `${smartyStreetsResponse.error}: ${smartyStreetsResponse.errorReason}. Due to this, we are unable to look up County information.`;
                } else {
                    errorMessage += `SmartyStreets could not determine the county for address: ${this.app.business.locations[0].address}, ${this.app.business.locations[0].city}, ${this.app.business.locations[0].state_abbr}, ${this.app.business.locations[0].zip}<br>`;
                }

                log.error(`${logPrefix}${errorMessage}`);
                smartyStreetsResponse = null;
            }

            const locationObj = {
                countyName: smartyStreetsResponse ? smartyStreetsResponse.addressInformation.county_name : ``,
                city: location.city,
                classCodes: this.industry_code.code,
                address: applicationDocData.mailingAddress,
                rawProtectionClass: "", // hardset value expected by Arrowhead
                state: location.state,
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

            this.injectLocationQuestions(locationObj, location.locationQuestions);
            this.injectBuildingQuestions(location, locationObj.buildingList, location.buildingQuestions);

            locationList.push(locationObj);
        }

        return locationList;
    }

    injectGeneralQuestions(requestJSON, questions) {
        // hydrate the request JSON object with general question data
        // NOTE: Add additional general questions here if more get imported  
        
        // parent questions
        const datcom = [];
        const cyber = [];

        const bbopSet = requestJSON.policy.bbopSet;

        for (const [id, answer] of Object.entries(questions)) {
            switch (id) {
                case "eqpbrk":
                    bbopSet.coverages.eqpbrk = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break;
                case "bitime":
                    bbopSet.coverages.bitime = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break;
                case "automaticIncr":
                    bbopSet.automaticIncr = this.convertToInteger(answer);
                    break;
                case "medicalExpenses":
                    bbopSet.medicalExpenses = answer;
                    break;        
                case "liaDed":
                    bbopSet.liaDed = answer;
                    break;       
                case "fixedPropDeductible":
                    bbopSet.fixedPropDeductible = this.convertToInteger(answer);
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

    injectLocationQuestions(location, locationQuestions) {
        // NOTE: Currently, none of these location questions are used, but keeping in case we need to introduce new location specific questions

        // hydrate the request JSON object with location question data
        // NOTE: Add additional location questions here if more get imported   
        for (const [id, answer] of Object.entries(locationQuestions)) {
            switch (id) {
                case "WHDeductiblePcnt": // Not asked for Wendys
                    location[id] = answer;
                    break;
                case "perilType": // Not asked for Wendys
                    location[id] = answer;
                    break;
                case "deductiblePcnt": // Not asked for Wendys
                    location[id] = answer;
                    break;
                default: 
                    log.warn(`${logPrefix}Encountered key [${id}] in injectLocationQuestions with no defined case. This could mean we have a new question that needs to be handled in the integration.`);
                    break;
            }
        }
    }

    // NOTE: Currently this has an object pre-seeded into the buildingList because we only work with 1 building by default. When we allow multiple buildings
    //       per location, that can be defined in the quote app, this will need to be refactored to handle that (questions will be tied to specific buildings). 
    injectBuildingQuestions(location, buildings, buildingQuestions) {
        // hydrate the request JSON object with building question data
        // NOTE: Add additional building questions here if more get imported   
        for (const building of buildings) {
            // parent questions
            const uw = [];
            const osigns = [];
            const spoil = [];
            const compf = [];

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
                        building[id] = this.convertToInteger(answer);
                        break;
                    case "occupancy":
                        building[id] = answer;
                        break;
                    case "occupiedSqFt":
                        building[id] = this.convertToInteger(answer);
                        break;
                    case "yearBuilt":
                        building[id] = this.convertToInteger(answer);
                        break;
                    case "compf":
                        building.coverages[id] = {
                            includeInd: this.convertToBoolean(answer)
                        };
                        break;
                    case "compf.limit":
                        compf.push({id: id.replace("compf.", ""), answer}); 
                        break;
                    case "uw.roofUpdates": // child
                    case "uw.hvacUpdates": // child
                    case "uw.plumbingUpdates": // child
                    case "uw.electricalUpdates": // child
                        uw.push({id: id.replace("uw.", ""), answer});
                        break;
                    case "osigns":
                        building.coverages[id] = {
                            includeInd: this.convertToBoolean(answer)
                        };
                        break;
                    case "osigns.limit": // child
                        osigns.push({id: id.replace("osigns.", ""), answer});
                        break;
                    case "spoil":
                        building.coverages[id] = {
                            includeInd: this.convertToBoolean(answer)
                        }; 
                        break;
                    case "spoil.spoilageDescription": // child
                    case "spoil.spoilageLimit": // child
                    case "spoil.powerOutInd": // child
                    case "spoil.refrigerationInd": // child
                    case "spoil.breakContInd": // child
                        spoil.push({id: id.replace("spoil.", ""), answer});
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
                            building.uw[id] = this.convertToInteger(answer);
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for PP coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.`);
                            break;
                    }
                });
            }    

            if (osigns.length > 0) {
                if (!building.coverages.hasOwnProperty("osigns")) {
                    building.coverages.osigns = {
                        includeInd: true
                    };
                }

                osigns.forEach(({id, answer}) => {
                    switch (id) {
                        case "limit":
                            building.coverages.osigns[id] = this.removeCharacters(['$', ','], answer);
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for osigns coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.`);
                            break;
                        }
                });
            }

            if (spoil.length > 0) {
                if (!building.coverages.hasOwnProperty("spoil")) {
                    building.coverages.spoil = {
                        includeInd: true
                    };
                }

                spoil.forEach(({id, answer}) => {
                    switch (id) {
                        case "spoilageDescription":
                            building.coverages.spoil[id] = answer;
                            break;
                        case "spoilageLimit":
                            building.coverages.spoil[id] = this.convertToInteger(answer);
                            break;
                        case "powerOutInd": 
                            building.coverages.spoil[id] = this.convertToBoolean(answer);
                            break;
                        case "refrigerationInd": 
                            building.coverages.spoil[id] = this.convertToBoolean(answer);
                            break;
                        case "breakContInd":
                            building.coverages.spoil[id] = this.convertToBoolean(answer);
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for spoil coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.`);
                            break;
                    }
                });
            }

            // hydrate compf with child question data, if any exist
            if (compf.length > 0) {
                if (!building.coverages.hasOwnProperty("compf")) {
                    building.coverages.compf = {
                        includeInd: true
                    };
                }

                compf.forEach(({id, answer}) => {
                    switch (id) {
                        case "limit":
                            building.coverages.compf[id] = answer;
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for compf coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.`);
                            break;
                    }
                });
            }

            // This section includes deprecated questions that can be answered implicitly now
            // Square Feet (total)
            building.totalSqFt = this.convertToInteger(location.square_footage);

            // Building Limit            
            building.coverages.PP = {
                includeInd: true,
                seasonalIncrease: "25",
                valuationInd: false,
                limit: `${location.buildingLimit}`
            };

            // Business Personal Property Limit            
            building.coverages.bld = {
                includeInd: true,
                valuation: "Replacement Cost",
                limit: location.businessPersonalPropertyLimit
            };
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

    convertToInteger(answer) {
        let parsedAnswer = parseInt(answer);

        if (isNaN(parsedAnswer)) {
            log.warn(`${logPrefix}Couldn't parse "${answer}" into an integer, Result was NaN. Leaving as-is.`);
            parsedAnswer = answer;
        }

        return parsedAnswer;
    }

    removeCharacters(characters, value) {
        characters.forEach(c => {
            value = value.replace(c, "");
        });

        return value;
    }
}