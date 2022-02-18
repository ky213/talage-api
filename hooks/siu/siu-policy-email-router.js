/* eslint-disable object-curly-newline */

/* eslint-disable object-shorthand */
/**
 * Build a link to application in for agency portal.
 * @param {Object} appDoc - Application Doc.
 * @param {string} recipients - Existing comma delimited string of recipients.
 * @param {Object} agencyNetworkJSON - agencyNetwork objects.
 * @return {string} New recipients list
 * To create a link and NOT send an email, don't pass emailAddress on the options, or leave options null
 */
async function GetRecipients(appDoc, recipients, agencyNetworkJSON){
    log.debug(`in siu-policy-email-router.GetRecipients hook` + __location)
    //Note SUI underwriters might already by on recipients list.  Those UW need to stay on the list.
    if(!recipients){
        recipients = '';
    }

    log.debug(`in siu-policy-email-router.GetRecipients hook agencyNetworkJSON?.additionalInfo ${JSON.stringify(agencyNetworkJSON?.additionalInfo)}` + __location)

    //Determine if GL or BOP, if so make sure quote@siunis.com is in recipients
    let bopEmail = 'quote@siuins.com'
    if(agencyNetworkJSON?.additionalInfo?.bopEmail){
        bopEmail = agencyNetworkJSON?.additionalInfo.bopEmail
    }
    const bopPolicy = appDoc.policies.find((p) => p.policyType === "BOP")
    const glPolicy = appDoc.policies.find((p) => p.policyType === "GL")
    if(bopPolicy || glPolicy){
        log.debug(`in siu-policy-email-router.GetRecipients has bopPolicy ${bopPolicy}  or glPolicy ${glPolicy}` + __location)
        if(!recipients.includes(bopEmail)){
            if(recipients.length > 0){
                recipients += ","
            }
            recipients += bopEmail
        }
        else {
            log.debug(`in siu-policy-email-router.GetRecipients bopPolicy no new emails ` + __location)
        }

    }

    //Determine if WC, if so make sure workercomp@siuins.com is in recipients
    let wcEmail = 'workcomp@siuins.com'
    if(agencyNetworkJSON?.additionalInfo?.wcEmail){
        wcEmail = agencyNetworkJSON?.additionalInfo.wcEmail
    }
    const wcPolicy = appDoc.policies.find((p) => p.policyType === "WC")
    if(wcPolicy){
        log.debug(`in siu-policy-email-router.GetRecipients has wcPolicy ${wcPolicy}` + __location)
        if(!recipients.includes(wcEmail)){
            if(recipients.length > 0){
                recipients += ","
            }
            recipients += wcEmail
        }
        else {
            log.debug(`in siu-policy-email-router.GetRecipients wcPolicy no new emails ` + __location)
        }
    }

    log.debug(`SIU Policy Email Router new recipients ${recipients}` + __location)

    return recipients;

}


// eslint-disable-next-line object-curly-newline
module.exports = {
    GetRecipients
}