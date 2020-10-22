'use strict'

const applicationBO = global.requireShared('./models/Application-BO.js');
const agencyBO = global.requireShared('./models/Agency-BO.js');
const insurerBO = global.requireShared('./models/Insurer-BO.js');
const businessBO = global.requireShared('./models/Business-model.js');
const businessAddressBO = global.requireShared('./models/BusinessAddress-model.js');
const applicationQuestionBO = global.requireShared('./models/ApplicationQuestion-BO.js');
const questionBO = global.requireShared('./models/Question-BO.js');


exports.dataInit = async function(applicationId, insurerId){

    const application = new applicationBO();
    await application.getById(applicationId);
    await application.getAgencyNewtorkIdById(applicationId);

    const agency = new agencyBO();
    await agency.loadFromId(application.agency);

    const insurer = new insurerBO();
    await insurer.loadFromId(insurerId);

    const business = new businessBO();
    await business.loadFromId(application.business);

    const businessAddresses = new businessAddressBO();
    const addresses = await businessAddresses.loadFromBusinessId(application.business);

    const applicationQuestionsBO = new applicationQuestionBO();
    const applicationQuestionList = await questionsBO.loadFromApplicationId(applicationId);


    const dataObj = {
        application: application,
        agency: agency,
        insurer: insurer,
        business: business,
        businessAddressList: addresses
    }

}

exports.getLimitsAsDollarAmounts = function(limitsString){
    const limitsArray = limitsString.match(/[1-9]+0*/g);
    limitsArray.forEach((limit, index) => {
        limitsArray[index] = limit.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    });
    return limitsArray;
};