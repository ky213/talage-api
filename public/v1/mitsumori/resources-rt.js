/* eslint-disable default-case */
/* eslint-disable object-curly-newline */
/* eslint-disable require-jsdoc */

"use strict";
const serverHelper = require("../../../server.js");
// const validator = global.requireShared("./helpers/validator.js");
 const ApplicationBO = global.requireShared("models/Application-BO.js");
// const AgencyBO = global.requireShared('models/Agency-BO.js');
 const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
// const ApplicationQuoting = global.requireRootPath('public/v1/quote/helpers/models/Application.js');
// const ActivityCodeBO = global.requireShared('models/ActivityCode-BO.js');

// dummy endpoint to stimulate resources
async function getResources(req, res, next){
    // Let basic through with no app id
    if (!req.query.page || !req.query.appId && req.query.page !== "_basic") {
        log.info('Bad Request: Parameters missing' + __location);
        return next(serverHelper.requestError('Parameters missing'));
    }
    // This endpoint recieves application Id, we should be able to utilize that to make this endpoint smart, i.e. agencyId for the application to determine policy limits
    const resources = {};

    switch(req.query.page) {
        case "_business-questions":
            membershipTypes(resources);
            break;
        case "_basic":
        case "_basic-created":
            entityTypes(resources);
            break;
        case "_business":
            break;
        case "_claims":
            policyTypes(resources);
            break;
        case "_locations":
            territories(resources);
            employeeTypes(resources);
            unemploymentNumberStates(resources);
            break;
        case "_mailing-address":
            territories(resources);
            break;
        case "_officers":
            officerTitles(resources);
            break;
        case "_policies":
            await limitsSelectionAmounts(resources, req);
            deductibleAmounts(resources);
            await policiesEnabled(resources, req);
            break;
    }

    res.send(200, resources);
}
const membershipTypes = resources => {
    resources.membershipTypes = ['Nevada Resturant Association'];
}
const policiesEnabled = async (resources, req) => {
    // defaultEnabledPolicies is the list of policies that can be enabled so if we add more policy types that we are supporting THOSE NEED TO BE INCLUDED in this list
    const defaultEnabledPolicies = [
        "BOP",
        "GL",
        "WC"
    ];
    const enabledPoliciesSet = new Set();
    let applicationDB = null;
    const applicationBO = new ApplicationBO();
    try{
        applicationDB = await applicationBO.getById(req.query.appId);
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
    }
    if(applicationDB && applicationDB.applicationId && applicationDB.hasOwnProperty('agencyId')){
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
            log.error(`Could not get agency locations for agencyId ${agencyId} `+ err.message + __location);
            error = err;
        });
        // console.log(JSON.stringify(locationList));
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
                            if(insurer.hasOwnProperty('policyTypeInfo'))
                            // for each default enabled policy type determine if policy is enabled for this insurer 
                            for( const pt of defaultEnabledPolicies){
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
    let enabledPoliciesArray = null;
    if(enabledPoliciesSet.size > 0){
        enabledPoliciesArray = Array.from(enabledPoliciesSet);
    }
    resources.policiesEnabled = enabledPoliciesArray ? enabledPoliciesArray : defaultEnabledPolicies;
}

const policyTypes = resources => {
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
        }
    ];
};

const limitsSelectionAmounts = async (resources, req) => {
    let limits = {
        bop: [
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
        ],
        gl: [
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
        ],
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
        ]
    };
        
    let applicationDB = null;
    const applicationBO = new ApplicationBO();
    try{
        applicationDB = await applicationBO.getById(req.query.appId);
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
    }
    if(applicationDB && applicationDB.applicationId && applicationDB.hasOwnProperty('agencyId')){
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
            log.error(`Could not get agency locations for agencyId ${agencyId} `+ err.message + __location);
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
                            const insurerIdList =  locationInsurers.map(insurerObj => insurerObj.insurerId);
                            // are any of the insurer id equal 27
                            if(insurerIdList && insurerIdList.includes(arrowHeadInsurerId)){
                                limits['bop'] = [ {
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
}

const deductibleAmounts = resources => {
    resources.deductibleAmounts = {
        bop: ["$1500",
            "$1000",
            "$500"],
        gl: ["$1500",
            "$1000",
            "$500"]
    };
}


const unemploymentNumberStates = resources => {
    resources.unemploymentNumberStates = [
        "CO",
        "HI",
        "ME",
        "MI",
        "MN",
        "NJ",
        "RI",
        "UT"
    ];
}

const officerTitles = resources => {
    // TODO: pull from officer_titles table (sql db)
    resources.officerTitles =
    [
        "Chief Executive Officer",
        "Chief Financial Officer",
        "Chief Operating Officer",
        "Director",
        "Vice President",
        "Executive Vice President",
        "Executive Secy-VP",
        "Executive Secretary",
        "Treasurer",
        "Secy-Treas",
        "Secretary",
        "President",
        "Pres-VP-Secy-Treas",
        "Pres-VP-Secy",
        "Pres-VP",
        "Pres-Treas",
        "Pres-Secy-Treas",
        "Pres-Secy",
        "VP-Treas",
        "VP-Secy-Treas",
        "VP-Secy"
    ];
}

const employeeTypes = resources => {
    resources.employeeTypes =
    [
        "Full Time",
        "Part Time",
        "Owners",
        "Contractors (1099)"
    ];
}

const entityTypes = resources => {
    resources.entityTypes =
    [
        "Association",
        "Corporation (C-Corp)",
        "Corporation (S-Corp)",
        "Non Profit Corporation",
        "Limited Liability Company (Member Managed)",
        "Limited Liability Company (Manager Managed)",
        "Limited Partnership",
        "Partnership",
        "Sole Proprietorship",
        "Other"
    ];
}

const territories = resources => {
    resources.territories =
    [
        "AK",
        "AL",
        "AR",
        "AZ",
        "CA",
        "CO",
        "CT",
        "DC",
        "DE",
        "FL",
        "GA",
        "HI",
        "IA",
        "ID",
        "IL",
        "IN",
        "KS",
        "KY",
        "LA",
        "MA",
        "MD",
        "ME",
        "MI",
        "MN",
        "MO",
        "MS",
        "MT",
        "NC",
        "ND",
        "NE",
        "NH",
        "NJ",
        "NM",
        "NV",
        "NY",
        "OH",
        "OK",
        "OR",
        "PA",
        "PR",
        "RI",
        "SC",
        "SD",
        "TN",
        "TX",
        "UT",
        "VA",
        "VT",
        "WA",
        "WI",
        "WV",
        "WY"
    ];
}

async function getRemoteAddress(req, res, next){
    const remoteAdd = req.connection.remoteAddress;
    if(!remoteAdd){
        next(serverHelper.requestError(`Unable to detect the remote address.`))
    }
    res.send(200, {remoteAddress: req.connection.remoteAddress});
}
/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAppWF("Get Next Route", `${basePath}/resources`, getResources);
    server.addGetAuthAppWF("Get IP Info", `${basePath}/remote-address`, getRemoteAddress);
}