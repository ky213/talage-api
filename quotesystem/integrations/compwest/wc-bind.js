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


        const apiSwitchOverDateString = '2021-07-01T00:00:00-08'
        const apiSwitchOverDateDT = moment(apiSwitchOverDateString)
        const policy = appDoc.policies.find((appPolicy) => appPolicy.policyType === "WC")
        let notGwAPI = false;
        if(policy){
            try{
                const policyEffectiveDate = moment(policy.effectiveDate).format('YYYY-MM-DD')
                if(policyEffectiveDate < apiSwitchOverDateDT){
                    notGwAPI = true;
                }
            }
            catch(err){
                log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} error processing policy dates ${err}` + __location);
            }
        }
        else {
            log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} missing WC policy ` + __location);
        }
        if(notGwAPI){
            // only sent quotebind for GW API.
            // return success so no error processing kick in.
            return "success";
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
            DBAAddr.ele('Addr1', appDoc.mailingAddress);
            if (appDoc.mailingAddress2) {
                DBAAddr.ele('Addr2', appDoc.mailingAddress2);
            }
            DBAAddr.ele('City', appDoc.mailingCity);
            DBAAddr.ele('StateProvCd', appDoc.mailingState);
            DBAAddr.ele('PostalCode', appDoc.mailingZipcode);
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
        let additionalInsureredCount = 0;
        if (appDoc.additionalInsuredList && appDoc.additionalInsuredList.length > 0){
            appDoc.additionalInsuredList.forEach((additionalInsured) =>{
                const addInsuredAdditionalInterest = Location.ele('AdditionalInterest');
                additionalInsureredCount++;
                addInsuredAdditionalInterest.att('id', 'i' + additionalInsureredCount.toString());
                // <GeneralPartyInfo>
                const DBAGeneralPartyInfo = addInsuredAdditionalInterest.ele('GeneralPartyInfo');
                // <NameInfo>
                const nameInsuredNameInfo = DBAGeneralPartyInfo.ele('NameInfo');
                const CommlNameAddInfo = nameInsuredNameInfo.ele('CommlName')
                CommlNameAddInfo.ele('CommercialName', appDoc.dba.replace('’', "'").replace('+', '').replace('|', ''));
                //TODO look at entity type assume it is the same.  As of 20210331 entity type of DBA not tracked.
                const DBATaxIdentity = nameInsuredNameInfo.ele('TaxIdentity');
                let taxIdType = 'FEIN';
                if(additionalInsured.entityType === "Sole Proprietorship"){
                    taxIdType = 'SSN';
                }
                CommlNameAddInfo.ele('Type',taxIdType === 'FEIN' ? "Company" : "Person");
                DBATaxIdentity.ele('TaxIdTypeCd', taxIdType);
                DBATaxIdentity.ele('TaxCd',additionalInsured.ein);
                nameInsuredNameInfo.ele('LegalEntityCd', entityMatrix[additionalInsured.entityType]);
                // </NameInfo>
                // <Addr>
                const DBAAddr = DBAGeneralPartyInfo.ele('Addr');
                DBAAddr.ele('Addr1', appDoc.mailingAddress);
                if (appDoc.mailingAddress2) {
                    DBAAddr.ele('Addr2', appDoc.mailingAddress2);
                }
                DBAAddr.ele('City', appDoc.mailingCity);
                DBAAddr.ele('StateProvCd', appDoc.mailingState);
                DBAAddr.ele('PostalCode', appDoc.mailingZipcode);
                if(isGuideWireAPI === true){
                    DBAAddr.ele('CountryCd', 'US');
                }
                else {
                    DBAAddr.ele('CountryCd', 'USA');
                }
                // </Addr>
                // </GeneralPartyInfo>
                // <AdditionalInterestInfo>
                addInsuredAdditionalInterest.ele('AdditionalInterestInfo').ele('NatureInterestCd', 'NI');
                // </AdditionalInterestInfo>
            });
        }
        //Owners
         if (appDoc.owners && appDoc.owners.length > 0){
            for(const owner of appDoc.owners){
            //appDoc.owners.forEach((owner) =>{
                const addInsuredAdditionalInterest = Location.ele('AdditionalInterest');
                additionalInsureredCount++;
                addInsuredAdditionalInterest.att('id', 'i' + additionalInsureredCount.toString());
                // <GeneralPartyInfo>
                const DBAGeneralPartyInfo = addInsuredAdditionalInterest.ele('GeneralPartyInfo');
                // <NameInfo>
                const nameInsuredNameInfo = DBAGeneralPartyInfo.ele('NameInfo');
                const CommlNameAddInfo = nameInsuredNameInfo.ele('CommlName')
                CommlNameAddInfo.ele('CommercialName', `${owner.fname}  ${owner.lname}`);
                CommlNameAddInfo.ele('Type',"Person");
                
                // const DBATaxIdentity = nameInsuredNameInfo.ele('TaxIdentity');
                
                // DBATaxIdentity.ele('TaxIdTypeCd', 'SSN');
                // DBATaxIdentity.ele('TaxCd',owner.ein);
                nameInsuredNameInfo.ele('LegalEntityCd', 'Individual');
                // </NameInfo>
                // <Addr>
                const DBAAddr = DBAGeneralPartyInfo.ele('Addr');
                DBAAddr.ele('Addr1', appDoc.mailingAddress);
                if (appDoc.mailingAddress2) {
                    DBAAddr.ele('Addr2', appDoc.mailingAddress2);
                }
                DBAAddr.ele('City', appDoc.mailingCity);
                DBAAddr.ele('StateProvCd', appDoc.mailingState);
                DBAAddr.ele('PostalCode', appDoc.mailingZipcode);
                if(isGuideWireAPI === true){
                    DBAAddr.ele('CountryCd', 'US');
                }
                else {
                    DBAAddr.ele('CountryCd', 'USA');
                }
                // </Addr>
                // </GeneralPartyInfo>
                // <AdditionalInterestInfo>
                const AdditionalInterestInfo =  addInsuredAdditionalInterest.ele('AdditionalInterestInfo')
                AdditionalInterestInfo.ele('NatureInterestCd', owner.include ? 'I' : 'E');
                
                if(owner.ownership > 0){
                    const OwnershipPct =  addInsuredAdditionalInterest.ele('OwnershipPct')
                    const NumericValueNode =  OwnershipPct.ele('NumericValue');
                    NumericValueNode.ele('FormatInteger', parseInt(owner.ownership,10));
                }

                //Can only tie ActivityCode and payroll to Named Insured if there is one owner.
                if(owner.include && appDoc.owners.length === 1){
                    if(appDoc.locations && appDoc.locations.length > 0){
                        for (const location of application.locations) {
                            for (const ActivtyCodeEmployeeType of location.activityPayrollList) {
                                // Find the entry for this activity code
                                let ActivityCodeEmployeeTypeEntry = ActivtyCodeEmployeeType.find((acs) => acs.employeeType === "Owners" && employeeTypeCount === 1);
                                if(ActivityCodeEmployeeTypeEntry){
                                    const ActualRemunerationAmt = AdditionalInterestInfo.ele('ActualRemunerationAmt');
                                    ActualRemunerationAmt.ele('Amt', ActivityCodeEmployeeTypeEntry.employeeTypePayroll);
                                    //look up AF/C
                                    const iAC_Query = {
                                        insurerId: this.quote.insurerId,
                                        talageActivityCodeIdList: ActivtyCodeEmployeeTypeSchema.activityCodeId,
                                        territoryList: appDoc.mailingState
                                    }
                                    const InsurerActivityCodeBO = global.requireShared('./models/InsurerActivityCode-BO.js');
                                    try{
                                        iacDocList = await InsurerActivityCodeBO.find(iAC_Query);
                                        if(iacDocList && iacDocList.length === 1){
                                            AdditionalInterestInfo.ele('ClassCD',iacDocList[0].code)
                                        }
                                        else if(iacDocList && iacDocList.length > 1){
                                            log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} error getting IAC multiple hits ${iAC_Query} ` + __location);
                                        }
                                        else {
                                            log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} error getting IAC no hits ${iAC_Query} ` + __location);
                                        }
                                    }
                                    catch(err){
                                        log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} error getting IAC ${err} ` + __location);
                                    }
                                }
                            }
                        }
                    }
                }
            };


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