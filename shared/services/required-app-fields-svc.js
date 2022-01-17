/* eslint-disable object-curly-newline */
/* eslint-disable default-case */
const ApplicationBO = global.requireShared("models/Application-BO.js");
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO');

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

const bopRequirements = {
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
    coverageLapseWC: {requirement: hidden},
    yearsOfExp: {requirement: required}
};

const glRequirements = {
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
    coverageLapseWC: {requirement: hidden},
    yearsOfExp: {requirement: required}
};

const wcRequirements = {
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
    yearsOfExp: {requirement: required}
};

const plRequirements = {
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
    grossSalesAmt: {requirement: required},
    yearsOfExp: {requirement: required},
    coverageLapseWC: {requirement: hidden}
};

const cyberRequirements = {
    location: {
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
        square_footage: {requirement: hidden},
        bop: {
            requirement: hidden,
            sprinklerEquipped: {requirement: hidden},
            fireAlarmType: {requirement: hidden},
            roofingImprovementYear: {requirement: hidden},
            wiringImprovementYear: {requirement: hidden},
            heatingImprovementYear: {requirement: hidden},
            plumbingImprovementYear: {requirement: hidden}
        },
        owner: {
            requirement: hidden
        }
    },
    grossSalesAmt: {requirement: hidden},
    ein: {requirement: hidden},
    website: {requirement: hidden},
    yearsOfExp: {requirement: hidden},
    coverageLapseWC: {requirement: hidden}
};

exports.requiredFields = async(appId) => {
    let applicationDB = null;
    const applicationBO = new ApplicationBO();
    try{
        applicationDB = await applicationBO.getById(appId);
    }
    catch(err){
        log.error("Error getting application doc " + err + __location);
    }
    // TODO Get insurer required fields by policytype.
    // starting point is the minium carrier set.


    let requiredFields = null;
    if(applicationDB && applicationDB.hasOwnProperty('policies')){
        for(const policyData of applicationDB.policies){
            // if the policyType is not defined for any reason, just skip it
            if(!policyData.policyType){
                continue;
            }
            const newRequirements = {};
            switch(policyData.policyType.toUpperCase()){
                case "WC":
                    if(requiredFields){
                        combineRequiredObjects(requiredFields, wcRequirements, newRequirements);
                    }
                    else {
                        populateSingleRequiredObject(wcRequirements, newRequirements);
                    }
                    requiredFields = newRequirements;
                    break;
                case "GL":
                    if(requiredFields){
                        combineRequiredObjects(requiredFields, glRequirements, newRequirements);
                    }
                    else {
                        populateSingleRequiredObject(glRequirements, newRequirements);
                    }
                    requiredFields = newRequirements;
                    break;
                case "BOP":
                    if(requiredFields){
                        combineRequiredObjects(requiredFields, bopRequirements, newRequirements);
                    }
                    else {
                        populateSingleRequiredObject(bopRequirements, newRequirements);
                    }
                    requiredFields = newRequirements;
                    break;
                case "CYBER":
                    if(requiredFields){
                        combineRequiredObjects(requiredFields, cyberRequirements, newRequirements);
                    }
                    else {
                        populateSingleRequiredObject(cyberRequirements, newRequirements);
                    }
                    requiredFields = newRequirements;
                    break;
                case "PL":
                    if(requiredFields){
                        combineRequiredObjects(requiredFields, plRequirements, newRequirements);
                    }
                    else {
                        populateSingleRequiredObject(plRequirements, newRequirements);
                    }
                    requiredFields = newRequirements;
                    break;
            }
        }

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
        // TODO: eventually we can make more determinations off the application to decide what is required (and not)

        //TODO Software Hook to override optional fields per Agency Network.
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