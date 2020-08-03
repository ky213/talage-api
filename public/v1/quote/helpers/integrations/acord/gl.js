'use strict';

const Integration = require('../Integration.js');
const acordsvc = global.requireShared('./services/acordsvc.js');
const emailsvc = global.requireShared('./services/emailsvc.js');

// Email template
let email_subject = 'ACORD Application from TEMPLATE_AGENCY_NAME';
let email_body = 'Attached is the ACORD 126 application from TEMPLATE_AGENCY_NAME for a General Liability policy';

module.exports = class ACORDGL extends Integration{

	/**
	 * Generate and sends ACORD email and returns
	 *
	 * @returns {object | error} A promise that returns an object containing quote information if resolved, or an error if rejected
	 */
	async _insurer_quote(){

		// Generate acord
		const generated_acord = await acordsvc.create(this.app.id, this.insurer.id, 'gl');

		// Check the acord generated successfully
		if(generated_acord.error){
			log.error(`Acord form could not be generated for application ${this.app.id} insurer ${this.insurer.id}: ` + generated_acord.error + __location);
			return this.return_result('error');
		}
		// Retrieve email address to send to
		let acord_email = await this.getEmail().catch(function(err){
			log.error(`Could not retrieve email for agency` + err + __location);
            //	return this.return_result('error');
            acord_email = false;
		});

		//Check the email was retrieved successfully
		if(acord_email === false){
			log.error(`Failed to retrieve Email for agency location ${this.app.agencyLocation.id}, insurer ${this.insurer.id} for GL` + __location);
			return this.return_result('error');
		}

		// Prepare email subject and body with application business name
		email_subject = email_subject.replace('TEMPLATE_AGENCY_NAME', this.app.agencyLocation.agency);
		email_body = email_body.replace('TEMPLATE_AGENCY_NAME', this.app.agencyLocation.agency);

		// Prepare keys so that the record of the email being sent is written
		const email_keys = {
			'application': this.app.id,
			'agencyLocation': this.app.agencyLocation.id
		}

		const chunks = [];

		generated_acord.doc.on('data', function(chunk){
			chunks.push(chunk);
		});
        // eslint-disable-next-line consistent-this

		generated_acord.doc.on('end', async() => {
			const result = Buffer.concat(chunks);
			const attachment = {
				'content': result.toString('base64'),
				'filename': 'acord-126.pdf',
				'type': 'application/pdf',
				'disposition': 'attachment'
			};
			const attachments = [];
			attachments.push(attachment);
			// Email it
            const emailResp = await emailsvc.send(acord_email, email_subject, email_body, email_keys, this.app.agencyLocation.email_brand, this.app.agencyLocation.agencyId, attachments);
            if(emailResp === false){
                log.error(`Unable to send accord for applicationId ${this.app.id}` + __location)
             }
            //  if(emailResp === true){
            //     self.return_result('referred');
            // }
            // else{
            //     self.return_result('error');
            // }
            return emailResp;
        });
        // always referred regardless of email .
        const email_sent = generated_acord.doc.end();
        return this.return_result('referred');
    }


    // TODO getEmail logic should be in the agency location's BO  NOT HERE.

	/**
	 * Retrieve agency location/insurer email address to send acord form to for GL - This logic snou
	 *
	 * @returns {Promise<string|false>} A promise that contains an email address if resolved, false otherwise
	 */
	async getEmail(){

		let acord_email = '';
		const acord_email_sql = `SELECT policy_type_info
								 FROM clw_talage_agency_location_insurers
								 WHERE agency_location = ${this.app.agencyLocation.id} AND insurer = ${this.insurer.id}`

		try{
			acord_email = await db.query(acord_email_sql)
		}
		catch(err){
			log.error(`Database error retrieving ACORD email for agency location: ${this.app.agencyLocation.id} insurer: ${this.insurer.id} ` + err + __location);
			return false;
		}

		//Make sure we found exactly one record
		if(acord_email.length !== 1){
			log.error(`${acord_email.length} records found for ACORD email for agency location: ${this.app.agencyLocation.id} insurer: ${this.insurer.id} instead of 1` + __location);
			return false;
		}

		//Retrieve the email address for GL
		const policyTypeInfoJSON = await JSON.parse(acord_email[0].policy_type_info);

        let email_address = null;
        try{
            email_address = policyTypeInfoJSON.GL.acordInfo.sendToEmail;
        }
		catch(e){
            log.error(`Missing accord email address GL agency location id ${this.app.agencyLocation.id} ` + __location)
        }

		//Check the email was found
		if(email_address && email_address.length > 0){
			return email_address;
		}
		else{
			log.error(`Email for agency location ${this.app.agencyLocation.id}, insurer ${this.insurer.id}, policy type GL, was not found.` + __location);
			return false;
		}
	}
}