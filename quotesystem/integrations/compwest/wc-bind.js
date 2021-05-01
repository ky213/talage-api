const Bind = require('../bind');
const axios = require('axios');
const builder = require('xmlbuilder');
const moment = require('moment');
const util = require('util');
const ApplicationBO = global.requireShared('./models/Application-BO.js');

class CompuwestBind extends Bind {
    async bind() {
        const isGuideWireAPI = true;

        const applicationBO = new ApplicationBO();
        let appDoc = null;
        try {
            //getById does uuid vs integer check...
            appDoc = await applicationBO.loadById(this.quote.applicationId);
            log.debug("Quote Application added applicationData" + __location)
        }
        catch(err){
            log.error(`Compwest Bind: Unable to get applicationData for binding quoteId: ${this.quote.quoteId} appId: ` + this.quote.applicationId + __location);
            return "error";
        }
        if(!this.appDoc){
            log.error(`Compwest Bind: Failed to load application ${this.quote.applicationId} `)
            return "error";
        }


        const alInsurer = this.agencyLocation.insurers.find((ali) => ali.insurerId === this.insurer.insurerId)
        // let agencyCode = alInsurer.agency_id;
        // if(isGuideWireAPI === true){
        //     agencyCode = alInsurer.agent_id;
        // }
        //this.qoute

        const requestACORD = await this.createRequestXML(appDoc, this.quote.requestId)

        // Get the XML structure as a string
        const xml = requestACORD.end({pretty: true});

        //https://npsv.afgroup.com/TEST_DigitalAq/rest/getbindworkcompquote
        //basic auth...
        const auth = {
            username: await this.insurer.get_username(),
            password: await this.insurer.get_password()
        }

        const axiosOptions = {headers: {
            "auth": auth,
            "Accept": "application/xml"
        }};

        const host = this.insurer.useSandbox ? 'npsv.afgroup.com/TEST_DigitalAq/rest' : 'npsv.afgroup.com/DigitalAq/rest';

        const requestUrl = `https://${host}/getbindworkcompquote`;
        this.quote.log += `--------======= Bind Request to ${requestUrl} =======--------<br><br>`;
        this.quote.log += `Request: <pre>${xml}</pre><br><br>`;
        this.quote.log += `--------======= End =======--------<br><br>`;
        let result = null;
        try {
            result = await axios.put(requestUrl, xml, axiosOptions);
        }
        catch (error) {
            log.error(`Compwest Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind request Error: ${error}  Response ${JSON.stringify(error.response.data)} ${__location}`);
            this.quote.log += `--------======= Bind Response Error =======--------<br><br>`;
            this.quote.log += error;
            this.quote.log += "<br><br>";
            return "error";
            //throw new Error(JSON.stringify(error));
        }
        if (result.data && !result.data.ACORD) {
            log.error(`Compwest Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind Rejected: ${JSON.stringify(result.data)} ${__location}`);
            this.quote.log += `--------======= Bind Response Declined =======--------<br><br>`;
            this.quote.log += `Response:\n <pre>${JSON.stringify(result.data, null, 2)}</pre><br><br>`;
            this.quote.log += "<br><br>";
            return "error";

        }
        const res = result.ACORD;
        let status = ''
        try{
            status = res.SignonRs[0].Status[0].StatusCd[0];
        }
        catch(err){
            log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type}. Error getting AF response status from ${JSON.stringify(res.SignonRs[0].Status[0])} ` + err + __location);
        }

        this.quote.log += `--------======= Bind Response =======--------<br><br>`;
        this.quote.log += `Response:\n <pre>${JSON.stringify(res, null, 2)}</pre><br><br>`;
        this.quote.log += `--------======= End =======--------<br><br>`;

        //log response.
        if(status === 'SUCCESS'){
            ///ACORD/InsuranceSvcRs/WorkCompPolicyQuoteInqRs/com.csc_PDFContent/CommlPolicy/PolicyNumber
            // this.policyId = employersResp.id;
            // this.policyNumber = employersResp.policyNumber;
            // this.policyUrl = employersResp.policyURL;
            // // this.policyName = '';
            // this.policyEffectiveDate = employersResp.effectiveDate;
            // this.policyPremium = employersResp.totalPremium;
            return "success"
        }
        else{
            //unknown response
            this.quote.log += `--------======= Bind Response Unknown no data =======--------<br><br>`;
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

        // <SignonRq>
        const SignonRq = requestACORD.ele('SignonRq');

        // <ClientApp>
        const ClientApp = SignonRq.ele('ClientApp');

        // Org (AF Group has asked us to send in the Channel ID in this field. 2 indicates Digalent Storefront. 1 indicates the Talage Digital Agency)
        ClientApp.ele('Org', this.app.agencyLocation.id === 2 || this.app.agencyLocation.agencyNetwork === 2 ? 2 : 1);

        //SubmissionId

        // </ClientApp>
        // </SignonRq>

        // <InsuranceSvcRq>
        const InsuranceSvcRq = requestACORD.ele('InsuranceSvcRq');
        InsuranceSvcRq.ele('RqUID', request_id);

        // <WorkCompPolicyQuoteInqRq>
        const WorkCompPolicyAddRq = InsuranceSvcRq.ele('WorkCompPolicyAddRq');


        // <CommlPolicy>
        const CommlPolicy = WorkCompPolicyAddRq.ele('CommlPolicy');
        // <ContractTerm>
        //get WC policy
        const ContractTerm = CommlPolicy.ele('ContractTerm');
        ContractTerm.ele('EffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));
        ContractTerm.ele('ExpirationDt', this.policy.expiration_date.format('YYYY-MM-DD'));
        //policynumber == quote number
        CommlPolicy.ele('PolicyNumber', this.quote.quoteNumber);

        // </ContractTerm>

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
        const territories = appDoc.getTerritories();
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