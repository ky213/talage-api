/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Simple BOP Policy Integration for Liberty Mutual
 */

'use strict';

const moment = require('moment');
const Integration = require('../Integration.js');
global.requireShared('./helpers/tracker.js');
const axios = require('axios');

// TODO: Update to toggle between test/prod 
const host = 'https://stag-api.nationalprograms.io';
const path = '/Quote/v0.2-beta/CreateQuote';

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

        const applicationDocData = this.app.applicationDocData;
        const BOPPolicy = applicationDocData.policies.find(p => p.policyType === "BOP");
        const primaryContact = applicationDocData.contacts.find(c => c.primary);

        // hydrate the request JSON object
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
                instype: applicationDocData.entityType,
                companyName: applicationDocData.businessName,
                wphone: `+1-${primaryContact.phone.substring(0, 3)}-${primaryContact.phone.substring(primaryContact.phone.length - 7)}`,
                email: primaryContact.email
            },
            company: "CABPQ1",
            controlSet: {
                prodcode: "111111"
            },
            policy: {
                product: "BBOP",
                state: applicationDocData.mailingState,
                commonSet: {
                    dnb: {
                        callResult: "HIT",
                        message: "",
                        dunsNumber: 777777776
                    },
                    stateOfDomicile: applicationDocData.mailingState,
                    company: "CABPQ1",
                    naicsCode: this.industry_code.naics, // <---- CHECK THIS
                    classCode: this.industry_code.code, // <---- CHECK THIS
                    yearBizStarted: moment(applicationDocData.founded).year(),
                    sicCode: this.industry_code.sic, // <---- CHECK THIS
                    expiration: moment(BOPPolicy.effectiveDate).add(1, "year").format("YYYYMMDD")
                },
                bbopSet: {
                    flMixedBbopInd: false,
                    automaticIncr: 8,
                    coverages: {
                        elteat: {
                            includeInd: false
                        },                
                        terror: {
                            includeInd: true
                        }
                    },
                    GLOccurrenceLimit: 1000000,
                    productsCOA: 2000000,
                    medicalExpenses: "0",
                    removeITVProvision: false,
                    liabCovInd: true,
                    liaDed: "None",
                    propCovInd: true,
                    fixedPropDeductible: 2500,
                    locationList: [
                        {
                            userCountryName: "USA",
                            userCountyName: "SAN DIEGO",
                            city: "SAN DIEGO",
                            PPCCall: {
                                fireProtectionArea: "SAN DIEGO",
                                waterSupplyType: "Hydrant",
                                PPCCode: 3,
                                matchType: "Address Level Match",
                                county: "SAN DIEGO",
                                respondingFireStation: "STATION 14",
                                priorAlternativePPCCodes: "9/10",
                                driveDistanceToRespondingFireStation: "1 mile or less",
                                multiplePPCInd: false
                            },
                            finalProtectionClass: 3,
                            bceg: {
                                bcegCode: 99,
                                callResult: "SUCCESSFUL",
                                message: ""
                            },
                            street: "POLK",
                            fireline: {
                                wildFireHazardScore: "0",
                                callResult: "SUCCESSFUL",
                                message: ""
                            },
                            state: "CA",
                            buildingList: [
                                {
                                    classCode: "09361",
                                    uw: {
                                        roofUpdates: 2015,
                                        plumbingUpdates: 2015,
                                        electricalUpdates: 2015,
                                        playam: false,
                                        hvacUpdates: 2015
                                    },
                                    occupancy: "Owner Occupied Bldg - More than 10%",
                                    LOI: 500000,
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
                                            seasonalIncrease: 25,
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
                                            sales: 500000
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
                                            limit: "500000"
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
                                            limit: "50000",
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
                                    premOpsILF: 1,
                                    cspCode: "0931",
                                    naicsCode: "445120",
                                    sprinklered: true
                                }
                            ],
                            countyName: "SAN DIEGO",
                            zip: "92104",
                            zipAddOn: "2509",
                            based: "riskAddress1",
                            streetType: "AVE",
                            address: "2819 POLK AVE",
                            postDir: "",
                            scrubberCalled: true,
                            WHExclusions: false,
                            recordType: "S",
                            rawProtectionClass: 3,
                            streetNum: 2819,
                            WHDeductiblePcnt: "5",
                            classCodes: "09361",
                            confirmation: "N/A",
                            addressLine: "2819 POLK AVE",
                            isoClassGroups: "Convenience Food/Gasoline Store/Restaurant",
                            unit: "",
                            scrubberResult: "Accepted",
                            secondaryName: "",
                            buildings: 1,
                            PPCAddressKey: "2819 POLK AVE:SAN DIEGO:CA:92104:2819:POLK:AVE",
                            preDir: "",
                            territory: "San Diego, San Diego"
                        }
                    ],
                    otherCOA: "2000000",
                    addtlIntInd: false,
                    proLiabInd: false
                },
                effectiveProduct: "BBOP"
            },
            products: "BBOP"
        };

        // send the JSON request

        log.info("=================== QUOTE REQUEST ===================");
        log.info(`Arrowhead BOP request (Appid: ${applicationDocData.mysqlId}):\n${JSON.stringify(requestJSON, null, 4)}`);
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
        log.info("=================== QUOTE RESULT ===================");
        // log.info(`Arrowhead BOP response (Appid: ${applicationDocData.mysqlId}):\n${JSON.stringify(result, null, 4)}`);
        // log.info(`Arrowhead BOP response (Appid: ${applicationDocData.mysqlId}):\n${JSON.stringify(JSON.parse(result), null, 4)}`);
        log.info(`Arrowhead BOP response (Appid: ${applicationDocData.mysqlId}):\n${JSON.stringify(result.data, null, 4)}`);
        log.info("=================== QUOTE RESULT ===================");

    }

}