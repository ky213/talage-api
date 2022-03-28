/* eslint-disable require-jsdoc */
/* eslint-disable object-curly-newline */
/* eslint-disable default-case */
const ApplicationBO = global.requireShared("models/Application-BO.js");
const AgencyLocationBO = global.requireShared("models/AgencyLocation-BO.js");
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO');
const InsurerBO = global.requireShared('./models/Insurer-BO.js');

// higher values will override lower values
// if one policy says hidden and another says required then (hidden < required): it will be required

// if the property is NOT provided:
// It will be assumed optional

// the client side handles some of the requirements for now, for things that are always required

// if hidden the property will not show
const hidden = 0;

// if optional the property will show, and be OPTIONAL
const optional = 5;

// if required the property will show, and be REQUIRED
const required = 10;


const policyBasedRequiredFields = {
    BOP:{
        location: {
            activityPayrollList: {requirement: optional},
            buildingLimit: {requirement: optional},
            businessPersonalPropertyLimit: {requirement: optional},
            own: {requirement: optional},
            numStories: {requirement: required},
            constructionType: {requirement: required},
            yearBuilt: {requirement: required},
            unemployment_num: {requirement: hidden},
            full_time_employees: {requirement: hidden},
            part_time_employees: {requirement: hidden},
            square_footage: {requirement: required},
            bop: {
                requirement: required,
                sprinklerEquipped: {requirement: optional},
                fireAlarmType: {requirement: required},
                roofingImprovementYear: {requirement: required},
                wiringImprovementYear: {requirement: required},
                heatingImprovementYear: {requirement: required},
                plumbingImprovementYear: {requirement: required}
            }
        },
        grossSalesAmt: {requirement: required},
        ein: {requirement: optional},
        website: {requirement: optional},
        coverageLapseWC: {requirement: hidden},
        yearsOfExp: {requirement: required},
        fireCode: {required: hidden},
        owner: {
            requirement: optional,
            officerTitle: {requirement: optional},
            birthdate: {requirement: optional},
            ownership: {requirement: optional},
            payroll: {requirement: optional}
        }
    },
    GL: {
        location: {
            activityPayrollList: {requirement: optional},
            buildingLimit: {requirement: hidden},
            businessPersonalPropertyLimit: {requirement: hidden},
            own: {requirement: hidden},
            numStories: {requirement: hidden},
            constructionType: {requirement: hidden},
            yearBuilt: {requirement: hidden},
            unemployment_num: {requirement: hidden},
            full_time_employees: {requirement: hidden},
            part_time_employees: {requirement: hidden},
            square_footage: {requirement: required},
            bop: {
                requirement: hidden,
                sprinklerEquipped: {requirement: hidden},
                fireAlarmType: {requirement: hidden},
                roofingImprovementYear: {requirement: hidden},
                wiringImprovementYear: {requirement: hidden},
                heatingImprovementYear: {requirement: hidden},
                plumbingImprovementYear: {requirement: hidden}
            }
        },
        grossSalesAmt: {requirement: required},
        ein: {requirement: optional},
        coverageLapseWC: {requirement: hidden},
        website: {requirement: optional},
        yearsOfExp: {requirement: required},
        fireCode: {required: hidden},
        owner: {
            requirement: hidden
        }
    },
    WC: {
        owner: {
            requirement: required,
            officerTitle: {requirement: optional},
            birthdate: {requirement: required}
            // ownership: {requirement: hidden},
            // payroll: {requirement: hidden}
        },
        location: {
            activityPayrollList: {requirement: required},
            buildingLimit: {requirement: hidden},
            businessPersonalPropertyLimit: {requirement: hidden},
            own: {requirement: hidden},
            numStories: {requirement: hidden},
            constructionType: {requirement: hidden},
            yearBuilt: {requirement: hidden},
            unemployment_num: {requirement: required},
            full_time_employees: {requirement: hidden},
            part_time_employees: {requirement: hidden},
            square_footage: {requirement: hidden},
            bop: {
                requirement: hidden,
                sprinklerEquipped: {requirement: hidden},
                fireAlarmType: {requirement: hidden},
                roofingImprovementYear: {requirement: hidden},
                wiringImprovementYear: {requirement: hidden},
                heatingImprovementYear: {requirement: hidden},
                plumbingImprovementYear: {requirement: hidden}
            }
        },
        grossSalesAmt: {requirement: hidden},
        ein: {requirement: required},
        website: {requirement: optional},
        yearsOfExp: {requirement: required},
        fireCode: {required: hidden}
    },
    PL: {
        location: {
            square_footage: {requirement: hidden},
            activityPayrollList: {requirement: required},
            buildingLimit: {requirement: hidden},
            businessPersonalPropertyLimit: {requirement: hidden},
            own: {requirement: hidden},
            numStories: {requirement: hidden},
            constructionType: {requirement: hidden},
            yearBuilt: {requirement: hidden},
            unemployment_num: {requirement: hidden},
            full_time_employees: {requirement: hidden},
            part_time_employees: {requirement: hidden},
            bop: {
                sprinklerEquipped: {requirement: hidden},
                requirement: hidden,
                fireAlarmType: {requirement: hidden},
                roofingImprovementYear: {requirement: hidden},
                wiringImprovementYear: {requirement: hidden},
                heatingImprovementYear: {requirement: hidden},
                plumbingImprovementYear: {requirement: hidden}
            }
        },
        website: {requirement: hidden},
        grossSalesAmt: {requirement: required},
        ein: {requirement: hidden},
        yearsOfExp: {requirement: required},
        coverageLapseWC: {requirement: hidden},
        fireCode: {required: hidden},
        owner: {
            requirement: hidden
        }
    },
    CYBER: {
        location: {
            activityPayrollList: {requirement: hidden},
            buildingLimit: {requirement: hidden},
            businessPersonalPropertyLimit: {requirement: hidden},
            own: {requirement: hidden},
            numStories: {requirement: hidden},
            constructionType: {requirement: hidden},
            yearBuilt: {requirement: hidden},
            unemployment_num: {requirement: hidden},
            full_time_employees: {requirement: required},
            part_time_employees: {requirement: optional},
            square_footage: {requirement: hidden},
            bop: {
                requirement: hidden,
                sprinklerEquipped: {requirement: hidden},
                fireAlarmType: {requirement: hidden},
                roofingImprovementYear: {requirement: hidden},
                wiringImprovementYear: {requirement: hidden},
                heatingImprovementYear: {requirement: hidden},
                plumbingImprovementYear: {requirement: hidden}
            }
        },
        grossSalesAmt: {requirement: hidden},
        ein: {requirement: hidden},
        website: {requirement: hidden},
        yearsOfExp: {requirement: hidden},
        coverageLapseWC: {requirement: hidden},
        fireCode: {required: hidden},
        owner: {
            requirement: hidden
        }
    }
};


