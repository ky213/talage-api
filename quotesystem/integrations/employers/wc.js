/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Worker's Compensation Integration for Employers
 *
 * This integration file has answers to the following questions hard-coded in:
 * - I attest that the Insured (my client) has complied with the applicable workers' compensation laws of the states shown in Item 3.A of the policy information page, and I will maintain and make available upon request all required documentation in the Agency file.
 */

 'use strict';

 const Integration = require('../Integration.js');
 //const moment_timezone = require('moment-timezone');
 // eslint-disable-next-line no-unused-vars
 const tracker = global.requireShared('./helpers/tracker.js');
 //const PaymentPlanSvc = global.requireShared('./services/paymentplansvc.js');
 const moment = require('moment');
 const employersClient = require('./employers-client.js');

 module.exports = class EmployersWC extends Integration {

     /**
      * Initializes this integration.
      *
      * @returns {void}
      */
     _insurer_init() {
         this.requiresInsurerActivityClassCodes = true;
     }

     /**
      * Formats phone number string from applicationDocData into the format desired by Employers
      *
      * @param {*} phone - Phone number of the form found in applicationDocData
      * @returns {string} - Phone number in the form: "###-###-####"
      */
     formatPhoneForEmployers(phone) {
         if (!phone || typeof phone !== 'string') {
             log.warn(`Employers WC App ID: ${this.app.id}: Bad phone number format: "${phone}" ` + __location);
             return '';
         }
         const phoneDigits = phone.trim().replace(/\D/g, '');
         if (phoneDigits.length !== 10) {
             log.error(`Employers WC App ID: ${this.app.id}, Incorrect number of digits in phone number: ${phone} ` + __location);
             return '';
         }
         const newPhone = [];
         newPhone.push(phoneDigits.slice(0,3));
         newPhone.push(phoneDigits.slice(3,6));
         newPhone.push(phoneDigits.slice(6,10));
         return newPhone.join('-');
     }

     formatZipCodeForEmployers(zipcode) {
         if (!zipcode || typeof zipcode !== 'string') {
             log.error(`Employers WC App ID: ${this.app.id}: Bad zipcode format: "${zipcode}" ` + __location);
             return '';
         }
         const zipDigits = zipcode.trim().replace(/\D/g, '');
         if (zipDigits.length !== 5 && zipDigits.length !== 9) {
             log.error(`Employers WC App ID: ${this.app.id}, Incorrect number of digits in zip code: ${zipcode} ` + __location);
             return '';
         }
         if (zipDigits.length === 5) {
             return zipDigits;
         }
         else {
             const newZip = [];
             newZip.push(zipDigits.slice(0,5));
             newZip.push(zipDigits.slice(5));
             return newZip.join('-');
         }

     }

     /**
      * Requests a quote from Employers and returns. This request is not intended to be called directly.
      *
      * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
      */
     async _insurer_quote() {
         // Build the Promise
             const appDoc = this.app.applicationDocData;

             const logPrefix = `Employers WC (Appid: ${this.app.id}): `;

              const tomorrow = moment().add(1,'d').startOf('d');
             if(this.policy.effective_date < tomorrow){
                 this.reasons.push("Insurer: Does not allow effective dates before tomorrow. - Stopped before submission to insurer");
                 return this.return_result('autodeclined');
             }

             // These are the statuses returned by the insurer and how they map to our Talage statuses
             this.possible_api_responses.DECLINED = 'declined';
             this.possible_api_responses.IN_PROGRESS = 'referred';
             this.possible_api_responses.PENDING_REFERRAL = 'referred_with_price';
             this.possible_api_responses.QUOTED = 'quoted';
             this.possible_api_responses.REFERRED = 'referred';

             // These are the limits supported by Employers
             const carrierLimits = ['100000/500000/100000',
                 '500000/500000/500000',
                 '1000000/1000000/1000000',
                 '2000000/2000000/2000000'];

             // Define how legal entities are mapped for Employers
             const entityMatrix = {
                 Association: 'AS',
                 Corporation: 'CP',
                 'Limited Liability Company': 'LL',
                 'Limited Partnership': 'LP',
                 Partnership: 'PT',
                 'Sole Proprietorship': 'IN',
                 'Other': 'OT'
             };

             // Define how owner titles are mapped for Employers
             // Owner title codes from https://eigservices.atlassian.net/wiki/spaces/DUG/pages/1070663103/WorkCompIndividuals+Endorsement+Codes
             const ownerTitleMatrix = {
                 'Chief Executive Officer': 'CE',
                 'Chief Financial Officer': 'CF',
                 'Chief Operating Officer': 'CO',
                 'Director': 'DI',
                 'Vice President': 'VP',
                 'Executive Vice President': 'EV',
                 'Executive Secy-VP': 'EY',
                 'Executive Secretary': 'ES',
                 'Treasurer': 'TR',
                 'Secy-Treas': 'ST',
                 'Secretary': 'SE',
                 'President': 'PR',
                 'Pres-VP-Secy-Treas': 'PA',
                 'Pres-VP-Secy': 'PC',
                 'Pres-VP': 'PV',
                 'Pres-Treas': 'PE',
                 'Pres-Secy-Treas': 'PS',
                 'Pres-Secy': 'PY',
                 'VP-Treas': 'VT',
                 'VP-Secy-Treas': 'VY',
                 'VP-Secy': 'VS'
             };

             // Define a list of required questions
             //const required_questions = [979];


             // Log a warning message if there is no location state that matches the business primary state, as Employers will decline
             if (!appDoc.locations.find(location => location.state === appDoc.primaryState)) {
                 log.warn(`Appid: ${this.app.id} No location matches primary state ${appDoc.primaryState}. This will likely result in an autodecline from Employers.`);
             }

             const requestJSON = {
             // Employers has us define our own Request ID
                 //"id": this.app.id,
                 "id": this.quoteId,
                 "effectiveDate": this.policy.effective_date.format('YYYY-MM-DD'),
                 "expirationDate": this.policy.expiration_date.format('YYYY-MM-DD'),
                 "primaryRiskState": appDoc.primaryState,
                 "yearsInBusiness": this.get_years_in_business()
             };
             if(requestJSON.yearsInBusiness < 3){
                 requestJSON.yearsInIndustry = appDoc.yearsOfExp ? appDoc.yearsOfExp : 0;
             }

             try {
                 let primaryContact = null;
                 const agency = this.app.agencyLocation

                 if (appDoc.contacts.length === 1) {
                     primaryContact = appDoc.contacts[0];
                 }
                 else {
                     primaryContact = appDoc.contacts.find(contact => contact.primary === true);
                 }
                 if (!primaryContact) {
                    primaryContact = appDoc.contacts[0];
                    log.warn(`${logPrefix}Could not find primary contact ${JSON.stringify(appDoc.contacts)}` + __location);
                    //throw new Error(`Could not find primary contact`)
                 }

                 const applicantContact = {"email": primaryContact.email};
                 const billingContact = {"email": primaryContact.email};
                 const proposalContact = {"email": this.quotingAgencyLocationDB.email ? this.quotingAgencyLocationDB.email : agency.agencyEmail};

                 const formattedPhone = this.formatPhoneForEmployers(primaryContact.phone);
                 let formattedAgencyPhone = this.formatPhoneForEmployers(this.quotingAgencyLocationDB.phone ? this.quotingAgencyLocationDB.phone : agency.agencyPhone);

                 if (formattedPhone) {
                     applicantContact.phoneNumber = formattedPhone;
                     billingContact.phoneNumber = formattedPhone;
                 }
                 else if (global.settings.ENV === "demo") {
                    applicantContact.phoneNumber = "833-482-5243";
                    billingContact.phoneNumber = "833-482-5243";
                    log.error(`${logPrefix}Cannot fully construct address information. Some fields missing: phone ${JSON.stringify(primaryContact)}` + __location);
                 }
                 else {
                    log.error(`${logPrefix}Cannot fully construct address information. Some fields missing: phone ${JSON.stringify(primaryContact)}` + __location);
                    throw new Error('Primary Contact or Quoting Agency Phone Number is blank or not valid');
                 }

                 if (formattedAgencyPhone) {
                     proposalContact.phoneNumber = formattedAgencyPhone;
                 }
                 else {
                     formattedAgencyPhone = "";
                 }

                 const applicantName = `${primaryContact.firstName} ${primaryContact.lastName}`;
                 if (!primaryContact.firstName || !primaryContact.lastName) {
                     log.warn(`${logPrefix}Cannot construct applicant name: "${applicantName}" ` + __location);
                 }
                 else {
                     applicantContact.name = applicantName;
                     billingContact.name = applicantName;
                 }
                 proposalContact.name = `${this.quotingAgencyLocationDB?.firstName ? this.quotingAgencyLocationDB?.firstName : agency.first_name} ${this.quotingAgencyLocationDB.lastName ? this.quotingAgencyLocationDB.lastName : agency.last_name}`;
                 const address = {
                     "streetAddress1": appDoc.mailingAddress,
                     "streetAddress2": appDoc.mailingAddress2 ? appDoc.mailingAddress2 : "",
                     "city": appDoc.mailingCity,
                     "state": appDoc.mailingState,
                     "zipCode": this.formatZipCodeForEmployers(appDoc.mailingZipcode)
                 };

                 //TODO this need to determine if this is TalageWhole Sale or using AgencyPrime for Employers
                 //if another insurer is using TalageWholesale, but Employer's is not.   this would be wrong.
                 //if(this.app.agencyLocation.insurers[this.insurer.id].talageWholesale){
                 const agencyAddress = {
                     "streetAddress1": this.quotingAgencyLocationDB.address,
                     "streetAddress2": "",
                     "city": this.quotingAgencyLocationDB.city,
                     "state": this.quotingAgencyLocationDB.state,
                     "zipCode": this.formatZipCodeForEmployers(this.quotingAgencyLocationDB.zip)
                 };
                 proposalContact.address = agencyAddress;

                 if (!appDoc.mailingAddress || !appDoc.mailingCity || !appDoc.mailingState || !address.zipCode) {
                     log.warn(`${logPrefix}Cannot fully construct address information. Some fields missing:` + __location);
                     log.debug(`Address: "${JSON.stringify(address)}"`);
                 }
                 else {
                     applicantContact.address = address;
                     billingContact.address = address;

                 }

                 requestJSON.applicantContact = applicantContact;
                 requestJSON.billingContact = billingContact;
                 requestJSON.proposalContact = proposalContact;
             }
             catch (err) {
                 log.error(`${logPrefix}Problem creating contact information on quote request: ${err} ` + __location);
                 // immediately autodecline and report the error
                 this.reasons.push(`${logPrefix} ${err.message}  - Stopped before submission to insurer`);
                 return this.return_result('autodeclined');
             }

             //We use the Agency Code (Entered in AP) only send the agencyCode so not to trigger secondary employer search
             requestJSON.agency = {"agencyCode": this.app.agencyLocation.insurers[this.insurer.id].agencyId};

             //Just use the customerNumber for the agent, so not to trigger Employers secondary look up.
             requestJSON.agent = {"customerNumber": this.app.agencyLocation.insurers[this.insurer.id].agencyId + "-" + this.app.agencyLocation.insurers[this.insurer.id].agentId};

             const association = this.app.agencyLocation.business.association;
             const associationMembershipId = this.app.agencyLocation.business.association_id;
             if (association && association !== "None" && associationMembershipId) {
                 requestJSON.association = {
                     "associationCode": this.app.agencyLocation.business.association,
                     "membershipId": this.app.agencyLocation.business.association_id
                 }
             }

             // Ensure this entity type is in the entity matrix above
             if (!(appDoc.entityType in entityMatrix)) {
                 log.error(`Appid: ${this.app.id} autodeclined: no limits  ${this.insurer.name} does not support the selected entity type ${appDoc.entityType} ` + __location)
             }


             //Prepare some fields for use by locations and namedInsureds
             const businessName = appDoc.businessName.substring(0,60).replace('&', '');

             const locations = [];
             const primaryLocationIndex = appDoc.locations.findIndex(({primary}) => primary);

             for (const index in appDoc.locations) {
                 if(index) {// eslint fix
                     const location = appDoc.locations[index]
                     const locationJSON = {};

                     //make sure only one location is set to "primary"
                     if (primaryLocationIndex > -1) {
                     locationJSON.primary = Number(index) === primaryLocationIndex
                     }
                     else if (Number(index) === 0) {
                         locationJSON.primary = true
                     }

                     if (businessName) {
                         locationJSON.businessName = businessName;
                     }

                     if (location.state === "NJ" && !appDoc.ein) {
                         log.error(`${logPrefix}EIN Required for ${location.state}: ` + __location);
                     }
                     else if (appDoc.ein) {
                         locationJSON.taxPayerId = appDoc.ein;
                     }

                     const unemploymentIdRequiredStates = [
                         'HI',
                         'ME',
                         'NJ',
                         'RI',
                         'MN',
                         'IA'
                     ];
                     if (unemploymentIdRequiredStates.includes(location.state) && !location.unemployment_num) {
                         log.error(`${logPrefix}Unemployment ID required for ${location.state}` + __location);
                     }
                     else if (location.unemployment_num) {
                         locationJSON.unemploymentId = location.unemployment_num
                     }
                     const locationTotalEmployees = this.get_total_location_employees(location)
                     locationJSON.numberOfEmployees = locationTotalEmployees;
                     locationJSON.shift1EmployeesCount = locationTotalEmployees;
                     locationJSON.shift2EmployeesCount = 0;
                     locationJSON.shift3EmployeesCount = 0;

                     const address = {};
                     if (location.address) {
                         address.streetAddress1 = location.address.length > 300 ? location.address.substring(0,299) : location.address;
                     }
                     else {
                         log.error(`${logPrefix}Could not get location address` + __location);
                     }

                     address.streetAddress2 = location.address2 ? location.address2 : "";
                     if (location.city) {
                         address.city = location.city;
                     }
                     else {
                         log.error(`${logPrefix}Could not get location city` + __location);
                     }

                     if (location.state) {
                         address.state = location.state;
                     }
                     else {
                         log.error(`${logPrefix}Could not get location state` + __location);
                     }

                     if (location.zipcode) {
                         address.zipCode = this.formatZipCodeForEmployers(location.zipcode);
                     }
                     else {
                         log.error(`${logPrefix}Could not get location zipcode` + __location);
                     }

                     locationJSON.address = address;

                     locationJSON.rateClasses = [];
                     for (const activityCode of location.activityPayrollList) {
                         let insurerActivityCode = null;
                         if (location.state) {
                             insurerActivityCode = await this.get_insurer_code_for_activity_code(this.insurer.id, location.state, activityCode.activityCodeId);
                         }
                         else {
                             log.error(`${logPrefix}Unable to find Insurer Activity Code due to missing state information ` + __location);
                             continue;
                         }
                         let classCode = "";
                         if (!insurerActivityCode) {
                             log.warn(`Appid: ${this.app.id}: ${this.insurer.name} Could not find insurerActivityCode for ${location.state} ` + __location);
                         }
                         else {
                             classCode = insurerActivityCode.code + insurerActivityCode.sub;
                         }
                         const rateClass = {
                             "classCode": classCode,
                             "payrollAmount": activityCode.payroll
                         }
                         locationJSON.rateClasses.push(rateClass);
                     }
                     locationJSON.owners = [];
                     for(const owner of appDoc.owners){
                         const ownerObj = {
                             "firstName": owner.fname,
                             "lastName": owner.lname,
                             "isIncluded": Boolean(owner.include),
                             "ownershipPercent": owner.ownership
                         };
                         if (owner.payroll) {
                             ownerObj.ownershipSalary = owner.payroll;
                         }
                         else if (ownerObj.isIncluded && location.state === "MT") {
                             log.error(`${logPrefix}Ownership Salary is included for State MT when owner is included ` + __location);
                         }
                         const ownerTitle = ownerTitleMatrix[owner.officerTitle];
                         if (ownerTitle) {
                             ownerObj.ownerTitle = {"code": ownerTitle}
                         }
                         locationJSON.owners.push(ownerObj)

                         //class and payroll for rating.
                         if(owner.activityCodeId > 0){
                             let insurerActivityCode = null;

                             if (location.state) {
                                 insurerActivityCode = await this.get_insurer_code_for_activity_code(this.insurer.id, location.state, owner.activityCodeId);
                             }
                             else {
                                 log.error(`${logPrefix}Unable to find Insurer Activity Code due to missing state information ` + __location);
                                 continue;
                             }
                             let classCode = "";
                             if (!insurerActivityCode) {
                                 log.warn(`Appid: ${this.app.id}: ${this.insurer.name} Could not find insurerActivityCode for ${location.state} ` + __location);
                             }
                             else {
                                 classCode = insurerActivityCode.code + insurerActivityCode.sub;
                             }
                             let newClassCode = true;
                             if(locationJSON.rateClasses.length > 0){
                                 const existingRateClass = locationJSON.rateClasses.find((rc) => rc.classCode === classCode)
                                 if(existingRateClass){
                                     newClassCode = false;
                                     if(owner.include && owner.payroll){
                                         existingRateClass.payrollAmount += owner.payroll
                                     }
                                 }
                             }
                             if(newClassCode){
                                 const rateClass = {
                                     "classCode": classCode,
                                     "payrollAmount": 0
                                 }
                                 if(owner.include && owner.payroll){
                                     rateClass.payrollAmount += owner.payroll
                                 }

                                 locationJSON.rateClasses.push(rateClass);
                             }
                         }
                     }
                     locations.push(locationJSON);
                 }
             }

             // California Req: If there is atleast one CA location, and it is a Partnerhsip entity, all owners must be listed
             if (appDoc.entityType === 'Partnership' || appDoc.entityType === 'Limited Partnership' || appDoc.entityType === 'Limited Liability Partnership') {
                 if (appDoc.locations.find(location => location.state === 'CA')) {
                     if (appDoc.owners.length < 2) {
                         log.error(`A ${appDoc.entityType} with at least one location in California is required to have all partners listed on the application - Only one partner was listed.`);
                         this.reasons.push(`Insurer: All partners must be listed on a ${appDoc.entityType} application if insuring a location in the state of California. However, only one partner was listed. - Stopped before submission to insurer`);
                         return this.return_result('autodeclined');
                     }
                     let countOwnershipRate = 0;
                     appDoc.owners.map(ownershipPercentage => countOwnershipRate += ownershipPercentage.ownership);
                     if (countOwnershipRate !== 100) {
                         log.error(`A ${appDoc.entityType} with at least one location in California is required to have all partners listed on the application - Current ownership percentage listed is ${countOwnershipRate}%.`);
                         this.reasons.push(`Insurer: All partners must be listed on a ${appDoc.entityType} application if insuring a location in the state of California. Current ownership allocation is listed at ${countOwnershipRate}% - Stopped before submission to insurer`);
                         return this.return_result('autodeclined');
                     }
                     // Add partnerNames to our requestJSON submission
                     const arrOfPartners = [];
                     for (const partner of appDoc.owners) {
                         const temp = {};
                         temp.firstName = partner.fname;
                         temp.lastName = partner.lname;
                         arrOfPartners.push(temp);
                       }
                     requestJSON.partnerNames = arrOfPartners;
                 }
             }

             requestJSON.namedInsureds = [{}];
             if (businessName) {
                 requestJSON.namedInsureds[0].name = businessName;
             }
             else {
                log.error(`${logPrefix}Could not get business name` + __location);
             }

             if (appDoc.ein) {
                 requestJSON.namedInsureds[0].fein = appDoc.ein;
             }
             else {
                log.error(`${logPrefix}Could not get EIN` + __location);
                this.reasons.push("No FEIN - Stopped before submission to insurer");
                return this.return_result('autodeclined');
             }

             const entityCode = entityMatrix[appDoc.entityType];
             if (entityCode) {
                 requestJSON.namedInsureds[0].legalEntity = {"code": entityCode}
             }
             else {
                log.warn(`${logPrefix}Could not find entity code ${appDoc.entityType} in Entity Matrix ` + __location);
             }

             requestJSON.namedInsureds[0].locations = locations;


             // Prepare limits
             const bestLimits = this.getBestLimits(carrierLimits);
             if (!bestLimits) {
                 log.error(`Appid: ${this.app.id} no best limits  ${this.insurer.name} does not support the requested liability limits ` + __location);
             }
             else {
                 requestJSON.wcelCoverageLimits = {
                     "claimLimit": bestLimits[0],
                     "employeeLimit": bestLimits[2],
                     "policyLimit": bestLimits[1]
                 };
             }


             // Prepare claims by year
             let claimsByYear = null;
             if (this.policy.claims.length > 0) {
                 // Get the claims organized by year
                 claimsByYear = this.claims_to_policy_years();
             }
             requestJSON.priorLosses = [];
             if (claimsByYear) {
                 for (let i = 1; i <= 4; i++){ // Employers wants at most 4 years of prior losses
                     const claimYear = claimsByYear[i];
                     if (claimYear) {
                         requestJSON.priorLosses.push({
                             "effectiveDate": claimYear.effective_date.format("YYYY-MM-DD"),
                             "numberOfClaims": claimYear.count,
                             "numberOfLostTimeClaims": 0,
                             "amountPaidAndReserved": claimYear.amountPaid + claimYear.amountReserved
                         })
                     }
                 }
             }

             requestJSON.disclaimers = [];

             // Prepare questions

             requestJSON.questions = [];
             for (const insurerQuestion of this.insurerQuestionList) {
                     const question = this.questions[insurerQuestion.talageQuestionId];
                     if(!question){
                         log.error(`${logPrefix} could not find insurerQuestion for Talage Question ${insurerQuestion.talageQuestionId}` + __location)
                         log.error(`${JSON.stringify(this.questions)}` + __location)
                         continue;
                     }

                     // Don't process questions without a code (not for this insurer)
                     const questionCode = this.question_identifiers[question.id];
                     if (!questionCode) {
                         continue;
                     }

                     // For Yes/No questions, if they are not required and the user answered 'No', simply don't send them  - logic does not match comment
                     // if (!required_questions.includes(question.id) && question.type !== 'Yes/No' && !question.hidden && !question.required && !question.get_answer_as_boolean()) {
                     //     continue;
                     // }

                     if (questionCode === 'OOEA') {
                         requestJSON.disclaimers.push({
                                 "disclaimerCode": questionCode,
                                 "stateCode": appDoc.primaryState,
                                 "affirmed": this.determine_question_answer(question, true) === "Yes"
                             });
                         continue;
                     }

                     // Get the answer
                     let answer = '';
                     try {
                         answer = this.determine_question_answer(question, question.required);
                     }
                     catch (error) {
                         log.error(`${logPrefix}Unable to determine question answer for Talage Question ${JSON.stringify(question)} linked to Insurer Question Id: ${insurerQuestion.insurerQuestionId}. Error: ${error} ` + __location);
                     }

                     // This question was not answered
                     if (!answer) {
                         continue;
                     }
                     let goodQuestion = true
                     // Ensure the question is only yes/no at this point
                     if (question.type !== 'Yes/No') {
                         goodQuestion = false
                         log.error(`${logPrefix}Unsupported question type "${question.type}" for Talage Question ${JSON.stringify(question)} linked to Insurer Question Id: ${insurerQuestion.insurerQuestionId}. Employers only supports "Yes/No". ` + __location);
                     }
                     if(goodQuestion){
                         // Save this as an answered question
                         requestJSON.questions.push({
                             "questionCode": questionCode,
                             "value": question.get_answer_as_boolean() ? 'YES' : 'NO'
                         });
                     }
             }

             // set blanket-waiver
             if(appDoc.policies[0]?.blanketWaiver){
                 const states = new Set(appDoc.locations.map(({state}) => state))

                 requestJSON.stateMods = [...states].map((state) => ({
                     state: state,
                     modType: "WAIVER-BLANKET"
                 }))
             }

             //call API
             let host = null;
             if (this.insurer.useSandbox) {
                 host = 'api-qa.employers.com';
             }
             else {
                 host = 'api.employers.com';
             }
             const path = '/DigitalAgencyServices/quote';
             let newAuthSystem = false;
             const additionalHeaders = {};
             if(this.insurer.insurerDoc?.additionalInfo?.newAuthSystem === true){
                 newAuthSystem = true;
             }
             if(newAuthSystem){
                 const authToken = await employersClient.auth(this);
                 if(!authToken){
                     log.error(`${logPrefix}Failed to get auth token ` + __location);
                     this.reasons.push(`Failed to get Auth Token`)
                     return this.return_result('error');
                 }
                 additionalHeaders.authorization = `Bearer ${authToken.trim()}`
             }
             else {
                 additionalHeaders.appKey = this.username
                 additionalHeaders.appToken = this.password
             }

             let quoteResponse = null;
             log.debug(`Appid: ${this.app.id} Sending application to ${host}${path}. Remember to connect to the VPN. This can take up to 30 seconds.`);
             try {
                 quoteResponse = await this.send_json_request(host, path, JSON.stringify(requestJSON), additionalHeaders, 'POST', true, true);
             }
             catch (err) {
                 log.error(`Employers API: Appid: ${this.app.id} API call error: ${err}  ` + __location);
                 this.log += `--------======= Employers Request Error =======--------<br><br>`;
                 this.log += err;
                 this.log += `--------======= End =======--------<br><br>`;
                 if(err.toString().includes('Application is not available')){
                     this.reasons.push(`Employers API: Application is not available'`);
                     return this.return_result('outage');
                 }
                 else if (err.toString().includes('Request unsuccessful')){
                     this.reasons.push(`Employers API: Request unsuccessful'`);
                     return this.return_result('outage');
                 }
                 else {
                     this.reasons.push(`Employers API Error: ${err}`);
                     return this.return_result('error');
                 }
             }

             if (!quoteResponse || !quoteResponse.success) {

                 this.request_id = this.quoteId;
                 this.quoteResponseJSON = quoteResponse;

                 if (quoteResponse.status) {
                     this.reasons.push(`Insurer returned status: ${quoteResponse.status}`);
                 }
                 else {
                     this.reasons.push(`Insurer returned unknown status.`);
                 }

                 if (quoteResponse.errors) {
                     // quoteResponse.errors array also contains info and warnings. Get the actual errors which can make a quote fail
                     const failingQuoteErrors = quoteResponse.errors.filter(error => {
                         const failingQuoteErrorCodes = ['required',
                                                         'invalid',
                                                         'error',
                                                         'nominal'];
                         const errorCode = error.code.split('.')[1];
                         return failingQuoteErrorCodes.includes(errorCode);
                     });
                     failingQuoteErrors.forEach(error => {
                         let errorMessage = "";
                         if (error.message) {
                             errorMessage += error.message;
                         }
                         if (error.fieldValue) {
                             errorMessage += ` : ${error.fieldValue}`;
                         }
                         this.reasons.push(errorMessage);
                     });
                 }
                 return this.return_result('declined');
             }

             // Attempt to get the policy number
             if (quoteResponse.policyNumber) {
                 this.number = quoteResponse.policyNumber;
             }
             else {
                 log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find policy number.` + __location);
             }

             // Attempt to get the amount of the quote
             const premium = quoteResponse.totalPremium;
             if (premium){
                 if (typeof premium === 'number') {
                     this.amount = quoteResponse.totalPremium;
                 }
                 else {
                     log.error(`Appid: ${this.app.id} Employers WC: Quote premium value in quote reponse is not of type 'number' but instead ${typeof premium}` + __location)
                 }
             }

             if (quoteResponse.wcelCoverageLimits) {
                 this.limits[1] = quoteResponse.wcelCoverageLimits.claimLimit;
                 this.limits[2] = quoteResponse.wcelCoverageLimits.policyLimit;
                 this.limits[3] = quoteResponse.wcelCoverageLimits.employeeLimit;
             } // If no limits, this is handled in return_result()

             const status = quoteResponse.status;
             try {
                 this.writer = quoteResponse.writingCompany;
             }
             catch (err) {
                 if (status === 'QUOTED' || status === 'PENDING_REFER') {
                     log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find writing company.` + __location);
                 }
             }

             const insurerPaymentPlans = quoteResponse.availablePaymentPlans;
             try {
                 if (insurerPaymentPlans) {
                     const employerPaymentPlanTranslations = {
                         "DB-D-K": 1, // Employers Billing Option Id - Pay By Code - Pay Option Code
                         "DB-D-9": 4
                     };

                     this.insurerPaymentPlans = insurerPaymentPlans;
                     this.talageInsurerPaymentPlans = [];
                     for (const insurerPaymentPlan of insurerPaymentPlans) {
                         const talagePaymentPlan = {};
                         const lookupKey = `${insurerPaymentPlan.billingOptionId}-${insurerPaymentPlan.payByCode}-${insurerPaymentPlan.payOptionCode}`;
                         const talagePaymentPlanId = employerPaymentPlanTranslations[lookupKey];
                         if (!talagePaymentPlanId) {
                             log.debug(`Could not determine Talage payment plan ID. Skipping payment plan with lookup key "${lookupKey}"`);
                             continue; // Can't determine Payment Plan type so skip this payment plan
                         }
                         talagePaymentPlan.paymentPlanId = talagePaymentPlanId;
                         talagePaymentPlan.insurerPaymentPlanId = insurerPaymentPlan.billingOptionId;
                         if (insurerPaymentPlan.description) {
                             talagePaymentPlan.insurerPaymentPlanDescription = insurerPaymentPlan.description;
                         }

                         if (insurerPaymentPlan.hasOwnProperty('numberOfInstallments') && !isNaN(insurerPaymentPlan.numberOfInstallments)) {
                             talagePaymentPlan.NumberPayments = Number(insurerPaymentPlan.numberOfInstallments);
                         }
                         else {
                             log.debug(`Could not determine number of installments. Skipping payment plan with lookup key "${lookupKey}"`);
                             continue;
                         }

                         if (quoteResponse.hasOwnProperty('totalPremium') && !isNaN(quoteResponse.totalPremium)) {
                             talagePaymentPlan.TotalPremium = Number(quoteResponse.totalPremium);
                         }
                         else {
                             log.debug(`Could not determine total premium. Skipping payment plan with lookup key "${lookupKey}"`);
                             continue;
                         }

                         let totalInstallmentCost = 0;
                         if (insurerPaymentPlan.hasOwnProperty('amountDue') && !isNaN(insurerPaymentPlan.amountDue)) { // Amount due per installment if any
                             talagePaymentPlan.installmentPayment = Number(insurerPaymentPlan.amountDue);
                             totalInstallmentCost = Number(insurerPaymentPlan.amountDue) * Number(insurerPaymentPlan.numberOfInstallments);
                         }
                         else {
                             log.debug(`Could not determine installment payment. Skipping payment plan with lookup key "${lookupKey}"`);
                             continue; // If we can't find amountDue then skip this payment plan. We don't want to make a down payment seem like the total cost of the payment plan
                         }

                         if (insurerPaymentPlan.hasOwnProperty('downPayment') && !isNaN(insurerPaymentPlan.downPayment)){
                             talagePaymentPlan.DownPayment = Number(insurerPaymentPlan.downPayment);
                         }
                         else {
                             log.debug(`Could not determine down payment. Skipping payment plan with lookup key "${lookupKey}"`);
                             continue;
                         }

                         talagePaymentPlan.TotalCost = Number(insurerPaymentPlan.downPayment) + totalInstallmentCost;

                         if (insurerPaymentPlan.hasOwnProperty('downPaymentPercent') && !isNaN(insurerPaymentPlan.downPaymentPercent)) {
                             talagePaymentPlan.DepositPercent = insurerPaymentPlan.downPaymentPercent;
                         }

                         talagePaymentPlan.invoices = [];

                         this.talageInsurerPaymentPlans.push(talagePaymentPlan);
                     }
                 }
             }
             catch (err) {
                 log.error(`${logPrefix}Problem getting payment plan from response object: ${err}` + __location);
             }

             try {
                 const quoteLetter = quoteResponse.attachments.find(attachment => attachment.attachmentType === "QuoteLetter");
                 if (quoteLetter) {
                     this.quote_letter = {
                         content_type: quoteLetter.contentType,
                         data: quoteLetter.contentBody,
                         file_name: quoteLetter.contentDisposition.match(/"(.*)"/)[1],
                         length: quoteLetter.contentLength
                     }
                 }
             }
             catch (err) {
                 if (status === 'QUOTED') {
                     log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Changed how it returns the quote letter.` + __location);
                 }
             }

             if (status === `QUOTED`) {
                 this.isBindable = true
             }
             let returnStatus = status.toLowerCase();
             if (status === `QUOTED`) {
                 returnStatus = "quoted";
             }

             if(status === 'PENDING_REFER' || status === 'PENDING_REFERRAL'){
                 if(this.amount > 0){
                     returnStatus = "referred_with_price";
                 }
                 else {
                     returnStatus = "referred";
                 }
             }
             const response = await this.return_result(returnStatus);
             return response;
     }
 };