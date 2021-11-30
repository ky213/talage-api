const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const ApplicationBO = global.requireShared("models/Application-BO.js");
const crypt = global.requireShared('./services/crypt.js');
const emailsvc = global.requireShared('./services/emailsvc.js');

const applicationLinkTimeout = 48 * 60 * 60; // 48 hours

// eslint-disable-next-line multiline-comment-style
/*
options: {
    pageSlug: string,
    agentName: string,
    agencyName: string,
    agentEmail: string,

    // the customers email
    emailAddress: string,

    // the customers first name
    firstName: string,

    // the email subject
    subject: string
}
*/

/**
 * Creates a link into an application for Quote App
 * @param {uuid} appId - The application to create a link for
 * @param {Object} options - Options for creating the link, see above comment for uses
 * @return {URL} The application link for Quote App
 * To create a link and NOT send an email, don't pass emailAddress on the options, or leave options null
 */
exports.createApplicationLink = async(appId, options) => {
    if(!appId){
        log.error(`Error generating application link, invalid appId ${appId}` + __location);
        return;
    }

    const applicationBO = new ApplicationBO();
    const application = await applicationBO.getById(appId);

    const agencyBO = new AgencyBO();
    const agency = await agencyBO.getById(application.agencyId);

    const agencyNetworkBO = new AgencyNetworkBO();
    const agencyNetwork = await agencyNetworkBO.getById(application.agencyNetworkId);


    // create hash
    const hash = await crypt.hash(appId);

    // store hash in redis with application id as value
    await global.redisSvc.storeKeyValue(hash, JSON.stringify({applicationId: appId}), applicationLinkTimeout);
    const link = await buildLink(agency, agencyNetwork, options?.pageSlug, hash);

    // send an email if an emailAddress is provided on options
    const returnLink = await sendEmail(agency, link, options, application);
    return returnLink;
}

const buildLink = async(agency, agencyNetwork, pageSlug, hash) => {
    let domain = "";
    if(agencyNetwork?.additionalInfo?.environmentSettings[global.settings.ENV]?.APPLICATION_URL){
        // get the domain from agency networks env settings, so we can point digalent to their custom site, etc.
        domain = agencyNetwork.additionalInfo.environmentSettings[global.settings.ENV].APPLICATION_URL;
    }
    else{
        // if environmentSettings is not defined for any reason, fall back to defaults
        switch(global.settings.ENV){
            case "development":
                domain = "http://localhost:8080";
                break;
            case "awsdev":
                domain = "https://dev.wh-app.io";
                break;
            case "staging":
                domain = "https://sta.wh-app.io";
                break;
            case "demo":
                domain = "https://demo.wh-app.io";
                break;
            case "production":
                domain = "https://wh-app.io";
                break;
            default:
                // dont send the email
                log.error(`Failed to generating application link, invalid environment. ${__location}`);
                return;
        }
    }

    let link = "";
    if(pageSlug){
        link = `${domain}/${agency.slug}/${pageSlug}/_load/${hash}`;
    }
    else{
        link = `${domain}/${agency.slug}/_load/${hash}`;
    }

    return link;
}