// const bopRequirements = {
//     location: {
//         activityPayrollList: {requirement: optional},
//         buildingLimit: {requirement: optional},
//         businessPersonalPropertyLimit: {requirement: optional},
//         own: {requirement: optional},
//         numStories: {requirement: required},
//         constructionType: {requirement: required},
//         yearBuilt: {requirement: required},
//         unemployment_num: {requirement: hidden},
//         full_time_employees: {requirement: hidden},
//         part_time_employees: {requirement: hidden},
//         square_footage: {requirement: required},
//         bop: {
//             requirement: required,
//             sprinklerEquipped: {requirement: optional},
//             fireAlarmType: {requirement: required},
//             roofingImprovementYear: {requirement: required},
//             wiringImprovementYear: {requirement: required},
//             heatingImprovementYear: {requirement: required},
//             plumbingImprovementYear: {requirement: required}
//         }
//     },
//     grossSalesAmt: {requirement: required},
//     ein: {requirement: optional},
//     website: {requirement: optional},
//     coverageLapseWC: {requirement: hidden},
//     yearsOfExp: {requirement: required},
//     owner: {
//         requirement: optional,
//         officerTitle: {requirement: hidden},
//         birthdate: {requirement: hidden},
//         ownership: {requirement: hidden},
//         payroll: {requirement: hidden}
//     }
// };

// const glRequirements = {
//     location: {
//         activityPayrollList: {requirement: optional},
//         buildingLimit: {requirement: hidden},
//         businessPersonalPropertyLimit: {requirement: hidden},
//         own: {requirement: hidden},
//         numStories: {requirement: hidden},
//         constructionType: {requirement: hidden},
//         yearBuilt: {requirement: hidden},
//         unemployment_num: {requirement: hidden},
//         full_time_employees: {requirement: hidden},
//         part_time_employees: {requirement: hidden},
//         square_footage: {requirement: required},
//         bop: {
//             requirement: hidden,
//             sprinklerEquipped: {requirement: hidden},
//             fireAlarmType: {requirement: hidden},
//             roofingImprovementYear: {requirement: hidden},
//             wiringImprovementYear: {requirement: hidden},
//             heatingImprovementYear: {requirement: hidden},
//             plumbingImprovementYear: {requirement: hidden}
//         }
//     },
//     grossSalesAmt: {requirement: required},
//     ein: {requirement: optional},
//     coverageLapseWC: {requirement: hidden},
//     website: {requirement: optional},
//     yearsOfExp: {requirement: required},
//     owner: {
//         requirement: hidden
//     }
// };

