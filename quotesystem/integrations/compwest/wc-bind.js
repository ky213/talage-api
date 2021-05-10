const Bind = require('../bind');
const axios = require('axios');
const builder = require('xmlbuilder');
const moment = require('moment');
const htmlentities = require('html-entities').Html5Entities;
// const util = require('util');
const ApplicationBO = global.requireShared('./models/Application-BO.js');

class CompuwestBind extends Bind {
    async bind() {

        const applicationBO = new ApplicationBO();
        let appDoc = null;
        try {
            //getById does uuid vs integer check...
            appDoc = await applicationBO.getById(this.quote.applicationId);
            log.debug("Quote Application added applicationData" + __location)
        }
        catch(err){
            log.error(`Compwest Bind: Unable to get applicationData for binding quoteId: ${this.quote.quoteId} appId: ` + this.quote.applicationId + __location);
            return "error";
        }
        if(!appDoc){
            log.error(`Compwest Bind: Failed to load quote: ${this.quote.quoteId} application: ${this.quote.applicationId} `)
            return "error";
        }

        const requestACORD = await this.createRequestXML(appDoc, this.quote.requestId)

        // Get the XML structure as a string
        const xml = requestACORD.end({pretty: true});

        const username = await this.insurer.get_username();
        const password = await this.insurer.get_password();
        //basic auth...
        const auth = {
            username: username,
            password: password
        }
        const axiosOptions = {
            auth: auth,
            headers: {"Content-Type": "application/xml"}
        };

        const host = this.insurer.useSandbox ? 'npsv.afgroup.com/TEST_DigitalAq/rest' : 'npsv.afgroup.com/DigitalAq/rest';

        const requestUrl = `https://${host}/getbindworkcompquote`;
        this.quote.log += `--------======= Bind Request to ${requestUrl} at ${moment().utc().toISOString()} =======--------<br><br>`;
        this.quote.log += `Request: <pre>${htmlentities.encode(xml)}</pre><br><br>`;
        this.quote.log += `--------======= End =======--------<br><br>`;
        let result = null;
        try {
            result = await axios.post(requestUrl, xml, axiosOptions);
        }
        catch (error) {
            log.error(`Compwest Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind request Error: ${error}  Response ${JSON.stringify(error.response.data)} ${__location}`);
            this.quote.log += `--------======= Bind Response Error =======--------<br><br>`;
            this.quote.log += error;
            this.quote.log += "<br><br>";
            return "error";
            //throw new Error(JSON.stringify(error));
        }
        if (result.data && result.data.ACORD) {
            log.error(`Compwest Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind Response no ACORD node: ${JSON.stringify(result.data)} ${__location}`);
            log.error(result.data);
            log.error(typeof result.data);
            this.quote.log += `--------======= Bind Response No Acord =======--------<br><br>`;
            this.quote.log += `Response:\n <pre>${htmlentities.encode(result.data, null, 2)}</pre><br><br>`;
            this.quote.log += "<br><br>";
            return "error";

        }
        log.debug(`typeof result.data.ACORD ${typeof result.data.ACORD}` + __location)
        const res = result.data.ACORD;
        let status = ''
        try{
            status = res.SignonRs[0].Status[0].StatusCd[0];
        }
        catch(err){
            log.error(`Appid: ${this.quote.applicationId} ${this.insurer.name} WC. Error getting AF response status from ${JSON.stringify(res.SignonRs[0].Status[0])} ` + err + __location);
        }

        this.quote.log += `--------======= Bind Response =======--------<br><br>`;
        this.quote.log += `Response:\n <pre>${htmlentities.encode(res, null, 2)}</pre><br><br>`;
        this.quote.log += `--------======= End =======--------<br><br>`;

        //log response.
        if(status === 'QUOTED'){
            // Document is updated - Replace quote letter?
            //com.afg_Base64PDF
            try {
                const WorkCompPolicyAddRs = res.InsuranceSvcRs[0].WorkCompPolicyAddRs[0];
                this.quote.quote_letter = {
                    content_type: 'application/pdf',
                    data: WorkCompPolicyAddRs['com.afg_Base64PDF'][0],
                    file_name: `${this.insurer.name}_${this.policy.type}_bind_quote_letter.pdf`,
                    length: WorkCompPolicyAddRs['com.afg_Base64PDF'][0].length
                };
            }
            catch (err) {
                log.error(`Appid: ${this.quote.applicationId} ${this.insurer.name} integration error: could not locate quote letter attachments. ${JSON.stringify(res)} ${__location}`);
                //return this.return_result('error');
            }
            return "success"
        }
        else if (status === 'REFERRALNEEDED'){
            return "success"
        }
        else if (status === "ERROR"){
            log.error(`Compwest Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind Response ERROR: ${JSON.stringify(result.data)} ${__location}`);
            return "rejected"
        }
        else{
            //unknown response
            this.quote.log += `--------======= Bind Response Unknown no data status: ${status} =======--------<br><br>`;
            return "rejected"
        }
    }

