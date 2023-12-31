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

'use strict';

const Integration = require('../Integration.js');
global.requireShared('./helpers/tracker.js');
const axios = require('axios');
const ZipCodeBO = global.requireShared('./models/ZipCode-BO.js');
const moment = require('moment');
const { convertToDollarFormat } = global.requireShared('./helpers/stringFunctions.js');

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
        // Get Subscription Key
        let subscriptionKey = null;
        if (this.username) {
            subscriptionKey = this.username;
        }

        // Determine which URL to use
        let host = null; 
        let path = null; 
        if (this.insurer.useSandbox) {
            host = 'https://stag-api.nationalprograms.io';
            path = '/Quote/v0.2-beta/CreateQuote';
        }
        else {
            host = 'https://api.nationalprograms.io';
            path = '/Quote/v1.0.0/CreateQuote';
        }

        // "Other" is not included, as anything not below is defaulted to it
        const supportedEntityTypes = [
            "Corporation",
            "Limited Liability Company",
            "Individual",
            "Joint Venture",
            "Partnership"
        ];

        const applicationDocData = this.applicationDocData;
        const BOPPolicy = applicationDocData.policies.find(p => p.policyType === "BOP");
        const primaryContact = applicationDocData.contacts.find(c => c.primary);

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
        const insurerIndustryCodeAttributes = this.insurerIndustryCode.attributes;
        let arrowheadNAICS = insurerIndustryCodeAttributes['New NAICS'];
        let arrowheadSIC = insurerIndustryCodeAttributes['SIC Code'];
            
        if (!arrowheadNAICS) {
            log.error(`${logPrefix}Problem getting NAICS from Insurer Industry Code attributes ` + __location);
            arrowheadNAICS = "000000";
        }
        if (!arrowheadSIC) {
            log.error(`${logPrefix}Problem getting SIC from Insurer Industry Code attributes ` + __location);
            arrowheadSIC = "000000";
        }

        const requestJSON = {
            rateCallType: "RATE_INDICATION",
            insuredSet: {
                firstName: primaryContact.firstName,
                lastName: primaryContact.lastName,
                DBA: applicationDocData.dba,
                address: {
                    zip: applicationDocData.mailingZipcode.slice(0,5),
                    address: applicationDocData.mailingAddress,
                    city: applicationDocData.mailingCity,
                    state: applicationDocData.mailingState
                },
                instype: supportedEntityTypes.includes(applicationDocData.entityType) ? applicationDocData.entityType : "Other",
                companyName: applicationDocData.businessName,
                wphone: `${primaryContact.phone.toString().substring(0, 3)}-${primaryContact.phone.toString().substring(3,6)}-${primaryContact.phone.toString().substring(6)}`,
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
                agentid: this.app.agencyLocation.insurers[this.insurer.id].agent_id, //Check if this is different than sub producer. 
                effective: moment(BOPPolicy.effectiveDate).format("YYYYMMDD"), 
                expiration: moment(BOPPolicy.effectiveDate).add(1, "year").subtract(1, 'days').format("YYYYMMDD"), 
                commonSet: {
                    stateOfDomicile: applicationDocData.mailingState,
                    classCode: this.insurerIndustryCode.code,
                    naicsCode: arrowheadNAICS,
                    yearBizStarted: `${moment(applicationDocData.founded).year()}`,
                    sicCode: arrowheadSIC, 
                    state: applicationDocData.mailingState,
                    effective: moment(BOPPolicy.effectiveDate).format("YYYYMMDD"), 
                    expiration: moment(BOPPolicy.effectiveDate).add(1, "year").subtract(1, 'days').format("YYYYMMDD"), 
                    quoteType: "NB"
                },
                bbopSet: {
                    classCodes: this.insurerIndustryCode.code,
                    finalized: true,
                    GLOccurrenceLimit: "1000000",
                    productsCOA: "2000000",
                    liabCovInd: false, // documentation states this should be hardcoded to true, yet example wendy's request has as false?
                    propCovInd: false,
                    locationList: locationList,
                    otherCOA: "2000000",
                    addtlIntInd: false,
                    coverages: {
                        terror: {
                            includeInd: Boolean(BOPPolicy.addTerrorismCoverage)
                        }
                    }
                }
            }
        };

        if (BOPPolicy.deductible) {
            requestJSON.policy.bbopSet.fixedPropDeductible = this.bestFitArrowheadDeductible(BOPPolicy.deductible);
        }
        else {
            requestJSON.policy.bbopSet.fixedPropDeductible = 250;
        }

        try {
            this.injectGeneralQuestions(requestJSON, questions);
        } catch (e) {
            const errorMessage = `There was an issue adding general questions to the application`;
            log.error(errorMessage + `: ${e}` + __location);
            return this.client_error(errorMessage, __location, e);
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
        this.log += `--------======= QUOTE REQUEST =======--------<br><br>`;
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
            "Ocp-Apim-Subscription-Key": subscriptionKey
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
            this.log += `=================== QUOTE ERROR ===================<br><br>`;
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
        this.log += `--------======= Insurer Response =======--------<br><br>`;
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

            this.log += `--------======= Insurer Decision Message =======--------<br><br>`;
            this.log += `<pre>${decisionMessage}</pre><br><br>`;
            this.log += `--------======= End =======--------<br><br>`;
            if (decision.toLowerCase().trim() === 'decline') {
                return this.client_declined(decisionMessage);
            }
        }

        let quoteNumber = null;
        let premium = null;
        const quoteLimits = {}; 
        const quoteLetter = null; // not provided by Arrowhead
        const quoteMIMEType = null; // not provided by Arrowhead
        let policyStatus = null; // not provided by Arrowhead, either rated (quoted) or failed (error)
        //Why are we using a local when integrations.js as this.quoteCoverages
        const quoteCoverages = [];
        let coverageSort = 1;

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

        try {
            // Each Occurrence
            quoteCoverages.push({
                description: `Each Occurrence`,
                value: convertToDollarFormat(res.coreCommVs.policy.bbopSet.GLOccurrenceLimit, true),
                sort: coverageSort++,
                category: "Liability Coverages"
            });

            // Aggregate
            quoteCoverages.push({
                description: `Aggregate`,
                value: convertToDollarFormat(res.coreCommVs.policy.bbopSet.otherCOA, true),
                sort: coverageSort++,
                category: "Liability Coverages"
            });

            // Products & Completed Operations
            quoteCoverages.push({
                description: `Products & Completed Operations`,
                value: convertToDollarFormat(res.coreCommVs.policy.bbopSet.productsCOA, true),
                sort: coverageSort++,
                category: "Liability Coverages"
            });
        }
        catch (err) {
            log.warn(`${logPrefix}Unable to get limits. Result structure may have changed: ${err}` + __location);
        }

        // Get other Policy Limits
        try {
            const bbopCoverages = res.coreCommRatedVs.acord.insuranceSvcRsList[0].policyQuoteInqRs.additionalQuotedScenarioList[0].instecResponse.rc1.bbopResponse.coverages;
            for (const key of Object.keys(bbopCoverages)) {
                const coverage = bbopCoverages[key];
                if (coverage.limit && coverage.desc) {
                    quoteCoverages.push({
                        description: `${coverage.desc}`,
                        value: coverage.limit,
                        sort: coverageSort++,
                        category: "Liability Coverages"
                    });
                }
            }
        }
        catch (err) {
            log.warn(`${logPrefix}Unable to get policy limits from response. Result structure may have changed: ${err}` + __location);
        }

        // Get Location based limits
        try {
            const resultLocationsList = res.coreCommRatedVs.acord.insuranceSvcRsList[0].policyQuoteInqRs.additionalQuotedScenarioList[0].bopReporting.locationList;
            for (let i = 0; i < resultLocationsList.length; i++) {
                const building = resultLocationsList[i].buildingList[0];
                //log.debug(`Location[i]: ${JSON.stringify(resultLocationsList[i], null, 4)}`);
                //log.debug(`Building: ${JSON.stringify(building, null, 4)}`);
                //log.debug(`Building.coverages: ${JSON.stringify(building.coverages, null, 4)}`);
                for (const coverage of Object.keys(building.coverages)) {
                    log.debug(`Coverage: ${JSON.stringify(coverage, null, 4)}`);
                    if (building.coverages[coverage].limit && building.coverages[coverage].desc) {
                        quoteCoverages.push({
                            description: `${building.coverages[coverage].desc}: ${building.address}, ${building.city}`,
                            value: convertToDollarFormat(building.coverages[coverage].limit, true),
                            sort: coverageSort++,
                            category: "Property Coverages"
                        });
                    }
                }
            }
        }
        catch (err) {
            log.warn(`${logPrefix}Unable to get location based limits. Result structure may have changed: ${err}` + __location);
        }


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
        const applicationDocData = this.applicationDocData;
        const locationList = [];
        const zipCodeBO = new ZipCodeBO();
        for (const location of applicationDocData.locations) {
            const zipCodeDoc = await zipCodeBO.loadByZipCode(location.zipcode).
                catch(err => {
                    log.error(`Could not get zip code (${location.zipcode}) information from ZipCodeBO: ${err}` + __location);
                });

            // Get the total payroll for the location
            let liabPayroll = 0;
            for (const activityPayroll of location.activityPayrollList) {
                liabPayroll += activityPayroll.employeeTypeList.reduce((payroll, employeeType) => payroll + employeeType.employeeTypePayroll, 0);
            }

            const insurerIndustryCodeAttributes = this.insurerIndustryCode.attributes;
            let arrowheadNAICS = insurerIndustryCodeAttributes['New NAICS'];
            let arrowheadSIC = insurerIndustryCodeAttributes['SIC Code'];
                
            if (!arrowheadNAICS) {
                log.error(`${logPrefix}Problem getting NAICS from Insurer Industry Code attributes ` + __location);
                arrowheadNAICS = "000000";
            }
            if (!arrowheadSIC) {
                log.error(`${logPrefix}Problem getting SIC from Insurer Industry Code attributes ` + __location);
                arrowheadSIC = "000000";
            }

            let occupancy = null;
            if (location.own) {
                occupancy = "Owner Occupied Bldg - More than 10%";
            }
            else {
                occupancy = "Tenant"
            }

            const locationObj = {
                countyName: zipCodeDoc.county,
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
                        sicCode: arrowheadSIC,
                        naicsCode: arrowheadNAICS,
                        yearBuilt: location.yearBuilt,
                        occupancy: occupancy,
                        uw: {
                            roofUpdates: location.bop.roofingImprovementYear,
                            hvacUpdates: location.bop.heatingImprovementYear,
                            plumbingUpdates: location.bop.plumbingImprovementYear,
                            electricalUpdates: location.bop.wiringImprovementYear
                        },
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

            if (location.hasOwnProperty('numStories')){
                locationObj.buildingList[0].numStories = location.numStories > 0 ? location.numStories : 1;
            }
            else {
                locationObj.buildingList[0].numStories = 1;
            }

            if (location.hasOwnProperty('bop')) {
                locationObj.buildingList[0].sprinklered = location.bop.hasOwnProperty('sprinklerEquipped') ? location.bop.sprinklerEquipped : false;
            }
            else {
                locationObj.buildingList[0].sprinklered = false;
            }

            if (location.square_footage) {
                locationObj.buildingList[0].occupiedSqFt = location.square_footage;
            }
            else {
                locationObj.buildingList[0].occupiedSqFt = 0;
            }

            // added description since its required in arrowhead quote
            if (location.description) {
                locationObj.buildingList[0].description = location.description;
            }
            else{
                locationObj.buildingList[0].description = '';
            }

            const constructionTypes = {
                "Frame": "Frame",
                "Fire Resistive": "Fire Resistive",
                "Joisted Masonry": "Joisted Masonry",
                "Masonry Non Combustible": "Masonry Non-Combustible",
                "Non Combustible": "Non-Combustible"
            };
            if (location.constructionType && constructionTypes[location.constructionType]) {
                locationObj.buildingList[0].construction = constructionTypes[location.constructionType];
            }

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

        const applicationDocData = this.applicationDocData;
        
        // parent questions
        const contractorCoverage = [];
        const contractorScheduled = [];
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
                case "contractorInstallCov":
                    bbopSet.coverages.conins = {
                        includeInd: this.convertToBoolean(answer)
                    };  
                    break;
                case "contractorInstallCov.limit":
                    contractorCoverage.push({id: "limit", answer});
                    break;
                case "conToolsCovType":
                case "blanketLimitNoMin":
                case "itemSubLimitText":
                case "nonownTools.limit":
                case "empTools.limit":
                    contractorCoverage.push({id, answer});
                    break;
                case "nonownTools.includeInd":
                    contractorCoverage.push({id, answer: this.convertToBoolean(answer)});
                    break;
                case "empTools.includeInd":
                    contractorCoverage.push({id, answer: this.convertToBoolean(answer)});
                    break;
                case "actualCashValueInd":
                    contractorCoverage.push({id: "ACVInd", answer: this.convertToBoolean(answer)});
                    break;
                case "conscd.equips.desc":
                    contractorScheduled.push({id, answer});
                    break;
                case "conscd.equips.val":
                    contractorScheduled.push({id, answer: this.convertToInteger(answer)});
                    break;
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
                    if (answer === 'No Building Coverage') {
                        bbopSet.automaticIncr = 0;
                    }
                    else {
                        bbopSet.automaticIncr = this.convertToInteger(answer);
                    }
                    break;
                case "medicalExpenses":
                    bbopSet.medicalExpenses = answer;
                    break;        
                case "liaDed":
                    bbopSet.liaDed = answer;
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
                        bbopSet.coverages.stopwa = {limit: answer};
                    }
                    if (applicationDocData.locations.find(loc => loc.state === 'WY')) {
                        bbopSet.coverages.stopwy = {limit: answer};
                    }
                    if (applicationDocData.locations.find(loc => loc.state === 'ND')) {
                        bbopSet.coverages.stopnd = {limit: answer};
                    }
                    if (applicationDocData.locations.find(loc => loc.state === 'OH')) {
                        bbopSet.coverages.stopoh = {limit: answer};
                    }
                    break;
                case "moldIncl":
                    bbopSet.coverages.mold = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break;
                case "moldIncl.stateException":
                    mold.push({id: "georgiaStateException", answer: this.convertToBoolean(answer)});
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
                case "schedBookFloater.limit1":
                    schedBookFloater.push({id: "limit1", answer: this.convertToInteger(answer)});
                    break;
                case "schedBookFloater.limit2":
                    schedBookFloater.push({id: "limit2", answer: this.convertToInteger(answer)});
                    break;
                case "schedBookFloater.limit3":
                    schedBookFloater.push({id: "limit3", answer: this.convertToInteger(answer)});
                    break;
                case "schedBookFloater.limit4":
                    schedBookFloater.push({id: "limit4", answer: this.convertToInteger(answer)});
                    break;
                case "schedBookFloater.limit5":
                    schedBookFloater.push({id: "limit5", answer: this.convertToInteger(answer)});
                    break;
                case "schedBookFloater.description1":
                    schedBookFloater.push({id: "description1", answer});
                    break;
                case "schedBookFloater.description2":
                    schedBookFloater.push({id: "description2", answer});
                    break;
                case "schedBookFloater.description3":
                    schedBookFloater.push({id: "description3", answer});
                    break;
                case "schedBookFloater.description4":
                    schedBookFloater.push({id: "description4", answer});
                    break;
                case "schedBookFloater.description5":
                    schedBookFloater.push({id: "description5", answer});
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
                    bbopSet.coverages.liqlia = {
                        includeInd: this.convertToBoolean(answer)
                    };
                    break;
                case "liquorLiab.typeOfSales":
                    const answerTranslations = {
                        "Manufacturing Wholesalers or Distributors Selling Alcohol For Consumption Off Premises": "Type 1",
                        "Restaurants or Motels Including Package Sales": "Type 2",
                        "Package Stores and Other Retail Establishments Selling Alcohol For Consumption Off Premises": "Type 3"
                    };
                    liquorLiab.push({id: "type", answer: answerTranslations[answer]})
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
                        bbopSet.coverages.conadd = {includeInd: this.convertToBoolean(answer)};
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
                    pharmLiab.push({id: "grossSales", answer: answer});
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
        // hydrate Contractors' Scheduled coverage with child question data, if any exist
        if (contractorScheduled.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("conscd")) {
                bbopSet.coverages.conscd = {
                    equips: [{}]
                };
            }
            contractorScheduled.forEach(({id, answer}) => {
                switch (id) {
                    case "conscd.equips.desc":
                        bbopSet.coverages.conscd.equips[0].desc = answer;
                        break;
                    case "conscd.equips.val":
                        bbopSet.coverages.conscd.equips[0].val = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for Contractors' Installation Coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            });
        }

        // hydrate Contractors' Installation coverage with child question data, if any exist
        if (contractorCoverage.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("conins")) {
                bbopSet.coverages.conins = {
                    includeInd: true
                }
            }
            contractorCoverage.forEach(({id, answer}) => {
                switch (id) {
                    case "limit":
                    case "conToolsCovType":
                    case "blanketLimitNoMin":
                    case "itemSubLimitText":
                    case "ACVInd":
                        bbopSet.coverages.conins[id] = answer;
                        break;
                    case "nonownTools.includeInd":
                        if (!bbopSet.coverages.conins.hasOwnProperty("nonownTools")) {
                            bbopSet.coverages.conins.nonownTools = {};
                        }
                            bbopSet.coverages.conins.nonownTools.includeInd = answer;
                        break;
                    case "nonownTools.limit":
                        if (!bbopSet.coverages.conins.hasOwnProperty("nonownTools")) {
                            bbopSet.coverages.conins.nonownTools = {};
                        }
                            bbopSet.coverages.conins.nonownTools.limit = answer;
                            break;
                    case "empTools.includeInd":
                        if (!bbopSet.coverages.conins.hasOwnProperty("empTools")) {
                            bbopSet.coverages.conins.empTools = {};
                        }
                            bbopSet.coverages.conins.empTools.includeInd = answer;
                            break;
                    case "empTools.limit":
                        if (!bbopSet.coverages.conins.hasOwnProperty("empTools")) {
                            bbopSet.coverages.conins.empTools = {};
                        }
                            bbopSet.coverages.conins.empTools.limit = answer;
                            break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for Contractors' Installation Coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            });

            if (!bbopSet.coverages.conins.hasOwnProperty('conToolsCovType') && (bbopSet.coverages.conins.hasOwnProperty('blanketLimitNoMin') || bbopSet.coverages.conins.hasOwnProperty('actualCashValueInd') || bbopSet.coverages.conins.hasOwnProperty('itemSubLimitText'))) {
                bbopSet.coverages.conins.conToolsCovType = "Blanket Limit";
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

            let arrowheadSIC = this.insurerIndustryCode.attributes['SIC Code'];
            if (!arrowheadSIC) {
                log.error(`${logPrefix}Problem getting SIC from Insurer Industry Code attributes ` + __location);
                arrowheadSIC = "000000";
            }
            bbopSet.coverages.emplia.sic = arrowheadSIC;
        }

        // hydrate Liquor Liability coverage with child question data, if any exist
        if (liquorLiab.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("liqlia")) {
                bbopSet.coverages.liqlia = {
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
                        bbopSet.coverages.liqlia[id] = answer;
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
            if (!bbopSet.coverages.schdbk.hasOwnProperty("equips")) {
                bbopSet.coverages.schdbk.equips = [{}];
            }
            const equips = [];
            for (let i = 0; i < 5; i++) {
                equips.push({});
            }
            schedBookFloater.forEach(({id, answer}) => {
                switch (id) {
                    case "limit1":
                        equips[0].val = answer;
                        break;
                    case "description1":
                        equips[0].desc = answer;
                        break;
                    case "limit2":
                        equips[1].val = answer;
                        break;
                    case "description2":
                        equips[1].desc = answer;
                        break;
                    case "limit3":
                        equips[2].val = answer;
                        break;
                    case "description3":
                        equips[2].desc = answer;
                        break;
                    case "limit4":
                        equips[3].val = answer;
                        break;
                    case "description4":
                        equips[3].desc = answer;
                        break;
                    case "limit5":
                        equips[4].val = answer;
                        break;
                    case "description5":
                        equips[4].desc = answer;
                        break;
                    default:
                        log.warn(`${logPrefix}Encountered key [${id}] in injectGeneralQuestions for Scheduled Book and Manuscript Floater coverage with no defined case. This could mean we have a new child question that needs to be handled in the integration. ${__location}`);
                        break;
                }
            });

            const filteredEquips = equips.filter(equip => equip && equip.val && !isNaN(equip.val) && equip.desc); // Submit only those with both non-empty description and non-zero limit value
            if (filteredEquips && filteredEquips.length > 0) {
                bbopSet.coverages.schdbk.equips = filteredEquips;
                bbopSet.coverages.schdbk.limit = String(bbopSet.coverages.schdbk.equips.reduce((sum, elem) => {
                    let addVal = 0;
                    if (elem.val){
                        addVal = elem.val;
                    }
                    return sum + addVal;
                }, 0));
            }
            else {
                bbopSet.coverages.schdbk.includeInd = false;
            }
        }

        if (bbopSet.coverages.schdbk && (!bbopSet.coverages.schdbk.equips || bbopSet.coverages.schdbk.equips.length === 0)) {
            bbopSet.coverages.schdbk.includeInd = false;
        }


        // hydrate dentist/physician equipment coverage with child question data, if any exist
        if (dentistEquip.length > 0) {
            if (!bbopSet.coverages.hasOwnProperty("dentistEquip")) {
                bbopSet.coverages.dentistEquip = {
                    includeInd: true
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
                    includeInd: true
                }
            }
            mold.forEach(({id, answer}) => {
                switch (id) {
                    case "georgiaStateException":
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
        // hydrate the request JSON object with location question data
        // NOTE: Add additional location questions here if more get imported   
        for (const [id, answer] of Object.entries(locationQuestions)) {
            switch (id) {
                case "windHailCov": 
                    location.WHExclusions = !this.convertToBoolean(answer);
                    break;
                case "windHailDeductible": 
                    location.WHDeductiblePcnt = answer;
                    break;
                case "perilType": 
                    location.perilType = answer;
                    break;
                case "WHDedPcnt": 
                    location.WHDedPcnt = answer;
                    location.StormPcnt = "N/A";
                    break;
                case "StormPcnt": 
                    location.StormPcnt = answer;
                    location.WHDedPcnt = "N/A";
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
                    case "description":
                        building[id] = answer;
                        break;
                    case "occupancy":
                        building[id] = answer === 'Non-Owner Occupied Bldg' ? 'Non-Owner Occupied Bldg.' : answer; // Arrowhead needs the '.' on the end for this answer
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
                        spoil.push({id: "spoilageLimit", answer: this.convertToInteger(answer)});
                        break;
                    case "spoil.breakCont.refrigMaint":
                        spoil.push({id: "refrigerationInd", answer: this.convertToBoolean(answer)});
                        break;
                    case "spoil.breakCont":
                        spoil.push({id: "breakContInd", answer: this.convertToBoolean(answer)});
                        break;
                    case "spoil.stockDesc":
                        spoil.push({id: "spoilageDescription", answer});
                        break;
                    case "spoil.powerOut":
                        spoil.push({id: "powerOutInd", answer: this.convertToBoolean(answer)});
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
                        case "spoilageDescription":
                        case "powerOutInd":
                        case "refrigerationInd":
                        case "spoilageLimit":
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
                valuationInd: false
            };

            if (location.businessPersonalPropertyLimit && location.businessPersonalPropertyLimit > 0) {
                building.coverages.PP.includeInd = true;
                building.coverages.PP.limit = `${location.businessPersonalPropertyLimit}`;
            }
            else {
                building.coverages.PP.includeInd = false;
                building.coverages.PP.limit = '0';
            }

            // Business Personal Property Limit            
            building.coverages.bld = {
                includeInd: building.occupancy !== "Tenant",
                valuation: "Replacement Cost",
                limit: building.occupancy === "Tenant" ? 0 : location.buildingLimit
            };

            // Mine subsidence coverage required for certain territories
            const mineSubStates = [
                'IL',
                'IN',
                'KY',
                'WV'
                ];
            const mineMaxLimits = {
                IL: 500000,
                IN: 500000,
                KY: 300000,
                WV: 200000
            }
            if (mineSubStates.includes(location.state) && building.coverages.bld.includeInd) {
                switch (location.state) {
                    case 'IL':
                        building.coverages.bld.mine = {il: {includeInd: true}}
                        if (building.coverages.bld.limit < mineMaxLimits[location.state]) {
                            building.coverages.bld.mine.il.limit = `${building.coverages.bld.limit}`;
                        }
                        else {
                            building.coverages.bld.mine.il.limit = `${mineMaxLimits[location.state]}`;
                        }
                        break;
                    case 'IN': 
                        building.coverages.bld.mine = {in: {includeInd: true}}
                        if (building.coverages.bld.limit < mineMaxLimits[location.state]) {
                            building.coverages.bld.mine.in.limit = `${building.coverages.bld.limit}`;
                        }
                        else {
                            building.coverages.bld.mine.in.limit = `${mineMaxLimits[location.state]}`;
                        }
                        break;
                    case 'KY':
                        building.coverages.bld.mine = {ky: {includeInd: true}}
                        if (building.coverages.bld.limit < mineMaxLimits[location.state]) {
                            building.coverages.bld.mine.ky.limit = `${building.coverages.bld.limit}`;
                        }
                        else {
                            building.coverages.bld.mine.ky.limit = `${mineMaxLimits[location.state]}`;
                        }
                        break;
                    case 'WV':
                        building.coverages.bld.mine = {wv: {includeInd: true}}
                        if (building.coverages.bld.limit < mineMaxLimits[location.state]) {
                            building.coverages.bld.mine.wv.limit = `${building.coverages.bld.limit}`;
                        }
                        else {
                            building.coverages.bld.mine.wv.limit = `${mineMaxLimits[location.state]}`;
                        }
                        break;
                    default:
                        log.error(`Location territory is ${location.state} but it needs to be either IL, IN, KY, WV`);
                }
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

    convertToInteger(answer) {
        let parsedAnswer = parseInt(answer);

        if (isNaN(parsedAnswer)) {
            log.warn(`${logPrefix}Couldn't parse "${answer}" into an integer, Result was NaN. Leaving as-is.`);
            parsedAnswer = answer;
        }

        return parsedAnswer;
    }

    bestFitArrowheadDeductible(givenDeductible) {
        const arrowheadDeductibles = [
            250,
            500,
            1000,
            2500
        ];

        let deductible = givenDeductible;
        if (typeof deductible !== 'number') {
            deductible = parseInt(deductible);
        }
        if (isNaN(deductible)) {
            return arrowheadDeductibles[0]; // Arrowhead's lowest acceptable deductible
        }

        const lowerDeductibles = arrowheadDeductibles.filter(ded => ded < deductible);
        return Math.max(...lowerDeductibles);
    } 

    removeCharacters(characters, value) {
        characters.forEach(c => {
            value = value.replace(c, "");
        });

        return value;
    }
}