// const wcRequirements = {
//     owner: {
//         requirement: required,
//         officerTitle: {requirement: optional},
//         birthdate: {requirement: required}
//         // ownership: {requirement: hidden},
//         // payroll: {requirement: hidden}
//     },
//     location: {
//         activityPayrollList: {requirement: required},
//         buildingLimit: {requirement: hidden},
//         businessPersonalPropertyLimit: {requirement: hidden},
//         own: {requirement: hidden},
//         numStories: {requirement: hidden},
//         constructionType: {requirement: hidden},
//         yearBuilt: {requirement: hidden},
//         unemployment_num: {requirement: required},
//         full_time_employees: {requirement: hidden},
//         part_time_employees: {requirement: hidden},
//         square_footage: {requirement: hidden},
//         bop: {
//             requirement: hidden,
//             sprinklerEquipped: {requirement: hidden},
//             fireAlarmType: {requirement: hidden},
//             roofingImprovementYear: {requirement: hidden},
//             wiringImprovementYear: {requirement: hidden},
//             heatingImprovementYear: {requirement: hidden},
//             plumbingImprovementYear: {requirement: hidden}
//         }
//     },
//     grossSalesAmt: {requirement: hidden},
//     ein: {requirement: required},
//     website: {requirement: optional},
//     yearsOfExp: {requirement: required}
// };

// const plRequirements = {
//     location: {
//         square_footage: {requirement: hidden},
//         activityPayrollList: {requirement: required},
//         buildingLimit: {requirement: hidden},
//         businessPersonalPropertyLimit: {requirement: hidden},
//         own: {requirement: hidden},
//         numStories: {requirement: hidden},
//         constructionType: {requirement: hidden},
//         yearBuilt: {requirement: hidden},
//         unemployment_num: {requirement: hidden},
//         full_time_employees: {requirement: hidden},
//         part_time_employees: {requirement: hidden},
//         bop: {
//             sprinklerEquipped: {requirement: hidden},
//             requirement: hidden,
//             fireAlarmType: {requirement: hidden},
//             roofingImprovementYear: {requirement: hidden},
//             wiringImprovementYear: {requirement: hidden},
//             heatingImprovementYear: {requirement: hidden},
//             plumbingImprovementYear: {requirement: hidden}
//         }
//     },
//     website: {requirement: hidden},
//     grossSalesAmt: {requirement: required},
//     ein: {requirement: hidden},
//     yearsOfExp: {requirement: required},
//     coverageLapseWC: {requirement: hidden},
//     owner: {
//         requirement: hidden
//     }
// };

// const cyberRequirements = {
//     location: {
//         activityPayrollList: {requirement: hidden},
//         buildingLimit: {requirement: hidden},
//         businessPersonalPropertyLimit: {requirement: hidden},
//         own: {requirement: hidden},
//         numStories: {requirement: hidden},
//         constructionType: {requirement: hidden},
//         yearBuilt: {requirement: hidden},
//         unemployment_num: {requirement: hidden},
//         full_time_employees: {requirement: required},
//         part_time_employees: {requirement: optional},
//         square_footage: {requirement: hidden},
//         bop: {
//             requirement: hidden,
//             sprinklerEquipped: {requirement: hidden},
//             fireAlarmType: {requirement: hidden},
//             roofingImprovementYear: {requirement: hidden},
//             wiringImprovementYear: {requirement: hidden},
//             heatingImprovementYear: {requirement: hidden},
//             plumbingImprovementYear: {requirement: hidden}
//         }
//     },
//     grossSalesAmt: {requirement: hidden},
//     ein: {requirement: hidden},
//     website: {requirement: hidden},
//     yearsOfExp: {requirement: hidden},
//     coverageLapseWC: {requirement: hidden},
//     owner: {
//         requirement: hidden
//     }
// };

