/* eslint-disable prefer-const */
const Integration = require('../Integration.js');
const moment = require('moment');
const util = require('util');
const log = global.log;
//const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


module.exports = class CompwestWC extends Integration {

    /**
     * Requests a quote from Great America and returns. This request is not
     * intended to be called directly.
     *
     * @returns {Promise.<object, Error>} A promise that returns an object
     *   containing quote information if resolved, or an Error if rejected
     */
    async _insurer_quote() {

        const appDoc = this.app.applicationDocData;

        // product array
        let policyTypeArray = [];
        policyTypeArray.push(this.policy.type.toUpperCase())

        let locationArray = [];
        //location array
        appDoc.locations.forEach((location) => {
            let subLoc = {
                "street": location.address,
                "city": location.city,
                "state": location.state,
                "zip": location.zipcode
            }
            if(this.policy.type.toUpperCase() === 'BOP'){
                if(location.businessPersonalPropertyLimit){
                    subLoc.bppLimit = location.businessPersonalPropertyLimit
                }
                else {
                    subLoc.bppLimit = this.bopCoverage;
                }
                subLoc.buildingLimit = location.buildingLimit
            }
            locationArray.push(subLoc)
        });

        //get primary contact
        let primaryContact = {}
        appDoc.contacts.forEach((appContact) => {
            if(appContact.primary){
                primaryContact = appContact;
            }
        });
        //look up coterie industry Code from InsurerIndustryCode Doc attributes.
        let coterieIndustryId = 0;
        if(this.insurerIndustryCode && this.insurerIndustryCode.attributes){
            coterieIndustryId = this.insurerIndustryCode.attributes["Coterie ID"]
        }
        const requestedLimits = this.getSplitLimits(this.policy.limits);

        let submissionJSON = {
            "metadata": appDoc.applicationId,
            "applicationTypes": policyTypeArray,
            "grossAnnualSales": appDoc.grossSalesAmt,
            "glLimit": requestedLimits[0],
            "glAggregateLimit": requestedLimits[1],
            "glAggregatePcoLimit": requestedLimits[2],
            "policyStartDate": this.policy.expiration_datetoISOString(),
            "policyEndDate": this.policy.expiration_date.toISOString(),
            "zip": appDoc.mailingZipcode,
            "numEmployees": this.get_total_employees(),
            "industryId": coterieIndustryId,
            "AKHash":this.insurerIndustryCode.code,
            "contactEmail": primaryContact.email,
            "businessName": appDoc.businessName,
            "contactFirstName": primaryContact.firstName,
            "contactLastName": primaryContact.lastName,
            "contactPhone": primaryContact.phone,
            "mailingAddressStreet": appDoc.mailingAddress,
            "mailingAddressCity": appDoc.mailingCity,
            "mailingAddressState": appDoc.mailingState,
            "mailingAddressZip": appDoc.mailingZipcode,
            "locations": locationArray
        }

        if(this.policy.type.toUpperCase() === 'BOP'){
            //submissionJSON.bppDeductible = appDoc.policies[].deductible
            submissionJSON.bppDeductible = this.policy.deductible;
            // what is "propertyDamageLiabilityDeductible"
            //"propertyDamageLiabilityDeductible": 500,
        }

        //we might not have payroll if just GL or BOP
        const totalPayRoll = this.get_total_payroll()
        if(totalPayRoll > 0){
            submissionJSON.annualPayroll = totalPayRoll;
        }

        //Claims
        if(appDoc.claims && appDoc.claims.length > 0){
            let claimsArray = [];
            appDoc.claims.forEach((claim) => {
                if(claim.policyType.toUpperCase() === this.policy.type.toUpperCase()){
                    const claimJson = {
                        "description": "Event: " + claim.eventDate.toISOString(),
                        "amount": claim.amountPaid
                    }
                    claimsArray.push(claimJson)
                }
            });
            if(claimsArray.length > 0){
                submissionJSON.previousLosses = claimsArray
            }
        }



        //When additional Insurered is collected.
        // "endorsements" : {"additionalInsureds" : [
        //         {
        //             "name" : "Company A",
        //             "address" : "7817 Cooper Rd Suite A, Cincinnati OH 45242",
        //             "email" : "contact@company-a.io",
        //             "description" : ""
        //         }
        //     ]}



        //call API


        //deal with results.


        return this.return_result('error');

    }

}