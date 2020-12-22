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

    /**
	 * Checks that the data supplied is valid
	 *
	 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
	 */
    validate() {
        return new Promise(async(fulfill, reject) => {
            // Validate effective_date
            if (this.effective_date) {
                // Check for mm-dd-yyyy formatting

                if (!this.effective_date.isValid()) {
                    reject(new Error('Invalid formatting for property: effective_date. Expected mm-dd-yyyy'));
                    return;
                }

                // Check if this date is in the past
                if (this.effective_date.isBefore(moment().startOf('day'))) {
                    reject(new Error('Invalid property: effective_date. The effective date cannot be in the past'));
                    return;
                }

                // Check if this date is too far in the future
                if (this.effective_date.isAfter(moment().startOf('day').add(90, 'days'))) {
                    reject(new Error('Invalid property: effective_date. The effective date cannot be more than 90 days in the future'));
                    return;
                }
            }
            else {
                reject(new Error('Missing property: effective_date'));
                return;
            }


            // Validate claims
            const claim_promises = [];
            if (this.claims.length) {
                this.claims.forEach(function(claim) {
                    claim_promises.push(claim.validate());
                });
            }
            await Promise.all(claim_promises).catch(function(error) {
                reject(error);
            });

            // Limits: If this is a WC policy, check if further limit controls are needed
            if (this.type === 'WC') {
                // In CA, force limits to be at least 1,000,000/1,000,000/1,000,000
                if (this.territories.includes('CA')) {
                    if (this.limits !== '2000000/2000000/2000000') {
                        this.limits = '1000000/1000000/1000000';
                    }

                    // In OR force limits to be at least 500,000/500,000/500,000
                }
                else if (this.territories.includes('OR')) {
                    if (this.limits === '100000/500000/100000') {
                        this.limits = '500000/500000/500000';
                    }
                }
            }

            // Validate type
            if (this.type) {
                const valid_types = ['BOP',
                    'GL',
                    'WC'];
                if (valid_types.indexOf(this.type) < 0) {
                    reject(new Error('Invalid policy type'));
                    return;
                }
            }
            else {
                reject(new Error('You must provide a policy type'));
                return;
            }

            // BOP & GL Specific Properties
            if (this.type === 'BOP' || this.type === 'GL') {

                /**
                 * Gross Sales Amount
                 */
                if (this.gross_sales) {
                    if (!validator.gross_sales(this.gross_sales)) {
                        reject(new Error('The gross sales amount must be a dollar value greater than 0 and below 100,000,000'));
                        return;
                    }

                    // Cleanup this input
                    if (typeof this.gross_sales === 'number') {
                        this.gross_sales = Math.round(this.gross_sales);
                    }
                    else {
                        this.gross_sales = Math.round(parseFloat(this.gross_sales.toString().replace('$', '').replace(/,/g, '')));
                    }
                }
                else {
                    reject(new Error('Gross sales amount must be provided'));
                    return;
                }
            }

            // Determine the deductible
            if (typeof this.deductible === "string") {
                // Parse the deductible string
                try {
                    this.deductible = parseInt(this.deductible, 10);
                }
                catch (error) {
                    // Default to 500 if the parse fails
                    log.warn(`appId: ${this.applicationId} policyType: ${this.type} Could not parse deductible string '${this.deductible}'. Defaulting to 500.`);
                    this.deductible = 500;
                }
            }

            if (this.type === 'BOP') {
                // BOP specific validation

                // Coverage Lapse Due To Non-Payment - Note: Quote does not collect this for BOP only WC.
                if (this.coverage_lapse_non_payment === null) {
                    reject(new Error('coverage_lapse_non_payment is required, and must be a true or false value'));
                    return;
                }
            }
            else if (this.type === 'GL') {
                // GL specific validation


            }
            else if (this.type === 'WC') {
                // WC Specific Properties

                /**
                 * Coverage Lapse
                 * - Boolean
                 */
                if (this.coverage_lapse === null) {
                    reject(new Error('coverage_lapse is required, and must be a true or false value'));
                    return;
                }
            }

            // Limits
            if (!validator.limits(this.limits, this.type)) {
                reject(new Error('The policy limits you supplied are invalid.'));
                return;
            }

            fulfill(true);
        });
    }
};