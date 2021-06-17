"use strict";
const ApplicationBO = global.requireShared("models/Application-BO.js");
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');

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
    await policiesEnabled(resources, applicationDB);
    await limitsSelectionAmounts(resources, applicationDB);
};

// Policy related, used for claims
exports.policyTypes = resources => {
    resources.policyTypes = [
        {
            value: "BOP",
            label: "Business Owners Policy (BOP)"
        },
        {
            value: "GL",
            label: "General Liability (GL)"
        },
        {
            value: "WC",
            label: "Workers' Compensation (WC)"
        },
        {
            value: "CYBER",
            label: "Cyber Liability"
        }
    ];
};
const socialEngDeductibleList = [
    10000, 25000, 50000
];
const cyberDeductibleList = [
    1000, 1500, 2500, 5000, 10000, 25000, 50000
];
const bopAndGlDeductibles = ['$1500','$1000','$500'];

const deductibleAmounts = resources => {
    resources.deductibleAmounts = {
        bop: bopAndGlDeductibles, // send back as seperate entry incase bop/gl change in the future
        gl: bopAndGlDeductibles, // send back as seperate entry incase bop/gl change in the future
        cyber: {
            cyberDeductibleList,
            socialEngDeductibleList
        },
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
        locationList = await agencyLocationBO.getList(query, getAgencyName, getChildren, useAgencyPrimeInsurers).catch(function(err){
            log.error(`Could not get agency locations for agencyId ${agencyId} ` + err.message + __location);
            error = err;
        });
        if(!error){
            if(locationList && locationList.length > 0){
                // for each location go through the list of insurers
                for(let i = 0; i < locationList.length; i++){
                    if(locationList[i].hasOwnProperty('insurers')){
                        // grab all the insurers
                        const locationInsurers = locationList[i].insurers;
                        // for each insurer go through the list of policy type object
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
const cyberAggregateLimitList = [
    50000, 100000, 250000, 500000, 750000, 1000000, 2000000, 3000000, 4000000, 5000000
];
const plAggregateLimitList = [
    50000, 100000, 250000, 500000, 750000, 1000000, 2000000, 3000000
];
const businessIncomeCoverageList = [
    100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 550000, 600000, 650000, 700000, 750000, 800000, 850000, 900000, 950000, 1000000
];
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
    {
        "key": "1000000/1000000/1000000",
        "value": "$1,000,000 / $1,000,000 / $1,000,000"
    },
    {
        "key": "1000000/2000000/1000000",
        "value": "$1,000,000 / $2,000,000 / $1,000,000"
    },
    {
        "key": "1000000/2000000/2000000",
        "value": "$1,000,000 / $2,000,000 / $2,000,000"
    }
]

// hard coded limits, user not able to change, if they select endorsement these values are set
const hardwareReplCostLimit = [50000];
const postBreachRemediationLimit = [50000];
const telecomsFraudEndorsementLimit = [50000];

// does it match helpers.limits ?
const limitsSelectionAmounts = async(resources, applicationDB) => {
    const limits = {
        bop: bopAndGlLimits,
        gl: bopAndGlLimits,
        wc: [
            {
                "key": "100000/500000/100000",
                "value": "$100,000 / $500,000 / $100,000"
            },
            {
                "key": "500000/500000/500000",
                "value": "$500,000 / $500,000 / $500,000"
            },
            {
                "key": "500000/1000000/500000",
                "value": "$500,000 / $1,000,000 / $500,000"
            },
            {
                "key": "1000000/1000000/1000000",
                "value": "$1,000,000 / $1,000,000 / $1,000,000"
            }
        ],
        cyber: {
            aggregateLimitList: cyberAggregateLimitList,
            businessIncomeCoverageList,
            ransomPaymentLimitList,
            socialEngLimitList,
            waitingPeriodList,
            hardcodedLimits: {
                hardwareReplCostLimit,
                postBreachRemediationLimit,
                telecomsFraudEndorsementLimit
            }
        },
        pl: {
            aggregateLimitList: plAggregateLimitList,
            occurrenceLimitList
        }
    };

    if(applicationDB && applicationDB.hasOwnProperty('agencyId')){
        const arrowHeadInsurerId = 27;
        // TODO: make this smart logic where we don't do hardcoded check
        // given an agency grab all of its locations
        const agencyId = applicationDB.agencyId;
        const agencyLocationBO = new AgencyLocationBO();
        let locationList = null;
        const query = {"agencyId": agencyId}
        const getAgencyName = true;
        const getChildren = true;
        const useAgencyPrimeInsurers = true;
        let error = null;
        locationList = await agencyLocationBO.getList(query, getAgencyName, getChildren, useAgencyPrimeInsurers).catch(function(err){
            log.error(`Could not get agency locations for agencyId ${agencyId} ` + err.message + __location);
            error = err;
        });
        if(!error){
            if(locationList && locationList.length > 0){
                // for each location go through the list of insurers
                for(let i = 0; i < locationList.length; i++){
                    if(locationList[i].hasOwnProperty('insurers')){
                        // grab all the insurers
                        const locationInsurers = locationList[i].insurers;
                        if(locationInsurers && locationInsurers.length > 0){
                            // grab all the insurer ids
                            const insurerIdList = locationInsurers.map(insurerObj => insurerObj.insurerId);
                            // are any of the insurer id equal 27
                            if(insurerIdList && insurerIdList.includes(arrowHeadInsurerId)){
                                limits.bop = [{
                                    "key": "1000000/1000000/1000000",
                                    "value": "$1,000,000 / $1,000,000 / $1,000,000"
                                }];
                                if(insurerIdList.length > 1){
                                    log.error(`Arrow Head agency #${agencyId} has other insurers configured for location #${locationList[i].systemId}. Arrow Head agencies should only have 1 insurer configured. Please fix configuration.`);
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    resources.limitsSelectionAmounts = {...limits};
};