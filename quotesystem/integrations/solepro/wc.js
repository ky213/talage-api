/* eslint-disable object-curly-spacing */
/* eslint-disable function-paren-newline */
/* eslint multiline-comment-style: 0 */

/**
 * General Liability Policy Integration for Chubb
 */

const moment = require('moment');
const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const { convertToDollarFormat } = global.requireShared('./helpers/stringFunctions.js');

module.exports = class SoleProWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityClassCodes = true;
    }


    //         "AddressIndex": 1,
    //         "AddressLine1": "1234 First Street",
    //         "AddressLine2": "337673 Hillside Court",
    //         "City": "Anytown",
    //         "StateCode": "AL",
    //         "Zip": "34535",
    //         "AddressTypeID": 1,
    //         "IsPrimaryAddress": true
    //     }, {
    //         "AddressIndex": 2,
    //         "AddressLine1": "456 Second Street",
    //         "AddressLine2": "",
    //         "City": "Anytown",
    //         "StateCode": "CA",
    //         "Zip": "55357",
    //         "AddressTypeID": 2,
    //         "IsPrimaryAddress": false
    //     }
    // ],


    getAddressList(){
        const addressList = [];
        for (let i = 0; i < this.applicationDocData.locations.length; i++) {
            const location = this.applicationDocData.locations[i];
            const address = {
                "AddressIndex": i + 1,
                "AddressTypeID": 1, //physcial
                "IsPrimaryAddress": location.primary,
                "AddressLine1": location.address,
                "AddressLine2": location.address2 || "",
                "City": location.city,
                "StateCode": location.state,
                "Zip": location.zipcode
            }
            addressList.push(address)
        }
        return addressList;
    }

    async getOfficers(logPrefix,primaryContact, primaryTerritory, primaryActivityCodeId) {

        // {
        //     "FirstName": "John",
        //     "LastName": "Doe",
        //     "ClassCode":"2802",
        //     "DateofBirth": "05-17-1980",
        //     "SSN": "xx-xxxxxxx",
        //     "IsIncluded": true,
        //     "Email": "insured@example.com",
        //     "TitlePosition": "President",
        //     "PhoneNumber": "4085551234",  Required Format (XXX)XXX-XXXX
        //     "Gender": "Male",
        //     "BeneficiaryFirstName": "David",
        //     "BeneficiaryLastName": "Larusso",
        //     "BeneficiaryRelationship": "Father",
        //     "OwnershipPercentage": "100",
        //     "AddAccident": true,
        //     "AddressIndex": 1
        // }


        const officerList = [];
        for (let i = 0; i < this.applicationDocData.owners.length; i++) {
            const owner = this.applicationDocData.owners[i];
            const rawPhone = owner.phone ? owner.phone : primaryContact.phone
            const displayPhone = rawPhone.replace(/\D+/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1)$2-$3');
            const officer = {
                "FirstName": `${owner.fname.slice(0,50)}`,
                "LastName": `${owner.lname.slice(0,50)}`,
                "TitlePosition": owner.officerTitle.slice(0,50),
                "IsIncluded": owner.include,
                OwnershipPercentage: owner.ownership,
                "Email": owner.email ? owner.email : primaryContact.email,
                PhoneNumber: displayPhone,
                "Gender": "Male", //TODO
                "AddAccident": true,
                "AddressIndex": 1
            }
            if(owner.birthdate){
                try{
                    officer.DateofBirth = moment(owner.birthdate).format('MM-DD-YYYY');
                }
                catch(err){
                    log.error(`${logPrefix}`)
                }
            }
            if(owner.activityCodeId || primaryActivityCodeId){
                const ownerAcivityCodeId = owner.activityCodeId ? owner.activityCodeId : primaryActivityCodeId
                try{
                    const iac = await this.get_insurer_code_for_activity_code(this.insurer?.id, primaryTerritory, ownerAcivityCodeId)
                    const subCode = iac.sub ? `-${iac.sub}` : "";
                    officer.ClassCode = iac.code + subCode
                }
                catch(err){
                    log.error(`${logPrefix} error getting officer.ClassCode ${err}` + __location)
                }
            }
            if(owner.ssn || this.applicationDocData.ein){
                const ownerSSN = owner.ssn ? owner.ssn : this.applicationDocData.ein
                try{
                    officer.SSN = ownerSSN.replace(/\D+/g, '').replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3');
                }
                catch(err){
                    log.error(`${logPrefix}`)
                }

            }
            officerList.push(officer)
        }
        return officerList;

    }


    // getClaims(logPrefix){
    //     if(!this.applicationDocData.claims || this.applicationDocData.claims.length === 0){
    //         return [];
    //     }
    //     const requestClaims = [];
    //     try{
    //         const claims = this.applicationDocData.claims.filter(c => c.policyType === "WC");

    //         if (!claims || claims?.length === 0) {
    //             return [];
    //         }

    //         claims.forEach(claim => {
    //             requestClaims.push({
    //                 "lossDate": moment(claim.eventDate).format("YYYY-MM-DD"),
    //                 "claimDate": moment(claim.eventDate).format("YYYY-MM-DD"),
    //                 "lossDescription": claim.description,
    //                 "lossAmount": claim.amountPaid + claim.amountReserved !== null ? claim.amountReserved : 0,
    //                 "claimStatus": claim.open ? "O" : "CP",
    //                 "medicalOnly": "No"
    //             });
    //         });
    //     }
    //     catch(err){
    //         log.error(`${logPrefix} claim error ${err}` + __location)
    //     }

    //     return requestClaims;
    // }

    /**
	 * Requests a quote from Chubb and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {

        // Define how legal entities are mapped for Chubb
        const entity_matrix = {
            Corporation: 'CP',
            "Corporation (C-Corp)": 'CP',
            "Corporation (S-Corp)": 'CP',
            'Limited Liability Company': 'LL',
            'Limited Liability Partnership': 'LP',
            'Limited Partnership': 'LP',
            "Limited Liability Company (Member Managed)": 'LL',
            "Limited Liability Company (Manager Managed)": 'LL',
            Partnership: 'LP',
            'Sole Proprietorship': 'IN'
        };


        const applicationDocData = this.applicationDocData;
        const appDoc = this.applicationDocData;
        const logPrefix = `Chubb WC (Appid: ${applicationDocData.applicationId}): `;
        // Determine which API host to use
        let host = '';
        let testBusinessNamePrefix = "";
        if (this.insurer.useSandbox) {
            host = 'www.solepro.com';
            testBusinessNamePrefix = "TEST ";
        }
        else {
            host = 'www.solepro.com';
        }

        // entity type check
        if(appDoc.entityType !== "Sole Proprietorship" && appDoc.entityType !== "Corporation (S-Corp)" && appDoc.corporationType !== "S"){
            this.reasons.push(`Wheelhouse only supports SolePro Sole Proprietorship or S-Corps submissions at this time.`);
            return this.return_result('autodeclined');
        }
        //owner count check only handle one wiht owner SSN issue
        if(appDoc.owners.length !== 1){
            this.reasons.push(`Wheelhouse only supports SolePro for Sole Proprietorship or S-Corps with one owner at this time.`);
            return this.return_result('autodeclined');
        }


        //let primaryCodesCode = '';
        let primaryAcivityCodeId = 0;
        let primaryLocation = this.applicationDocData.locations.find((loc) => loc.primary === true);
        if(!primaryLocation){
            primaryLocation = this.applicationDocData.locations[0];
        }
        const governingActivityCodeJson = this.determine_governing_activity_code();
        primaryAcivityCodeId = governingActivityCodeJson?.id ? governingActivityCodeJson.id : 0;
        log.debug(`${logPrefix} primaryAcivityCodeId ${primaryAcivityCodeId}`)
        //const insurerIAC = await this.get_insurer_code_for_activity_code(this.insurer.insurerDoc.insurerId, primaryLocation.state, governingActivityCodeJson.id);
        //primaryCodesCode = insurerIAC.code;


        let primaryContact = appDoc.contacts.find(c => c.primary);
        if(!primaryContact && appDoc.contacts.length > 0){
            primaryContact = appDoc.contacts[0]
        }

        const mapCarrierLimits = {
            '100000/500000/100000': '$100,000/$500,000/$100,000',
            '500000/500000/500000': '$500,000/$500,000/$500,000',
            '1000000/1000000/1000000': '$1,000,000/$1,000,000/$1,000,000',
            '1500000/1500000/1500000': '$1,000,000/$1,000,000/$1,000,000',
            '2000000/2000000/2000000': '$1,000,000/$1,000,000/$1,000,000'
        }

        const limitDisplay = mapCarrierLimits[this.app.policies[0].limits] ? mapCarrierLimits[this.app.policies[0].limits] : '$100,000/$500,000/$100,000'
        let einDisplay = appDoc.ein;
        try{
            einDisplay = einDisplay.replace(/\D+/g, '').replace(/(\d{2})(\d{7})/, '$1-$2');
            log.debug(logPrefix + `ein  ${einDisplay}` + __location);
        }
        catch(err){
            log.error(logPrefix + `ein formation error ${err}` + __location);
        }

        let HasSubcontractor = false;
        const subContractorAnswer = this.get_question_anwser_by_identifier("7")
        log.debug(`subContractorAnswer ${subContractorAnswer}`)
        if(subContractorAnswer.toUpperCase() === "YES"){
            HasSubcontractor = true
        }


        //number of employee check
        let numOfEmployees = 0;
        // let totalPayroll = 0;
        //this.get_total_employees(),  might grab owners
        this.applicationDocData.locations.forEach((appLocation) => {
            appLocation.activityPayrollList.forEach((activtyCodePayroll) => {
                activtyCodePayroll.employeeTypeList.forEach((employeeType) => {
                    if(employeeType.employeeType !== "Owners"){
                        numOfEmployees += employeeType.employeeTypeCount;
                        //totalPayroll += employeeType.employeeTypePayroll;
                    }
                });
            });
        });
        //Old simpler storage.
        if(numOfEmployees === 0){
            this.app.business.locations.forEach(function(loc) {
                numOfEmployees += loc.full_time_employees;
                numOfEmployees += loc.part_time_employees;
            });
        }
        if(numOfEmployees > 0){
            const policyDoc = appDoc.policies.find((pt) => pt.policyType === "WC");
            if(!policyDoc || !policyDoc.isGhostPolicy){
                this.reasons.push(`Wheelhouse only supports SolePro with zero employees (Solo-X and Solo-I) at this time.`);
                return this.return_result('autodeclined');
            }
        }


        //TODO pick correct product
        let soleproProduct = "SLX";

        if(appDoc.owners[0].include){ // Refactor once more than one owner is allowed
            soleproProduct = "SLI";
        }


        //TODO ? is product avaialbe in State.

        const requestJSON = {
            "ApplicationID": appDoc.applicationId,
            "IsPartialQuote": false,
            "StateCode": primaryLocation.state,
            "ProductCode": soleproProduct,
            "BusinessEntity": entity_matrix[applicationDocData.entityType],
            "Limit": limitDisplay,
            "InsuredCompanyName": testBusinessNamePrefix + applicationDocData.businessName,
            "EffectiveDate": this.policy.effective_date.format("MM-DD-YYYY"),
            "YearsInBusiness": this.get_years_in_business(),
            "DescriptionofOperation": this.industry_code.description,
            "HasSubcontractor": HasSubcontractor,
            "NumberOfEmployees": numOfEmployees,
            "NumberOfOwners": applicationDocData.owners.length,
            "FEIN": einDisplay,
            "IsFein": appDoc.hasEin,
            "Addresses": [],
            "Owners": [],
            "QuestionAnswers": []

        }


        //locations
        requestJSON.Addresses = this.getAddressList();
        // log.debug(`loss` + __location)
        // insuredOrPrincipal.lossInfo = this.getClaims();
        log.debug(`offices` + __location)
        requestJSON.Owners = await this.getOfficers(logPrefix, primaryContact, primaryLocation.state, primaryAcivityCodeId);
        //questions
        //requestJSON.questions
        log.debug(`Questions` + __location)
        for(const insurerQuestion of this.insurerQuestionList){
            //for (const question_id in this.questions) {
            if (Object.prototype.hasOwnProperty.call(this.questions, insurerQuestion.talageQuestionId)) {
                //const question = this.questions[question_id];
                const question = this.questions[insurerQuestion.talageQuestionId];
                if(!question){
                    continue;
                }
                if (!insurerQuestion.identifier) {
                    continue;
                }
                if(insurerQuestion.universal === false){
                    const stateProducts = insurerQuestion.attributes?.stateProducts
                    if(!stateProducts){
                        continue;
                    }
                    const stateProductList = stateProducts[primaryLocation.state]
                    if(!stateProductList){
                        continue;
                    }
                    if(stateProductList.indexOf(soleproProduct) === -1){
                        continue;
                    }
                }

                let answer = '';
                try {
                    answer = this.determine_question_answer(question);
                }
                catch (error) {
                    log.error(`${logPrefix}Could not determine question ${insurerQuestion.talageQuestionId} answer: ${error}. ${__location}`);
                }

                // This question was not answered
                if (!answer) {
                    continue;
                }
                const questionJSON = {
                    "QuestionID": insurerQuestion.identifier,
                    "QuestionText": insurerQuestion.text,
                    "AnswerText": answer,
                    "Explanation": ""
                }
                requestJSON.QuestionAnswers.push(questionJSON);
            }
        }


        log.debug(`SolePro SUBMISSION`)
        log.debug(JSON.stringify(requestJSON))

        // Build the authorization header
        // Send the XML to the insurer
        let result = null;
        const apiKey = this.app.agencyLocation.insurers[this.insurer.id].agencyId.trim();
        //https://www.solepro.com/api/GetQuestions/?AppKey=af8720ef-9816-4f0b-8a8b-671d4e441db4
        try {
            result = await this.send_json_request(host, `/api/Quote/?AppKey=${apiKey}`, JSON.stringify(requestJSON), null, 'POST');
        }
        catch (error) {
            const errorMessage = `Error sending JSON request: ${error} `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }
        log.debug(`SOLEPRO RESPONSE`)
        log.debug(JSON.stringify(result))
        if(!result?.decision){
            this.reasons.push("no decision in response");
            return this.return_result('error');
        }
        log.debug(`result.decision.status ${result.decision.status}`)
        if(result.decision.status === "Quoted" || result.decision.status === "Referral"){
            this.number = result.reference;
            this.amount = result.decision.premiums?.gross?.amount
            this.quoteLink = "https://www.solepro.com/account/login"

            try{
                if(result?.covers && result?.covers[0] && result?.covers[0].limits){
                    this.quoteCoverages = [];
                    let coverageSort = 0;
                    for(const limit of result.covers[0].limits){
                        const newCoverage = {
                            description: limit.name,
                            value: limit.value?.amount ? convertToDollarFormat(limit.value.amount, true) : null,
                            sort: coverageSort++,
                            category: 'WC Limits'
                        }
                        this.quoteCoverages.push(newCoverage);
                    }
                }


            }
            catch(err){
                log.error(logPrefix + `response coverage processing error ${err}` + __location);
            }
            if(result?.decision?.status === "Quoted"){
                return this.return_result('quoted');
            }
            else if(result?.decision?.status === "Referral" && this.amount > 0){
                return this.return_result('referred_with_price');
            }
            else {
                return this.return_result('referred');
            }
        }
        else if(result?.decision?.status){
            this.quoteLink = "https://www.solepro.com/account/login"
            if(result?.decline_reasons){
                for(const decline_reason of result.decline_reasons){
                    this.reasons.push(decline_reason);
                }

            }
            return this.return_result('declined');
        }
        else {
            return this.return_result('error');
        }
    }


};