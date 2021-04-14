/* eslint-disable default-case */
const ApplicationBO = global.requireShared("models/Application-BO.js");

// basic starting points for policy requirements
// the requirement is only needed if it is NOT ALWAYS required
const bopRequirements = ["officer", "officer.officerTitle"];
const glRequirements = ["officer"];
const wcRequirements = [];

exports.requiredFields = async(resources, appId) => {
    let applicationDB = null;
    const applicationBO = new ApplicationBO();
    try{
        applicationDB = await applicationBO.getById(appId);
    }
    catch(err){
        log.error("Error getting application doc " + err + __location);
    }

    if(applicationDB && applicationDB.hasOwnProperty('policies')){
        let requiredFields = [];
        for(const policyData of applicationDB.policies){
            // if the policyType is not defined for any reason, just skip it
            if(!policyData.policyType){
                continue;
            }

            switch(policyData.policyType.toUpperCase()){
                case "WC":
                    requiredFields = combineArrays(requiredFields, wcRequirements);
                    break;
                case "GL":
                    requiredFields = combineArrays(requiredFields, glRequirements);
                    break;
                case "BOP":
                    requiredFields = combineArrays(requiredFields, bopRequirements);
                    break;
            }
        }
        resources.requiredAppFields = requiredFields;
    }
};

// use a set to de-duplicate the data
const combineArrays = (a1, a2) => [...new Set([...a1 ,...a2])];