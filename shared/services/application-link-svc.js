/* eslint-disable object-shorthand */
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
const crypt = global.requireShared('./services/crypt.js');
const emailsvc = global.requireShared('./services/emailsvc.js');
const {capitalizeName} = global.requireShared('./helpers/stringFunctions.js');

const moment = require('moment');

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
async function createQuoteApplicationLink(appId, options){
    if(!appId){
        log.error(`Error generating application link, invalid appId ${appId}` + __location);
        return;
    }
    let returnLink = '';
    try{
        const ApplicationBO = global.requireShared("models/Application-BO.js");
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
        const link = await buildQuoteLink(agency, agencyNetwork, options?.pageSlug, hash);
        returnLink = await sendQuoteEmail(agency, link, options, application);
    }
    catch(err){
        log.error(`createQuoteApplicationLink error ${err}` + __location)
    }

    // send an email if an emailAddress is provided on options

    return returnLink;
}

/**
 * Creates a link into an application for agency portal App
 * @param {uuid} appId - The application to create a link for
 * @param {Object} options - Options for creating the link, see above comment for uses
 * @return {URL} The application link for agency portal App
 * To create a link and NOT send an email, don't pass emailAddress on the options, or leave options null
 */
async function createAgencyPortalApplicationLink(appId, options){
    // ensure an application ID was provided
    if (!appId) {
        log.error(`Error generating application link for agent: No application ID provided.` + __location);
        return;
    }

    // ensure email address was provided
    if (!options?.toEmail) {
        log.error(`Error generating application link for Agency Portal: No to email address provided.` + __location);
        return;
    }

    if (!options?.fromAgencyPortalUserId) {
        log.error(`Error generating application link for agent: From Agency Portal User was not provided.` + __location);
        return;
    }
    let returnLink = '';
    try{
        let application = null;
        try{
            const ApplicationBO = global.requireShared("models/Application-BO.js");
            const applicationBO = new ApplicationBO();
            application = await applicationBO.getById(appId);
        }
        catch(err){
            log.error(`createQuoteApplicationLink error ${err}` + __location)
            throw err;
        }

        const agencyBO = new AgencyBO();
        const agency = await agencyBO.getById(application.agencyId);

        const agencyNetworkBO = new AgencyNetworkBO();
        const agencyNetwork = await agencyNetworkBO.getById(application.agencyNetworkId);

        //load from agencyportal user

        // check that the provided email address is a valid agent (agency portal user) with proper permissions
        const agencyPortalUserBO = new AgencyPortalUserBO();
        const fromAgencyPortalUser = await agencyPortalUserBO.getById(options.fromAgencyPortalUserId);
        if (fromAgencyPortalUser) {
            options.fromEmailAddress = fromAgencyPortalUser.email;
        }

        // create unique hash (key) and value ONLY FOR auto login. Store the link without the hash information to be used for loading the page after login
        let hash = null;
        if (options.autoLogin) {
            let toAgencyPortalUser = null;
            try {
                toAgencyPortalUser = await agencyPortalUserBO.getByEmailAndAgencyNetworkId(options.toEmail, application.agencyNetworkId);
            }
            catch (e) {
                log.error(`An error occurred trying to get the agency portal user for auto login: ${e}.` + __location);
            }

            // if we were able to find the person, create the auto-login hash/value and store in redis
            if (toAgencyPortalUser) {
                hash = await crypt.hash(`${moment.now()}`);
                const value = {agencyPortalUserId: toAgencyPortalUser.agencyPortalUserId};

                // store the hash in redis using prefixed key
                await global.redisSvc.storeKeyValue(`apu-${hash}`, JSON.stringify(value), applicationLinkTimeout);
            }
            else {
                log.info(`Unable to find agency portal user ${options.toEmail} for auto login.` + __location);
            }
        }

        // build the link
        const link = await buildAgencyPortalLink(agencyNetwork, appId, hash);

        // send the email to the agent and return the link
        returnLink = await sendAgencyPortalEmail(agency, link, options, application, agencyNetwork);
    }
    catch(err){
        log.error(`createAgencyPortalApplicationLink error ${err}` + __location)
    }

    return returnLink;
}


