/* eslint-disable object-curly-newline */
/* eslint-disable default-case */
const ApplicationBO = global.requireShared("models/Application-BO.js");

// if the property is provided:

// required is assumed true if not provided
// if required is true, visible will be true

// visible is assumed true if not provided
// if visible is false, required will be false

// required takes precedence over visible if "required: true" and "visible: false"

// if the property is NOT provided:
// TODO: the client side handles some of the requirements for now, for things that are always required
// required is assumed false
// visible is assumed true

const bopRequirements = {
    location: {
        buildingLimit: {},
        businessPersonalPropertyLimit: {},
        own: {
            required: false
        },
        unemployment_num: {
            visible: false,
            required: false
        }
    },
    grossSalesAmt: {}
};

const glRequirements = {
    location: {
        buildingLimit: {
            visible: false,
            required: false
        },
        businessPersonalPropertyLimit: {
            visible: false,
            required: false
        },
        own: {
            visible: false,
            required: false
        },
        unemployment_num: {
            visible: false,
            required: false
        }
    },
    grossSalesAmt: {}
};

const wcRequirements = {
    owner: {
        officerTitle: {}
    },
    location: {
        buildingLimit: {
            visible: false,
            required: false
        },
        businessPersonalPropertyLimit: {
            visible: false,
            required: false
        },
        own: {
            visible: false,
            required: false
        },
        unemployment_num: {
            visible: true,
            required: true
        }
    },
    grossSalesAmt: {},
    ein: {}
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
            }
        }
    }

    // TODO: eventually we can make more determinations off the application to decide what is required (and not)
    return requiredFields;
};
// combine objects, this needs to merge both objects with true taking precedence above false for both required and visible
const combineRequiredObjects = (obj1, obj2, newObj) => {
    const keysToSkip = ["required", "visible"];

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
            // if the property is provided:
            // if required is true, visible will be true
            // if visible is false, required will be false
            // required takes precedence over visible if "required: true" and "visible: false"

            // if the property is NOT provided:
            // required is assumed false
            // visible is assumed true

            newObj[key] = {};

            // if the key is not provided for an obj default required to false
            let obj1Required = Boolean(object1[key]);
            const checkObj1Required = object1[key] && object1[key].hasOwnProperty("required");
            if(checkObj1Required){
                obj1Required = object1[key].required;
            }

            // if the key is not provided for an obj default required to false
            let obj2Required = Boolean(object2[key]);
            const checkObj2Required = object2[key] && object2[key].hasOwnProperty("required");
            if(checkObj2Required){
                obj2Required = object2[key].required;
            }

            newObj[key].required = obj1Required || obj2Required;

            // if the key is not provided for an obj default visible to true
            let obj1Visible = !(object1[key] && object1[key].hasOwnProperty("visible"));
            const checkObj1Visible = object1[key] && object1[key].hasOwnProperty("visible");
            if(checkObj1Visible){
                obj1Visible = object1[key].visible;
            }

            // if the key is not provided for an obj default visible to true
            let obj2Visible = !(object2[key] && object2[key].hasOwnProperty("visible"));
            const checkObj2Visible = object2[key] && object2[key].hasOwnProperty("visible");
            if(checkObj2Visible){
                obj2Visible = object2[key].visible;
            }

            // if required is true, then visible is true
            newObj[key].visible = newObj[key].required || obj1Visible || obj2Visible;

            combineRequiredObjects(object1[key], object2[key], newObj[key]);
        }
    }
}

const populateSingleRequiredObject = (obj, newObj) => {
    const keysToSkip = ["required", "visible"];

    // For single object we know all the keys are present
    for(const key in obj){
        if(!keysToSkip.includes(key)){
            newObj[key] = {};

            // if required is provided, check it, otherwise true
            if(obj[key].hasOwnProperty("required")){
                newObj[key].required = obj[key].required;
            }
            else{
                newObj[key].required = true;
            }

            // if visible is provided, check it, otherwise true
            if(obj[key].hasOwnProperty("visible")){
                // if required is true, then visible is true
                newObj[key].visible = newObj[key].required || obj[key].visible;
            }
            else{
                newObj[key].visible = true;
            }

            populateSingleRequiredObject(obj[key], newObj[key]);
        }
    }
}