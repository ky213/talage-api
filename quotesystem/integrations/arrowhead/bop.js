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
const fs = require('fs'); // zy debug remove

let logPrefix = "";
const MAX_RETRY_ATTEMPTS = 10;

module.exports = class ArrowheadBOP extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.usePolciyBOPindustryCode = true;
        this.requiresInsurerIndustryCodes = true;
    }

    /**
	 * Requests a quote from Arrowhead and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
	async _insurer_quote() {
        // Determine which URL to use
        let host = null; 
        let path = null; 
        if (this.insurer.useSandbox) {
            host = 'https://stag-api.nationalprograms.io';
            path = '/Quote/v0.2-beta/CreateQuote';
        }
        else {
            host = 'bad';
            path = 'bad';
        }

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

        logPrefix = `Arrowhead (Appid: ${applicationDocData.applicationId}): `;

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
                DBA: applicationDocData.dba,
                address: {
                    zip: applicationDocData.mailingZipcode,
                    address: applicationDocData.mailingAddress,
                    city: applicationDocData.mailingCity,
                    state: applicationDocData.mailingState
                },
                instype: supportedEntityTypes.includes(applicationDocData.entityType) ? applicationDocData.entityType : "Other",
                companyName: applicationDocData.businessName,
                wphone: `${primaryContact.phone.substring(0, 3)}-${primaryContact.phone.substring(3,6)}-${primaryContact.phone.substring(6)}`,
                email: primaryContact.email
            },
            controlSet: {
                leadid: this.generate_uuid(),
                prodcode: this.app.agencyLocation.insurers[this.insurer.id].agency_id,
                prodsubcode: this.app.agencyLocation.insurers[this.insurer.id].agent_id
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
                    classCode: this.insurerIndustryCode.code,
                    naicsCode: this.industry_code.naics,
                    yearBizStarted: `${moment(applicationDocData.founded).year()}`,
                    sicCode: this.industry_code.sic, 
                    state: applicationDocData.mailingState,
                    effective: moment(BOPPolicy.effectiveDate).format("YYYYMMDD"), 
                    expiration: moment(BOPPolicy.effectiveDate).add(1, "year").format("YYYYMMDD"), 
                    quoteType: "NB"
                },
                bbopSet: {
                    classCodes: this.insurerIndustryCode.code,
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
                            includeInd: Boolean(BOPPolicy.addTerrorismCoverage)
                        }
                    }
                }
            }
        };

        try {
            this.injectGeneralQuestions(requestJSON, questions);
        } catch (e) {
            return this.client_error(`There was an issue adding general questions to the application`, __location, e);
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
        fs.writeFileSync('/Users/talageuser/Desktop/arrowhead-bop/app.json', JSON.stringify(this.app, null, 4)); // zy debug remove
        fs.writeFileSync('/Users/talageuser/Desktop/arrowhead-bop/appDocData.json', JSON.stringify(applicationDocData, null, 4)); // zy debug remove
        fs.writeFileSync('/Users/talageuser/Desktop/arrowhead-bop/request.json', JSON.stringify(requestJSON, null, 4)); // zy debug remove
        fs.writeFileSync('/Users/talageuser/Desktop/arrowhead-bop/industryCode.json', JSON.stringify(this.industry_code, null, 4)); // zy debug remove

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
                fs.writeFileSync('/Users/talageuser/Desktop/arrowhead-bop/response.json', JSON.stringify(result.data, null, 4)); // zy debug remove
            } catch(e) {
                const errorMessage = `There was an error sending the application request: ${e}`;
                log.error(logPrefix + errorMessage + __location);
                return this.client_error(errorMessage, __location);
            }

            if (!result.data.hasOwnProperty("error") || result.data.error.code !== "CALLOUT_FAILURE") {
                calloutFailure = false;
            } else {
                retryAttempts++;

                if (retryAttempts < MAX_RETRY_ATTEMPTS) {
                    log.warn(`${logPrefix}Recieved a [500] CALLOUT_FAILURE, retrying quote request. Attempts: ${retryAttempts}/${MAX_RETRY_ATTEMPTS}` + __location);
                } else {
                    log.error(`${logPrefix}Recieved a [500] CALLOUT_FAILURE, reached max retry attempts.` + __location);
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
        this.log += `--------======= ${logPrefix} =======--------<br><br>`;
        this.log += `<pre>${JSON.stringify(result.data, null, 2)}</pre><br><br>`;
        this.log += `--------======= End =======--------<br><br>`;

        // if a decision was provided, a quote likely wasn't
        if (result.data.hasOwnProperty("decision")) {
            const decision = result.data.decision;
            let decisionMessage = `Decision: "${decision}". \n`;
            if (result.data.hasOwnProperty("uwResults")) {
                result.data.uwResults.forEach(reason => {
                    decisionMessage += `${reason.trim()}.\n`;
                });
            }

            this.log += `--------======= ${logPrefix} =======--------<br><br>`;
            this.log += `<pre>${decisionMessage}</pre><br><br>`;
            this.log += `--------======= End =======--------<br><br>`;
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
            return this.client_error(`Quote response from carrier did not provide a premium.`, __location);
        } else {
            return this.client_error(`Quote response from carrier did not provide a policy status.`, __location);
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

            // Get the total payroll for the location
            let liabPayroll = 0;
            for (const activityPayroll of location.activityPayrollList) {
                liabPayroll += activityPayroll.employeeTypeList.reduce((payroll, employeeType) => payroll + employeeType.employeeTypePayroll, 0);
            }

            fs.writeFileSync('/Users/talageuser/Desktop/arrowhead-bop/insurerIndustryCode.json', JSON.stringify(this.insurerIndustryCode, null, 4)); // zy debug remove

            const locationObj = {
                countyName: smartyStreetsResponse ? smartyStreetsResponse.addressInformation.county_name : ``,
                city: location.city,
                classCodes: this.insurerIndustryCode.code,
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
                        classCode: this.insurerIndustryCode.code,
                        sicCode: `${this.industry_code.sic}`,
                        naicsCode: this.industry_code.naics,
                        yearBuilt: location.yearBuilt,
                        uw: {
                            roofUpdates: location.bop.roofingImprovementYear,
                            hvacUpdates: location.bop.heatingImprovementYear,
                            plumbingUpdates: location.bop.plumbingImprovementYear,
                            electricalUpdates: location.bop.wiringImprovementYear
                        },
                        sprinklered: location.bop.sprinklerEquipped ? location.bop.sprinklerEquipped : false, // zy debug fix, we shoudl always have "sprinklered" on the application right?
                        numStories: location.numStories, 
                        coverages: {
                            // this is required because classTag is set to "SALES"
                            liab: {
                                includeInd: true,
                                payroll: `${liabPayroll}`,
                                sales: `${applicationDocData.grossSalesAmt}`
                            }
                        }
                    }
                ]
            };

            if (location.state === 'NC') {
                locationObj.territoryNC = ''; // TODO Options for NC include 003, 005, and 006. Figure out how to determine which one
            }

            this.injectLocationQuestions(locationObj, location.locationQuestions);
            this.injectBuildingQuestions(location, locationObj.buildingList, location.buildingQuestions);

            locationList.push(locationObj);
        }

        return locationList;
    }

    injectGeneralQuestions(requestJSON, questions) {
        // hydrate the request JSON object with general question data
        // NOTE: Add additional general questions here if more get imported  

        const applicationDocData = this.app.applicationDocData;
        
        // parent questions
        const datcom = [];
        const cyber = [];
        const edol = [];
        const mold = [];
        const dentistEquip = [];
        const schedBookFloater = [];
        const nonOwnedAutoLiab = [];
        const liquorLiab = [];
        const empLiab = [];
        const suppPropDmg = [];
        const pharmLiab = [];
        const compFraud = [];

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
                case "emplDishonesty":
                    bbopSet.coverages.edol = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break;
                case "emplDishonesty.limit":
                    edol.push({id: "limit", answer});
                    break;
                case "emplDishonesty.benefitPlanName":
                    edol.push({id: "benefitPlanName", answer});
                    break;
                case "removeITVProvision":
                    bbopSet.removeITVProvision = this.convertToBoolean(answer);
                    break;
                case "stopGapLimit":
                    // Limit applies to up to four separate states if those states are present on the application
                    if (applicationDocData.locations.find(loc => loc.state === 'WA')) {
                        bbopSet.coverages.stopGapWA = {limit: answer};
                    }
                    if (applicationDocData.locations.find(loc => loc.state === 'WY')) {
                        bbopSet.coverages.stopGapWY = {limit: answer};
                    }
                    if (applicationDocData.locations.find(loc => loc.state === 'ND')) {
                        bbopSet.coverages.stopGapND = {limit: answer};
                    }
                    if (applicationDocData.locations.find(loc => loc.state === 'OH')) {
                        bbopSet.coverages.stopGapOH = {limit: answer};
                    }
                    break;
                case "moldIncl":
                    bbopSet.coverages.mold = {
                        IncludeInd: this.convertToBoolean(answer)
                    };
                    break;
                case "moldIncl.stateException":
                    mold.push({id: "GeorgiaStateException", answer: this.convertToBoolean(answer)});
                    break;
                case "dentistEuipFloater":
                    bbopSet.coverages.dentistEquip = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break;
                case "dentistEuipFloater.limit":
                    dentistEquip.push({id: "limit", answer});
                    break;
                case "schedBookFloater":
                    bbopSet.coverages.schdbk = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break;
                case "schedBookFloater.limit":
                    schedBookFloater.push({id: "limit", answer});
                    break;
                case "nonOwnedAutoLiab":
                    // This question populates both nonown and hired auto in arrowhead request
                    bbopSet.coverages.nonown = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    bbopSet.coverages.hireda = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break;
                case "nonOwnedAutoLiab.exposure":
                    nonOwnedAutoLiab.push({id: "exposure", answer});
                    break;
                case "liquorLiab":
                    bbopSet.coverages.liqLia = {
                        includeInd: answer === "Liquor Liability Coverage"
                    };
                    break;
                case "liquorLiab.typeOfSales":
                    liquorLiab.push({id: "type", answer})
                    break;
                case "liquorLiab.limit":
                    liquorLiab.push({id: "limit", answer})
                    break;
                case "liquorLiab.totalSales":
                    liquorLiab.push({id: "salesTotal", answer: answer});
                    break;
                case "liquorLiab.liquorSales":
                    liquorLiab.push({id: "salesLiquor", answer: answer});
                    break;
                case "liquorLiab.premOp":
                    liquorLiab.push({id: "premOp", answer})
                    break;
                case "empLiab":
                    bbopSet.coverages.emplia = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break;
                case "empLiab.limit":
                    empLiab.push({id: "limit", answer});
                    break;
                case "empLiab.defenseLimit":
                    empLiab.push({id: "defenseLimit", answer});
                    break;
                case "empLiab.indemnityLimit":
                    empLiab.push({id: "indemnityLimit", answer});
                    break;
                case "empLiab.deductible":
                    empLiab.push({id: "ded", answer});
                    break;
                case "empLiab.retroactiveDate":
                    empLiab.push({id: "retroDate", answer});
                    break;
                case "empLiab.priorActs":
                    empLiab.push({id: "priorActs", answer});
                    break;
                case "empLiab.thirdPartyCoverage":
                    empLiab.push({id: "thirdPartyCoverage", answer: this.convertToBoolean(answer)});
                    break;
                case "snowPlowCoverage":
                        bbopSet.coverages.snowco = {includeInd: this.convertToBoolean(answer)};
                    break;
                case "fellowEmployeeCoverage":
                        bbopSet.coverages.fellow = {includeInd: this.convertToBoolean(answer)};
                    break;
                case "suppPropertyDmg":
                        bbopSet.coverages.suppr = {includeInd: this.convertToBoolean(answer)};
                    break;
                case "suppPropertyDmg.limit": 
                        suppPropDmg.push({id: "limit", answer})
                    break;
                case "contractorsAdditionalInsured":
                        bbopSet.coverages.conadd = {IncludeInd: this.convertToBoolean(answer)};
                    break;
                case "waiverTOR":
                        bbopSet.coverages.waiver = {includeInd: this.convertToBoolean(answer)};
                    break;
                case "pharmacistLiab":
                        bbopSet.coverages.pharm = {includeInd: this.convertToBoolean(answer)};
                    break;
                case "pharmacistLiab.coverageOptions":
                    pharmLiab.push({id: "option", answer});
                    break;
                case "pharmacistLiab.grossSales":
                    pharmLiab.push({id: "grossSales", answer: this.convertToInteger(answer)});
                    break;
                case "pharmacistLiab.limit":
                    pharmLiab.push({id: "ilLimit", answer});
                    break;
                case "compFraud":
                    bbopSet.coverages.compf = {includeInd: this.convertToBoolean(answer)};
                    break;
                case "compFraud.limit":
                    compFraud.push({id: "limit", answer});
                    break;
                default:
                    log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions with no defined case. This could mean we have a new question that needs to be handled in the integration. ${__location}`);
                    break;
            }
        }
        // hydrate Computer Fraud coverage with child question data, if any exist
        if (compFraud.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("compf")) {
                bbopSet.coverages.compf = {
                    includeInd: true
                }
            }
            compFraud.forEach(({id, answer}) => {
                switch (id) {
                    case "limit":
                        bbopSet.coverages.compf[id] = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for Computer Fraud with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            });
        }

        // hydrate Pharmacist Liability coverage with child question data, if any exist
        if (pharmLiab.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("pharm")) {
                bbopSet.coverages.pharm = {
                    includeInd: true
                }
            }
            pharmLiab.forEach(({id, answer}) => {
                switch (id) {
                    case "option":
                    case "grossSales":
                    case "ilLimit":
                        bbopSet.coverages.pharm[id] = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for Pharmacist Liability coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            });
        }

        // hydrate Supplemental Property Damage coverage with child question data, if any exist
        if (suppPropDmg.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("suppr")) {
                bbopSet.coverages.suppr = {
                    includeInd: true
                }
            }
            suppPropDmg.forEach(({id, answer}) => {
                switch (id) {
                    case "limit":
                        bbopSet.coverages.suppr[id] = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for Supplemental Property Damage coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            });
        }

        // hydrate Employment Related Practices Liability coverage with child question data, if any exist
        if (empLiab.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("emplia")) {
                bbopSet.coverages.emplia = {
                    includeInd: true
                }
            }
            empLiab.forEach(({id, answer}) => {
                switch (id) {
                    case "limit":
                    case "defenseLimit":
                    case "indemnityLimit":
                    case "ded":
                    case "retroDate":
                    case "priorActs":
                    case "thirdPartyCoverage":
                        bbopSet.coverages.emplia[id] = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for Employment Related Practices Liability coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            });
            bbopSet.coverages.emplia.numEmp = applicationDocData.locations.reduce((acc, location) => acc + location.full_time_employees, 0);
            if (applicationDocData.primaryState !== "MN") {
                bbopSet.coverages.emplia.numNonFTEmp = applicationDocData.locations.reduce((acc, location) => acc + location.part_time_employees, 0);
            }
            bbopSet.coverages.emplia.sic = this.industry_code.sic;
        }

        // hydrate Liquor Liability coverage with child question data, if any exist
        if (liquorLiab.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("liqLia")) {
                bbopSet.coverages.liqLia = {
                    includeInd: true
                }
            }
            liquorLiab.forEach(({id, answer}) => {
                switch (id) {
                    case "type":
                    case "limit":
                    case "salesTotal":
                    case "salesLiquor":
                    case "premOp":
                        bbopSet.coverages.liqLia[id] = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for Liquor Liability coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            });
        }

        // hydrate non-owned auto liability coverage with child question data, if any exist
        if (nonOwnedAutoLiab.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("nonown")) {
                bbopSet.coverages.nonown = {
                    includeInd: true
                }
            }
            nonOwnedAutoLiab.forEach(({id, answer}) => {
                switch (id) {
                    case "exposure":
                        bbopSet.coverages.nonown[id] = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for Non Owned Auto Liability coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            });
        }

        // hydrate scheduled book and manuscript floater coverage with child question data, if any exist
        if (schedBookFloater.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("schdbk")) {
                bbopSet.coverages.schdbk = {
                    includeInd: true
                }
            }
            schedBookFloater.forEach(({id, answer}) => {
                switch (id) {
                    case "limit":
                        bbopSet.coverages.schdbk[id] = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for Scheduled Book and Manuscript Floater coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            });
        }

        // hydrate dentist/physician equipment coverage with child question data, if any exist
        if (dentistEquip.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("dentistEquip")) {
                bbopSet.coverages.dentistEquip = {
                    IncludeInd: true
                }
            }
            dentistEquip.forEach(({id, answer}) => {
                switch (id) {
                    case "limit":
                        bbopSet.coverages.dentistEquip[id] = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for Dentist/Physician Equipment coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            });
        }

        // hydrate mold coverage with child question data, if any exist
        if (mold.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("mold")) {
                bbopSet.coverages.mold = {
                    IncludeInd: true
                }
            }
            mold.forEach(({id, answer}) => {
                switch (id) {
                    case "GeorgiaStateException":
                        bbopSet.coverages.mold[id] = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for mold coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            });
        }

        // hydrate employee dishonesty with child question data, if any exist
        if (edol.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("edol")) {
                bbopSet.coverages.edol = {
                    includeInd: true
                }
            }
            edol.forEach(({id, answer}) => {
                switch (id) {
                    case "limit":
                    case "benefitPlanName":
                        bbopSet.coverages.edol[id] = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for employee dishonesty coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            })
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
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for cyber coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
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
                    log.warn(`${logPrefix}Encountered key [${id}] in injectLocationQuestions with no defined case. This could mean we have a new question that needs to be handled in the integration. ${__location}`);
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
            const osigns = [];
            const spoil = [];
            const compf = [];
            const windstormFeatures = [];
            const mine = [];
            const addLivingExpense = [];
            const actReceivable = [];
            const condoOwner = [];
            const dmgRentedPremises = [];
            const busIncDepProp = [];
            const ordinance = [];
            const utilityTimeElement = [];
            const utilityDirectDamage = [];

            building.coverages.bld = {};

            for (const [id, answer] of Object.entries(buildingQuestions)) {
                switch (id) {
                    case "construction":
                        building[id] = answer;
                        break;
                    case "description":
                        building[id] = answer;
                        break;
                    case "occupancy":
                        building[id] = answer === 'Non-Owner Occupied Bldg' ? 'Non-Owner Occupied Bldg.' : answer; // Arrowhead needs the '.' on the end for this answer
                        break;
                    case "occupiedSqFt":
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
                    case "spoil.limit":
                        spoil.push({id: "limit", answer});
                        break;
                    case "spoil.breakCont.refrigMaint":
                        spoil.push({id: "refrigerationInd", answer: this.convertToBoolean(answer)});
                        break;
                    case "spoil.breakCont":
                        spoil.push({id: "breakContInd", answer: this.convertToBoolean(answer)});
                        break;
                    case "spoil.stockDesc":
                        spoil.push({id: "description", answer});
                        break;
                    case "spoil.powerOut":
                        spoil.push({id: "powerOutInd", answer: this.convertToBoolean(answer)});
                        break;
                    case "mineSubsidenceCoverage":
                        if (location.state === "IL") {
                            building.coverages.bld.mine = {il: {includeInd: this.convertToBoolean(answer)}}
                        }
                        if (location.state === "IN") {
                            building.coverages.bld.mine = {in: {includeInd: this.convertToBoolean(answer)}}
                        }
                        if (location.state === "KY") {
                            building.coverages.bld.mine = {ky: {includeInd: this.convertToBoolean(answer)}}
                        }
                        if (location.state === "WV") {
                            building.coverages.bld.mine = {wv: {includeInd: this.convertToBoolean(answer)}}
                        }
                        break;
                    case "mineSubsidenceCoverage.limit":
                        mine.push({id: "limit", answer: this.convertToInteger(answer)});
                        break;
                    case "addLivingExpense":
                        building.coverages.bld.addexp = {in: {includeInd: this.convertToBoolean(answer)}};
                        break;
                    case "addLivingExpense.limit":
                        addLivingExpense.push({id: "limit", answer: this.convertToInteger(answer)});
                        break;
                    case "newJerseyLeadCert":
                        if (location.yearBuilt && location.yearBuilt <= 1977) {
                            building.coverages.njlead = {
                                includeInd: true,
                                certification: answer
                            }
                            if (building.coverages.njlead.certification === "Certified") {
                                building.coverages.njlead.nonCertLiab = "Exclude Liability for Hazards of Lead";
                            }
                            else {
                                building.coverages.njlead.certLiab = "Included Liability for Hazards of Lead with sublimit";
                                building.coverages.njlead.limit = "50000";
                            }
                        }
                        break;
                    case "hasMortage":
                        const convertedAnswer = this.convertToBoolean(answer) ? "Included" : "Excluded";
                        building.coverages.lien = {includeInd: convertedAnswer};
                        break;
                    case "windstormConstruction":
                        building.windstormFeatures = {includeInd: this.convertToBoolean(answer)};
                        break;
                    case "windstormConstruction.certType":
                        windstormFeatures.push({id: "certificateType", answer});
                        break;
                    case "windstormConstruction.certLevel":
                        windstormFeatures.push({id: "certificateLevel", answer});
                        break;
                    case "windstormConstruction.roofType":
                        windstormFeatures.push({id: "roofType", answer});
                        break;
                    case "windstormConstruction.territoryAL":
                        windstormFeatures.push({id: "territory", answer});
                        break;
                    case "windstormConstruction.territorySC":
                        windstormFeatures.push({id: "territorySC", answer});
                        break;
                    case "windstormConstruction.buildingType":
                        windstormFeatures.push({id: "buildingType", answer});
                        break;
                    case "windstormConstruction.roofShape":
                        windstormFeatures.push({id: "roofShape", answer});
                        break;
                    case "windstormConstruction.roofCovering":
                        windstormFeatures.push({id: "roofCover", answer});
                        break;
                    case "windstormConstruction.roofDeckAttach":
                        windstormFeatures.push({id: "roofDeckAttach", answer});
                        break;
                    case "windstormConstruction.roofWallConn":
                        windstormFeatures.push({id: "roofWallConnect", answer});
                        break;
                    case "windstormConstruction.roofDeckMaterial":
                        windstormFeatures.push({id: "roofDeck", answer});
                        break;
                    case "windstormConstruction.openingProt":
                        windstormFeatures.push({id: "openProtection", answer});
                        break;
                    case "windstormConstruction.doorStrength":
                        windstormFeatures.push({id: "doorStrength", answer});
                        break;
                    case "windstormConstruction.secWaterRes":
                        windstormFeatures.push({id: "secondWaterRes", answer});
                        break;
                    case "windstormConstruction.proofCompliance":
                        windstormFeatures.push({id: "proofComp", answer});
                        break;
                    case "windstormConstruction.physinspection":
                        windstormFeatures.push({id: "physInspection", answer: this.convertToBoolean(answer)});
                        break;
                    case "accountsReceivable":
                          building.coverages.actrec = {includeInd: this.convertToBoolean(answer)};
                        break;
                    case "accountsReceivable.limit":
                        actReceivable.push({id: "limit", answer: this.convertToInteger(answer)});
                        break;
                    case "condoOptCoverage":
                        building.coverages.cndown = {includeInd: this.convertToBoolean(answer)};
                        break;
                    case "condoOptCoverage.lossLimit":
                        condoOwner.push({id: "lossAssessment", answer});
                        break;
                    case "condoOptCoverage.miscRealPropLimit":
                        condoOwner.push({id: "miscProp", answer});
                        break;
                    case "condoOptCoverage.subLimit":
                        condoOwner.push({id: "subLimit", answer: this.convertToInteger(answer)});
                        break;
                    case "emplDishonesty": 
                        building.coverages.ledol = {includeInd: this.convertToBoolean(answer)};
                        if (building.coverages.ledol.includeInd) {
                            building.coverages.ledol.numEmployees = location.full_time_employees + location.part_time_employees;
                        }
                        break;
                    case "dmgToRentedPremises":
                        building.coverages.tenfir = {includeInd: this.convertToBoolean(answer)};
                        break;
                    case "dmgToRentedPremises.type":
                        dmgRentedPremises.push({id: "coverageType", answer});
                        break;
                    case "dmgToRentedPremises.limit":
                        dmgRentedPremises.push({id: "limit", answer: this.convertToInteger(answer)});
                        break;
                    case "businessIncDepProps":
                        building.coverages.bidp = {includeInd: this.convertToBoolean(answer)};
                        break;
                    case "businessIncDepProps.limit":
                        busIncDepProp.push({id: "limit", answer: this.convertToInteger(answer)});
                        break;
                    case "businessIncDepProp.secDepProps":
                        busIncDepProp.push({id: "secondaryDependentProperties", answer: this.convertToBoolean(answer)});
                        break;
                    case "ordinance":
                        building.coverages.ordlaw = {includeInd: this.convertToBoolean(answer)};
                        break;
                    case "ordinance.coverageType":
                        ordinance.push({id: "covType", answer});
                        break;
                    case "ordinance.coverage2Limit":
                        ordinance.push({id: "limit2", answer});
                        break;
                    case "ordinance.coverage3Limit":
                        ordinance.push({id: "limit3", answer});
                        break;
                    case "ordinance.coverage2and3Limit":
                        ordinance.push({id: "combinedLimit", answer});
                        break;
                    case "utilServTimeElement":
                        building.coverages.utilte = {includeInd: this.convertToBoolean(answer)};
                        break;
                    case "utilServTimeElement.limit":
                        utilityTimeElement.push({id: "limit", answer: this.convertToInteger(answer)});
                        break;
                    case "utilServTimeElement.utility":
                        utilityTimeElement.push({id: "utility", answer});
                        break;
                    case "utilServTimeElement.waterSupply":
                        utilityTimeElement.push({id: "waterSupply", answer: this.convertToBoolean(answer)});
                        break;
                    case "utilServTimeElement.wasteRemoval":
                        utilityTimeElement.push({id: "wasteRemoval", answer: this.convertToBoolean(answer)});
                        break;
                    case "utilServTimeElement.comm":
                        utilityTimeElement.push({id: "commSupply", answer: this.convertToBoolean(answer)});
                        break;
                    case "utilServTimeElement.comm.overheadTxLines":
                        utilityTimeElement.push({id: "commOverheadTransLines", answer: this.convertToBoolean(answer)});
                        break;
                    case "utilServTimeElement.powerSupply":
                        utilityTimeElement.push({id: "powerSupply", answer: this.convertToBoolean(answer)});
                        break;
                    case "utilServTimeElement.powerSupply.overheadTxLines  ":
                        utilityTimeElement.push({id: "powerOverheadTransLines", answer: this.convertToBoolean(answer)});
                        break;
                    case "utilServeDirDmg":
                        building.coverages.utildd = {includeInd: this.convertToBoolean(answer)};
                        break;
                    case "utilServeDirDmg.buildingCov":
                        utilityDirectDamage.push({id: "building", answer})
                        break;
                    case "utilServeDirDmg.buildingCov.limit":
                        utilityDirectDamage.push({id: "buildingLimit", answer: this.convertToInteger(answer)});
                        break;
                    case "utilServeDirDmg.personalProp":
                        utilityDirectDamage.push({id: "personalProperty", answer});
                        break;
                    case "utilServeDirDmg.personalProp.limit":
                        utilityDirectDamage.push({id: "personalPropertyLimit", answer: this.convertToInteger(answer)});
                        break;
                    case "utilServeDirDmg.utility":
                        utilityDirectDamage.push({id: "utility", answer});
                        break;
                    case "utilServeDirDmg.waterSupply":
                        utilityDirectDamage.push({id: "waterSupply", answer: this.convertToBoolean(answer)});
                        break;
                    case "utilServeDirDmg.comm":
                        utilityDirectDamage.push({id: "communicationSupply", answer: this.convertToBoolean(answer)});
                        break;
                    case "utilServeDirDmg.comm.overheadTxLines":
                        utilityDirectDamage.push({id: "communicationTransLines", answer: this.convertToBoolean(answer)});
                        break;
                    case "utilServeDirDmg.powerSupply":
                        utilityDirectDamage.push({id: "powerSupply", answer: this.convertToBoolean(answer)});
                        break;
                    case "utilServeDirDmg.powerSupply.overheadTxLines":
                        utilityDirectDamage.push({id: "powerSupplyTransLines", answer: this.convertToBoolean(answer)});
                        break;
                    default: 
                        log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions with no defined case. This could mean we have a new question that needs to be handled in the integration.` + __location);
                        break;
                }
            }

            // injection of Utility Service - Direct Damage Coverage child question data
            if (ordinance.length > 0) {
                if (!building.coverages.hasOwnProperty("utildd")){
                    building.coverages.utildd = {includeInd: true};
                    building.coverages.utildd.limit1 = location.buildingLimit;
                }
                ordinance.forEach(({id, answer}) => {
                    switch (id) {
                        case "building":
                        case "buildingLimit":
                        case "personalProperty":
                        case "personalPropertyLimit":
                        case "utility":
                        case "waterSupply":
                        case "communicationSupply":
                        case "communicationTransLines":
                        case "powerSupply":
                        case "powerSupplyTransLines":
                                building.coverages.utildd[id] = answer;
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for Utility Service - Direct Damage Coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.` + __location);
                            break;
                    }
                });
            }    

            // injection of Utility Service - Time Element Coverage child question data
            if (ordinance.length > 0) {
                if (!building.coverages.hasOwnProperty("utilte")){
                    building.coverages.utilte = {includeInd: true};
                    building.coverages.utilte.limit1 = location.buildingLimit;
                }
                ordinance.forEach(({id, answer}) => {
                    switch (id) {
                        case "limit":
                        case "utility":
                        case "waterSupply":
                        case "wasteRemoval":
                        case "commSupply":
                        case "commOverheadTransLines":
                        case "powerSupply":
                        case "powerOverheadTransLines":
                                building.coverages.utilte[id] = answer;
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for Utility Service - Time Element Coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.` + __location);
                            break;
                    }
                });
            }    

            // injection of Ordinance or Law Coverage child question data
            if (ordinance.length > 0) {
                if (!building.coverages.hasOwnProperty("ordlaw")){
                    building.coverages.ordlaw = {includeInd: true};
                    building.coverages.ordlaw.limit1 = location.buildingLimit;
                }
                ordinance.forEach(({id, answer}) => {
                    switch (id) {
                        case "covType":
                        case "limit2":
                        case "limit3":
                        case "combinedLimit":
                                building.coverages.ordlaw[id] = answer;
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for Ordinance or Law Coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.` + __location);
                            break;
                    }
                });
            }    

            // injection of Business Income from Dependent Properties Coverage child question data
            if (busIncDepProp.length > 0) {
                if (!building.coverages.hasOwnProperty("bidp")){
                    building.coverages.bidp = {includeInd: true};
                }
                busIncDepProp.forEach(({id, answer}) => {
                    switch (id) {
                        case "secondaryDependentProperties":
                        case "limit":
                                building.coverages.bidp[id] = answer;
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for Business Income from Dependent Properties Coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.` + __location);
                            break;
                    }
                });
            }    

            // injection of Damage to Rented Premises Coverage child question data
            if (dmgRentedPremises.length > 0) {
                if (!building.coverages.hasOwnProperty("tenfir")){
                    building.coverages.tenfir = {includeInd: true};
                }
                dmgRentedPremises.forEach(({id, answer}) => {
                    switch (id) {
                        case "coverageType":
                        case "limit":
                                building.coverages.tenfir[id] = answer;
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for Damage to Rented Premises Coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.` + __location);
                            break;
                    }
                });
            }    

            // injection of Condo Owners Optional Coverages child question data
            if (condoOwner.length > 0) {
                if (!building.coverages.hasOwnProperty("cndown")){
                    building.coverages.cndown = {includeInd: true};
                }
                condoOwner.forEach(({id, answer}) => {
                    switch (id) {
                        case "lossLimit":
                        case "miscProp":
                        case "subLimit":
                                building.coverages.actrec[id] = answer;
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for Condo Owners Optional Coverages with no defined case. This could mean we have a new child question that needs to be handled in the integration.` + __location);
                            break;
                    }
                });
            }    

            // injection of Accounts Receivable Coverage child question data
            if (actReceivable.length > 0) {
                if (!building.coverages.hasOwnProperty("actrec")){
                    building.coverages.actrec = {includeInd: true};
                }
                actReceivable.forEach(({id, answer}) => {
                    switch (id) {
                        case "limit":
                                building.coverages.actrec[id] = answer;
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for Accounts Receivable coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.` + __location);
                            break;
                    }
                });
            }    

            // injection of Additional Living Expense Coverage child question data
            if (addLivingExpense.length > 0) {
                if (!building.coverages.bld.hasOwnProperty("addexp")){
                    building.coverages.bld.addexp = {in: {includeInd: true}};
                }
                addLivingExpense.forEach(({id, answer}) => {
                    switch (id) {
                        case "limit":
                                building.coverages.bld.addexp.in.addexpAI = answer;
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for Additional Living Expenses coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.` + __location);
                            break;
                    }
                });
            }    

            // injection of Mine Subsidence Coverage child question data
            if (mine.length > 0) {
                if (!building.coverages.hasOwnProperty("mine")){
                    building.coverages.mine = {};
                    if (location.state === "IL") {
                        building.mine.il = {includeInd: true};
                    }
                    if (location.state === "IN") {
                        building.mine.in = {includeInd: true};
                    }
                    if (location.state === "KY") {
                        building.mine.ky = {includeInd: true};
                    }
                    if (location.state === "WV") {
                        building.mine.wv = {includeInd: true};
                    }
                }
                mine.forEach(({id, answer}) => {
                    switch (id) {
                        case "limit":
                            if (location.state === "IL") {
                                building.coverages.mine.il = {limit: answer};
                            }
                            if (location.state === "IN") {
                                building.coverages.mine.in = {limit: answer};
                            }
                            if (location.state === "KY") {
                                building.coverages.mine.ky = {limit: answer};
                            }
                            if (location.state === "WV") {
                                building.coverages.mine.wv = {limit: answer};
                            }
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for Mine Subsidence coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration.` + __location);
                            break;
                    }
                });
            }    

            // injection of Windstorm Construction Feature child question data
            if (windstormFeatures.length > 0) {
                building.windstormFeatures = {};
                windstormFeatures.forEach(({id, answer}) => {
                    switch (id) {
                        case "certificateType":
                        case "certificateLevel":
                        case "roofType":
                        case "territory":
                        case "territorySC":
                        case "buildingType":
                        case "roofShape":
                        case "roofCover":
                        case "roofDeckAttach":
                        case "roofWallConnect":
                        case "roofDeck":
                        case "openProtection":
                        case "doorStrength":
                        case "secondWaterRes":
                        case "proofComp":
                        case "physInspection":
                            building.windstormFeatures[id] = this.convertToInteger(answer);
                            break;
                        default:
                            log.warn(`${logPrefix}Encountered key [${id}] in injectBuildingQuestions for Windstorm Construction features with no defined case. This could mean we have a new child question that needs to be handled in the integration.` + __location);
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
                        case "breakContInd":
                        case "description":
                        case "powerOutInd":
                        case "refrigerationInd":
                        case "limit":
                            building.coverages.spoil[id] = answer;
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
                limit: `${location.businessPersonalPropertyLimit}`
            };

            // Business Personal Property Limit            
            building.coverages.bld = {
                includeInd: true,
                valuation: "Replacement Cost",
                limit: location.buildingLimit
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