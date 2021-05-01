'use strict';

const Integration = require('../Integration.js');
const acordsvc = global.requireShared('./services/acordsvc.js');
const emailsvc = global.requireShared('./services/emailsvc.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');

// Email template
let email_subject = 'ACORD Application from TEMPLATE_AGENCY_NAME';
let email_body = 'Attached is the ACORD application from TEMPLATE_AGENCY_NAME for a General Liability policy';

module.exports = class ACORDGL extends Integration{

    /**
	 * Generate and sends ACORD email and returns
	 *
	 * @returns {object | error} A promise that returns an object containing quote information if resolved, or an error if rejected
	 */
    async _insurer_quote(){

        const appId = this.app.id;
        // Generate acord
        let error = null;
        const generated_acord = await acordsvc.create(this.app.id, this.insurer.id, 'gl').catch(function(err){
            error = err;
        });

        // Check the acord generated successfully
        if(generated_acord && generated_acord.error || error){
            log.error(`Appid: ${this.app.id} Acord form could not be generated for application ${this.app.id} insurer ${this.insurer.id}: ` + generated_acord.error + __location);
            return this.return_result('error');
        }
        // Retrieve email address to send to
        let acord_email = await this.getEmail().catch(function(err){
            log.error(`Appid: ${appId} Could not retrieve email for agency` + err + __location);
            //	return this.return_result('error');
            acord_email = false;
        });

        //Check the email was retrieved successfully
        if(acord_email === false){
            log.error(`Appid: ${this.app.id} Failed to retrieve Email for agency location ${this.app.agencyLocation.id}, insurer ${this.insurer.id} for GL` + __location);
            return this.return_result('error');
        }

        // Prepare email subject and body with application business name
        email_subject = email_subject.replace('TEMPLATE_AGENCY_NAME', this.app.agencyLocation.agency);
        email_body = email_body.replace('TEMPLATE_AGENCY_NAME', this.app.agencyLocation.agency);

        // Prepare keys so that the record of the email being sent is written
        const email_keys = {
            'applicationId': this.app.applicationDocData.applicationId,
            'agencyLocationId': this.app.agencyLocation.id,
            'applicationDoc': this.app.applicationDocData
        }

        const attachment = {
            'content': generated_acord.doc.toString('base64'),
            'filename': 'acordGL.pdf',
            'type': 'application/pdf',
            'disposition': 'attachment'
        };

        const attachmentList = [attachment];
        const emailResp = await emailsvc.send(acord_email, email_subject, email_body, email_keys, this.app.agencyLocation.agencyNetwork, this.app.agencyLocation.email_brand, this.app.agencyLocation.agencyId, attachmentList);

        if(emailResp === false){
            log.error(`Appid: ${this.app.id} Unable to send acord for applicationId ${this.app.id}` + __location)
        }

        return this.return_result('acord_emailed');

    }


    // TODO getEmail logic should be in the agency location's BO  NOT HERE.

    /**
	 * Retrieve agency location/insurer email address to send acord form to for GL
	 *
	 * @returns {Promise<string|false>} A promise that contains an email address if resolved, false otherwise
	 */
    async getEmail(){

        let policyTypeInfoJSON = '';
        try{
            const agencyLocationBO = new AgencyLocationBO();
            policyTypeInfoJSON = await agencyLocationBO.getPolicyInfo(this.app.agencyLocation.id, this.insurer.id);
        }
        catch(err){
            log.error(`Appid: ${this.app.id} Database error retrieving ACORD email for agency location: ${this.app.agencyLocation.id} insurer: ${this.insurer.id} ` + err + __location);
            return false;
        }

        //Make sure we found exactly one record
        if(!policyTypeInfoJSON){
            log.error(`Appid: ${this.app.id} not policyTypeInfo found for ACORD email for agency location: ${this.app.agencyLocation.id} insurer: ${this.insurer.id}` + __location);
            return false;
        }

        let email_address = null;
        try{
            email_address = policyTypeInfoJSON.GL.acordInfo.sendToEmail;
        }
        catch(e){
            log.error(`Appid: ${this.app.id} Missing acord email address GL agency location id ${this.app.agencyLocation.id} insurer: ${this.insurer.id}` + __location)
        }

        //Check the email was found
        if(email_address && email_address.length > 0){
            return email_address;
        }
        else{
            log.error(`Appid: ${this.app.id} Email for agency location ${this.app.agencyLocation.id}, insurer ${this.insurer.id}, policy type GL, was not found.` + __location);
            return false;
        }
    }
}