const sendEmail = async(agency, link, options, applicationJSON) => {
    if(!link || !options?.emailAddress){
        log.warn(`Not sending email for application link ${link} ${__location}`);
        return;
    }

    let recipients = options.emailAddress;

    // if there is an agentEmail, add it as long as it's not the same as emailAddress
    if(options.agentEmail && options.emailAddress !== options.agentEmail){
        recipients += `,${options.agentEmail}`;
    }

    const agencyDisplayName = agency.displayName ? agency.displayName : agency.name;

    const agentFullname = `${agency.firstName} ${agency.lastName}`;
    const agentName = options.agentName ? options.agentName : agentFullname;

    const agentEmail = options.agentEmail ? options.agentEmail : agency.email;

    const emailAgencyName = options.agencyName ? options.agencyName : agencyDisplayName;

    const emailSubjectDefault = 'A portal to your application';
    let emailSubject = options.subject ? options.subject : emailSubjectDefault;

    const agencyNetworkBranding = options.useAgencyNetworkBrand ? options.useAgencyNetworkBrand : false;

    let htmlBody = `
            <p>
                Hello${options.firstName ? ` ${options.firstName}` : ""},
            </p>
            <p>
                ${agentName} at ${emailAgencyName} is sending over an application for you to get started! We know you are busy, so with this, you can go at your convenience. 
                <br/>
                Its an easy way for you to fill out everything we'll need to get started on your insurance quotes, and you'll even be able to complete the process online. 
                <br/>
                If you ever need help, ${agentName} is still right here to help ensure you get the best policy at the best value. 
                <br/>
                If you have any questions, let us know at ${agentEmail} or reach out to ${agentName} directly.
            </p>
            <div align="center">
                <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-spacing: 0; border-collapse: collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;font-family:arial,helvetica,sans-serif;"><tr><td style="font-family:arial,helvetica,sans-serif;" align="center"><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="" style="height:45px; v-text-anchor:middle; width:120px;" arcsize="9%" stroke="f" fillcolor="#3AAEE0"><w:anchorlock/><center style="color:#FFFFFF;font-family:arial,helvetica,sans-serif;"><![endif]-->
                <a href="${link}" target="_blank" style="box-sizing: border-box;display: inline-block;font-family:arial,helvetica,sans-serif;text-decoration: none;-webkit-text-size-adjust: none;text-align: center;color: #FFFFFF; background-color: #3AAEE0; border-radius: 4px; -webkit-border-radius: 4px; -moz-border-radius: 4px; width:auto; max-width:100%; overflow-wrap: break-word; word-break: break-word; word-wrap:break-word; mso-border-alt: none;">
                    <span style="display:block;padding:10px 20px;line-height:120%;"><span style="font-size: 14px; line-height: 16.8px;">Open Application</span></span>
                </a>
                <!--[if mso]></center></v:roundrect></td></tr></table><![endif]-->
            </div>
            <p align="center">
                If the button does not work try pasting this link into your browser:
                <br/>
                <a href="${link}" target="_blank">
                    ${link}
                </a>
            </p>
        `
    if(options.htmlBody){
        htmlBody = options.htmlBody
        //replacements.
        htmlBody = htmlBody.replace(/{{link}}/g, link);
        htmlBody = htmlBody.replace(/{{agentName}}/g, agentName);
        htmlBody = htmlBody.replace(/{{emailAgencyName}}/g, emailAgencyName);
        htmlBody = htmlBody.replace(/{{agentEmail}}/g, agentEmail);
        htmlBody = htmlBody.replace(/{{agentEmail}}/g, agentEmail);


    }

    let branding = agencyNetworkBranding ? '' : 'agency'

    const keys = {

        agencyLocationId: applicationJSON.agencyLocationId,
        applicationId: applicationJSON.agencyLocationId,
        applicationDoc: applicationJSON

    }

    const dataPackageJSON = {
        appDoc: applicationJSON,
        agency: agency,
        link: link,
        options: options,
        htmlBody: htmlBody,
        emailSubject: emailSubject,
        branding: branding,
        recipients: recipients
    }

    try{
        await global.hookLoader.loadhook('quote-app-link', applicationJSON.agencyNetworkId, dataPackageJSON);
        htmlBody = dataPackageJSON.htmlBody
        emailSubject = dataPackageJSON.emailSubject
        branding = dataPackageJSON.branding
        link = dataPackageJSON.link;

    }
    catch(err){
        log.error(`Error quote-app-link hook call error ${err}` + __location);
    }

    const emailData = {
        html: htmlBody,
        subject: emailSubject,
        to: recipients
    };


    const emailSent = await emailsvc.send(emailData.to, emailData.subject, emailData.html, keys, agency.agencyNetworkId, branding, agency.systemId);
    if(!emailSent){
        log.error(`Failed to send email for application link to ${emailData.to}.`);
    }
    else {
        log.info(`Application link email was sent successfully to ${emailData.to}.`);
    }
    return link;
}