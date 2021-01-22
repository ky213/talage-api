/* eslint-disable no-unused-vars */
/**
 * Defines a single industry code
 */

'use strict';

const Claim = require('./Claim.js');
const moment = require('moment');
const validator = global.requireShared('./helpers/validator.js');


module.exports = class Policy {

    constructor() {

        // All Policies
        this.applicationId = 0;
        this.claims = [];
        this.effective_date = '';
        this.expiration_date = '';
        // Does not look like the Quote App send policy.json to server anymore.
        this.insurers = [];
        this.limits = '';
        // Does not look like the Quote App send policy.json to server anymore.
        this.json = '';
        this.type = '';

        // BOP and GL Only
        this.gross_sales = 0;
        this.add_terrorism_coverage = false;

        // BOP Only - Does not match Quote App UI
        this.coverage_lapse_non_payment = null;

        // GL Only
        this.deductible = 0;

        // WC Only
        this.coverage_lapse = null;

        this.territories = [];
        this.primary_territory = '';
    }

    /**
	 * Populates this object with data from the request
	 *
     * @param {object} policyJSON - Mongoose Application model policy
     * @param {object} appBusiness - Business Model
     * @param {object} applicationDocData - Mongoose Application Doc
	 * @returns {void}
	 */
    async load(policyJSON, appBusiness, applicationDocData) {
        if(!policyJSON){
            log.error("Quote Policy model no applicationPolicyTypeBO supplied" + __location)
            throw new Error("Quote Policy model no applicationPolicyTypeBO supplied");
        }

        const applicationId = applicationDocData.mysqlId

        //load property from applicationPolicyTypeBO
        this.applicationId = applicationId;
        this.type = policyJSON.policyType;
        this.coverage_lapse = policyJSON.coverageLapse;
        this.coverage_lapse_non_payment = policyJSON.coverage_lapse_non_payment;
        this.add_terrorism_coverage = policyJSON.addTerrorismCoverage;
        this.deductible = policyJSON.deductible;
        this.effective_date = policyJSON.effectiveDate;
        this.expiration_date = policyJSON.expirationDate;
        this.limits = this.formatLimits(policyJSON.limits);

        this.gross_sales = applicationDocData.grossSalesAmt;

        this.territories = appBusiness.getTerritories();
        this.primary_territory = appBusiness.primary_territory;

 
        //make moment objects.
        try{
            this.effective_date = moment(this.effective_date);
            this.expiration_date = moment(this.expiration_date)
        }
        catch(e){
            log.error("Quote Policy error creating moment objects appId: " + applicationId + " " + e + __location)
        }

        //load claims from db
        // Load the policy information

        try{
            if(applicationDocData.claims && applicationDocData.claims.length > 0){
                for(let i = 0; i < applicationDocData.claims.length; i++){
                    const claimJSON = applicationDocData.claims[i];
                    if(this.type.toLowerCase() === claimJSON.policyType.toLowerCase()){
                        // eslint-disable-next-line prefer-const
                        let claim = new Claim();
                        claim.load(claimJSON);
                        this.claims.push(claim);
                    }
                }
            }
            else {
                log.debug("")
            }
        }
        catch(e){
            log.error(`Error loading claims appId: ${applicationId} PolicyType = ${policyJSON.policy_type} error:` + e + __location)
            throw e;
        }
        // log.debug("Policy object: " + JSON.stringify(this));
    }


    formatLimits(dbLimit) {
        if(dbLimit){
            const individualLimits = dbLimit.match(/[1-9]+0*/g);
            return individualLimits.join('/');
        }
        else {
            log.error("Quote Policy formatLimits missing dbLimit " + __location)
        }
    }
};