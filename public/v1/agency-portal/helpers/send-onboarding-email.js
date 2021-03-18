'use strict';

const jwt = require('jsonwebtoken');
//const request = require('request');
const emailsvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');

module.exports = async function(agencyNetworkId, userID, firstName, lastName, agencyName, slug, userEmail) {
    // Get the content of the email
    let error = null;
    const agencyNetworkBO = new AgencyNetworkBO();
    const emailContentJSON = await agencyNetworkBO.getEmailContent(agencyNetworkId, "onboarding").catch(function(err){
        log.error(`Unable to get email content for Onboarding. agency_network: ${db.escape(agencyNetworkId)}.  error: ${err}` + __location);
        error = true;
    });
    if(error){
        return false;
    }

    if(emailContentJSON && emailContentJSON.message){

        const emailMessage = emailContentJSON.message;
        const emailSubject = emailContentJSON.subject;


        // Create a limited life JWT
        const token = jwt.sign({'userID': userID}, global.settings.AUTH_SECRET_KEY, {'expiresIn': '7d'});

        // Format the brand
        const brandraw = emailContentJSON.emailBrand;
        const portalurl = emailContentJSON.PORTAL_URL;
        const appurl = emailContentJSON.APPLICATION_URL;
        let brand = brandraw;
        if(brand){
            brand = `${brand.charAt(0).toUpperCase() + brand.slice(1)}`;
        }
        else {
            log.error(`Email Brand missing for agencyNetworkId ${agencyNetworkId} ` + __location);
        }

        // Prepare the email to send to the user
        const emailData = {
            'brand': brandraw,
            'html': emailMessage.
                replace(/{{Agent First Name}}/g, firstName).
                replace(/{{Agent Last Name}}/g, lastName).
                replace(/{{Agency}}/g, agencyName).
                replace(/{{Application Link}}/g, `${appurl}/${slug}`).
                replace(/{{Brand}}/g, brand).
                replace(/{{Activation Link}}/g, `<a href="${portalurl}/reset-password/${token}" style="background-color:#ED7D31;border-radius:0.25rem;color:#FFF;font-size:1.3rem;padding-bottom:0.75rem;padding-left:1.5rem;padding-top:0.75rem;padding-right:1.5rem;text-decoration:none;text-transform:uppercase;">Activate My Account</a>`),
            'subject': emailSubject.replace('{{Brand}}', brand),
            'to': userEmail
        };


        const emailResp = await emailsvc.send(emailData.to, emailData.subject, emailData.html, {}, agencyNetworkId, emailData.brand);
        if (emailResp === false) {
            const errorStr = `Failed to send the onboarding email to ${userEmail} during the creation of the agency ${agencyName}. Please send manually.`;
            log.error(errorStr + __location);
            slack.send('#alerts', 'warning', errorStr);
            return errorStr;
        }

        // If nothing goes wrong
        return false;
    }
    else {
        log.error('send-onboarding-email: Could not find email message' + __location);
        return 'Could not find email message';
    }

};