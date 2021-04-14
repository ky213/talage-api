/* eslint-disable default-case */
const ApplicationBO = global.requireShared("models/Application-BO.js");

// basic starting points for policy requirements
// the requirement is only needed if it is NOT ALWAYS required

// TODO: this needs to be documented and set up to include everything required.
// its current state is just to reflect what is possible.
// eventually we can add or remove keys based on factors other than policy type.
const bopRequirements = {
    officer: {officerTitle: {}},
    grossSalesAmt: {}
};

const glRequirements = {
    officer: {},
    grossSalesAmt: {}
};

const wcRequirements = {grossSalesAmt: {}};

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
        let requiredFields = {};
        for(const policyData of applicationDB.policies){
            // if the policyType is not defined for any reason, just skip it
            if(!policyData.policyType){
                continue;
            }

            switch(policyData.policyType.toUpperCase()){
                case "WC":
                    requiredFields = {
                        ...requiredFields,
                        ...wcRequirements
                    };
                    break;
                case "GL":
                    requiredFields = {
                        ...requiredFields,
                        ...glRequirements
                    };
                    break;
                case "BOP":
                    requiredFields = {
                        ...requiredFields,
                        ...bopRequirements
                    };
                    break;
            }
        }
        resources.requiredAppFields = requiredFields;
    }
};