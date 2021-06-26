/* eslint-disable guard-for-in */
/* eslint-disable no-loop-func */
/* eslint-disable brace-style */
/* eslint-disable array-element-newline */
/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */
/* eslint no-unreachable: 0 */

/**
 * Worker's Compensation Integration for CompWest (shared with Accident Fund)
 *
 * If Alabama (Merit Rating Credit - MRC) or Maine (Loss Ratio) are turned on, there are additional fields we need to add below
 */

'use strict';

const Integration = require('../Integration.js');
const builder = require('xmlbuilder');
const moment = require('moment');
const util = require('util');
const log = global.log;
//const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const wcEmodEmail = global.requireRootPath('./tasksystem/task-wcemodemail');

module.exports = class CompwestWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityClassCodes = true;
    }

    /**
     * Requests a quote from CompWest and returns. This method is not intended to be called directly.
     *
     * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
     */
    async _insurer_quote() {


       

        //const appDoc = this.app.applicationDocData

        // eslint-disable-next-line prefer-const
        let guideWireAPI = true; //2021-07-01T00:00:00
        const apiSwitchOverDateString = '2021-07-01T00:00:00-08'
        const apiSwitchOverDateDT = moment(apiSwitchOverDateString)

        //check policy effectiv date to determine API to call.
        if(this.policy.effective_date < apiSwitchOverDateDT){
            guideWireAPI = false;
        }
        //prevent new API use in Production
        if (!this.insurer.useSandbox) {
            guideWireAPI = false;
        }
        log.debug(`guideWireAPI: ${guideWireAPI}` + __location);
        // These are the statuses returned by the insurer and how they map to our Talage statuses
        this.possible_api_responses.DECLINE = 'declined';
        this.possible_api_responses.QUOTED = 'quoted';
        this.possible_api_responses.REFERRALNEEDED = 'referred';

        // Core States
        const afCoreStates = ['AR', 'DC', 'GA', 'IA', 'IL', 'IN', 'KS', 'KY', 'LA', 'MD', 'MI', 'MN', 'MO', 'MS', 'NC', 'NE', 'OK', 'SC', 'SD', 'TN', 'TX', 'VA', 'WI'];

        const cwCoreStates = ['AZ', 'CA', 'CO', 'ID', 'NV', 'OR', 'UT'];

        const entityMatrix = {
            Association: 'AS',
            Corporation: 'CP',
            'Limited Liability Company': 'LL',
            'Limited Partnership': 'LP',
            Partnership: 'PT',
            'Sole Proprietorship': 'IN'
        };

        // CompWest has us define our own Request ID
        this.request_id = this.generate_uuid();


        // Check if this is within a core state, if not, more checking needs to be done
        if (!afCoreStates.includes(this.app.business.primary_territory) && !cwCoreStates.includes(this.app.business.primary_territory)) {
            // If this wasn't the Talage agency, start over as the Talage agency
            if (this.app.agencyLocation.agencyId !== 1) {
                log.info(`TO DO: Appid: ${this.app.id}  As this business could not be written by ${this.insurer.name}, we can wholesale it.`);
            }

            // For now, just auto decline
            log.warn(`Appid: ${this.app.id} autodeclined: Non-Core State:  ${this.insurer.name} will not write policies where the primary territory is ${this.app.business.primary_territory} ` + __location);
            this.reasons.push(`Non-Core State: ${this.insurer.name} will not write policies where the primary territory is ${this.app.business.primary_territory}`);
            return this.return_result('autodeclined');
        }

        // Prepare limits - just for error check here.
        const carrierLimits = ['100000/500000/100000', '500000/500000/500000', '500000/1000000/500000', '1000000/1000000/1000000', '2000000/2000000/2000000'];
        const limits = this.getBestLimits(carrierLimits);
        if (!limits) {
            log.warn(`Appid: ${this.app.id} autodeclined: no limits  ${this.insurer.name} does not support the requested liability limits ` + __location);
            this.reasons.push(`Appid: ${this.app.id} ${this.insurer.name} does not support the requested liability limits`);
            return this.return_result('autodeclined');
        }

         if (!(this.app.business.entity_type in entityMatrix)) {
            log.error(`Appid: ${this.app.id} ${this.insurer.name} WC Integration File: Invalid Entity Type` + __location);
            this.reasons.push(`Appid: ${this.app.id} ${this.insurer.name} WC Integration File: Invalid Entity Type`);
            return this.return_result('error');
        }
        //************************* create XML ************************************ */
        // Build the XML Request

        const requestACORD = await this.createRequestXML(this.request_id, guideWireAPI)

        // Get the XML structure as a string
        const xml = requestACORD.end({pretty: true});

        /************** Make Request ********************************************** */
        // Determine which URL to use
        let host = '';
        let path = '';
        if(guideWireAPI === true){
            if (this.insurer.useSandbox) {
                log.debug("AF sandbox Guidewire");
                host = 'npsv.afgroup.com';
                path = '/TEST_DigitalAq/rest/getworkcompquote';
            }
            else {
                log.debug("AF prod Guidewire");
                // //TODO Change when Production URl is received
                 host = 'psv.afgroup.com';
                 path = '/DigitalAq/rest/getworkcompquote';
            }
        }
        else if (this.insurer.useSandbox) {
                host = 'npsv.afgroup.com';
                path = '/TEST_DigitalAq/rest/getworkcompquote';
        } 
        else {
            host = 'psv.afgroup.com';
            path = '/DigitalAq/rest/getworkcompquote';
        }

        // Send the XML to the insurer
        let result = null;
        try {
            log.debug(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} sending request ` + __location);
            result = await this.send_xml_request(host, path, xml, {
                Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
                'Content-Type': 'application/xml'
            }, false, true);
        }
        catch (error) {
            log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: ${error}` + __location);
            if(error.message.indexOf('timedout') > -1){
                this.reasons.push(error)
            }
            else{
                this.reasons.push(error)
            }
            //return this.return_result('error');
        }
        // Begin reducing the response
        if(!result){
            this.log += '--------======= Unexpected API Response - No response =======--------';
            this.log += util.inspect(result, false, null);
            log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type}. Request Error: Empty response from Insurer`)
            this.reasons.push("Request Error: Empty response from Insurer")
            return this.return_result('error');
        }
        if(!result.ACORD){
            this.log += '--------======= Unexpected API Response - No Acord Tag =======--------';
            this.log += util.inspect(result, false, null);
            log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type}. Request Error: Unexpected response ${JSON.stringify(result)}`)
            this.reasons.push("Request Error:  Unexpected response see logs - Contact Talage Engineering")
            return this.return_result('error');
        }
        const res = result.ACORD;
        //log.debug("AF response " + JSON.stringify(res))

        // Check the status to determine what to do next
        let message_type = '';
        let status = ''
        let statusDescription = '';
        //if(res.SignonRs[0] && res.SignonRs[0].Status[0]){
        try{
            status = res.SignonRs[0].Status[0].StatusCd[0];

            try{
                if(res.SignonRs[0].Status[0].StatusDesc[0] && res.SignonRs[0].Status[0].StatusDesc[0].Desc){
                    statusDescription = res.SignonRs[0].Status[0].StatusDesc[0].Desc.toString();
                }
                //statusDescription = res.SignonRs[0].Status[0].StatusDesc[0].Desc ? res.SignonRs[0].Status[0].StatusDesc[0].Desc : "";
            }
            catch(err){
                log.debug(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type}. Unable to process  res.SignonRs[0].Status[0].StatusDesc[0].Desc ${err}` + __location);
            }

            // if(res.SignonRs[0].Status[0] && res.SignonRs[0].Status.StatusDesc
            //     && res.SignonRs[0].Status[0].StatusDesc[0] && res.SignonRs[0].Status[0].StatusDesc[0].Desc
            //     && res.SignonRs[0].Status[0].StatusDesc[0].Desc.length){
            // }
            // else {
            //     statusDescription = "AFGroup/CompWest did not return an error description.";
            // }
        }
        catch(err){
            log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type}. Error getting AF response status from ${JSON.stringify(res.SignonRs[0].Status[0])} ` + err + __location);
        }
        if(typeof statusDescription !== 'string'){
            log.debug(`CompWest WC statusDescription response typeof ${typeof statusDescription} value: ` + statusDescription + __location);
            statusDescription = '';
        }
        // }
        // else {
        //     log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type}. Error getting AF response status: no res.SignonRs[0].Status[0] node`)
        // }
        switch (status) {
            case 'DECLINE':
                this.log += `--------======= Application Declined =======--------<br><br>Appid: ${this.app.id}  ${this.insurer.name} declined to write this business`;
                this.reasons.push(`${status} - ${statusDescription}`);
                return this.return_result(status);
            case 'UNAUTHENTICATED':
            case 'UNAUTHORIZED':
                message_type = status === 'UNAUTHENTICATED' ? 'Incorrect' : 'Locked';
                this.log += `--------======= ${message_type} Agency ID =======--------<br><br>We attempted to process a quote, but the Agency ID set for the agent was ${message_type.toLowerCase()} and no quote could be processed.`;
                log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} ${message_type} Agency ID` + __location);
                // This was a misconfiguration on the Agent's part, pick it up under the Talage agency for a better user experience
                this.reasons.push(`${status} - ${message_type} Agency ID`);
                return this.return_result('error');
            case 'ERRORED':
                this.log += `--------======= Application error =======--------<br><br> ${statusDescription}`;
                log.error(`Appid: ${this.app.id}  ${this.insurer.name} ${this.policy.type} Integration Error(s):\n--- ${statusDescription}` + __location);
                this.reasons.push(`${status} - ${statusDescription}`);
                // Send notification email if we get an E Mod error back from carrier
                try{
                      if (typeof statusDescription === 'string' && statusDescription.toLowerCase().includes("experience mod")) {
                        wcEmodEmail.sendEmodEmail(this.app.id);
                    }
                }
                catch(err){
                    log.error(`Appid: ${this.app.id} ${this.insurer.name} ${status} Error: ${err}` + __location);
                }
                return this.return_result('error');
            case 'SMARTEDITS':
                this.log += `--------======= Application SMARTEDITS =======--------<br><br>${statusDescription}`;
                log.info(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Carrier returned SMARTEDITS :\n--- ${statusDescription}` + __location);
                this.reasons.push(`${status} - ${statusDescription}`);
                // Send notification email if we get an E Mod error back from carrier
                try{
                     if (typeof statusDescription === 'string' && statusDescription.toLowerCase().includes("experience mod")) {
                        wcEmodEmail.sendEmodEmail(this.app.id);
                    }
                    let WorkCompPolicyAddRsError = null;
                    WorkCompPolicyAddRsError = res.InsuranceSvcRs[0].WorkCompPolicyAddRs[0];
                    const resWorkCompPolicy = WorkCompPolicyAddRsError['com.afg_PDFContent'][0].CommlPolicy[0];
                    this.number = resWorkCompPolicy.PolicyNumber[0];
                }
                catch(err){
                    log.error(`Appid: ${this.app.id} ${this.insurer.name} ${status} Error: ${err}` + __location);
                }
                return this.return_result('referred');
            case 'REFERRALNEEDED':
            case 'QUOTED':
                // This is desired, do nothing
                break;
            case 'RESERVED':
                this.log += `--------======= Application Blocked =======--------<br><br>Another agency has already quoted this business.`;
                log.info(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Application Blocked (business already quoted by another agency)`);
                this.reasons.push(`${status} (blocked) - Another agency has already quoted this business.`);
                return this.return_result('declined');
            default:
                this.log += '--------======= Unexpected API Response =======--------';
                this.log += util.inspect(res, false, null);
                log.error(`Appid: ${this.app.id} ${this.insurer.name} ${status} - Unexpected response code by API `);
                this.reasons.push(`${status} - Unexpected response code returned by API.`);
                return this.return_result('error');
        }
        let WorkCompPolicyAddRs = null;
        // Reduce the response further
        try{
            WorkCompPolicyAddRs = res.InsuranceSvcRs[0].WorkCompPolicyAddRs[0];
        }
        catch(err){
            log.error(`Error getting AF response status from ${JSON.stringify(res)} ` + err + __location);
        }

        if (status === 'QUOTED') {
            // Grab the file info
            try {
                this.quote_letter = {
                    content_type: 'application/pdf',
                    data: WorkCompPolicyAddRs['com.afg_Base64PDF'][0],
                    file_name: `${this.insurer.name}_ ${this.policy.type}_quote_letter.pdf`,
                    length: WorkCompPolicyAddRs['com.afg_Base64PDF'][0].length
                };
            } catch (err) {
                log.error(`Appid: ${this.app.id} ${this.insurer.name} integration error: could not locate quote letter attachments. ${__location}`);
                //return this.return_result('error');
            }
        }

        // Further reduce the response
        let resWorkCompPolicy = null;
        try{
            resWorkCompPolicy = WorkCompPolicyAddRs['com.afg_PDFContent'][0].CommlPolicy[0];
        }
        catch(err){
            log.error(`Error getting AF response status from ${JSON.stringify(res)} ` + err + __location);
        }

        // Attempt to get the policy number
        // eslint-disable-next-line prefer-const
        let policyInfo = {};
        try {
            this.number = resWorkCompPolicy.PolicyNumber[0];
            policyInfo.policyNumber = this.number;
            this.insurerPolicyInfo = policyInfo;
        } catch (e) {
            log.error(`Appid: ${this.app.id} ${this.insurer.name} integration error: could not locate policy number ${__location}`);
            //return this.return_result('error');
        }

        // Get the amount of the quote
        if (status === 'QUOTED' || status === 'REFERRALNEEDED') {
            try {
                this.amount = parseInt(resWorkCompPolicy.CurrentTermAmt[0].Amt[0], 10);
                policyInfo.policyPremium = this.amount;
            } catch (e) {
                log.error(`Appid: ${this.app.id} ${this.insurer.name} Integration Error: Quote structure changed. Unable to quote amount. `);
                //return this.return_result('error');
            }
        }

        // Set the limits info
        this.limits[1] = limits[0];
        this.limits[2] = limits[1];
        this.limits[3] = limits[2];

        // Send the result of the request
        return this.return_result(status);
    }


    async createRequestXML(request_id, guideWireAPI){
        const appDoc = this.app.applicationDocData

        // These are the limits supported by AF Group - checked earlier.
        const carrierLimits = ['100000/500000/100000', '500000/500000/500000', '500000/1000000/500000', '1000000/1000000/1000000', '2000000/2000000/2000000'];
        const limits = this.getBestLimits(carrierLimits);

        // Define how legal entities are mapped for Employers
        let entityMatrix = {
            Association: 'AS',
            Corporation: 'CP',
            'Limited Liability Company': 'LL',
            'Limited Partnership': 'LP',
            Partnership: 'PT',
            'Sole Proprietorship': 'IN'
        };
        if(guideWireAPI === true){
            //updates
            // need to take corporation_type into account for
            // nonprofits.
            entityMatrix = {
                    Association: 'ASSOCIATION',
                    Corporation: 'CORPORATION',
                    'Limited Liability Company': 'LLC',
                    'Limited Partnership': 'LLP',
                    Partnership: 'PARTNERSHIP',
                    'Sole Proprietorship': 'INDIVIDUAL'
                }
                // ASSOCIATION
                // COMMONOWNERSHIP
                // CORPORATION
                // EXECUTORTRUSTEE
                // GOVERNMENT
                // INDIVIDUAL
                // JOINTEMPLOYERS
                // JOINTVENTURE
                // LIMITEDPARTNERSHIP
                // LLC
                // LLP
                // MULTIPLE
                // NONPROFIT
                // OTHER
                // PARTNERSHIP
                // TRUSTESTATE
        }

          // <ACORD>
          //<TransactionRequestDt>2021-05-24</TransactionRequestDt>
        const requestACORD = builder.create('ACORD');
        if(guideWireAPI === true){
            requestACORD.att('xsi:noNamespaceSchemaLocation', 'WorkCompPolicyQuoteInqRqXSD.xsd');
            requestACORD.att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
        }

        // <SignonRq>
        const SignonRq = requestACORD.ele('SignonRq');

        // <ClientApp>
        const ClientApp = SignonRq.ele('ClientApp');

        // Org (AF Group has asked us to send in the Channel ID in this field. 2 indicates Digalent Storefront. 1 indicates the Talage Digital Agency)
        ClientApp.ele('Org', this.app.agencyLocation.id === 2 || this.app.agencyLocation.agencyNetwork === 2 ? 2 : 1);
        if(this.app.applicationDocData
            && this.app.applicationDocData.businessDataJSON
            && this.app.applicationDocData.businessDataJSON.afBusinessData
            && this.app.applicationDocData.businessDataJSON.afBusinessData.requestResponseId){
                ClientApp.ele('SubmissionId', this.app.applicationDocData.businessDataJSON.afBusinessData.requestResponseId);
                log.debug("CompWest WC added SubmissionId");
        }
        //SubmissionId

        // </ClientApp>
        // </SignonRq>

        // <InsuranceSvcRq>
        const InsuranceSvcRq = requestACORD.ele('InsuranceSvcRq');
        InsuranceSvcRq.ele('RqUID', request_id);

        // <WorkCompPolicyQuoteInqRq>
        const WorkCompPolicyQuoteInqRq = InsuranceSvcRq.ele('WorkCompPolicyQuoteInqRq');
        //if(guideWireAPI === true){
            const txnDate = moment();
            WorkCompPolicyQuoteInqRq.ele('TransactionRequestDt',txnDate.tz("America/Los_Angeles").format('YYYY-MM-DD'));
        //}
        // <Producer>
        const Producer = WorkCompPolicyQuoteInqRq.ele('Producer');

        // <ItemIdInfo>
        const ItemIdInfo = Producer.ele('ItemIdInfo');
        let agencyCode = this.app.agencyLocation.insurers[this.insurer.id].agency_id;
        if(guideWireAPI === true){
            agencyCode = this.app.agencyLocation.insurers[this.insurer.id].agent_id;
        }
        ItemIdInfo.ele('AgencyId', agencyCode);
        // </ItemIdInfo>

        // <GeneralPartyInfo>
        let GeneralPartyInfo = Producer.ele('GeneralPartyInfo');

        // <NameInfo>
        let NameInfo = GeneralPartyInfo.ele('NameInfo');
        NameInfo.att('id', 'ProducerName');

        // <PersonName>
        const PersonName = NameInfo.ele('PersonName');
        PersonName.ele('Surname', this.app.agencyLocation.last_name);
        PersonName.ele('GivenName', this.app.agencyLocation.first_name);
        // </PersonName>
        // </NameInfo>
        // </GeneralPartyInfo>
        // </Producer>

        // <InsuredOrPrincipal>
        const InsuredOrPrincipal = WorkCompPolicyQuoteInqRq.ele('InsuredOrPrincipal');
        InsuredOrPrincipal.att('id', 'n0');

        // <GeneralPartyInfo>
        GeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');

        // <NameInfo>
        NameInfo = GeneralPartyInfo.ele('NameInfo');

        // <CommlName>
        const CommlName = NameInfo.ele('CommlName');
        CommlName.ele('CommercialName', this.app.business.name.replace('’', "'").replace('+', '').replace('|', ''));
        // Preserve this in case they move it back here -SF
        // if (this.app.business.dba) {
        //     // <SupplementaryNameInfo>
        //     const SupplementaryNameInfo = CommlName.ele('SupplementaryNameInfo');
        //     SupplementaryNameInfo.ele('SupplementaryNameCd', 'DBA');
        //     SupplementaryNameInfo.ele('SupplementaryName', this.app.business.dba.replace('’', "'").replace('+', '').replace('|', ''));
        //     // </SupplementaryNameInfo>
        // }
        // </CommlName>


        NameInfo.ele('LegalEntityCd', entityMatrix[this.app.business.entity_type]);

        // <TaxIdentity>
        const TaxIdentity = NameInfo.ele('TaxIdentity');
        TaxIdentity.ele('TaxId', appDoc.ein);
        // </TaxIdentity>
        // </NameInfo>

        // <Addr>
        let Addr = GeneralPartyInfo.ele('Addr');
        Addr.ele('AddrTypeCd', 'MailingAddress');
        Addr.ele('Addr1', this.app.business.mailing_address);
        if (this.app.business.mailing_address2) {
            Addr.ele('Addr2', this.app.business.mailing_address2);
        }
        Addr.ele('City', this.app.business.mailing_city);
        Addr.ele('StateProvCd', this.app.business.mailing_territory);
        Addr.ele('PostalCode', this.app.business.mailing_zip);

        if(guideWireAPI === true){
            Addr.ele('CountryCd', 'US');
        }
        else {
            Addr.ele('CountryCd', 'USA');
        }
        // </Addr>

        // <Communications>
        const Communications = GeneralPartyInfo.ele('Communications');

        // <PhoneInfo>
        const PhoneInfo = Communications.ele('PhoneInfo');
        PhoneInfo.ele('PhoneNumber', this.app.business.contacts[0].phone);
        // </PhoneInfo>

        // <EmailInfo>
        const EmailInfo = Communications.ele('EmailInfo');
        EmailInfo.ele('EmailAddr', this.app.business.contacts[0].email);
        // </EmailInfo>

        if (this.app.business.website) {
            // <WebsiteInfo>
            const WebsiteInfo = Communications.ele('WebsiteInfo');
            WebsiteInfo.ele('WebsiteURL', this.app.business.website);
            // </WebsiteInfo>
        }
        // </Communications>
        // </GeneralPartyInfo>
        // </InsuredOrPrincipal>

        // <CommlPolicy>
        const CommlPolicy = WorkCompPolicyQuoteInqRq.ele('CommlPolicy');
        CommlPolicy.ele('ControllingStateProvCd', this.app.business.primary_territory);
        CommlPolicy.ele('com.afg_TotalEmployees', this.get_total_employees());

        // <ContractTerm>
        const ContractTerm = CommlPolicy.ele('ContractTerm');
        ContractTerm.ele('EffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));
        ContractTerm.ele('ExpirationDt', this.policy.expiration_date.format('YYYY-MM-DD'));
        // </ContractTerm>

        // <CommlPolicySupplement>
        const CommlPolicySupplement = CommlPolicy.ele('CommlPolicySupplement');
        CommlPolicySupplement.ele('OperationsDesc', this.get_operation_description());

        // <LengthTimeInBusiness> They want this in years
        const LengthTimeInBusiness = CommlPolicySupplement.ele('LengthTimeInBusiness');
        LengthTimeInBusiness.ele('NumUnits', moment().diff(this.app.business.founded, 'years'));
        // </LengthTimeInBusiness>

        const has_claims = this.policy.claims.length > 0;

        CommlPolicySupplement.ele('LossDataAvailable', has_claims ? 'Y' : 'N');
        if (has_claims) {
            const claims_data = this.claims_to_policy_years();
            CommlPolicySupplement.ele('NumberClaims', this.get_num_claims(4));
            CommlPolicySupplement.ele('NumberClaims1', claims_data[1].count);
            CommlPolicySupplement.ele('NumberClaims2', claims_data[2].count);
            CommlPolicySupplement.ele('NumberClaims3', claims_data[3].count);
            CommlPolicySupplement.ele('TotalClaimAmount', this.get_total_amount_incurred_on_claims(4));
        }
        // <CommlPolicySupplement>
        // </CommlPolicy>
        this.app.business.locations.forEach((location, index) => {
            // <Location>
            const Location = WorkCompPolicyQuoteInqRq.ele('Location');
            Location.att('id', `l${index + 1}`);

            // <Addr>
            Addr = Location.ele('Addr');
            Addr.ele('Addr1', location.address);
            if (location.address2) {
                Addr.ele('Addr2', location.address2);
            }
            Addr.ele('City', location.city);
            Addr.ele('StateProvCd', location.territory);
            Addr.ele('PostalCode', location.zip);
            // </Addr>

            if (location.unemployment_number) {
                // <TaxCodeInfo>
                const TaxCodeInfo = Location.ele('TaxCodeInfo');
                TaxCodeInfo.ele('TaxCd', location.unemployment_number);
                // </TaxCodeInfo>
            }

            // For the first location, insert the DBA nodes
            if (this.app.business.dba && index === 0) {
                const DBAAdditionalInterest = Location.ele('AdditionalInterest');
                DBAAdditionalInterest.att('id', 'c2');
                // <GeneralPartyInfo>
                const DBAGeneralPartyInfo = DBAAdditionalInterest.ele('GeneralPartyInfo');
                // <NameInfo>
                const DBANameInfo = DBAGeneralPartyInfo.ele('NameInfo');
                const CommlNameAddInfo = DBANameInfo.ele('CommlName')
                CommlNameAddInfo.ele('CommercialName', this.app.business.dba.replace('’', "'").replace('+', '').replace('|', ''));
                //TODO look at entity type assume it is the same.  As of 20210331 entity type of DBA not tracked.
                CommlNameAddInfo.ele('Type',"Company");
                const DBATaxIdentity = DBANameInfo.ele('TaxIdentity');
                DBATaxIdentity.ele('TaxIdTypeCd', 'FEIN');
                DBATaxIdentity.ele('TaxCd',appDoc.ein);
                DBANameInfo.ele('LegalEntityCd', entityMatrix[this.app.business.entity_type]);
                // </NameInfo>
                // <Addr>
                const DBAAddr = DBAGeneralPartyInfo.ele('Addr');
                DBAAddr.ele('Addr1', this.app.business.mailing_address);
                if (this.app.business.mailing_address2) {
                    DBAAddr.ele('Addr2', this.app.business.mailing_address2);
                }
                DBAAddr.ele('City', this.app.business.mailing_city);
                DBAAddr.ele('StateProvCd', this.app.business.mailing_territory);
                DBAAddr.ele('PostalCode', this.app.business.mailing_zip);
                if(guideWireAPI === true){
                    DBAAddr.ele('CountryCd', 'US');
                }
                else {
                    DBAAddr.ele('CountryCd', 'USA');
                }
                // </Addr>
                // </GeneralPartyInfo>
                // <AdditionalInterestInfo>
                DBAAdditionalInterest.ele('AdditionalInterestInfo').ele('NatureInterestCd', 'DB');
                // </AdditionalInterestInfo>
            }

            // </Location>
        });

        // <WorkCompLineBusiness>
        const WorkCompLineBusiness = WorkCompPolicyQuoteInqRq.ele('WorkCompLineBusiness');

        // Separate out the states
        const territories = this.app.business.getTerritories();
        for(let t = 0; t < territories.length; t++){
            //territories.forEach((territory) => {
            const territory = territories[t];
            // <WorkCompRateState>
            const WorkCompRateState = WorkCompLineBusiness.ele('WorkCompRateState');
            //db queries below.
            for(let index = 0; index < this.app.business.locations.length; index++){
                //this.app.business.locations.forEach((location, index) => {
                const location = this.app.business.locations[index];

                // Make sure this location is in the current territory, if not, skip it
                if (location.territory !== territory) {
                    continue;
                }

                // <WorkCompLocInfo>
                const WorkCompLocInfo = WorkCompRateState.ele('WorkCompLocInfo');
                WorkCompLocInfo.att('LocationRef', `l${index + 1}`);

                // Combine the activity codes
                const activityCodes = this.combineLocationActivityCodes(location);

                // Add class code information
                for (const activityCode in activityCodes) {
                    if (Object.prototype.hasOwnProperty.call(activityCodes, activityCode)) {
                        // Split up the class code
                        const classCode = activityCode.substring(0, 4);
                        const subCode = activityCode.substring(4, 6);

                        // <WorkCompRateClass>
                        const WorkCompRateClass = WorkCompLocInfo.ele('WorkCompRateClass');
                        WorkCompRateClass.ele('RatingClassificationCd', classCode);
                        // log.info('TO DO: We need to build in support for this bullshit');
                        WorkCompRateClass.ele('RatingClassificationLetter', '');
                        WorkCompRateClass.ele('RatingClassificationSubCd', subCode);
                        WorkCompRateClass.ele('Exposure', activityCodes[activityCode]);

                        // From AF : If we have a Classcode(RatingClassificationCd) and Classcode Indiator(RatingClassificationSubCd),
                        // we don’t expect to see ClassCodeQuestions node within
                        // Handle class specific questions
                        log.debug('')
                        log.debug(`!classCode ${classCode} || !subCode ${subCode}) && guideWireAPI ${guideWireAPI} === true || guideWireAPI === false`)
                        //if((classCode || subCode) && guideWireAPI === false || guideWireAPI === true){

                        
                        //get insurerActivityCode doc.
                        const InsurerActivityCodeModel = require('mongoose').model('InsurerActivityCode');
                        const activityCodeQuery = {
                            insurerId: this.insurer.id,
                            code: classCode,
                            sub: subCode,
                            effectiveDate: {$lte: this.policy.effective_date},
                            expirationDate: {$gte: this.policy.effective_date},
                            territoryList: location.territory,
                            active: true
                        }
                        try{
                            log.debug(`AF activityCodeQuery \n ${JSON.stringify(activityCodeQuery)} \n ` + __location)
                            const insurerActivityCode = await InsurerActivityCodeModel.findOne(activityCodeQuery);
                            // eslint-disable-next-line prefer-const
                            let talageQuestionList = [];
                            let insurerQuestionIdList = [];
                            if(insurerActivityCode && insurerActivityCode.insurerQuestionIdList){
                                insurerQuestionIdList = insurerActivityCode.insurerQuestionIdList
                                log.debug(`Using AF insurerActivityCode.insurerQuestionIdList`)
                            }
                            if (insurerActivityCode && insurerActivityCode.insurerTerritoryQuestionList && insurerActivityCode.insurerTerritoryQuestionList.length) {
                                const territoryQuestion = insurerActivityCode.insurerTerritoryQuestionList.find((itq) => itq.territory === location.territory);
                                if(territoryQuestion){
                                    //override
                                    insurerQuestionIdList = [];
                                    territoryQuestion.insurerQuestionIdList.forEach((insurerQuestionId) => {
                                        if(!insurerQuestionIdList.includes(insurerQuestionId)){
                                            insurerQuestionIdList.push(insurerQuestionId);
                                        }
                                    });
                                }
                            }
                            //get insurerQuestions
                            if(insurerQuestionIdList.length > 0){
                                    const query = {
                                    "insurerId": this.insurer.id,
                                    "insurerQuestionId": {$in: insurerQuestionIdList},
                                    effectiveDate: {$lte: this.policy.effective_date},
                                    expirationDate: {$gte: this.policy.effective_date}
                                }
                                log.debug(`AF InsurerQuestionModel query \n ${JSON.stringify(query)} \n ` + __location)
                                const InsurerQuestionModel = require('mongoose').model('InsurerQuestion');
                                let insurerQuestionList = null;
                                try{
                                    insurerQuestionList = await InsurerQuestionModel.find(query);
                                    if(insurerQuestionList){
                                        insurerQuestionList.forEach((insurerQuestion) => {
                                            talageQuestionList.push(insurerQuestion.talageQuestionId);
                                        });
                                    }
                                }
                                catch(err){
                                    throw err
                                }
                            }

                            let ClassCodeQuestions = null;
                            if(talageQuestionList.length > 0){
                                ClassCodeQuestions = WorkCompRateClass.ele('ClassCodeQuestions');
                            }
                            talageQuestionList.forEach((talageQuestionId) => {
                                const question = this.questions[talageQuestionId];
                                if (!Object.prototype.hasOwnProperty.call(this.question_details, talageQuestionId)) {
                                    log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type}: did not have talageQuestionId ${talageQuestionId} in question_details: ${JSON.stringify(this.question_details)} `)
                                    return;
                                }
                                //const question_attributes = question.attributes;
                                const question_attributes = this.question_details[talageQuestionId].attributes;
                                log.debug(`${this.insurer.name} WC calling processActivtyCodeQuestion`);
                                this.processActivtyCodeQuestion(ClassCodeQuestions,guideWireAPI, WorkCompRateClass,
                                    classCode, subCode, talageQuestionId, question, question_attributes);

                            });
                        }
                        catch(err){
                            log.error(`CompWest WC processActivityCode Qeustions error ${err}` + __location)
                        }
                       // }//have classcode and sub
                        // </WorkCompRateClass>
                    }
                }
                // </WorkCompLocInfo>
            }
            // </WorkCompRateState>
        }

        // <CommlCoverage>
        const CommlCoverage = WorkCompLineBusiness.ele('CommlCoverage');
        if(guideWireAPI === true){
            CommlCoverage.ele('CoverageCd', 'WC7WorkersCompEmpLiabInsurancePolicyACov');
        }
        else {
            CommlCoverage.ele('CoverageCd', 'WCEL');
        }

        CommlCoverage.ele('CoverageDesc', 'Employers Liability');

        // <Limit>
        let Limit = CommlCoverage.ele('Limit');
        Limit.ele('FormatCurrencyAmt').ele('Amt', limits[0]);
        Limit.ele('LimitAppliesToCd', 'EachClaim');
        // </Limit>

         // <Limit>
        Limit = CommlCoverage.ele('Limit');
        Limit.ele('FormatCurrencyAmt').ele('Amt', limits[1]);
        Limit.ele('LimitAppliesToCd', 'PolicyLimit');

        // <Limit>
        Limit = CommlCoverage.ele('Limit');
        Limit.ele('FormatCurrencyAmt').ele('Amt', limits[2]);
        Limit.ele('LimitAppliesToCd', 'EachEmployee');
        // </Limit>


        /* ---=== Begin Ineligibility and Statement Questions ===--- */
        // Make a list of embedded questions need by WC questions for Guidwire api.
        const embeddedQuestions = {};
        for (const questionId in this.questions) {
            if (Object.prototype.hasOwnProperty.call(this.questions, questionId)) {
                // Get the attributes for this question
                const questionAttributes = this.question_details[questionId].attributes;

                // Check if this is an embedded question
                if (Object.prototype.hasOwnProperty.call(questionAttributes, 'embedded') && questionAttributes.embedded === true) {
                    // Make sure we have the attributes we are expecting
                    if (Object.prototype.hasOwnProperty.call(questionAttributes, 'xml_section') && Object.prototype.hasOwnProperty.call(questionAttributes, 'code')) {
                        embeddedQuestions[`${questionAttributes.xml_section}-${questionAttributes.code}`] = this.questions[questionId];
                    }
                    else {
                        log.error(`Appid: ${this.app.id} The AF Group embedded question "${this.question_details[questionId].identifier}" has invalid attributes.` + __location);
                    }
                }
            }
        }


        // Create one section for each Ineligibility and Statement questions
        ['Ineligibility', 'Statement'].forEach((type) => {
            // <Ineligibility/Statement>
            const root_questions_element = WorkCompLineBusiness.ele(type);

            // Loop through each question
            for (const questionId in this.questions) {
                if (Object.prototype.hasOwnProperty.call(this.questions, questionId)) {

                    // Get the attributes for this question
                    const questionAttributes = this.question_details[questionId].attributes;

                    // If this is an embedded question, skip it
                    if (Object.prototype.hasOwnProperty.call(questionAttributes, 'embedded') && questionAttributes.embedded === true) {
                        continue;
                    }

                     if (Object.prototype.hasOwnProperty.call(questionAttributes, 'hasParent') && questionAttributes.hasParent === true) {
                        continue;
                    }

                    // Make sure we have the attributes we need, and that they match this section
                    if (Object.prototype.hasOwnProperty.call(questionAttributes, 'xml_section') && questionAttributes.xml_section === type) {
                        let answerBoolean = this.questions[questionId].get_answer_as_boolean();

                        // Swap over statement question 7, it is inversed in our system
                        if (this.question_details[questionId].identifier === 'Statement-Q7') {
                            answerBoolean = !answerBoolean;
                        }

                        // <QuestionAnswer>

                        //Detemine QuestionCd
                        let questionCdValue = null;
                        if(guideWireAPI === true){
                            questionCdValue = this.question_details[questionId].attributes.questionCd;
                        }
                        else {
                            questionCdValue = this.question_details[questionId].identifier.split('-')[1]
                        }
                        //handle old questions that did not get mapped or has effective date changed.
                        if(questionCdValue){
                            let QuestionAnswer = null;
                            QuestionAnswer = root_questions_element.ele('QuestionAnswer');
                            QuestionAnswer.ele('QuestionCd', questionCdValue);
                            QuestionAnswer.ele('YesNoCd', answerBoolean ? 'Y' : 'N');

                             if(guideWireAPI === true && answerBoolean){
                                const insurerParentQuestionId = this.question_details[questionId].insurerQuestionId;
                                for (const childQuestionId in this.questions) {
                                    const childTalageQuestion = this.questions[childQuestionId]
                                    const childInsurerQuestion = this.question_details[childQuestionId]
                                    if(childInsurerQuestion.attributes && childInsurerQuestion.attributes.hasParent && childInsurerQuestion.attributes.parentQuestionId === insurerParentQuestionId){
                                        QuestionAnswer.ele('Explanation', childTalageQuestion.answer);
                                        //Added node for child question
                                        // eslint-disable-next-line prefer-const
                                        let childQuestionAnswer = root_questions_element.ele('QuestionAnswer');
                                        childQuestionAnswer.ele('QuestionCd', childInsurerQuestion.attributes.questionCd);
                                        childQuestionAnswer.ele('Explanation', childTalageQuestion.answer);
                                    }
                                }
                            }
                            else if (answerBoolean && Object.prototype.hasOwnProperty.call(embeddedQuestions, this.question_details[questionId].identifier)) {
                                // If the answer to this question was true, and it has an embedded question, add the answer
                                const embeddedQuestion = embeddedQuestions[this.question_details[questionId].identifier];

                                // If the answer was null, skip it
                                if (embeddedQuestion.answer === null) {
                                    continue;
                                }

                                QuestionAnswer.ele('Explanation', embeddedQuestion.answer);
                            }
                        }
                        // </QuestionAnswer>
                    }
                }
            }
            // </Ineligibility/Statement>
        });

        /* ---=== End Ineligibility and Statement Questions ===--- */

        // </WorkCompLineBusiness>
        // </WorkCompPolicyQuoteInqRq>
        // </InsuranceSvcRq>
        // </ACORD>

        return requestACORD;

    }


    processActivtyCodeQuestion(ClassCodeQuestionsNode, guideWireAPI, WorkCompRateClass, classCode, subCode, question_id, question, question_attributes){
        // log.debug('Adding Activity Code questions ' + __location)
        // log.debug(`question_id ${JSON.stringify(question_id)}  question_attributes ${JSON.stringify(question_attributes)}  question ${JSON.stringify(question)}` + __location)
        let ClassCodeQuestion = null;
        //Determine QuestionCd or questionId
        let addNode = false;
        if(guideWireAPI === true){
            //to loop up publicId in attributes based on classcode
            let publicId = '';
            if(question_attributes && !question_attributes.parentQuestionId
                && question_attributes.classCodeList
                && question_attributes.classCodeList.length > 0){
                for(let i = 0; i < question_attributes.classCodeList.length; i++){
                    if(question_attributes.classCodeList[i].classCode === classCode){
                        if(subCode === question_attributes.classCodeList[i].sub){
                            publicId = question_attributes.classCodeList[i].PublicId;
                            break;
                        }
                        else if(!subCode || !question_attributes.classCodeList[i].sub){
                            publicId = question_attributes.classCodeList[i].PublicId;
                            break;
                        }
                    }
                }
            }
            else if(!question_attributes.parentQuestionId){
                log.error(`AF - AppId ${this.app.id} ${this.insurer.name} Missing classCodeList from ${classCode}-${subCode} QuestionId ${question_id} attributes ${JSON.stringify(question_attributes)}` + __location)
            }
            if(publicId){
                ClassCodeQuestion = ClassCodeQuestionsNode.ele('ClassCodeQuestion');
                ClassCodeQuestion.ele('QuestionId', publicId);
                addNode = true;
            }
            else if(!question_attributes.parentQuestionId){
                log.error(`AF - AppId ${this.app.id} ${this.insurer.name} Did not find PublicId for ${classCode}-${subCode} QuestionId ${question_id} attributes ${JSON.stringify(question_attributes)}` + __location)
                //TODO Throw Error?
            }
        }
        else if(question_attributes.code){
           // log.debug(`question_id ${JSON.stringify(question_id)}  question_attributes ${JSON.stringify(question_attributes)}  question ${JSON.stringify(question)}` + __location)
            ClassCodeQuestion = ClassCodeQuestionsNode.ele('ClassCodeQuestion');
            ClassCodeQuestion.ele('QuestionId', question_attributes.id);
            ClassCodeQuestion.ele('QuestionCd', question_attributes.code);
            addNode = true;
        }
        // Determine how to send the answer
        //TODO look at attributies.afQuestionType
        if(addNode){
            if(question_attributes.afQuestionType === "PercentageInputOnYes"
                    || question_attributes.afQuestionType === "PercentageInput"){
                        //if value is greater then zero "Y" for answer
                    try{
                        let value = 0;
                        if(question.answer){
                            try{
                                value = parseInt(question.answer,10);
                            }
                            catch(err){
                                log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} bad input for numeric question QuestionId ${question.id} value ${question.answer} ` + __location)
                            }
                        }
                        const responseYes = value > 0 ? 'Y' : 'N';
                        ClassCodeQuestion.ele('ResponseInd', responseYes);
                        if(responseYes === 'Y'){
                            ClassCodeQuestion.ele('PercentageAnswerValue', question.answer);
                        }
                    }
                    catch(err){
                        log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} error creating PercentageAnswerValue node - ${err}` + __location)

                    }
            }
            else if(question_attributes.afQuestionType === "OptionsOnYes"){
                const answerBoolean = question.get_answer_as_boolean()
                ClassCodeQuestion.ele('ResponseInd', answerBoolean ? 'Y' : 'N');
                //find the child with the answers
                    if(answerBoolean){
                    log.debug("checking for OptionsOnYes childen")
                    const insurerParentQuestionId = this.question_details[question_id].insurerQuestionId;
                    for (const childQuestionId in this.questions) {
                        const childTalageQuestion = this.questions[childQuestionId]
                        const childInsurerQuestion = this.question_details[childQuestionId]
                        if(childInsurerQuestion && childInsurerQuestion.attributes
                            && childInsurerQuestion.attributes.optionList
                            && childInsurerQuestion.attributes.parentQuestionId === insurerParentQuestionId){
                            log.debug(`Processing OptionsOnYes child ${childQuestionId}` + __location)
                            const optionList = childInsurerQuestion.attributes.optionList
                            // eslint-disable-next-line prefer-const
                            const childQuestionAnswerStr = this.determine_question_answer(childTalageQuestion);
                            if(childQuestionAnswerStr !== false){
                                let childAnswerList = childQuestionAnswerStr.split(',');
                                childAnswerList = childAnswerList.map(s => s.trim());
                                log.debug("childAnswerList " + JSON.stringify(childAnswerList))
                                log.debug("optionList " + JSON.stringify(optionList))
                                if(childAnswerList.length > 0){
                                    for (let i = 0; i < childAnswerList.length; i++){
                                        log.debug("Search optionList for answer " + childAnswerList[i]);
                                        const optionAnswer = optionList.find((optionJSON) => optionJSON.talageAnswerText === childAnswerList[i].trim())
                                        if(optionAnswer){
                                            log.debug("AF Adding OptionResponse for " + childAnswerList[i] + __location)
                                            // eslint-disable-next-line prefer-const
                                            let childQuestionAnswer = ClassCodeQuestionsNode.ele('OptionResponse');
                                            childQuestionAnswer.ele('YesOptionResponse', optionAnswer["ns2:PublicId"]);
                                            childQuestionAnswer.ele('OtherOptionResponse',"Y");
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            else if (question.type === 'Yes/No') {
                ClassCodeQuestion.ele('ResponseInd', question.get_answer_as_boolean() ? 'Y' : 'N');
            }
            else {
                ClassCodeQuestion.ele('ResponseInd', question.question.answer);
            }

        }
    }
};