/**
 * Encryption/Decryption helper. Provides an interface for our internal encryption service.
 */

'use strict';
const Sendgrid = require('@sendgrid/mail');
//const util = require('util');
const imageSize = require('image-size');
const url = require('url');
const https = require('https');
const crypt = require('./crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const fs = require('fs');
//const imgSize = require('./emailhelpers/imgSize.js');
const moment = require('moment');
//const moment_timezone = require('moment-timezone');
//const request = require('request');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const MessageBO = global.requireShared('./models/Message-BO.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');

/**
 * Sends an email to the address specified through our email service and saves the message data in the database
 *
 * @param {mixed} recipients - The recipient email addresses, accepts a single address as a string, a list of
 * 								addresses as a comma separated string, or an array of addresses
 * @param {string} subject - The subject of the email
 * @param {string} content - The HTML content of the email
 * @param {object} keys - (optional) An object of property names and values to tie this email to, an be an application id, agencyLocation, or both (preferred)
 * @param {string} brand - (optional) The name of the brand to override agency network record. talage to override wheelhouse. agency to make it agency branding.
 * @param {int} agency - (optional) The ID of the agency whose branding will appear on the email (brand must be agency or digalent-agency)
  @param {int} attachments - (optional) Array of JSON for attachments
 * @return {boolean} - True if successful; false otherwise
 */

exports.send = async function(recipients, subject, content, keys = {}, agencyNetworkId = 1 , brandOverride = '', agencyId = 1, attachments) {
    // If we are in the test environment, don't send and just return true
    if(global.settings.ENV === 'test'){
        return true;
    }
    // log.debug("EmailSvc: agencyNetworkId:  " + agencyNetworkId);
    // log.debug("EmailSvc: brandOverride:  " + brandOverride);
    // log.debug("EmailSvc: agencyId:  " + agencyId);
    //check agencyNetworkId is number
    let applicationDoc = null;
    if(keys && keys.applicationDoc){
        applicationDoc = keys.applicationDoc;
    }
    try{
        agencyNetworkId = parseInt(agencyNetworkId,10);
    }
    catch(e){

        return false;
    }

    //load AgencyNetworkBO
    const agencyNetworkBO = new AgencyNetworkBO();
    let error = null;

    const agencyNetworkJSON = await agencyNetworkBO.getById(agencyNetworkId).catch(function(err){
        log.error(`Error loading AgencyNetworkBO AgencyNetworkId {agencyNetworkId} ` + err + __location);
        error = err;
    })
    if(error || !agencyNetworkJSON){
        return false;
    }
    if(!agencyNetworkJSON.additionalInfo || !agencyNetworkJSON.additionalInfo.fromEmailAddress){
        log.error(`Error loading AgencyNetworkBO Missing additionalInfo AgencyNetworkId {agencyNetworkId} ` + __location);
        return false;
    }

    var emailJSON = {};
    // Define systems with their sending email address
    // const systems = {
    //     agency: 'no-reply@insurancewheelhouse.com',
    //     digalent: 'no-reply@digalent.com',
    //     'digalent-agency': 'no-reply@digalent.com',
    //     talage: 'info@talageins.com',
    //     wheelhouse: 'info@insurancewheelhouse.com'
    // };

    if(agencyId === 1 && brandOverride === 'wheelhouse'){
        brandOverride = 'talage';
    }

    // Make sure we have recipients
    if (!recipients || !recipients.length) {
        log.warn('Email Service Send: You must supply recipients when using send()' + __location);
        return false;
    }

    // Make sure we have a subject
    if (typeof subject !== 'string' || !subject) {
        log.warn('Email Service Send: You must supply a subject when using send()' + __location);
        return false;
    }

    // Make sure we have content
    if (typeof content !== 'string' || !content) {
        log.warn('Email Service Send: You must supply content when using send()' + __location);
        return false;
    }


    // If this is an agency, make sure we have an agency ID in the payload
    if (brandOverride === 'agency' || brandOverride === 'digalent-agency') {
        if (!agencyId || !/^\d*$/.test(agencyId)) {
            const message = `You must specify an agency when sending from '${brandOverride}'`;
            log.error('Email Service send: ' + message + __location);
            return false;
        }

        emailJSON.agency = parseInt(agencyId, 10);

        // Validate the agency
        if (!await validator.agency(emailJSON.agency)) {
            const message = 'The agencyId specified is not valid ' + emailJSON.agency;
            log.error('Email Service send: ' + message + __location);
            return false;
        }
    }

    // If the brand is 'agency' or 'digalent-agency', make sure an agency was supplied
    if ((brandOverride === 'agency' || brandOverride === 'digalent-agency') && (typeof agencyId !== 'number' || !agencyId)) {
        log.warn('Email Service Send: When using a brand of "agency" or "digalent-agency" an agency must be supplied to send()');
        return false;
    }

    // ******* Begin building out the data that will be sent into the email service ****************************************
    emailJSON.from = agencyNetworkJSON.additionalInfo.fromEmailAddress
    if (brandOverride === 'agency' || brandOverride === 'digalent-agency'){
        emailJSON.from = agencyNetworkJSON.additionalInfo.fromEmailAddressAgency
    }
    else if (brandOverride === 'talage'){
        emailJSON.from = 'info@talageins.com';
    }
    // log.debug("emailJSON.from: " + emailJSON.from);
    emailJSON.subject = subject;

    // ******  Template processing ************/
    // Make sure we have a template for this system
    let template = `${__dirname}/emailhelpers/templates/${agencyNetworkJSON.additionalInfo.emailTempateFile}`;
    if(brandOverride === 'agency' || brandOverride === 'digalent-agency'){
        template = `${__dirname}/emailhelpers/templates/${agencyNetworkJSON.additionalInfo.emailTempateFileAgency}`;
    }
    else if(brandOverride === 'talage'){
        template = `${__dirname}/emailhelpers/templates/talage.html`;
    }
    //log.debug("template:  " + template);
    if (!fs.existsSync(template)) {
        const message = 'There is no email template setup for the specified system. ' + template;
        log.error('Email Service send: ' + message + __location);
        return false;
    }

    // Bring in the Template HTML and perform a couple of replacements
    emailJSON.html = fs.readFileSync(template, 'utf8').replace('{{subject}}', emailJSON.subject).replace('{{content}}', content);

    // If this is an agency, there is some additional replacement that needs to occur
    if (brandOverride === 'agency' || brandOverride === 'digalent-agency') {
        log.debug('agency template being used')
        // default logoHTMl empty string
        let logoHTML = '';
        logoHTML = await getAgencyLogoHtml(emailJSON.agency).catch(function(err) {
            log.error('Email Svc getAgencyLogoHtml error: ' + err + __location);
        });
        // Make sure to not get an undefined in email.
        if(!logoHTML){
            logoHTML = '';
        }
        emailJSON.html = emailJSON.html.replace('{{logo}}', logoHTML);
    }

    //Setup storing sent email.
    // Working UTC with MongoDB and sending momemt object
    const sentDtm = moment();
    // Begin populating a list of columns to insert into the database
    const columns = {
        message: content,
        sent: sentDtm,
        subject: emailJSON.subject
    };
    //keys.applicationDoc
    // TODO Eliminate when rest of emails about Apps move to AppDoc. If there were keys supplied, write the appropriate records to the database
    if (keys && typeof keys === 'object' && Object.keys(keys).length) {
        // Handle the Application key
        if(keys.applicationId){
            columns.applicationId = keys.application;
            if(keys.applicationDoc && keys.applicationDoc.businessName){
                columns.businessName = keys.applicationDoc.businessName;
            }
        }
        if(keys.application){
            columns.applicationId = keys.application;
            if(keys.applicationDoc && keys.applicationDoc.businessName){
                columns.businessName = keys.applicationDoc.businessName;
            }
        }
        if (Object.prototype.hasOwnProperty.call(keys, 'applicationId')) {
            // Add the application to the columns list
            columns.application = keys.application;
            if(keys.applicationDoc && keys.applicationDoc.businessName){
                columns.business = keys.applicationDoc.businessName;
            }
        }
        // Handle the agencyLocation key
        if (Object.prototype.hasOwnProperty.call(keys, 'agencyLocationId')) {
            // Add the agencyLocation to the columns list
            columns.agencyLocationId = keys.agencyLocationId;
        }
    }

    //applicationDoc override keys sent.
    if(applicationDoc && applicationDoc.applicationId){
        columns.applicationId = applicationDoc.applicationId;
        columns.businessName = applicationDoc.businessName;
        columns.agencyLocationId = applicationDoc.agencyLocationId;
    }


    // Adjust the subject based on the environment
    if (emailJSON && emailJSON.subject && typeof emailJSON.subject === 'string' && global.settings.ENV !== 'production') {
        if (global.settings.ENV === 'test') {
            emailJSON.subject = `[TEST] ${emailJSON.subject}`;
        }
        else if (global.settings.ENV === 'development' || global.settings.ENV === 'awsdev') {
            emailJSON.subject = `[DEV TEST] ${emailJSON.subject}`;
        }
        else if (global.settings.ENV === 'staging') {
            emailJSON.subject = `[STA TEST] ${emailJSON.subject}`;
        }
        else if (global.settings.ENV === 'demo') {
            emailJSON.subject = `[DEMO TEST] ${emailJSON.subject}`;
        }
        else {
            //unknown or new env setting
            log.error('email unknown ENV setting ' + global.settings.ENV);
            emailJSON.subject = `[DEV TEST] ${emailJSON.subject}`;
        }
    }
    emailJSON.to = recipients;

    // DO NOT send non talageins.com email in development (local) or awsdev
    // Scheduled tasks and db restores may lead to applications or agencies with "real" emails
    // in dev databases.
    if (global.settings.ENV === 'development' || global.settings.ENV === 'awsdev') {
        // Hard disable
        if (global.settings.DISABLE_EMAIL && global.settings.DISABLE_EMAIL === 'YES') {
            log.debug('Disabling email: ' + emailJSON.to);
            return true;
        }
        // Hard override
        if (global.settings.OVERRIDE_EMAIL && global.settings.OVERRIDE_EMAIL === 'YES' && global.settings.TEST_EMAIL) {
            emailJSON.to = global.settings.TEST_EMAIL;
            log.debug('Overriding email: ' + emailJSON.to);
        }
        else if (recipients.endsWith('@talageins.com') === false || recipients.includes(',')) {
            // Soft override
            // eslint-disable-next-line keyword-spacing
            if (global.settings.TEST_EMAIL) {
                emailJSON.to = global.settings.TEST_EMAIL;
            }
            else {
                const overrideEmail = 'brian@talageins.com';
                emailJSON.to = overrideEmail;
            }
        }
    }
    //save any overrides for DB Save
    recipients = emailJSON.to
    if (attachments) {
        emailJSON.attachments = attachments;
    }

    //emailJSON.to may get changed in sendUsingSendGrid
    let sendGridResp = await sendUsingSendGrid(emailJSON).catch(function(err) {
        log.error('SendUsingSendGrid error: ' + err + __location);
        sendGridResp = {"sendGridRespError": err};
    });
    // log.debug('sendGridResp:  ' + JSON.stringify(sendGridResp))

    // Store mail before sending to SendGrid
    // Store a record of this sent message
    // await saveEmailToDb(columns, emailJSON.to, attachments).catch(function(err) {
    //     log.error('saveEmailToDb error: ' + err + __location);
    // });
    const messageBO = new MessageBO();
    await messageBO.saveMessage(columns,recipients,sendGridResp, attachments, applicationDoc).catch(function(err){
        log.error('saveMessage error: ' + err + __location);
    });

    return sendGridResp;
};

var sendUsingSendGrid = async function(emailJSON) {
    // Set the Sendgrid API key
    Sendgrid.setApiKey(global.settings.SENDGRID_API_KEY);

    const recipientsList = emailJSON.to.split(',');
    if(recipientsList.length > 0){
        emailJSON.to = recipientsList;
    }
    // Initialize the email object
    let goodSend = false;
    await Sendgrid.send(emailJSON).
        then(function() {
            log.info('Email successfully sent.' + __location);
            goodSend = true;
        }).
        catch(function(error) {
            // Make sure the error returned is an object and has a code
            if (typeof error !== 'object' || !Object.prototype.hasOwnProperty.call(error, 'code')) {
                //const message = 'An unexpected error was returned from Sendgrid. Check the logs for more information. ' ;
                log.error('Email Service PostEmail: ' + error + __location);
                //log.verbose(util.inspect(error, false, null));
            }
            else if (error.code === 400) {
                // If this is a 400, something wrong was sent in
                // Check that the response object has the properties we are expecting, and if not, exit
                if (!Object.prototype.hasOwnProperty.call(error, 'response') || !Object.prototype.hasOwnProperty.call(error.response, 'body') || !Object.prototype.hasOwnProperty.call(error.response.body, 'errors') || typeof error.response.body.errors !== 'object') {
                    const message = 'Sendgrid may have changed the way it returns errors. Check the logs for more information. ';
                    log.error('Email Service PostEmail: ' + message + JSON.stringify(error) + __location);
                    //log.verbose(util.inspect(error, false, null) + __location);
                }
                else {
                    // Parse the error message to return something useful
                    const errors = [];
                    error.response.body.errors.forEach(function(errorObj) {
                        errors.push(errorObj.message + __location);
                    });

                    // Build the message to be sent
                    const message = `Sendgrid returned the following errors: ${errors.join(', ')}`;
                    log.error(`Email Failed: ${message}` + __location);

                }
            }
            else {
                // Some other type of error occurred
                const message = 'An unexpected error was returned from Sendgrid. Check the logs for more information. ';
                log.error('Email Service PostEmail: ' + message + JSON.stringify(error) + __location);
            }
        });
    return goodSend;
};

/**
 * Determines the size of an image based on its URL
 *
 * @param {string} address - The publicly accessible web address of the image
 * @returns {Promise.<object, Error>} - A promise that returns the result of the request as an object with height, width, and type parameters, width and then height if resolved, or an Error if rejected
 */
var imgSize = function(address) {
    // Send the request to the encryption service
    return new Promise(function(resolve, reject) {
        try {
            // Parse out some of the information about this URL
            const options = url.parse(address);

            // Download the image
            // TO DO rewrite to us file svc. images are in S3.
            https.get(options, function(response) {
                const chunks = [];

                if (response.statusCode !== 200) {
                    log.error(`Image not found ${address} (code: ${response.statusCode})`);
                    reject(new Error(`Image not found`));
                    return;
                }

                response.
                    on('data', function(chunk) {
                        chunks.push(chunk);
                    }).
                    on('end', function() {
                        // Return the result
                        resolve(imageSize(Buffer.concat(chunks)));
                    });
            });
        }
        catch (e) {
            reject(new Error(`Unable to determine image size (${address})`));
        }
    });
};

var getAgencyLogoHtml = async function(agencyId) {
    const agencyBO = new AgencyBO();
    const agencyDB = await agencyBO.getById(agencyId).catch(function(err) {
        log.error(`Email Service getAgencyLogoHtml: Agency getbyId ${agencyId} error ` + err + __location);
        throw err;
    });

    let logoHTML = `<h1 style="padding: 35px 0;">${agencyDB.name}</h1>`;

    // If the user has a logo, use it; otherwise, use a heading
    if (agencyDB.logo) {
        try {
            const imgInfo = await imgSize(`${global.settings.IMAGE_URL}/public/agency-logos/${agencyDB.logo}`);

            // Determine if image needs to be scaled down
            const maxHeight = 100;
            const maxWidth = 300;
            if (imgInfo.height > maxHeight || imgInfo.width > maxWidth) {
                // Scale the image down proportionally
                const ratio = Math.min(maxWidth / imgInfo.width, maxHeight / imgInfo.height);
                imgInfo.height *= ratio;
                imgInfo.width *= ratio;
            }

            logoHTML = `<img alt="${agencyDB.name}" src="${global.settings.IMAGE_URL}/public/agency-logos/${agencyDB.logo}" height="${imgInfo.height}" width="${imgInfo.width}">`;
        }
        catch (e) {
            // we will fail back to the default email heading for safety
            log.error(`Email Service PostEmail: Agency ${agencyId} logo image not found. Defaulting to text for logo. (${e})` + __location);
            throw e;
        }
    }

    // If the user had a website, we should wrap the logo in a link
    if (agencyDB.website) {
        // Wrap the logo in a link
        logoHTML = `<a href="${agencyDB.website}" target="_blank">${logoHTML}</a>`;
    }

    return logoHTML;
};