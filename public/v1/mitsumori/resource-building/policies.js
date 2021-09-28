/* eslint-disable array-element-newline */
/* eslint-disable no-unused-vars */
"use strict";
const ApplicationBO = global.requireShared("models/Application-BO.js");
const AgencyLocationBO = global.requireShared("models/AgencyLocation-BO.js");
const ZipCodeBO = global.requireShared("models/ZipCode-BO.js");
const AMTrustAgencyNetworkId = 10;

exports.populatePolicyResources = async(resources, appId) => {
    deductibleAmounts(resources);

    // calls that need the application info go after this
    let applicationDB = null;
    const applicationBO = new ApplicationBO();
    try{
        applicationDB = await applicationBO.getById(appId);
    }
    catch(err){
        log.error("Error getting application doc " + err + __location);
    }

    // get states from application DB zipcode
    let zipCodeData = null;

    const zipCodeBO = new ZipCodeBO();
    try{
        const primaryLocation = applicationDB?.locations?.find(loc => loc.primary);
        zipCodeData = await zipCodeBO.loadByZipCode(primaryLocation?.zipcode);
    }
    catch(err){
        log.error("Error getting zipCodeData " + err + __location);
    }

    await policiesEnabled(resources, applicationDB);
    await limitsSelectionAmounts(resources, applicationDB, zipCodeData);
};

// Policy related, used for claims
exports.policyTypes = resources => {
    resources.policyTypes = [
        {
            value: "BOP",
            label: "Business Owners Policy"
        },
        {
            value: "GL",
            label: "General Liability"
        },
        {
            value: "WC",
            label: "Workers' Compensation"
        },
        {
            value: "CYBER",
            label: "Cyber Liability "
        },
        {
            value: "PL",
            label: "Professional Liability"
        }
    ];
};
const socialEngDeductibleList = [
    10000, 25000, 50000
];

const customSocialEngDeductibleList = {
    50000: [5000, 10000, 25000, 50000],
    100000: [10000, 25000, 50000],
    250000: [10000, 25000, 50000]
}
const cyberDeductibleList = [
    1000, 1500, 2500, 5000, 10000, 25000, 50000
];
const bopAndGlDeductibles = ['$1500','$1000','$500'];

const deductibleAmounts = resources => {
    resources.deductibleAmounts = {
        bop: bopAndGlDeductibles, // send back as seperate entry incase bop/gl change in the future
        gl: bopAndGlDeductibles, // send back as seperate entry incase bop/gl change in the future
        cyber: cyberDeductibleList,
        pl: cyberDeductibleList
    };
};
const policiesEnabled = async(resources, applicationDB) => {
    // defaultEnabledPolicies is the list of policies that can be enabled so if we add more policy types that we are supporting THOSE NEED TO BE INCLUDED in this list
    const defaultEnabledPolicies = [
        "BOP",
        "GL",
        "WC",
        "CYBER",
        "PL"
    ];
    const enabledPoliciesSet = new Set();

    if(applicationDB && applicationDB.hasOwnProperty('agencyId')){
        // given an agency grab all of its locations
        const agencyId = applicationDB.agencyId;
        const agencyLocationBO = new AgencyLocationBO();
        let locationList = null;
        const query = {"agencyId": agencyId}
        const getAgencyName = true;
        const getChildren = true;
        const useAgencyPrimeInsurers = true;
        let error = null;
        if(!error){
                if(applicationDB && applicationDB.lockAgencyLocationId === true && applicationDB.hasOwnProperty('agencyLocationId')){
                    let locationObj = await agencyLocationBO.getById(applicationDB.agencyLocationId).catch(function(err){
                        log.error(`Could not get agency location for agencyLocationId ${applicationDB.agencyLocationId} ` + err.message + __location);
                        error = err;
                    });
                    if(locationObj && locationObj.insurers && locationObj.insurers.length > 0){
                        // grab all the insurers
                        const locationInsurers = locationObj.insurers;
                        // for each insurer go through the list of policy type object
                        getPoliciesPerInsurer(locationInsurers, defaultEnabledPolicies, enabledPoliciesSet);
                    }
                }
                else {
                    locationList = await agencyLocationBO.getList(query, getAgencyName, getChildren, useAgencyPrimeInsurers).catch(function(err){
                        log.error(`Could not get agency locations for agencyId ${agencyId} ` + err.message + __location);
                        error = err;
                    });
                    if(locationList && locationList.length > 0){
                        // for each location go through the list of insurers
                        for(let i = 0; i < locationList.length; i++){
                            if(locationList[i].hasOwnProperty('insurers')){
                                // grab all the insurers
                                const locationInsurers = locationList[i].insurers;
                                // for each insurer go through the list of policy type object
                                getPoliciesPerInsurer(locationInsurers, defaultEnabledPolicies, enabledPoliciesSet);
                            }
                        }
                    }
                }
        }
    }
    let enabledPoliciesArray = null;
    if(enabledPoliciesSet.size > 0){
        enabledPoliciesArray = Array.from(enabledPoliciesSet);
    }
    resources.policiesEnabled = enabledPoliciesArray ? enabledPoliciesArray : defaultEnabledPolicies;
};

