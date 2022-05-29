/* eslint-disable require-jsdoc */
/* eslint-disable curly */
'use strict';

const moment = require('moment');
//const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');
//const {applicationStatus} = global.requireShared('./models/status/applicationStatus.js');
const nextsureClient = require('../ams-integrations/nextsure/nextsure-client.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');

/**
 * NextsureImport Task processor
 *
 * @param {string} queueMessage - message from queue
 * @returns {void}
 */
async function processtask(queueMessage){
    let error = null;
    // check sent time over 30 minutes do not process.
    var sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp / 1000).utc();
    var now = moment().utc();
    const messageAge = now.unix() - sentDatetime.unix();
    if(messageAge < 1800){
        // DO STUFF
        //run aync  - delete task immediately.
        let messageBody = queueMessage.Body;
        if(typeof queueMessage.Body === 'string'){
            messageBody = JSON.parse(queueMessage.Body)
        }
        policyCheck(messageBody).catch(err => error = err);
        error = null;
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error Nextsure policy check deleteTaskQueueItem " + error + __location);
        }

        return;
    }
    else {
        log.info('removing old Nextsure policycheck Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error Nextsure policycheck deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}


async function policyCheck(taskBodyJSON){
    try {
        if(!taskBodyJSON.maxDaysInPast && !taskBodyJSON.quoteId){
            log.error(`Nextsure policycheck missing maxDaysInPast ` + __location);
            return;
        }
        let query = {insurerId: -1}// return nothing

        // if(taskBodyJSON.applicationId){
        //     query = {applicationId: taskBodyJSON.applicationId}
        // }
        // else {
        const AgencyAmsCred = global.mongoose.AgencyAmsCred;
        const AgencyAmsCredQuery = {amsType: "Nextsure"};
        if(taskBodyJSON.agencyId){
            AgencyAmsCredQuery.agencyId = taskBodyJSON.agencyId
        }

        const agencyAmsCredList = await AgencyAmsCred.find(AgencyAmsCredQuery)
        if(agencyAmsCredList.length === 0){
            log.info("Nextsure PolicyCheck no agencies to check " + __location)
            return;
        }

        //query mnogo for quotes.
        let maxCreateDate = new moment().endOf('day');
        if(taskBodyJSON.minDaysInPast > 0){
            maxCreateDate = new moment().subtract(taskBodyJSON.minDaysInPast,'d').endOf('day');
        }
        const minCreateDate = new moment().subtract(taskBodyJSON.maxDaysInPast,'d').startOf('day');

        const PROCESS_BOUND = true;
        const policyPolicyStatusList = [];
        const enforcedPolicyList = []
        const billingCarrierList = []
        const inssuingCarrierList = []
        let enforcePremium = 0;
        let newEnforcePremium = 0;
        for(const agencyAmsCred of agencyAmsCredList){
            try{
                query = {
                    agencyId: agencyAmsCred.agencyId,
                    active: true,
                    appStatusId: {$gte: 10},
                    createdAt: {
                        $lte: maxCreateDate,
                        $gte: minCreateDate
                    }
                }

                // let sendSlackMessage = true;
                // if(taskBodyJSON.hasOwnProperty("sendSlackMessage")){
                //     sendSlackMessage = taskBodyJSON.sendSlackMessage
                // }

                var Application = global.mongoose.Application;
                const queryProjection = {
                    applicationId: 1,
                    agencyNetworkId: 1,
                    agencyId: 1,
                    appStatusId:1,
                    amsInfo: 1,
                    businessName: 1,
                    primaryState: 1,
                    createdAt: 1,
                    status: 1
                }
                var queryOptions = {};
                queryOptions.sort = {createdAt: -1};
                queryOptions.limit = 3000;
                //queryOptions.sort.createdAt = -1;
                const applicationBO = new ApplicationBO();
                log.info(`Nextsture Policy Check for ${agencyAmsCred.agencyId} application query ` + JSON.stringify(query) + __location)
                const appJSONList = await Application.find(query, queryProjection, queryOptions).lean()
                if(appJSONList?.length > 0){
                    log.info(`Nextsture Policy Check for ${agencyAmsCred.agencyId} applications ${appJSONList?.length} ` + __location)
                    for(const appDoc of appJSONList){
                        log.info(`Nextsture Policy Check for ${agencyAmsCred.agencyId} application ${appDoc.applicationId} ` + __location)
                        try{
                            if(!appDoc.amsInfo?.clientId){
                                log.info(`Nextsture Policy Check for ${agencyAmsCred.agencyId} application ${appDoc.applicationId} looking up ${appDoc.businessName} ` + __location)
                                if(!appDoc.businessName){
                                    log.debug(`${JSON.stringify(appDoc)}`);
                                    continue;
                                }
                                const oldClientList = await nextsureClient.clientSearch(appDoc.agencyId, appDoc.businessName, appDoc.primaryState);
                                if(oldClientList?.length > 0){
                                    const clientId = oldClientList[0].clientId;
                                    log.info(`calling Nextsure client search found existing client ${clientId} for appId ${appDoc.applicationId}` + __location)
                                    try{
                                        const appAmsJSON = {amsInfo: {
                                            "amsType" : "Nextsure",
                                            clientId: clientId
                                        }};
                                        await applicationBO.updateMongo(appDoc.applicationId, appAmsJSON);
                                        appDoc.amsInfo = appAmsJSON.amsInfo;
                                    }
                                    catch(err){
                                        log.error(`Nextsure createClientFromAppDoc updating App Doc error ${err}` + __location)
                                    }
                                    // if(oldClientList[0].ClientStage === "Prospect"){
                                    //     log.debug(`appDoc.businessName is still a Prospect`)
                                    //     continue;
                                    // }
                                }
                            }
                            if(appDoc.amsInfo?.clientId){
                                log.info(`Nextsture Policy Check for ${agencyAmsCred.agencyId} application ${appDoc.applicationId} get policies  ` + __location)
                                const policies = await nextsureClient.getPoliciesByClientId(agencyAmsCred.agencyId, appDoc.amsInfo?.clientId, appDoc, PROCESS_BOUND);
                                // log.debug(`AppId: ${appDoc.applicationId} nextsure policies\n ${JSON.stringify(policies)}`)
                                for(const amsPolicy of policies){
                                    if(amsPolicy.PolicyStatus === "In Force" || amsPolicy.PolicyStatus === "Future"){
                                        const amsEffectiveDate = moment(amsPolicy.CovEffDate)
                                        //if(amsEffectiveDate > minCreateDate){
                                        if(amsEffectiveDate > appDoc.createdAt || amsEffectiveDate > moment() || !appDoc.createdAt){
                                            amsPolicy.applicationId = appDoc.applicationId;
                                            enforcedPolicyList.push(amsPolicy)
                                            if(amsPolicy.PolicyStatus === "Future"){
                                                log.debug(`AppId: ${appDoc.applicationId} nextsure has policy\n ${JSON.stringify(amsPolicy)}`)
                                            }

                                            if(amsEffectiveDate > moment()){
                                                log.debug(`POLICY IN FUTURE----------------------------------------------------`)
                                            }
                                            if(amsPolicy.BillingCarrier?.CarrierName && billingCarrierList.indexOf(amsPolicy.BillingCarrier?.CarrierName) === -1){
                                                billingCarrierList.push(amsPolicy.BillingCarrier?.CarrierName)
                                            }
                                            if(amsPolicy.IssuingCarrier?.CarrierName && inssuingCarrierList.indexOf(amsPolicy.IssuingCarrier?.CarrierName) === -1){
                                                inssuingCarrierList.push(amsPolicy.IssuingCarrier?.CarrierName)
                                            }
                                            let policyPremium = 0;
                                            if(amsPolicy.PolicyDetails?.LineOfBusiness?.Premiums?.Estimated){
                                                policyPremium += parseInt(amsPolicy.PolicyDetails?.LineOfBusiness?.Premiums?.Estimated,10) ? parseInt(amsPolicy.PolicyDetails?.LineOfBusiness?.Premiums?.Estimated,10) : 0;
                                            }
                                            else if(Array.isArray(amsPolicy.PolicyDetails?.LineOfBusiness)){
                                                for(const LOB of amsPolicy.PolicyDetails?.LineOfBusiness){
                                                    if(LOB.Premiums?.Estimated && parseInt(LOB.Premiums?.Estimated,10) > 0){
                                                        policyPremium += parseInt(LOB.Premiums?.Estimated,10)
                                                    }
                                                }

                                            }
                                            enforcePremium += policyPremium;
                                            if(appDoc.appStatusId < 90){
                                                newEnforcePremium += policyPremium;
                                                log.warn(`FOUND App: app satus ${appDoc.appStatusId} - ${appDoc.status} `)
                                            }
                                        }
                                    }
                                    if(policyPolicyStatusList.indexOf(amsPolicy.PolicyStatus) === -1){
                                        policyPolicyStatusList.push(amsPolicy.PolicyStatus)
                                    }
                                }

                            }
                            else{
                                log.info(`Nextsture Policy Check for ${agencyAmsCred.agencyId} application ${appDoc.applicationId} NO CLIENT ID ` + __location)
                            }
                        }
                        catch(err){
                            log.error(`Nextsure PolicyCheck from agencyId ${agencyAmsCred.agencyId} appId ${appDoc?.applicationId} error ${err}` + __location)
                        }
                    }
                }
                else {
                    log.info(`Nextsure PolicyCheck no application to check from agencyId ${agencyAmsCred.agencyId}` + __location)
                }
            }
            catch(err){
                log.error(`Nextsure PolicyCheck from agencyId ${agencyAmsCred.agencyId} error ${err}` + __location)
            }
        }
        log.debug(`Enforce policies \n${JSON.stringify(enforcedPolicyList)}\n\n`)
        log.debug(`Enforce policy count: ${enforcedPolicyList.length}`)
        log.debug(`Enforce policy Premium: ${enforcePremium}`)

        log.debug(`Enforce policy NEW Premium: ${newEnforcePremium}`)

        log.debug(`policyPolicyStatusList \n${JSON.stringify(policyPolicyStatusList)}\n\n`)

        log.debug(`billingCarrierList ${billingCarrierList}`)

        log.debug(`inssuingCarrierList ${inssuingCarrierList}`)

    }
    catch (err) {
        log.error(err + __location);
    }


}

module.exports = {
    processtask: processtask,
    policyCheck: policyCheck
};
