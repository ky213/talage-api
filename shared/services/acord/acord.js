const moment = require('moment');
const PdfHelper = require('./pdf-helper');

const applicationBO = global.requireShared('./models/Application-BO.js');
const insurerBO = global.requireShared('./models/Insurer-BO.js');
const activityCodeBO = global.requireShared('./models/ActivityCode-BO.js');
const agencyBO = global.requireShared('./models/Agency-BO.js');
const agencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const industryCodeBO = global.requireShared('./models/IndustryCode-BO.js');
const questionBO = global.requireShared('./models/Question-BO.js');
const insurerActivityCodeBO = global.requireShared('./models/InsurerActivityCode-BO.js');

const limitHelper = global.requireShared('./helpers/formatLimits.js');
const phoneHelper = global.requireShared('./helpers/formatPhone.js');

module.exports = class ACORD{

    /**
     * Constructor for each acord form generation
     *
     * @param {Number} applicationId - ID of the application the ACORD form will be generated for
     * @param {Number} insurerId - ID of the insurer the ACORD form will be generated for
     * @returns {void}
     */
    constructor(applicationId, insurerId){
        this.applicationId = applicationId;
        this.insurerId = insurerId;
        this.applicationDoc = null;
        this.insurerDoc = null;
        this.agencyDoc = {};
        this.agencyLocationDoc = {};
        this.industryCodeDoc = {};
        this.activityCodeList = [];
        this.policyObj = {};
        this.primaryContactObj = {};
        this.questionList = [];
    }

    /**
     * Retrieves necessary data to generate ACORD forms
     * @param {String} policyType - policy type of ACORD being generated
     * @returns {void}
     */
    async dataInit(policyType){

        // Get the application mongo doc
        const application = new applicationBO();

        try {
            log.debug(`Getting app using mysql Id  ${this.applicationId} from mongo` + __location)
            this.applicationDoc = await application.loadById(this.applicationId);
        }
        catch (err) {
            log.error(`Failed getting application with ID: ${this.applicationId}` + err + __location);
            throw err;
        }

        if(this.applicationDoc === null){
            log.error(`Application ID: ${this.applicationId} not found. Continuing Acord generation`);
        }
        else{

            this.policyObj = this.getPolicy(policyType);
            this.primaryContactObj = this.getPrimaryContact();

            if(this.applicationDoc.questions && this.applicationDoc.questions.length > 0){
                this.questionList = this.applicationDoc.questions;
            }

            // Get the question parent IDs
            const question = new questionBO();
            for(const q of this.questionList){
                try {
                    const newQuestion = await question.getById(q.questionId);
                    q.parent = newQuestion.parent;
                }
                catch (err) {
                    log.error(`Failed getting question with ID: ${q.questionId}` + err + __location);
                }
            }

            // Get the activity code descriptions
            if(this.applicationDoc.activityCodes){
                const activityCode = new activityCodeBO();
                for(const code of this.applicationDoc.activityCodes){
                    try {
                        if(!code.activityCodeId){
                            code.activityCodeId = code.ncciCode;
                        }
                        const newCode = await activityCode.getById(code.activityCodeId);
                        code.description = newCode.description;
                    }
                    catch (err) {
                        log.error(`Failed getting activity code with ID: ${code.activityCodeId}` + err + __location);
                    }
                }
                this.activityCodeList = this.applicationDoc.activityCodes;
            }

            const agency = new agencyBO();
            try {
                this.agencyDoc = await agency.getById(this.applicationDoc.agencyId);
            }
            catch (err) {
                log.error(`Failed getting agency with ID: ${this.applicationDoc.agencyId}` + err + __location);
            }

            if(this.agencyDoc === null){
                log.error(`Agency ID: ${this.applicationDoc.agencyId} not found. Continuing Acord generation`)
            }

            const agencyLocation = new agencyLocationBO();
            try {
                this.agencyLocationDoc = await agencyLocation.getById(this.applicationDoc.agencyLocationId);
            }
            catch (err) {
                log.error(`Failed getting agency location with ID: ${this.applicationDoc.agencyLocationId}` + err + __location);
            }

            if(this.agencyLocationDoc === null){
                log.error(`Agency location ID: ${this.applicationDoc.agencyLocationId} not found. Continuing Acord generation`)
            }

            const industryCode = new industryCodeBO();
            try {
                this.industryCodeDoc = await industryCode.getById(this.applicationDoc.industryCode);
            }
            catch (err) {
                log.error(`Failed getting industry code with ID: ${this.applicationDoc.industryCode}` + err + __location);
            }

            if(this.industryCodeDoc === null){
                log.error(`Industry code ID: ${this.applicationDoc.industryCode} not found. Continuing Acord generation`)
            }
        }

        const insurer = new insurerBO();
        try {
            this.insurerDoc = await insurer.getById(this.insurerId);
        }
        catch (err) {
            log.error(`Failed getting insurer with ID: ${this.insurerId}` + err + __location);
        }

        if(this.insurerDoc === null){
            log.warn(`Insurer ID: ${this.insurerId} not found. Continuing Acord generation`)
        }
    }

    async createAcord125(){

        if(this.applicationDoc === null){
            let pdf = null;
            try {
                pdf = await PdfHelper.createPDF('acord-125.pdf', {});
            }
            catch (err) {
                log.error(`Failed creating accord 125` + err + __location);
                throw err;
            }

            return pdf;
        }

        const pdfDataFieldsObj = {
            "Form_CompletionDate_A": moment().format('L'),
            "Producer_FullName_A": this.agencyDoc.name,
            "Producer_MailingAddress_LineOne_A": this.agencyLocationDoc.address,
            "Producer_MailingAddress_LineTwo_A": this.agencyLocationDoc.address2,
            "Producer_MailingAddress_CityName_A": this.agencyLocationDoc.city,
            "Producer_MailingAddress_StateOrProvinceCode_A": this.agencyLocationDoc.state_abbr,
            "Producer_MailingAddress_PostalCode_A": this.agencyLocationDoc.zip,
            "Producer_ContactPerson_FullName_A": this.agencyLocationDoc.fname + ' ' + this.agencyLocationDoc.lname,
            "Producer_ContactPerson_PhoneNumber_A": phoneHelper(this.agencyLocationDoc.phone),
            "Producer_ContactPerson_EmailAddress_A": this.agencyLocationDoc.email,
            "Insurer_FullName_A": this.insurerDoc.name,
            "NamedInsured_FullName_A": this.applicationDoc.businessName,
            "NamedInsured_MailingAddress_LineOne_A": this.applicationDoc.mailingAddress,
            "NamedInsured_MailingAddress_LineTwo_A": this.applicationDoc.mailingAddress2,
            "NamedInsured_MailingAddress_CityName_A": this.applicationDoc.mailingCity,
            "NamedInsured_MailingAddress_StateOrProvinceCode_A": this.applicationDoc.mailingState,
            "NamedInsured_MailingAddress_PostalCode_A": this.applicationDoc.mailingZipcode,
            "NamedInsured_SICCode_A": this.industryCodeDoc.sic,
            "NamedInsured_NAICSCode_A": this.industryCodeDoc.naics,
            "NamedInsured_TaxIdentifier_A": this.applicationDoc.ein,
            "NamedInsured_Primary_PhoneNumber_A": this.applicationDoc.phone,
            "NamedInsured_Primary_WebsiteAddress_A": this.applicationDoc.website,
            "NamedInsured_LegalEntity_OtherDescription_A": this.getEntityString === 'Other' ? this.applicationDoc.entityType : '',
            "NamedInsured_Contact_FullName_A": this.primaryContactObj.firstName + ' ' + this.primaryContactObj.lastName,
            "NamedInsured_Contact_PrimaryPhoneNumber_A": this.primaryContactObj.phone,
            "NamedInsured_Contact_PrimaryEmailAddress_A": this.primaryContactObj.email,
            "NamedInsured_BusinessStartDate_A": moment(this.applicationDoc.founded).format('L'),
            "CommercialPolicy_OperationsDescription_A": this.industryCodeDoc.description
        }

        // Add first 4 locations (only 4 spaces on Acord 125, additional locations will be added on Acord 823)
        const firstLocationsArray = this.applicationDoc.locations.slice(0, 4);

        // Starting at 65 (A) so we can increment through the alphabet because Acord thought it would be cool to use letters
        let pdfKey = 65;
        firstLocationsArray.forEach((location, index) => {
            const currentLetter = String.fromCharCode(pdfKey);
            pdfDataFieldsObj["CommercialStructure_Location_ProducerIdentifier_" + currentLetter] = index + 1;
            pdfDataFieldsObj["CommercialStructure_PhysicalAddress_LineOne_" + currentLetter] = location.address;
            pdfDataFieldsObj["CommercialStructure_PhysicalAddress_LineTwo_" + currentLetter] = location.address2;
            pdfDataFieldsObj["CommercialStructure_PhysicalAddress_CityName_" + currentLetter] = location.city;
            pdfDataFieldsObj["CommercialStructure_PhysicalAddress_StateOrProvinceCode_" + currentLetter] = location.state;
            pdfDataFieldsObj["CommercialStructure_PhysicalAddress_PostalCode_" + currentLetter] = location.zipcode;
            pdfDataFieldsObj["BusinessInformation_FullTimeEmployeeCount_" + currentLetter] = location.full_time_employees;
            pdfDataFieldsObj["BusinessInformation_PartTimeEmployeeCount_" + currentLetter] = location.part_time_employees;
            pdfDataFieldsObj["Construction_BuildingArea_" + currentLetter] = location.square_footage;
            pdfKey += 1;
        })

        // If there are more than 4 locations, create Acord 823
        let acord823Pdf = null;
        if(this.applicationDoc.locations.length > 4){
            try {
                acord823Pdf = await this.createAcord823()
            }
            catch (err) {
                log.error('Failed creating accord 823' + err + __location);
            }
        }

        // Check the appropriate entity checkbox
        pdfDataFieldsObj[`NamedInsured_LegalEntity_${this.getEntityString()}Indicator_A`] = 1

        if(this.policyObj){
            //Check if the effective date was acutally set, if it was add it
            if(this.policyObj.effectiveDate !== '0000-00-00'){
                pdfDataFieldsObj.Policy_EffectiveDate_A = moment(this.policyObj.effectiveDate).format('L');
            }

            if(this.policyObj.expirationDate !== '0000-00-00'){
                pdfDataFieldsObj.Policy_ExpirationDate_A = moment(this.policyObj.expirationDate).format('L');
            }
        }


        let pdf = null;
        let acord125Pdf = null;
        try {
            acord125Pdf = await PdfHelper.createPDF('acord-125.pdf', pdfDataFieldsObj);
        }
        catch (err) {
            log.error('Failed creating accord 125' + err + __location);
        }

        if(acord823Pdf){
            try {
                pdf = await PdfHelper.createMultiPagePDF([acord125Pdf, acord823Pdf]);
            }
            catch (err) {
                log.error('Failed creating pdf for accord 125 and 823' + err + __location);
            }
        }
        else{
            pdf = acord125Pdf;
        }
        return pdf;
    }

    async createAcord126(){

        if(this.applicationDoc === null){
            let pdf = null;
            try {
                pdf = await PdfHelper.createPDF('acord-126.pdf', {});
            }
            catch (err) {
                log.error(`Failed creating accord 126` + err + __location);
                throw err;
            }

            return pdf;
        }

        const pdfDataFieldsObj = {
            "Form_CompletionDate_A": moment().format('L'),
            "Producer_FullName_A": this.agencyDoc.name,
            "Insurer_FullName_A": this.insurerDoc.name,
            "NamedInsured_FullName_A": this.applicationDoc.businessName,
            "GeneralLiability_CoverageIndicator_A": 1,
            "GeneralLiability_GeneralAggregate_LimitAppliesPerPolicyIndicator_A": 1,
            "GeneralLiabilityLineOfBusiness_Question_AAHCode_A": 'N',
            "GeneralLiabilityLineOfBusiness_TailCoveragePurchasedPreviousPolicyExplanation_A": 'N'

        };

        // If the GL policy details exist, add them
        if(this.policyObj){
            // Get individual limits formatted as dollar amounts (ex. ['1,000,000' , '2,000,000' , '1,000,000'])
            const limitsArray = limitHelper.getLimitsAsDollarAmounts(this.policyObj.limits);
            pdfDataFieldsObj.GeneralLiability_EachOccurrence_LimitAmount_A = limitsArray[0];
            pdfDataFieldsObj.GeneralLiability_GeneralAggregate_LimitAmount_A = limitsArray[1];
            pdfDataFieldsObj.GeneralLiability_ProductsAndCompletedOperations_AggregateLimitAmount_A = limitsArray[2];

            //Check if the effective date was acutally set, if it was add it
            if(this.policyObj.effectiveDate !== '0000-00-00'){
                pdfDataFieldsObj.Policy_EffectiveDate_A = moment(this.policyObj.effectiveDate).format('L');
            }
        }

        // Add activity codes
        let pdfKey = 65;
        this.activityCodeList.forEach((activityCode) => {
            const currentLetter = String.fromCharCode(pdfKey);
            pdfDataFieldsObj["GeneralLiability_Hazard_Classification_" + currentLetter] = activityCode.description;
            pdfKey += 1;
        })

        let pdf = null;
        try {
            pdf = await PdfHelper.createPDF('acord-126.pdf', pdfDataFieldsObj);
        }
        catch (err) {
            log.error('Failed creating accord 126' + err + __location);
            throw err;
        }

        return pdf;
    }

    async createAcord140(){
        let pdf = null;
        try {
            pdf = await PdfHelper.createPDF('acord-140.pdf', {});
        }
        catch (err) {
            log.error('Failed creating accord 140' + err + __location);
            throw err;
        }

        return pdf;
    }

    async createAcord823(){

        const pdfDataFieldsObj = {
            "Producer_FullName_A": this.agencyDoc.name,
            "Insurer_FullName_A": this.insurerDoc.name,
            "NamedInsured_FullName_A": this.applicationDoc.businessName
        };

        if(this.policyObj){
            if(this.policyObj.effectiveDate !== '0000-00-00'){
                pdfDataFieldsObj.Policy_EffectiveDate_A = moment(this.policyObj.effectiveDate).format('L');
            }
        }

        let pdfKey = 65;
        const additionalLocationsArray = this.applicationDoc.locations.slice(4);
        additionalLocationsArray.forEach((location, index) => {
            const currentLetter = String.fromCharCode(pdfKey);
            pdfDataFieldsObj["CommercialStructure_Location_ProducerIdentifier_" + currentLetter] = index + 5;
            pdfDataFieldsObj["CommercialStructure_PhysicalAddress_LineOne_" + currentLetter] = location.address;
            pdfDataFieldsObj["CommercialStructure_PhysicalAddress_LineTwo_" + currentLetter] = location.address2;
            pdfDataFieldsObj["CommercialStructure_PhysicalAddress_CityName_" + currentLetter] = location.city;
            pdfDataFieldsObj["CommercialStructure_PhysicalAddress_StateOrProvinceCode_" + currentLetter] = location.state;
            pdfDataFieldsObj["CommercialStructure_PhysicalAddress_PostalCode_" + currentLetter] = location.zipcode;
            pdfDataFieldsObj["BusinessInformation_FullTimeEmployeeCount_" + currentLetter] = location.full_time_employees;
            pdfDataFieldsObj["BusinessInformation_PartTimeEmployeeCount_" + currentLetter] = location.part_time_employees;
            pdfDataFieldsObj["Construction_BuildingArea_" + currentLetter] = location.square_footage;
            pdfKey += 1;
        })

        let pdf = null;
        try {
            pdf = await PdfHelper.createPDF('acord-823.pdf', pdfDataFieldsObj);
        }
        catch (err) {
            log.error('Failed creating accord 823' + err + __location);
            throw err;
        }

        return pdf;
    }

    async createQuestionsTable(){

        if(this.applicationDoc === null){
            let pdf = null;
            try {
                pdf = await PdfHelper.createPDF('question-table.pdf', {});
            }
            catch (err) {
                log.error(`Failed creating questions pdf` + err + __location);
            }

            return pdf;
        }

        const questionTree = [];

        // Create index list
        const questionIndexMapping = this.questionList.reduce((indexMapping, question, index) => {
            indexMapping[question.questionId] = index;
            return indexMapping;
        }, {});

        this.questionList.forEach(question => {
            if(question.parent === null){
                questionTree.push(question);
                return
            }

            const parentQuestion = this.questionList[questionIndexMapping[question.parent]];

            if(parentQuestion){
                parentQuestion.children = [...parentQuestion.children || [], question];
            }
            else{
                questionTree.push(question);
            }

        });

        const pdfList = [];
        const totalPages = Math.ceil(questionTree.length / 15);

        for(let currentPage = 0; currentPage < totalPages; currentPage += 1){

            const pdfDataFieldsObj = {};
            questionTree.slice(15 * currentPage, 15 * (currentPage + 1)).forEach((question, index) => {
                pdfDataFieldsObj["Question_" + index] = question.questionText.toString();
                if(question.answerList.length){
                    pdfDataFieldsObj["Answer_" + index] = question.answerList.join('/ ').toString();
                }
                else{
                    pdfDataFieldsObj["Answer_" + index] = question.answerValue.toString();
                }
            })

            const pdf = await PdfHelper.createPDF('question-table.pdf', pdfDataFieldsObj);
            pdfList.push(pdf);
        }

        let pdf = null;
        try {
            pdf = await PdfHelper.createMultiPagePDF(pdfList);
        }
        catch (err) {
            log.error('Failed creating questions pdf' + err + __location);
            throw err;
        }

        return pdf;
    }

    async createAcord130(){

        const pdfList = [];

        if(this.applicationDoc === null){
            let pdf = null;
            try {
                pdfList.push(await PdfHelper.createPDF('acord130/page-1.pdf', {}));
                pdfList.push(await PdfHelper.createPDF('acord130/page-2.pdf', {}));
                pdfList.push(await PdfHelper.createPDF('acord130/page-3.pdf', {}));
                pdfList.push(await PdfHelper.createPDF('acord130/page-4.pdf', {}));

                pdf = await PdfHelper.createMultiPagePDF(pdfList);
            }
            catch (err) {
                log.error('Failed creating accord 130' + err + __location);
                throw err;
            }

            return pdf;
        }

        const page1Obj = {
            "Form_CompletionDate_A": moment().format('L'),
            "Producer_FullName_A": this.agencyDoc.name,
            "Producer_MailingAddress_LineOne_A": this.agencyLocationDoc.address,
            "Producer_MailingAddress_LineTwo_A": this.agencyLocationDoc.address2,
            "Producer_MailingAddress_CityName_A": this.agencyLocationDoc.city,
            "Producer_MailingAddress_StateOrProvinceCode_A": this.agencyLocationDoc.state_abbr,
            "Producer_MailingAddress_PostalCode_A": this.agencyLocationDoc.zip,
            "Producer_ContactPerson_FullName_A": this.agencyLocationDoc.fname + ' ' + this.agencyLocationDoc.lname,
            "Producer_ContactPerson_PhoneNumber_A": phoneHelper(this.agencyLocationDoc.phone),
            "Producer_ContactPerson_EmailAddress_A": this.agencyLocationDoc.email,
            "Insurer_FullName_A": this.insurerDoc.name,
            "NamedInsured_FullName_A": this.applicationDoc.businessName,
            "NamedInsured_MailingAddress_LineOne_A": this.applicationDoc.mailingAddress,
            "NamedInsured_MailingAddress_LineTwo_A": this.applicationDoc.mailingAddress2,
            "NamedInsured_MailingAddress_CityName_A": this.applicationDoc.mailingCity,
            "NamedInsured_MailingAddress_StateOrProvinceCode_A": this.applicationDoc.mailingState,
            "NamedInsured_MailingAddress_PostalCode_A": this.applicationDoc.mailingZipcode,
            "NamedInsured_SICCode_A": this.industryCodeDoc.sic,
            "NamedInsured_NAICSCode_A": this.industryCodeDoc.naics,
            "NamedInsured_TaxIdentifier_A": this.applicationDoc.ein,
            "NamedInsured_Primary_PhoneNumber_A": this.applicationDoc.phone,
            "NamedInsured_Primary_WebsiteAddress_A": this.applicationDoc.website,
            "NamedInsured_LegalEntity_OtherDescription": this.getEntityString === 'Other' ? this.applicationDoc.entityType : '',
            "NamedInsured_Primary_EmailAddress_A": this.primaryContactObj.email,
            "NamedInsured_InBusinessYearCount_A": moment().diff(this.applicationDoc.founded, 'years'),
            "Policy_Status_QuoteIndicator_A": 1,
            "Policy_Payment_DirectBillIndicator_A": 1,
            "NamedInsured_InspectionContact_FullName_A": this.primaryContactObj.firstName + ' ' + this.primaryContactObj.lastName,
            "NamedInsured_InspectionContact_PhoneNumber_A": this.primaryContactObj.phone,
            "NamedInsured_InspectionContact_EmailAddress_A": this.primaryContactObj.email
        }

        let pdfKey = 65;
        const uniqueStateList = [...new Set(this.applicationDoc.locations.map(location => location.state))]

        uniqueStateList.forEach(state => {
            const currentLetter = String.fromCharCode(pdfKey);
            page1Obj["WorkersCompensation_PartOne_StateOrProvinceCode_" + currentLetter] = state;
            pdfKey += 1;
        })

        // Write the locations
        pdfKey = 65;
        const page1Locations = this.applicationDoc.locations.slice(0, 3);
        page1Locations.forEach((location, index) => {
            const currentLetter = String.fromCharCode(pdfKey);
            page1Obj["Location_ProducerIdentifier_" + currentLetter] = index + 1;
            page1Obj["Location_PhysicalAddress_LineOne_" + currentLetter] = location.address;
            page1Obj["Location_PhysicalAddress_LineTwo_" + currentLetter] = location.address2;
            page1Obj["Location_PhysicalAddress_StateOrProvinceCode_" + currentLetter] = location.state;
            page1Obj["Location_PhysicalAddress_PostalCode_" + currentLetter] = location.zipcode;
            pdfKey += 1;
        })

        // If the WC policy details exist, add them
        if(this.policyObj){
            // Get individual limits formatted as dollar amounts (ex. ['1,000,000' , '2,000,000' , '1,000,000'])
            const limitsArray = limitHelper.getLimitsAsDollarAmounts(this.policyObj.limits);
            page1Obj.WorkersCompensationEmployersLiability_EmployersLiability_EachAccidentLimitAmount_A = limitsArray[0];
            page1Obj.WorkersCompensationEmployersLiability_EmployersLiability_DiseasePolicyLimitAmount_A = limitsArray[1];
            page1Obj.WorkersCompensationEmployersLiability_EmployersLiability_DiseaseEachEmployeeLimitAmount_A = limitsArray[2];

            //Check if the effective date was acutally set, if it was add it
            if(this.policyObj.effectiveDate !== '0000-00-00'){
                page1Obj.Policy_EffectiveDate_A = moment(this.policyObj.effectiveDate).format('L');
            }

            if(this.policyObj.expirationDate !== '0000-00-00'){
                page1Obj.Policy_ExpirationDate_A = moment(this.policyObj.expirationDate).format('L');
            }
        }

        // Check the appropriate entity checkbox
        page1Obj[`NamedInsured_LegalEntity_${this.getEntityString()}Indicator_A`] = 1

        // Write individuals included/excluded
        if(this.applicationDoc.ownersCovered === true){
            page1Obj.WorkersCompensation_Individual_FullName_A = "OWNERS INCLUDED";
        }
        else{
            pdfKey = 65;
            this.applicationDoc.owners.forEach(owner => {
                const currentLetter = String.fromCharCode(pdfKey);
                page1Obj["WorkersCompensation_Individual_LocationProducerIdentifier_" + currentLetter] = '1';
                page1Obj["WorkersCompensation_Individual_FullName_" + currentLetter] = owner.fname + ' ' + owner.lname;
                page1Obj["WorkersCompensation_Individual_BirthDate_" + currentLetter] = owner.birthdate ? moment(owner.birthdate).format('L') : '';
                page1Obj["WorkersCompensation_Individual_OwnershipPercent_" + currentLetter] = owner.ownership;
                page1Obj["WorkersCompensation_Individual_IncludedExcludedCode_" + currentLetter] = 'EXC';
                pdfKey += 1;
            })
        }

        // State rating sheets
        const stateRatingPdfList = [];
        let pageCounter = 1;

        for(const state of uniqueStateList){
            pdfKey = 65;
            const statePdfDataFieldsObj = {
                'WorkersCompensation_RateState_PageNumber_A': pageCounter,
                'WorkersCompensation_RateState_TotalPageNumber_A': uniqueStateList.length,
                'WorkersCompensation_RateState_StateOrProvinceName_A': state
            };

            const locationsInStateList = this.applicationDoc.locations.filter(location => location.state === state);
            for(const location of locationsInStateList){
                const locationNumber = this.applicationDoc.locations.indexOf(location) + 1;
                const talageActivityCodeIdList = location.activityPayrollList.map(activity => activity.activityCodeId || activity.ncciCode);
                const insurerActivityCodeQuery = {
                    insurerId: this.insurerId,
                    talageActivityCodeIdList: {$in: talageActivityCodeIdList},
                    territoryList: {$in: uniqueStateList},
                    effectiveDate: {$lte: this.policyObj.effectiveDate},
                    expirationDate: {$gte: this.policyObj.expirationDate},
                    active: true
                };

                const insurerActivityCode = new insurerActivityCodeBO();
                let insurerActivityCodeList = null;
                try{
                    insurerActivityCodeList = await insurerActivityCode.getList(insurerActivityCodeQuery);
                }
                catch(err) {
                    log.error('Failed getting Insurer Activity Code list' + err + __location);
                }

                if(!insurerActivityCodeList.length) {
                    log.info('No Insurer Activity Codes were found' + __location);
                }

                for(const activity of location.activityPayrollList){
                    if(!activity.activityCodeId){
                        activity.activityCodeId = activity.ncciCode
                    }

                    if(insurerActivityCodeList.length){
                        for(const insurerActivityCodeObj of insurerActivityCodeList){
                            const currentLetter = String.fromCharCode(pdfKey);
                            statePdfDataFieldsObj['WorkersCompensation_RateClass_LocationProducerIdentifier_' + currentLetter] = locationNumber;
                            statePdfDataFieldsObj['WorkersCompensation_RateClass_ClassificationCode_' + currentLetter] = `${insurerActivityCodeObj.code}${insurerActivityCodeObj.sub ? `-${insurerActivityCodeObj.sub}` : ''}`;
                            statePdfDataFieldsObj['WorkersCompensation_RateClass_DutiesDescription_' + currentLetter] = insurerActivityCodeObj.description;
                            statePdfDataFieldsObj['WorkersCompensation_RateClass_SICCode_' + currentLetter] = this.industryCodeDoc.sic;
                            statePdfDataFieldsObj['WorkersCompensation_RateClass_NAICSCode_' + currentLetter] = this.industryCodeDoc.naics;
                            statePdfDataFieldsObj['WorkersCompensation_RateClass_RemunerationAmount_' + currentLetter] = '$' + activity.payroll;
                            pdfKey += 1;
                        }
                    }
                    else{
                        const currentLetter = String.fromCharCode(pdfKey);
                        statePdfDataFieldsObj['WorkersCompensation_RateClass_LocationProducerIdentifier_' + currentLetter] = locationNumber;
                        const activityCodeWithDescriptionObj = this.activityCodeList.find(code => code.activityCodeId === activity.activityCodeId);
                        if(activityCodeWithDescriptionObj){
                            statePdfDataFieldsObj['WorkersCompensation_RateClass_DutiesDescription_' + currentLetter] = activityCodeWithDescriptionObj.description;
                        }
                        statePdfDataFieldsObj['WorkersCompensation_RateClass_SICCode_' + currentLetter] = this.industryCodeDoc.sic;
                        statePdfDataFieldsObj['WorkersCompensation_RateClass_NAICSCode_' + currentLetter] = this.industryCodeDoc.naics;
                        statePdfDataFieldsObj['WorkersCompensation_RateClass_RemunerationAmount_' + currentLetter] = '$' + activity.payroll;
                        pdfKey += 1;
                    }
                }
            }

            stateRatingPdfList.push(await PdfHelper.createPDF('acord130/page-2.pdf', statePdfDataFieldsObj));
            pageCounter += 1;
        }

        const page3Obj = {"CommercialPolicy_OperationsDescription_A": this.industryCodeDoc.description};

        let pdf = null;
        try {
            pdfList.push(await PdfHelper.createPDF('acord130/page-1.pdf', page1Obj));
            pdfList.push(await PdfHelper.createMultiPagePDF(stateRatingPdfList));
            pdfList.push(await PdfHelper.createPDF('acord130/page-3.pdf', page3Obj));
            pdfList.push(await PdfHelper.createPDF('acord130/page-4.pdf', {}));

            pdf = await PdfHelper.createMultiPagePDF(pdfList);
        }
        catch (err) {
            log.error('Failed creating accord 130' + err + __location);
            throw err;
        }

        return pdf;
    }

    getPolicy(policytype){
        return this.applicationDoc.policies.filter(policy => policy.policyType === policytype.toUpperCase())[0];
    }

    getPrimaryContact(){
        return this.applicationDoc.contacts.filter(contact => contact.primary)[0];
    }

    getEntityString(){
        if(this.applicationDoc.entityType === 'Limited Liability Company'){
            return 'LimitedLiabilityCorporation';
        }
        else if(this.applicationDoc.entityType === 'Corporation'){
            return this.applicationDoc.entityType;
        }
        else if(this.applicationDoc.entityType === 'Partnership'){
            return this.applicationDoc.entityType;
        }
        else{
            return 'Other';
        }
    }
}