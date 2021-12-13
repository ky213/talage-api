/* eslint-disable require-jsdoc */
/* eslint-disable object-shorthand */
const appLinkSvc = global.requireShared('./services/application-link-svc.js');

async function applinkProcessor(appDoc, agencyNetworkJSON, message){

    if(!message){
        log.error(`applinkProcessor message undefined` + __location)
        return '';
    }
    try{
        const linkUrl = await appLinkSvc.buildAgencyPortalLink(agencyNetworkJSON,appDoc.applicationId)

        const linkElement = ` <a href="${linkUrl}" target="_blank">
                                Agency Portal
                            </a>`;

        const linkButton = `<div align="center">
        <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-spacing: 0; border-collapse: collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;font-family:arial,helvetica,sans-serif;"><tr><td style="font-family:arial,helvetica,sans-serif;" align="center"><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="" style="height:45px; v-text-anchor:middle; width:120px;" arcsize="9%" stroke="f" fillcolor="#3AAEE0"><w:anchorlock/><center style="color:#FFFFFF;font-family:arial,helvetica,sans-serif;"><![endif]-->
        <a href="${linkUrl}" target="_blank" style="box-sizing: border-box;display: inline-block;font-family:arial,helvetica,sans-serif;text-decoration: none;-webkit-text-size-adjust: none;text-align: center;color: #FFFFFF; background-color: #3AAEE0; border-radius: 4px; -webkit-border-radius: 4px; -moz-border-radius: 4px; width:auto; max-width:100%; overflow-wrap: break-word; word-break: break-word; word-wrap:break-word; mso-border-alt: none;">
            <span style="display:block;padding:10px 20px;line-height:120%;"><span style="font-size: 14px; line-height: 16.8px;">Open Application</span></span>
        </a>
        <!--[if mso]></center></v:roundrect></td></tr></table><![endif]-->
    </div>`

        message = message.replace(/{{apAppLinkUrl}}/g, linkUrl);

        message = message.replace(/{{apAppLink}}/g, linkElement);

        message = message.replace(/{{apAppLinkButton}}/g, linkButton);
    }
    catch(err){
        log.error(`applinkProcessor error ${err}` + __location)
    }


    return message;
}


async function policyTypeProcessor(appDoc, agencyNetworkJSON, message, subject){

    if(!message){
        log.error(`applinkProcessor message undefined` + __location)
        return {};
    }

    if(!subject){
        log.error(`applinkProcessor subject undefined` + __location)
        return {};
    }

    let processNames = false;
    let policyTypeList = [];
    if(message.includes('policyTypeName') || subject.includes('policyTypeName')){
        processNames = true;
        const PolicyTypeBO = global.requireShared('./models/PolicyType-BO.js');
        const policyTypeBO = new PolicyTypeBO();
        const query = {wheelhouse_support: true};
        policyTypeList = await policyTypeBO.getList(query).catch(function(err) {
            log.error("policyTypeProcessor error: " + err + __location);
        })
    }

    try{
        let policyTypeCodeListString = '';
        let policyTypeNameListString = '';

        if(appDoc.policies && appDoc.policies.length > 0){
            for(let j = 0; j < appDoc.policies.length; j++){
                let currName = '';
                if(processNames){
                    const currPT = policyTypeList.find((pt) => pt.policyTypeCd === appDoc.policies[j].policyType)
                    if(currPT){
                        currName = currPT.name;
                    }
                }

                if(j === 0){
                    policyTypeCodeListString = appDoc.policies[j].policyType
                    policyTypeNameListString = currName
                }
                else if(j === appDoc.policies.length - 1){
                    policyTypeCodeListString += ` and ${appDoc.policies[j].policyType}`
                    policyTypeNameListString += ` and ${currName}`
                }
                else{
                    policyTypeCodeListString += `, ${appDoc.policies[j].policyType}`
                    policyTypeNameListString += `, ${currName}`
                }
            }
        }

        message = message.replace(/{{policyTypeCode}}/g, policyTypeCodeListString);
        subject = subject.replace(/{{policyTypeCode}}/g, policyTypeCodeListString);
        if(processNames){
            message = message.replace(/{{policyTypeName}}/g, policyTypeNameListString);
            subject = subject.replace(/{{policyTypeName}}/g, policyTypeNameListString);
        }
    }
    catch(err){
        log.error(`policyTypeProcessor error ${err}` + __location)
    }

    return {
        message,
        subject
    }
}

async function policyTypeQuoteProcessor(policyType, message, subject){

    if(!message){
        log.error(`applinkProcessor message undefined` + __location)
        return {};
    }

    if(!subject){
        log.error(`applinkProcessor subject undefined` + __location)
        return {};
    }

    let processNames = false;
    let policyTypeList = [];
    let policyTypeName = ''
    if(message.includes('policyTypeName') || subject.includes('policyTypeName')){
        processNames = true;
        const PolicyTypeBO = global.requireShared('./models/PolicyType-BO.js');
        const policyTypeBO = new PolicyTypeBO();
        const query = {wheelhouse_support: true};
        policyTypeList = await policyTypeBO.getList(query).catch(function(err) {
            log.error("policyTypeProcessor error: " + err + __location);
        })
        const currPT = policyTypeList.find((pt) => pt.policyTypeCd === policyType)
        if(currPT){
            policyTypeName = currPT.name;
        }
    }

    try{
        message = message.replace(/{{policyTypeCode}}/g, policyType);
        subject = subject.replace(/{{policyTypeCode}}/g, policyType);
        if(processNames){
            message = message.replace(/{{policyTypeName}}/g, policyTypeName);
            subject = subject.replace(/{{policyTypeName}}/g, policyTypeName);
        }
    }
    catch(err){
        log.error(`policyTypeProcessor error ${err}` + __location)
    }

    return {
        message,
        subject
    }
}


module.exports = {
    applinkProcessor,
    policyTypeProcessor,
    policyTypeQuoteProcessor
}