    // Bind XML different than quote request...
    async createRequestXML(appDoc, request_id, isGuideWireAPI = true){

        // Define how legal entities are mapped for Employers
        let entityMatrix = {
            Association: 'AS',
            Corporation: 'CP',
            'Limited Liability Company': 'LL',
            'Limited Partnership': 'LP',
            Partnership: 'PT',
            'Sole Proprietorship': 'IN'
        };
        if(isGuideWireAPI === true){
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
        const requestACORD = builder.create('ACORD');
        // if(isGuideWireAPI === true){
        //     requestACORD.att('xsi:noNamespaceSchemaLocation', 'WorkCompPolicyQuoteInqRqXSD.xsd');
        //     requestACORD.att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
        // }
        // <InsuranceSvcRq>
        const InsuranceSvcRq = requestACORD.ele('InsuranceSvcRq');
        InsuranceSvcRq.ele('RqUID', request_id);

        // <WorkCompPolicyQuoteInqRq>
        const WorkCompPolicyAddRq = InsuranceSvcRq.ele('WorkCompPolicyAddRq');


        // <CommlPolicy>
        const CommlPolicy = WorkCompPolicyAddRq.ele('CommlPolicy');
        // <ContractTerm>
        //get WC policy
        const policy = appDoc.policies.find((appPolicy) => appPolicy.policyType === "WC")
        if(policy){
            try{
                const ContractTerm = CommlPolicy.ele('ContractTerm');
                ContractTerm.ele('EffectiveDt', moment(policy.effectiveDate).format('YYYY-MM-DD'));
                ContractTerm.ele('ExpirationDt', moment(policy.expirationDate).format('YYYY-MM-DD'));
            }
            catch(err){
                log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} error processing policy dates ${err}` + __location);
            }
        }
        else {
            log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} missing WC policy ` + __location);
        }
        //policynumber == quote number
        CommlPolicy.ele('PolicyNumber', this.quote.quoteNumber);

        // <CommlPolicySupplement>
        const PaymentOption = CommlPolicy.ele('PaymentOption');
        PaymentOption.ele('PaymentPlanCd', "bcpayplan:11");
        const Location = WorkCompPolicyAddRq.ele('Location');
        Location.att('id', `l1`);

        if (appDoc.dba) {
            const DBAAdditionalInterest = Location.ele('AdditionalInterest');
            DBAAdditionalInterest.att('id', 'c2');
            // <GeneralPartyInfo>
            const DBAGeneralPartyInfo = DBAAdditionalInterest.ele('GeneralPartyInfo');
            // <NameInfo>
            const DBANameInfo = DBAGeneralPartyInfo.ele('NameInfo');
            const CommlNameAddInfo = DBANameInfo.ele('CommlName')
            CommlNameAddInfo.ele('CommercialName', appDoc.dba.replace('’', "'").replace('+', '').replace('|', ''));
            //TODO look at entity type assume it is the same.  As of 20210331 entity type of DBA not tracked.
            CommlNameAddInfo.ele('Type',"Company");
            const DBATaxIdentity = DBANameInfo.ele('TaxIdentity');
            DBATaxIdentity.ele('TaxIdTypeCd', 'FEIN');
            DBATaxIdentity.ele('TaxCd',appDoc.ein);
            DBANameInfo.ele('LegalEntityCd', entityMatrix[appDoc.entity_type]);
            // </NameInfo>
            // <Addr>
            const DBAAddr = DBAGeneralPartyInfo.ele('Addr');
            DBAAddr.ele('Addr1', appDoc.mailing_address);
            if (appDoc.mailing_address2) {
                DBAAddr.ele('Addr2', appDoc.mailing_address2);
            }
            DBAAddr.ele('City', appDoc.mailing_city);
            DBAAddr.ele('StateProvCd', appDoc.mailing_territory);
            DBAAddr.ele('PostalCode', appDoc.mailing_zip);
            if(isGuideWireAPI === true){
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


        // <WorkCompLineBusiness>
        const WorkCompLineBusiness = WorkCompPolicyAddRq.ele('WorkCompLineBusiness');

        // Separate out the states
        const territories = [];

        appDoc.locations.forEach(function(loc) {
            if (!territories.includes(loc.state)) {
                territories.push(loc.state);
            }
        });

        for(let t = 0; t < territories.length; t++){
            //territories.forEach((territory) => {
            const territory = territories[t];
            // <WorkCompRateState>
            const WorkCompRateState = WorkCompLineBusiness.ele('WorkCompRateState');
            //<StateProvCd>CA</StateProvCd>
            WorkCompRateState.ele('StateProvCd', territory);

            // </WorkCompRateState>
        }


        /* ---=== End Ineligibility and Statement Questions ===--- */

        // </WorkCompLineBusiness>
        // </WorkCompPolicyQuoteInqRq>
        // </InsuranceSvcRq>
        // </ACORD>

        return requestACORD;

    }


}

module.exports = CompuwestBind;