exports.requiredFields = async(appId) => {
    let applicationDB = null;
    const applicationBO = new ApplicationBO();
    try{
        applicationDB = await applicationBO.getById(appId);
    }
    catch(err){
        log.error("Error getting application doc " + err + __location);
    }
    if(!applicationDB){
        return {};
    }

    let POLICY_TYPE_BASED = true

    // Get AgencyLcoation Doc ot get insurer and policyType by insurer supported
    // for this applications.
    let agencyLocationDB = null;
    let insurerList = [];
    const agencyLcoationBO = new AgencyLocationBO();
    POLICY_TYPE_BASED = false
    try{
        log.debug(`Loading Agency Location Id ${applicationDB.agencyLocationId} ` + __location)
        agencyLocationDB = await agencyLcoationBO.getById(applicationDB.agencyLocationId);
        if(agencyLocationDB.useAgencyPrime){
            //load AgencyPrime's location
            log.debug(`USING PRIME Agency Location Id For ${applicationDB.agencyLocationId} ` + __location)
            agencyLocationDB = await agencyLcoationBO.getAgencyPrimeLocation(agencyLocationDB.agencyId,agencyLocationDB.agencyNetworkId);
        }
    }
    catch(err){
        log.error("requiredFields - Error getting agencyLcoation doc " + err + __location);
    }

    if(!agencyLocationDB){
        //no agencylocation fall back to policy_type based required Fields.
        log.warn(`Failing back to  Default Required Fields b/c agency location appId  ${appId}` + __location)
        POLICY_TYPE_BASED = true
    }
    else {
        // load full insuers list so we only do 1 DB or Redis hit for the insurers.
        const insurerBO = new InsurerBO();
        try{
            insurerList = await insurerBO.getList();
        }
        catch(err){
            log.error("requiredFields -Error getting insurerList " + err + __location);
            POLICY_TYPE_BASED = true
        }
    }


    // Get insurer required fields by policytype.

    let requiredFields = null;
    if(applicationDB && applicationDB.hasOwnProperty('policies')){
        for(const policyData of applicationDB.policies){
            // if the policyType is not defined for any reason, just skip it
            if(!policyData.policyType){
                continue;
            }


            const ptCode = policyData.policyType.toUpperCase()
            if(POLICY_TYPE_BASED){
                requiredFields = processPolicyTypeJson(policyBasedRequiredFields[ptCode], requiredFields);
            }
            else {
                const ptInsurerList = getAgencyLocationsInsurerByPolicyType(agencyLocationDB, ptCode, insurerList);
                if(ptInsurerList.length > 0){
                    for(const ptInsurer of ptInsurerList){
                        if(ptInsurer.requiredFields && ptInsurer.requiredFields[ptCode]) {
                            log.debug(`Using Insurer Required Fields insurerId ${ptInsurer.insurerId} ${ptCode}` + __location)
                            requiredFields = processPolicyTypeJson(ptInsurer.requiredFields[ptCode], requiredFields);
                        }
                        else {
                            log.warn(`Failing back to  Default Required Fields for insurerId ${ptInsurer.insurerId} ${ptCode}` + __location)
                            requiredFields = processPolicyTypeJson(policyBasedRequiredFields[ptCode], requiredFields);
                        }
                    }
                }
                else {
                    log.warn(`Failing back to  Default Required Fields for NO insurers for  ${ptCode}` + __location)
                    requiredFields = processPolicyTypeJson(policyBasedRequiredFields[ptCode], requiredFields);
                }
            }
        }
        //remove full_time_employees && part_time_employees if activityPayrollList is shown.
        if(requiredFields?.location && requiredFields?.location.activityPayrollList.requirement > 0){
            requiredFields.location.full_time_employees.requirement = 0
            requiredFields.location.part_time_employees.requirement = 0
        }
        //TODO check for old app that does not have activityPayrollList, but does have full_time_employee or requires it.


        // apply agency network overrides
        let agencyNetworkDB = null;
        const agencyNetworkBO = new AgencyNetworkBO();
        try{
            agencyNetworkDB = await agencyNetworkBO.getById(applicationDB.agencyNetworkId);
        }
        catch(err){
            log.error("Error getting agencyNetwork doc " + err + __location);
        }

        if(agencyNetworkDB?.appRequirementOverrides){
            const newRequirements = {};
            overrideRequiredObject(agencyNetworkDB.appRequirementOverrides, requiredFields, newRequirements);
            requiredFields = newRequirements;
        }


        //Software Hook to override optional fields per Agency Network.
        const dataPackageJSON = {
            appDoc: applicationDB,
            agencyNetworkDB: agencyNetworkDB,
            requiredFields: requiredFields
        }
        const hookName = 'app-requiredfields'
        try{
            await global.hookLoader.loadhook(hookName, applicationDB.agencyNetworkId, dataPackageJSON);
            requiredFields = dataPackageJSON.requiredFields
        }
        catch(err){
            log.error(`Error ${hookName} hook call error ${err}` + __location);
        }
    }
    return requiredFields;
};


