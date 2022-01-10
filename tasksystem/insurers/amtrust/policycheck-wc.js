/* eslint-disable require-jsdoc */

const moment = require("moment");
const amtrust = require('./amtrust-client.js');
const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');
const ApplicationStatus = global.requireShared('./models/status/applicationStatus.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const QuoteBind = global.requireRootPath('quotesystem/models/QuoteBind.js');


var Application = global.mongoose.Application;

async function processQuoteList(quoteJSONList,sendSlackMessage){

    let currentAgencyId = 0;
    let currentAgencyNetworkId = 0;
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
            log.error(`Amtrust Policycheck quote could load application. QuoteId ${quoteJSONList.quoteId}` + __location)
            continue;
        }

        if(applicationJSON.appStatusId === ApplicationStatus.applicationStatus.dead.appStatusId){
            continue;
        }
        //Todo check for othe WC quotes that are bound.

        let updateAuth = true;
        if(quoteJSON.talageWholesale && currentAgencyNetworkId === 1 && currentAgencyId === 1){
            updateAuth = false;
        }
        else if(applicationJSON.agencyNetworkId === 4 && currentAgencyNetworkId === 4){
            updateAuth = false;
        }
        else if(quoteJSONList.agencyId === currentAgencyId){
            updateAuth = false;
        }
        try{
            if(updateAuth){
                currentAgencyId = applicationJSON.agencyId
                currentAgencyNetworkId = applicationJSON.agencyNetworkId;
                log.info(`Amtrust Policycheck Getting new auth Token ` + __location)
                const checkToken = await amtrust.authorize(applicationJSON.agencyNetworkId, applicationJSON.agencyId, applicationJSON.agencyLocationId);
                if(!checkToken){
                    log.info(`Amtrust Policycheck Could not retrieving Auth token for applicationId: ${applicationJSON.applicationId} agency ${applicationJSON.agencyId}` + __location);
                    continue;
                }
            }

            await getQuotePolicy(quoteJSON.quoteId, sendSlackMessage)
        }
        catch(err){
            log.error(`AmTrust policycheck error ${err} ` + __location);
        }


    }
    return;
}


async function getQuotePolicy(quoteId, sendSlackMessage){
    try{
        log.debug(`Amtrust Policycheck checking quoteId ${quoteId} ` + __location)
        //get quote doc
        var Quote = global.mongoose.Quote;
        const query = {quoteId: quoteId}

        const queryProjection = {"__v": 0}
        const quoteDoc = await Quote.findOne(query, queryProjection)
        if(quoteDoc && quoteDoc.quoteNumber){
            //call Amtrust for policy number.
            const requestPath = `/api/v1/policies?quote=${quoteDoc.quoteNumber}`
            const policyData = await amtrust.callAPI("GET", requestPath, null);
            if (!policyData || policyData.StatusCode !== 200) {
                log.info(`Amtrust Policycheck Could not retrieving quote policy for applicationId: ${quoteDoc.applicationId}  quoteId ${quoteId}` + __location);
                return null;
            }
            if(policyData.Data && policyData.Data.length > 0){
                const policyNumber = policyData.Data[0].PolicyNumber
                const PolicyStatus = policyData.Data[0].PolicyStatus
                if(PolicyStatus === "In Effect"){
                    //call amtrust for policy details.
                    const requestDetailPath = `/api/v1/policies/${policyNumber}`
                    const policyDetailData = await amtrust.callAPI("GET", requestDetailPath, null);
                    if (!policyData || policyData.StatusCode !== 200) {
                        log.info(`Amtrust Policycheck Could not retrieving quote policy detail for quoteId ${quoteId}` + __location);
                        return null;
                    }
                    if(policyDetailData && policyDetailData.Data?.Premium){
                        log.info(`Amtrust Policycheck Found Bound submission applicationId: ${quoteDoc.applicationId} quoteId: ${quoteId}` + __location);
                        //update quote
                        quoteDoc.bound = true;
                        quoteDoc.quoteStatusId = quoteStatus.bound.id
                        quoteDoc.boundPremium = parseInt(policyDetailData.Data.Premium,10);
                        if(!quoteDoc.quotedPremium){
                            quoteDoc.quotedPremium = quoteDoc.amount
                        }
                        quoteDoc.amount = quoteDoc.boundPremium

                        const EffectiveDate = moment(policyDetailData.Data.EffectiveDate)
                        const now = moment();
                        if(EffectiveDate > now){
                            quoteDoc.boundDate = moment();
                        }
                        else {
                            quoteDoc.boundDate = EffectiveDate;
                        }
                        quoteDoc.effectiveDate = EffectiveDate;
                        quoteDoc.expirationDate = moment(policyDetailData.Data.ExpirationDate);


                        if(!quoteDoc.policyInfo){
                            quoteDoc.policyInfo = {}
                        }
                        quoteDoc.policyInfo.policyNumber = policyNumber
                        quoteDoc.policyInfo.policyId = policyDetailData.Data.PolicyId
                        quoteDoc.policyInfo.policyEffectiveDate = EffectiveDate
                        quoteDoc.policyInfo.policyPremium = quoteDoc.boundPremium

                        quoteDoc.boundUser = "system - api check"
                        quoteDoc.log += "<br>";
                        quoteDoc.log += `<b>Check at ${moment().utc().toISOString()}</b><br>`;
                        quoteDoc.log += `--------======= API Check Insurer Policy Response =======--------<br><br>`;
                        quoteDoc.log += `<pre>${JSON.stringify(policyDetailData, null, 2)}</pre><br><br>`;
                        quoteDoc.log += `--------======= End =======--------<br><br>`;

                        await quoteDoc.save();

                        //update app metrics
                        const applicationBO = new ApplicationBO();
                        await applicationBO.updateStatus(quoteDoc.applicationId,ApplicationStatus.applicationStatus.bound.appStatusDesc, ApplicationStatus.applicationStatus.bound.appStatusId)
                        await applicationBO.recalculateQuoteMetrics(quoteDoc.applicationId);

                        //slack........
                        if(sendSlackMessage === true){
                            log.debug(`Amtrust Policycheck quoteId ${quoteId} sending Slack ` + __location);
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
                    else {
                        log.info(`Amtrust Policycheck quoteId ${quoteId} did not return a premium ${JSON.stringify(policyDetailData)} ` + __location);
                    }
                }
                else {
                    log.info(`Amtrust Policycheck quoteId ${quoteId} returned policy status ${PolicyStatus} ` + __location);
                }
            }
            else{
                log.info(`Amtrust Policycheck no policy.data returned for quoteId ${quoteId}` + __location);
            }
        }
        else if(quoteDoc){
            log.error(`Amtrust Policycheck QuoteId ${quoteId} could not find quoteNumber ${JSON.stringify(quoteDoc)}` + __location)
        }
        else {
            log.error(`Amtrust Policycheck QuoteId ${quoteId} could not find quoteDoc` + __location)
        }
    }
    catch(err){
        log.error(`Amtrust Policycheck QuoteId ${quoteId} procesing error ${err}` + __location)
    }
    return;
}


module.exports = {
    getQuotePolicy: getQuotePolicy,
    processQuoteList: processQuoteList
};