/**
 * Build a link to application in for agency portal.
 * @param {Object} agency - agency Doc.
 * @param {Object} agencyNetwork - AgencyNetwork Doc.
 * @param {uuid} pageSlug - pageSlug for agency landing page being used
 * @param {uuid} hash - hash for auto login.
 * @return {URL} The application link for agency portal App
 * To create a link and NOT send an email, don't pass emailAddress on the options, or leave options null
 */
async function buildQuoteLink(agency, agencyNetwork, pageSlug, hash){
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
                log.error(`Failed to generating application link, invalid environment.` + __location);
                return;
        }
    }

    let link = "";

    if (pageSlug) {
        link = `${domain}/${agency.slug}/${pageSlug}/_load/${hash}`;
    }
    else {
        link = `${domain}/${agency.slug}/_load/${hash}`;
    }

    return link;
}

/**
 * Build a link to application in for agency portal.
 * @param {Object} agencyNetwork - AgencyNetwork Doc.
 * @param {uuid} appId - The application to create a link for
 * @param {uuid} hash - hash for auto login.
 * @return {URL} The application link for agency portal App
 * To create a link and NOT send an email, don't pass emailAddress on the options, or leave options null
 */
async function buildAgencyPortalLink(agencyNetwork, appId, hash){
    let domain = "";
    if(agencyNetwork?.additionalInfo?.environmentSettings[global.settings.ENV]?.PORTAL_URL){
        // get the domain from agency networks env settings, so we can point digalent to their custom site, etc.
        domain = agencyNetwork.additionalInfo.environmentSettings[global.settings.ENV].PORTAL_URL;
    }
    else {
        // if environmentSettings is not defined for any reason, fall back to defaults
        switch(global.settings.ENV){
            case "development":
                domain = "http://localhost:8081";
                break;
            case "awsdev":
                domain = "https://dev.insurancewheelhouse.com";
                break;
            case "staging":
                domain = "https://sta.insurancewheelhouse.com";
                break;
            case "demo":
                domain = "https://demo.insurancewheelhouse.com/";
                break;
            case "production":
                domain = "https://agents.insurancewheelhouse.com/";
                break;
            default:
                // dont send the email
                log.error('Failed generating application link: invalid environment.' + __location);
                return;
        }
    }

    let link = "";
    // if hash is provided, augment url for auto login
    if (hash) {
        link = `${domain}/applications/application/${appId}?z=${hash}`;
    }
    else {
        link = `${domain}/applications/application/${appId}`;
    }

    return link;
}