// process policytype base adding of PolicyType Required fields.
function processPolicyTypeJson(policyTypeRequiredFieldJson, requiredFields){
    const newRequirements = {};
    if(requiredFields){
        combineRequiredObjects(requiredFields, policyTypeRequiredFieldJson, newRequirements);
    }
    else {
        populateSingleRequiredObject(policyTypeRequiredFieldJson, newRequirements);
    }
    return newRequirements;
}

function getAgencyLocationsInsurerByPolicyType(agencyLocationDB, policyType, insurerList){
    const policyTypeInsurerList = []
    //loop through AL.insurers.
    for (const alInsurer of agencyLocationDB.insurers){
        if(alInsurer.policyTypeInfo[policyType] && alInsurer.policyTypeInfo[policyType].enabled === true){
            const insurerDoc = insurerList.find((i) => i.insurerId === alInsurer.insurerId);
            if(insurerDoc){
                policyTypeInsurerList.push(insurerDoc)
            }

        }
    }
    return policyTypeInsurerList;
}


// combine objects, this needs to merge both objects with higher values taking precedence
const combineRequiredObjects = (obj1, obj2, newObj) => {
    const keysToSkip = ["requirement"];

    // if we hit the bottom on an object, just set it to empty (the behavior is the same as not providing the prop)
    let object1 = obj1;
    if(!object1){
        object1 = {};
    }
    let object2 = obj2;
    if(!object2){
        object2 = {};
    }

    // combine the objects to make an amalgamation to use for navigating the keys
    const navObj = {
        ...object1,
        ...object2
    };
    for(const key in navObj){
        if(!keysToSkip.includes(key)){
            newObj[key] = {};

            // if the property is NOT provided:
            // requirement is assumed optional

            if(!object1[key]){
                object1[key] = {};
            }
            if(!object2[key]){
                object2[key] = {};
            }

            if(!object1[key].hasOwnProperty("requirement")){
                object1[key].requirement = optional;
            }
            if(!object2[key].hasOwnProperty("requirement")){
                object2[key].requirement = optional;
            }

            // if the property is provided:
            // highest value wins, if they are equal it doesn't matter which is assigned
            newObj[key].requirement = object1[key].requirement > object2[key].requirement ? object1[key].requirement : object2[key].requirement;

            combineRequiredObjects(object1[key], object2[key], newObj[key]);
        }
    }
}

const populateSingleRequiredObject = (obj, newObj) => {
    const keysToSkip = ["requirement"];

    // For single object we know all the keys are present
    for(const key in obj){
        if(!keysToSkip.includes(key)){
            newObj[key] = {};

            // if requirement is provided, check it, otherwise optional
            if(obj[key].hasOwnProperty("requirement")){
                newObj[key].requirement = obj[key].requirement;
            }
            else{
                newObj[key].requirement = optional;
            }

            populateSingleRequiredObject(obj[key], newObj[key]);
        }
    }
}

const overrideRequiredObject = (override, requirementObj, newObj) => {
    const keysToSkip = ["requirement"];

    // if we hit the bottom on an object, just set it to empty (the behavior is the same as not providing the prop)
    if(!override){
        override = {};
    }
    if(!requirementObj){
        requirementObj = {};
    }

    // combine the objects to make an amalgamation to use for navigating the keys
    const navObj = {
        ...override,
        ...requirementObj
    };
    for(const key in navObj){
        if(!keysToSkip.includes(key)){
            newObj[key] = {};

            // if the override didnt provide a requirement, use the original value
            if(!override[key] || !override[key].hasOwnProperty("requirement")){
                if(requirementObj.hasOwnProperty(key)){
                    newObj[key].requirement = requirementObj[key].requirement;
                }
                else{
                    // if the value was never set on either, set optional
                    newObj[key].requirement = optional;
                }
            }
            // otherwise use the override value
            else{
                newObj[key].requirement = override[key].requirement;
            }

            overrideRequiredObject(override[key], requirementObj[key], newObj[key]);
        }
    }
}