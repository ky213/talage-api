/* eslint-disable require-jsdoc */
const axios = require('axios');
const moment = require("moment");
const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');
const ApplicationStatus = global.requireShared('./models/status/applicationStatus.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const QuoteBind = global.requireRootPath('quotesystem/models/QuoteBind.js');


var Application = require('mongoose').model('Application');

let insurerJson = null;
const employersInsurerId = 1; //Employers


async function processQuoteList(quoteJSONList,sendSlackMessage){

    await getInsurerDoc(employersInsurerId);

    for(const quoteJSON of quoteJSONList){
        if(quoteJSON.quoteStatusId === quoteStatus.dead.id){
            continue;
        }
        const applicationQuery = {applicationId: quoteJSON.applicationId};
        const queryAppProjection = {
            applicationId: 1,
            agencyNetworkId: 1,
            agencyId: 1,
            agencyLocationId: 1,
            appStatusId:1
        }
        const applicationJSON = await Application.findOne(applicationQuery, queryAppProjection).lean();
        if(!applicationJSON){
            log.error(`Employers Policycheck quote could load application. QuoteId ${quoteJSONList.quoteId}` + __location)
            continue;
        }

        if(applicationJSON.appStatusId === ApplicationStatus.applicationStatus.dead.appStatusId){
            continue;
        }


        await getQuotePolicy(quoteJSON.quoteId, sendSlackMessage)


    }
    return;
}


async function getQuotePolicy(quoteId, sendSlackMessage){
    try{

        log.info(`Employers Policycheck checking quoteId ${quoteId} ` + __location)
        //get quote doc
        var Quote = require('mongoose').model('Quote');
        const query = {quoteId: quoteId}

        const queryProjection = {"__v": 0}
        const quoteDoc = await Quote.findOne(query, queryProjection)
        if(quoteDoc && quoteDoc.quoteNumber){
            if(!insurerJson){
                await getInsurerDoc(employersInsurerId);
                if(!insurerJson){
                    return;
                }
            }
            //call Employers Quote detail.
            let employerQuoteId = quoteDoc.quoteId;
            if(quoteDoc.requestId){
                employerQuoteId = quoteDoc.requestId;
            }
            const employersQuoteDetailJson = await getEmployersQuoteDetail(employerQuoteId, quoteDoc);
            if(employersQuoteDetailJson && employersQuoteDetailJson.status === "BOUND"){
                log.info(`Employers Policycheck Found Bound submission applicationId: ${quoteDoc.applicationId} quoteId: ${quoteId} ` + __location)
                quoteDoc.bound = true;
                quoteDoc.quoteStatusId = quoteStatus.bound.id
                quoteDoc.boundPremium = employersQuoteDetailJson.totalPremium;
                if(!quoteDoc.quotedPremium){
                    quoteDoc.quotedPremium = quoteDoc.amount
                }
                quoteDoc.amount = quoteDoc.boundPremium

                const EffectiveDate = moment(employersQuoteDetailJson.effectiveDate)
                const now = moment();
                if(EffectiveDate > now){
                    quoteDoc.boundDate = moment();
                }
                else {
                    quoteDoc.boundDate = EffectiveDate;
                }
                quoteDoc.effectiveDate = EffectiveDate;
                quoteDoc.expirationDate = moment(employersQuoteDetailJson.expirationDate);


                if(!quoteDoc.policyInfo){
                    quoteDoc.policyInfo = {}
                }
                quoteDoc.policyInfo.policyNumber = employersQuoteDetailJson.policyNumber
                quoteDoc.policyInfo.policyEffectiveDate = EffectiveDate
                quoteDoc.policyInfo.policyPremium = quoteDoc.boundPremium
                quoteDoc.policyInfo.policyUrl = employersQuoteDetailJson.policyURL
                if(employersQuoteDetailJson.commissionPercent){
                    quoteDoc.policyInfo.commissionPercent = employersQuoteDetailJson.commissionPercent
                }


                quoteDoc.boundUser = "system - api check"
                quoteDoc.log += "<br>";
                quoteDoc.log += `<b>Check at ${moment().utc().toISOString()}</b><br>`;
                quoteDoc.log += `--------======= API Check Insurer Policy Response =======--------<br><br>`;
                quoteDoc.log += `<pre>${JSON.stringify(employersQuoteDetailJson, null, 2)}</pre><br><br>`;
                quoteDoc.log += `--------======= End =======--------<br><br>`;

                await quoteDoc.save();
                //update app metrics
                const applicationBO = new ApplicationBO();
                await applicationBO.updateStatus(quoteDoc.applicationId,ApplicationStatus.applicationStatus.bound.appStatusDesc, ApplicationStatus.applicationStatus.bound.appStatusId)
                await applicationBO.recalculateQuoteMetrics(quoteDoc.applicationId);

                //slack........
                if(sendSlackMessage === true){
                    log.debug(`Employers Policycheck quoteId ${quoteId} sending Slack ` + __location);
                    const quoteBind = new QuoteBind();
                    await quoteBind.load(quoteDoc.quoteId, quoteDoc.paymentPlanId, null, quoteDoc.insurerPaymentPlanId);
                    //isolate to not prevent Digalent bind request to update submission.
                    try{
                        await quoteBind.send_slack_notification("boundApiCheck");
                    }
                    catch(err){
                        log.error(`appid ${quoteDoc.applicationId} quote ${quoteDoc.quoteId} had Slack API Bind Check  error ${err}` + __location);
                    }
                }
            }
        }
        else if(quoteDoc){
            log.invo(`Employers Policycheck QuoteId ${quoteId} could not find quoteNumber ${JSON.stringify(quoteDoc)}` + __location)
        }
        else {
            log.error(`Employers Policycheck QuoteId ${quoteId} could not find quoteDoc` + __location)
        }
    }
    catch(err){
        log.error(`Employers Policycheck QuoteId ${quoteId} procesing error ${err}` + __location)
    }
    return;
}
async function getInsurerDoc(insurerId){
    var InsurerModel = require('mongoose').model('Insurer');
    const insurer = await InsurerModel.findOne({insurerId: insurerId}).lean()
    if (!insurer) {
        log.error(`No Amtrust record ` + __location)
        return false;
    }
    insurerJson = insurer;


}
async function getEmployersQuoteDetail(employerQuoteId, quoteDoc){

    let appKeyEmployers = insurerJson.username
    let appTokenEmployers = insurerJson.password
    if(global.settings.ENV !== 'production'){
        appKeyEmployers = insurerJson.test_username
        appTokenEmployers = insurerJson.test_password
    }
    const axiosOptions = {headers: {
        "appKey": appKeyEmployers,
        "appToken": appTokenEmployers,
        "Accept": "application/json"
    }};
    const host = global.settings.ENV !== 'production' ? 'api-qa.employers.com' : 'api.employers.com';
    const requestUrl = `https://${host}/DigitalAgencyServices/quote/${employerQuoteId}?omitAttachment=QuoteLetter`;
    let response = null;
    try {
        response = await axios.get(requestUrl,axiosOptions);
    }
    catch (error) {
        log.error(`Employers Policy Check AppId: ${quoteDoc.applicationId} QuoteId: ${quoteDoc.quoteId} Bind request Error: ${error}  Response ${JSON.stringify(error.response.data)} ${__location}`);
        return null;
        //throw new Error(JSON.stringify(error));
    }
    if (response.data && response.data.success) {
        return response.data
    }
    else if (response.data && !response.data.success) {
        log.info(`Employers Policy Check AppId: ${quoteDoc.applicationId} QuoteId: ${quoteDoc.quoteId} not success: ${JSON.stringify(response.data)} ${__location}`);
        return null;
    }
    return null;
}


module.exports = {
    getQuotePolicy: getQuotePolicy,
    processQuoteList: processQuoteList
};