const sendQuoteEmail = async(agency, link, options, applicationJSON) => {
    if(!link || !options?.emailAddress){
        log.warn(`Not sending email for application link ${link} ${__location}`);
        return;
    }

    let recipients = options.emailAddress;

    // if there is an agentEmail, add it as long as it's not the same as emailAddress
    if(options.agentEmail && options.emailAddress !== options.agentEmail){
        recipients += `,${options.agentEmail}`;
    }

    const firstName = options.firstName ? options.firstName : "";
    const agencyDisplayName = agency.displayName ? agency.displayName : agency.name;

    const agentFullname = `${agency.firstName} ${agency.lastName}`;
    const agentName = options.agentName ? options.agentName : agentFullname;

    const agentEmail = options.agentEmail ? options.agentEmail : agency.email;

    const agencyName = options.agencyName ? options.agencyName : agencyDisplayName;

    const agencyNetworkBranding = options.useAgencyNetworkBrand ? options.useAgencyNetworkBrand : false;

    const agencyNetworkBO = new AgencyNetworkBO();
    try {
        const agencyNetworkId = agency.agencyNetworkId;
        const emailContentAgencyNetworkJSON = await agencyNetworkBO.getEmailContent(agencyNetworkId,"quote_app_application_link");
        let message = emailContentAgencyNetworkJSON.message;
        let emailSubject = emailContentAgencyNetworkJSON.subject;
        if(message && emailSubject){
            //replacements.
            message = message.replace(/{{Contact Name}}/g, firstName);
            message = message.replace(/{{Application Link}}/g, link);
            message = message.replace(/{{Agent Name}}/g, agentName);
            message = message.replace(/{{Agency Name}}/g, agencyName);
            message = message.replace(/{{Agent Email}}/g, agentEmail);
        }
        let branding = agencyNetworkBranding ? '' : 'agency';

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
            htmlBody: message,
            emailSubject: emailSubject,
            branding: branding,
            recipients: recipients
        }

        try{
            await global.hookLoader.loadhook('quote-app-link', applicationJSON.agencyNetworkId, dataPackageJSON);
            message = dataPackageJSON.htmlBody
            emailSubject = dataPackageJSON.emailSubject
            branding = dataPackageJSON.branding
            link = dataPackageJSON.link;

        }
        catch(err){
            log.error(`Error quote-app-link hook call error ${err}` + __location);
        }

        const emailData = {
            html: message,
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
    catch(err){
        log.error(`Sending Application Link email ${err}` + __location);
    }
}


const sendAgencyPortalEmail = async(agency, link, options, applicationJSON, agencyNetwork) => {
    if (!link || !options?.toEmail) {
        log.warn(`Not sending email for application link ${link}: No email address provided.` + __location);
        return;
    }

    const recipients = options.toEmail;

    // const agencyDisplayName = agency.displayName ? agency.displayName : agency.name;
    // const referringAgentName = `${agency.firstName} ${agency.lastName}`;
    // const agentEmail = options.agentEmail ? options.agentEmail : agency.email;

    const agencyNetworkBranding = options.useAgencyNetworkBrand ? options.useAgencyNetworkBrand : false;

    const toName = options.toName ? capitalizeName(options.toName).trim() : null;
    const agencyNetworkBO = new AgencyNetworkBO();
    try{
        const agencyNetworkId = agency.agencyNetworkId;
        const emailContentAgencyNetworkJSON = await agencyNetworkBO.getEmailContent(agencyNetworkId,"agency_portal_application_link");
        let message = emailContentAgencyNetworkJSON.message;
        let emailSubject = emailContentAgencyNetworkJSON.subject;

        if(message && emailSubject){
            //replacements.
            message = message.replace(/{{Agent Name}}/g, toName);
            message = message.replace(/{{Business Name}}/g, applicationJSON.businessName);
            message = message.replace(/{{Agency Network Name}}/g, agencyNetwork.name);
            message = message.replace(/{{Application Link}}/g, link);
            message = message.replace(/{{Agent Email}}/g, options.fromEmailAddress);
            emailSubject = emailSubject.replace(/{{Business Name}}/g, applicationJSON.businessName);
        }
        let branding = agencyNetworkBranding ? '' : 'agency';

        const keys = {
            agencyLocationId: applicationJSON.agencyLocationId,
            applicationId: applicationJSON.agencyLocationId,
            applicationDoc: applicationJSON
        };

        const dataPackageJSON = {
            appDoc: applicationJSON,
            agencyNetwork: agencyNetwork,
            agency: agency,
            link: link,
            options: options,
            htmlBody: message,
            emailSubject: emailSubject,
            branding: branding,
            recipients: recipients
        }

        try {
            await global.hookLoader.loadhook('ap-app-link', applicationJSON.agencyNetworkId, dataPackageJSON);

            message = dataPackageJSON.htmlBody
            emailSubject = dataPackageJSON.emailSubject
            branding = dataPackageJSON.branding
            link = dataPackageJSON.link;
        }
        catch (e) {
            log.error(`Error ap-app-link hook call error ${e}.` + __location);
        }

        const emailData = {
            html: message,
            subject: emailSubject,
            to: recipients
        };

        const emailSent = await emailsvc.send(emailData.to, emailData.subject, emailData.html, keys, agency.agencyNetworkId, branding, agency.systemId);

        if(!emailSent){
            log.error(`Failed to send email for application link to ${emailData.to}.` + __location);
        }
        else {
            log.info(`Application link email was sent successfully to ${emailData.to}.` + __location);
        }
        return link;
    }
    catch(err){
        log.error(`Sending Application Link email ${err}` + __location);
    }
}

module.exports = {
    createQuoteApplicationLink,
    createAgencyPortalApplicationLink,
    buildAgencyPortalLink,
    buildQuoteLink
}