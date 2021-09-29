/* eslint-disable no-loop-func */
const Bind = require('../bind');
const axios = require('axios');
const builder = require('xmlbuilder');
const moment = require('moment');
const htmlentities = require('html-entities').Html5Entities;
// const util = require('util');
const ApplicationBO = global.requireShared('./models/Application-BO.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const util = require('util');
const xmlToObj = util.promisify(require('xml2js').parseString);

class CompuwestBind extends Bind {
    async bind() {

        const applicationBO = new ApplicationBO();
        let appDoc = null;
        try {
            //getById does uuid vs integer check...
            appDoc = await applicationBO.getById(this.quote.applicationId);
            log.debug("Compwest Bind Quote Application added applicationData" + __location)
        }
        catch(err){
            log.error(`Compwest Bind: Unable to get applicationData for binding quoteId: ${this.quote.quoteId} appId: ` + this.quote.applicationId + __location);
            return "error";
        }
        if(!appDoc){
            log.error(`Compwest Bind: Failed to load quote: ${this.quote.quoteId} application: ${this.quote.applicationId} `)
            return "error";
        }


        let apiSwitchOverDateString = '2021-07-01T00:00:00-08'
        //Production cutover date
        if (!this.insurer.useSandbox) {
            apiSwitchOverDateString = '2022-01-05T00:00:00-08'
        }
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
        if(notGwAPI || !this.insurer.useSandbox){
            // only sent quotebind for GW API.
            // return success so no error processing kick in.
            return "updated";
        }
        let xml = null;
        try{
            const requestACORD = await this.createRequestXML(appDoc, this.quote.requestId, policy)
            // Get the XML structure as a string
            xml = requestACORD.end({pretty: true});
        }
        catch(err){
            log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} XML Creation error ${err} ` + __location);
            return "error";
        }

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
            log.debug(`${requestUrl} status ${result.status} `)
        }
        catch (error) {
            if(error.response) {
                log.error(`Compwest Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind request Error: ${error}  Response ${JSON.stringify(error.response.data)} ${__location}`);
            }
            this.quote.log += `--------======= Bind Response Error =======--------<br><br>`;
            this.quote.log += error;
            this.quote.log += "<br><br>";
            return "error";
            //throw new Error(JSON.stringify(error));
        }
        if (result?.data && !result?.data?.ACORD) {
            //Axios did not parse xml to json for us.
            //try to fix it .
            try {
                const xml2JsonObj = await xmlToObj(result?.data);
                log.debug(JSON.stringify(xml2JsonObj) + __location)
                result.data = JSON.parse(JSON.stringify(xml2JsonObj));
            }
            catch (error) {
                log.error(`Compwest Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind Response not XML: ${JSON.stringify(result.data)} ${__location}`);
            }

        }
        if (!result?.data?.ACORD) {
            if(result){
                log.error(`Compwest Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind Response no ACORD node: ${JSON.stringify(result.data)} ${__location}`);
                log.error(result.data);
                log.error(typeof result.data);
                this.quote.log += `--------======= Bind Response No Acord =======--------<br><br>`;
                this.quote.log += `Response:\n <pre>${htmlentities.encode(result.data, null, 2)}</pre><br><br>`;
                this.quote.log += "<br><br>";
            }
            else {
                this.quote.log += `--------======= Bind Response No response =======--------<br><br>`;
            }
            return "error";
        }
        log.debug(`typeof result.data.ACORD ${typeof result?.data?.ACORD}` + __location)
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
            //Not a real bind.  just an submission update.
            return "updated"
        }
        else if (status === 'REFERRALNEEDED'){
            log.info(`Compwest Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind Response - REFERRALNEEDED ${__location}`);
            return "updated"
        }
        else if (status === 'SMARTEDITS'){
            log.info(`Compwest Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind Response - SMARTEDITS ${__location}`);
            return "updated"
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
    async createRequestXML(appDoc, request_id, policy, isGuideWireAPI = true){
        const officerMap = {
            "Chief Executive Officer":"CEO",
            "Chief Financial Officer":"CFO",
            "Chief Operating Officer":"COO",
            "Director":"Dir",
            "Executive Secretary":"ExecSec_Ext",
            "Executive Vice President":"ExecVP_Ext",
            "Executive Secy-VP":"VP",
            "Pres-VP-Secy-Treas":"VP",
            "Pres-VP-Secy":"VP",
            "Pres-Treas":"VP",
            "President":"Pres",
            "Pres-Secy-Treas":"VP",
            "Pres-VP":"VP",
            "Pres-Secy":"VP",
            "Secretary":"Sec",
            "Secy-Treas":"SECYTREAS_Ext",
            "Treasurer":"Treas",
            "Vice President":"VP",
            "VP-Secy":"VP",
            "VP-Treas":"VP",
            "VP-Secy-Treas":"VP"
        }

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

        const txnDate = moment();
        WorkCompPolicyAddRq.ele('TransactionRequestDt',txnDate.tz("America/Los_Angeles").format('YYYY-MM-DD'));

        // <CommlPolicy>
        const CommlPolicy = WorkCompPolicyAddRq.ele('CommlPolicy');
        // <ContractTerm>
        //get WC policy
        //const policy = appDoc.policies.find((appPolicy) => appPolicy.policyType === "WC")
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
        let afPaymentPlanCode = "bcpayplan:11";
        const paymentPlanMap = {
            "1": "bcpayplan:11",
            "2": "bcpayplan:10",
            "3": "bcpayplan:9",
            "4": "bcpayplan:1"
        }
        if(paymentPlanMap[this.quote.paymentPlanId.toString().trim()]){
            afPaymentPlanCode = paymentPlanMap[this.quote.paymentPlanId.toString().trim()]
        }
        PaymentOption.ele('PaymentPlanCd',afPaymentPlanCode);
        const Location = WorkCompPolicyAddRq.ele('Location');
        Location.att('id', `l1`);
        let cCount = 1;
        if (appDoc.dba && appDoc.dba.length > 0){
            cCount++;
        }
        //Do not reprocess appDoc.dba here
        try{
            if (appDoc.additionalInsuredList?.length > 0){
                appDoc.additionalInsuredList.forEach((additionalInsured) => {
                    if (additionalInsured.dba && additionalInsured.namedInsured?.length > 0) {
                        cCount++;
                        const DBAAdditionalInterest = Location.ele('AdditionalInterest');
                        DBAAdditionalInterest.att('id', 'c' + cCount.toString());
                        // <GeneralPartyInfo>
                        const DBAGeneralPartyInfo = DBAAdditionalInterest.ele('GeneralPartyInfo');
                        // <NameInfo>
                        const DBANameInfo = DBAGeneralPartyInfo.ele('NameInfo');
                        const CommlNameAddInfo = DBANameInfo.ele('CommlName')
                        CommlNameAddInfo.ele('CommercialName', additionalInsured.namedInsured.replace('’', "'").replace('+', '').replace('|', ''));
                        //TODO look at entity type assume it is the same.  As of 20210331 entity type of DBA not tracked.
                        CommlNameAddInfo.ele('Type',"Company");
                        const DBATaxIdentity = DBANameInfo.ele('TaxIdentity');
                        DBATaxIdentity.ele('TaxIdTypeCd', 'FEIN');
                        DBATaxIdentity.ele('TaxId',stringFunctions.santizeNumber(additionalInsured.ein,false));
                        DBANameInfo.ele('LegalEntityCd', entityMatrix[additionalInsured.entityType]);
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
                });
            }
        }
        catch(err){
            log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} error dba processing ${err} ` + __location);
        }

        let additionalInsureredCount = 0;
        try{
            if (appDoc.additionalInsuredList && appDoc.additionalInsuredList.length > 0){
                appDoc.additionalInsuredList.forEach((additionalInsured) => {
                    const addInsuredAdditionalInterest = Location.ele('AdditionalInterest');
                    //additionalInsureredCount++;
                    cCount++;
                    addInsuredAdditionalInterest.att('id', 'c' + cCount.toString());
                    // <GeneralPartyInfo>
                    const DBAGeneralPartyInfo = addInsuredAdditionalInterest.ele('GeneralPartyInfo');
                    // <NameInfo>
                    const nameInsuredNameInfo = DBAGeneralPartyInfo.ele('NameInfo');
                    const CommlNameAddInfo = nameInsuredNameInfo.ele('CommlName')
                    if(additionalInsured.namedInsured){
                        CommlNameAddInfo.ele('CommercialName', additionalInsured.namedInsured.replace('’', "'").replace('+', '').replace('|', ''));
                    }
                    //TODO look at entity type assume it is the same.  As of 20210331 entity type of DBA not tracked.
                    const DBATaxIdentity = nameInsuredNameInfo.ele('TaxIdentity');
                    let taxIdType = 'FEIN';
                    if(additionalInsured.entityType === "Sole Proprietorship"){
                        taxIdType = 'SSN';
                    }
                    CommlNameAddInfo.ele('Type',taxIdType === 'FEIN' ? "Company" : "Person");
                    DBATaxIdentity.ele('TaxIdTypeCd', taxIdType);
                    DBATaxIdentity.ele('TaxId',stringFunctions.santizeNumber(additionalInsured.ein,false));
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
        }
        catch(err){
            log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} error additionalInsuredList processing ${err} ` + __location);
        }

        try{
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

                    if(officerMap[owner.officerTitle]){
                        const SupplementaryNameInfo = CommlNameAddInfo.ele('SupplementaryNameInfo');
                        SupplementaryNameInfo.ele('SupplementaryName',officerMap[owner.officerTitle]);
                    }
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
                    const AdditionalInterestInfo = addInsuredAdditionalInterest.ele('AdditionalInterestInfo')
                    AdditionalInterestInfo.ele('NatureInterestCd', owner.include ? 'I' : 'E');
                    if(owner.ownership){
                        try{
                            const OwnershipPct = AdditionalInterestInfo.ele('OwnershipPct')
                            const NumericValueNode = OwnershipPct.ele('NumericValue');
                            NumericValueNode.ele('FormatInteger', parseInt(owner.ownership,10));
                        }
                        catch(err){
                            log.error(`Compwest bind ownership application: ${this.quote.applicationId} error ${err}` + __location)
                        }
                    }

                    //Can only tie ActivityCodeand payroll to Named Insured if there is one owner.
                    // && appDoc.owners.length === 1
                    if(owner.include){
                        if(appDoc.locations && appDoc.locations.length > 0){
                            for (const location of appDoc.locations) {
                                for (const ActivtyCodeEmployeeType of location.activityPayrollList) {
                                    const activityCodeId = ActivtyCodeEmployeeType.activityCodeId;
                                    let ownerPayroll = null;
                                    if(ActivtyCodeEmployeeType.ownerPayRoll && ActivtyCodeEmployeeType.ownerPayRoll > 0){
                                        ownerPayroll = ActivtyCodeEmployeeType.ownerPayRoll;
                                        if(appDoc.owners.length > 1){
                                            ownerPayroll /= appDoc.owners.length;
                                        }
                                    }
                                    else {
                                        const ActivityCodeEmployeeTypeEntry = ActivtyCodeEmployeeType.employeeTypeList.find((acs) => acs.employeeType === "Owners" && acs.employeeTypeCount === 1);
                                        if(ActivityCodeEmployeeTypeEntry){
                                            ownerPayroll = ActivityCodeEmployeeTypeEntry.employeeTypePayroll;
                                            if(ActivityCodeEmployeeTypeEntry.employeeTypeCount > 0){
                                                ownerPayroll /= ActivityCodeEmployeeTypeEntry.employeeTypeCount;
                                            }
                                        }
                                    }
                                    if(ownerPayroll){
                                        // Find the entry for this activity code
                                        const InsurerActivityCodeBO = global.requireShared('./models/InsurerActivityCode-BO.js');
                                        const insurerActivityCodeBO = new InsurerActivityCodeBO();
                                        try{
                                            const iAC_Query = {
                                                insurerId: this.quote.insurerId,
                                                talageActivityCodeIdList: activityCodeId,
                                                territoryList: appDoc.mailingState
                                            }
                                            const iacDocList = await insurerActivityCodeBO.getList(iAC_Query);
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
                                        if(ownerPayroll > 0){
                                            const ActualRemunerationAmt = AdditionalInterestInfo.ele('ActualRemunerationAmt');
                                            ActualRemunerationAmt.ele('Amt', ownerPayroll);
                                        }
                                        else {
                                            AdditionalInterestInfo.ele('ActualRemunerationAmt');
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        catch(err){
            log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} error additionalInsuredList owner processing ${err} ` + __location);
        }
        // only add WorkCompLineBusiness if there is waivers
        // <WorkCompLineBusiness>

        if(policy.blanketWaiver === true){
            const WorkCompLineBusiness = WorkCompPolicyAddRq.ele('WorkCompLineBusiness');
            const WorkCompRateState = WorkCompLineBusiness.ele('WorkCompRateState');
            WorkCompRateState.ele('CreditSurchargeCd', "BWOS");
        }
        else if(policy?.waiverSubrogationList?.length > 0){
            for(const waiver of policy.waiverSubrogationList) {
                const WorkCompLineBusiness = WorkCompPolicyAddRq.ele('WorkCompLineBusiness');
                const WorkCompRateState = WorkCompLineBusiness.ele('WorkCompRateState');
                WorkCompRateState.ele('StateProvCd', waiver.state);
                const WaiversClassPayrollWM = WorkCompRateState.ele('WaiversClassPayrollWM');
                WaiversClassPayrollWM.ele('Payroll', waiver.payroll);

                const iac = await this.GetIAC(this.quote.insurerId, waiver.activityCodeId, waiver.state);
                if(iac){
                    WaiversClassPayrollWM.ele('ClassCode', iac.code); // Get AF class code...
                    WaiversClassPayrollWM.ele('WaiverName', iac.description);
                }
                const CreditOrSurcharge = WorkCompRateState.ele('CreditOrSurcharge');
                CreditOrSurcharge.ele('CreditSurchargeCd', "FWOS");
                const AdditionalInterest = CreditOrSurcharge.ele('AdditionalInterest');
                AdditionalInterest.ele('WaiverName', iac.description);
                const Addr = AdditionalInterest.ele('Addr');
                Addr.ele('Addr1', waiver.address);
                Addr.ele('City', waiver.city);
                Addr.ele('StateProvCd', waiver.state);
                Addr.ele('PostalCode', waiver.zipcode);
                Addr.ele('CountryCd', "US");
                const WaiverTotalNums = CreditOrSurcharge.ele('WaiverTotalNums');
                WaiverTotalNums.ele('StateProvCd', waiver.state);
                WaiverTotalNums.ele('TotalNumbers', 1);


            }
        }

        /* ---=== End Ineligibility and Statement Questions ===--- */

        // </WorkCompLineBusiness>
        // </WorkCompPolicyQuoteInqRq>
        // </InsuranceSvcRq>
        // </ACORD>

        return requestACORD;

    }

    async GetIAC(insurerId, activityCodeId, state){
        const InsurerActivityCodeBO = global.requireShared('./models/InsurerActivityCode-BO.js');
        const insurerActivityCodeBO = new InsurerActivityCodeBO();
        const iAC_Query = {
            insurerId: insurerId,
            talageActivityCodeIdList: activityCodeId,
            territoryList:  state
        }
        const iacDocList = await insurerActivityCodeBO.getList(iAC_Query);
        if(iacDocList && iacDocList.length === 1){
            return iacDocList[0];
        }
        else if(iacDocList && iacDocList.length > 1){
            log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} error getting IAC multiple hits ${iAC_Query} ` + __location);
        }
        else {
            log.error(`CompWest Bind quote: ${this.quote.quoteId} application: ${this.quote.applicationId} error getting IAC no hits ${iAC_Query} ` + __location);
        }
        return null
    }

}

module.exports = CompuwestBind;