const getPoliciesPerInsurer = (locationInsurers, defaultEnabledPolicies, enabledPoliciesSet) => {
    for(let j = 0; j < locationInsurers.length; j++){
        const insurer = locationInsurers[j];
        if(insurer.hasOwnProperty('policyTypeInfo')){
            // for each default enabled policy type determine if policy is enabled for this insurer
            for(const pt of defaultEnabledPolicies){
                if(insurer.policyTypeInfo[pt] && insurer.policyTypeInfo[pt].enabled === true){
                    enabledPoliciesSet.add(pt);
                }
            }
        }
    }
}
const cyberAggregateLimitList = [
    50000, 100000, 250000, 500000, 750000, 1000000, 2000000, 3000000
];
const plAggregateLimitList = [
    50000, 100000, 250000, 500000, 750000, 1000000, 2000000, 3000000
];
const businessIncomeCoverageList = [
    100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 550000, 600000, 650000, 700000, 750000, 800000, 850000, 900000, 950000, 1000000
];
// TODO move into a cyber.js file where we will take a list of insurerIds and generate a selection list based on available selections
// Idea is to take the lists and combine the values into a unique list of selections
// For now the below will allow cowbell to quote more regularly
const customBusinessIncomeCoverageList = {
    50000: [5000, 7500, 10000, 12500, 15000, 17500, 20000, 22500, 25000, 27500, 30000, 32500, 50000],
    100000: [10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000, 65000, 70000, 75000, 80000, 85000, 90000, 95000, 100000],
    250000: [25000, 37500, 50000, 62500, 75000, 87500, 100000, 112500, 125000, 137500, 150000, 162500, 175000, 187500, 200000, 212500, 225000, 237500, 250000],
    500000: [50000, 75000, 100000, 125000, 150000, 175000, 200000, 225000, 250000, 275000, 300000, 325000, 350000, 375000, 400000, 425000, 450000, 475000, 500000],
    750000: [75000, 112500, 150000, 187500, 225000, 262500, 300000, 337500, 375000, 412500, 450000, 487500, 525000, 562500, 600000, 637500, 675000, 712500, 750000],
    1000000: [100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 550000, 600000, 650000, 700000, 750000, 800000, 850000, 900000, 950000, 1000000],
    2000000: [200000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000],
    3000000: [300000, 450000, 600000, 750000, 900000, 950000, 1000000]
}
const ransomPaymentLimitList = [
    250000, 500000, 1000000
];
const waitingPeriodList = [
    6, 8, 12, 24
];
const occurrenceLimitList = [
    25000, 50000, 100000, 250000, 500000, 750000, 1000000
];
const socialEngLimitList = [
    50000, 100000, 250000
];
const bopAndGlLimits = [
    "1000000/1000000/1000000",
    "1000000/2000000/1000000",
    "1000000/2000000/2000000"
];

// hard coded limits, user not able to change, if they select endorsement these values are set
const hardwareReplCostLimit = [50000];
const postBreachRemediationLimit = [50000];
const telecomsFraudEndorsementLimit = [50000];

const territoryWCLimits = {
    "CA": ["1000000/1000000/1000000"],
    "OR": [
        "500000/500000/500000",
        "500000/1000000/500000",
        "1000000/1000000/1000000"
    ]
};

// does it match helpers.limits ?
const limitsSelectionAmounts = async(resources, applicationDB, zipCodeData) => {
    const limits = {
        bop: bopAndGlLimits,
        gl: bopAndGlLimits,
        wc: getWCLimits(applicationDB?.agencyNetworkId, zipCodeData?.state),
        cyber: {aggregateLimitList: cyberAggregateLimitList},
        pl: {
            aggregateLimitList: plAggregateLimitList,
            occurrenceLimitList: occurrenceLimitList
        }
    };

    resources.limitsSelectionAmounts = {...limits};
};

const getWCLimits = (agencyNetworkId, territory) => {
    // start with default, change on territory, THEN remove insurer values
    let limits = [
        "100000/500000/100000",
        "500000/500000/500000",
        "500000/1000000/500000",
        "1000000/1000000/1000000"
    ];

    // territory wins limit amounts
    if(territory && territoryWCLimits[territory]){
        limits = territoryWCLimits[territory];
    }

    // remove any limits the insurer does not want
    if(agencyNetworkId === AMTrustAgencyNetworkId){
        // TODO: this will come from DB eventually, agency network level.
        const limitsToRemove = ["500000/1000000/500000"];
        limits = limits.filter(lim => !limitsToRemove.includes(lim));
    }

    return limits;
};