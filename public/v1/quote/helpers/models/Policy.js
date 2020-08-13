/* eslint-disable no-unused-vars */
/**
 * Defines a single industry code
 */

'use strict';

const Claim = require('./Claim.js');
const moment = require('moment');
const serverHelper = require('../../../../../server.js');
//const { loggers } = require('winston');
const validator = global.requireShared('./helpers/validator.js');
const ApplicationClaimBO = global.requireShared('./models/ApplicationClaim-BO.js');


module.exports = class Policy {

    constructor(appBusiness) {

        // All Policies
        this.appBusiness = appBusiness;
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

        // BOP Only
        this.coverage_lapse_non_payment = null;

        // GL Only
        this.deductible = 0;

        // WC Only
        this.coverage_lapse = null;
    }

    /**
	 * Populates this object with data from the request
	 *
     * @param {object} applicationPolicyTypeBO - The business data
     * @param {int} applicationId - The business data
     * @param {object} applicationBO - The business data
	 * @param {object} data - The business data
	 * @returns {void}
	 */
    async load(applicationPolicyTypeBO, applicationId, applicationBO) {
        if(!applicationPolicyTypeBO){
            log.error("Quote Policy model no applicationPolicyTypeBO supplied" + __location)
            throw new Error("Quote Policy model no applicationPolicyTypeBO supplied");
        }

        //load property from applicationPolicyTypeBO
        this.type = applicationPolicyTypeBO.policy_type;

        //load from applicationBO
        this.coverage_lapse = Boolean(applicationBO.coverage_lapse);
        this.coverage_lapse_non_payment = Boolean(applicationBO.coverage_lapse_non_payment);
        this.gross_sales = applicationBO.gross_sales_amt;
        this.deductible = applicationBO.deductible;
        switch (this.type) {
            case "WC":
                this.effective_date = applicationBO.wc_effective_date;
                this.expiration_date = applicationBO.wc_expiration_date;
                if(applicationBO.wc_limits){
                    this.limits = this.formatLimits(applicationBO.wc_limits);
                }
                else {
                    log.error("Quote Policy model WC missing limits" + __location)
                    throw new Error("Quote Policy model WC missing limits");
                }
                break;
            case "GL":
                this.effective_date = applicationBO.gl_effective_date;
                this.expiration_date = applicationBO.gl_expiration_date;
                if(applicationBO.limits){
                    this.limits = this.formatLimits(applicationBO.limits)
                }
                else {
                    log.error("Quote Policy model GL missing limits" + __location)
                    throw new Error("Quote Policy model GL missing limits");
                }
                break;
            case "BOP":
                this.effective_date = applicationBO.bop_effective_date;
                this.expiration_date = applicationBO.bop_expiration_date;
                if(applicationBO.limits){
                    this.limits = this.formatLimits(applicationBO.limits)
                }
                else {
                    log.error("Quote Policy model BOP missing limits" + __location)
                    throw new Error("Quote Policy model BOP missing limits");
                }

                break;
            default:
                break;
        }

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
            let error = null;
            const applicationClaimBO = new ApplicationClaimBO();
            const claimList = await applicationClaimBO.loadFromApplicationId(applicationId, this.type).catch(function(err){
                error = err;
                log.error(`Unable to load list of applicationClaimBO for quoting appId: ${applicationId} PolicyType = ${applicationPolicyTypeBO.policy_type} ` + __location);
            });
            if (error) {
                throw error;
            }
            claimList.forEach((claimBO) => {
                const claim = new Claim();
                claim.load(claimBO);
                this.claims.push(claim);
            });
        }
        catch(e){
            log.error(`Error loading claims appId: ${applicationId} PolicyType = ${applicationPolicyTypeBO.policy_type} error:` + e + __location)
            throw e;
        }
        //log.debug("Policy object: " + JSON.stringify(this));
    }


    formatLimits(dbLimit) {
        const individualLimits = dbLimit.match(/[1-9]+0*/g);
        return individualLimits.join('/');
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
                    reject(serverHelper.requestError('Invalid formatting for property: effective_date. Expected mm-dd-yyyy'));
                    return;
                }

                // Check if this date is in the past
                if (this.effective_date.isBefore(moment().startOf('day'))) {
                    reject(serverHelper.requestError('Invalid property: effective_date. The effective date cannot be in the past'));
                    return;
                }

                // Check if this date is too far in the future
                if (this.effective_date.isAfter(moment().startOf('day').add(90, 'days'))) {
                    reject(serverHelper.requestError('Invalid property: effective_date. The effective date cannot be more than 90 days in the future'));
                    return;
                }
            }
            else {
                reject(serverHelper.requestError('Missing property: effective_date'));
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
            const territories = this.appBusiness.getTerritories();
            if (this.type === 'WC') {
                // In CA, force limits to be at least 1,000,000/1,000,000/1,000,000
                if (territories.includes('CA')) {
                    if (this.limits !== '2000000/2000000/2000000') {
                        this.limits = '1000000/1000000/1000000';
                    }

                    // In OR force limits to be at least 500,000/500,000/500,000
                }
                else if (territories.includes('OR')) {
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
                    reject(serverHelper.requestError('Invalid policy type'));
                    return;
                }
            }
            else {
                reject(serverHelper.requestError('You must provide a policy type'));
                return;
            }

            // BOP & GL Specific Properties
            if (this.type === 'BOP' || this.type === 'GL') {

                /**
                 * Gross Sales Amount
                 */
                if (this.gross_sales) {
                    if (!validator.gross_sales(this.gross_sales)) {
                        reject(serverHelper.requestError('The gross sales amount must be a dollar value greater than 0 and below 100,000,000'));
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
                    reject(serverHelper.requestError('Gross sales amount must be provided'));
                    return;
                }
            }

            // BOP Specific Properties
            if (this.type === 'BOP') {

                /**
                 * Coverage Lapse Due To Non-Payment
                 * - Boolean
                 */
                if (this.coverage_lapse_non_payment === null) {
                    reject(serverHelper.requestError('coverage_lapse_non_payment is required, and must be a true or false value'));
                    return;
                }
            }
            else if (this.type === 'GL') {
                // GL Specific Properties

                /**
                 * Deductible
                 * - Integer (enforced with parseInt() on load())
                 * - Only accepted in AR, AZ, CA, CO, ID, NM, NV, OK, OR, TX, UT, or WA
                 * - Must be one of:
                 * 		- 500
                 * 		- 1000
                 * 		- 1500
                 */
                if (['AR',
                    'AZ',
                    'CA',
                    'CO',
                    'ID',
                    'NM',
                    'NV',
                    'OK',
                    'OR',
                    'TX',
                    'UT',
                    'WA'].includes(this.appBusiness.primary_territory)) {
                    if (!this.deductible) {
                        reject(serverHelper.requestError('You must supply a deductible for GL policies in AR, AZ, CA, CO, ID, NM, NV, OK, OR, TX, UT, or WA. The deductible can be 500, 1000, or 1500'));
                        return;
                    }
                    if (!validator.deductible(this.deductible)) {
                        reject(serverHelper.requestError('The policy deductible you supplied is invalid. It must be one of 500, 1000, or 1500.'));
                        return;
                    }
                    this.deductible = parseInt(this.deductible, 10);
                }
                else {
                    // Default the deductible
                    this.deductible = 500;
                }
            }
            else if (this.type === 'WC') {
                // WC Specific Properties

                /**
                 * Coverage Lapse
                 * - Boolean
                 */
                if (this.coverage_lapse === null) {
                    reject(serverHelper.requestError('coverage_lapse is required, and must be a true or false value'));
                    return;
                }
            }

            // Limits
            if (!validator.limits(this.limits, this.type)) {
                reject(serverHelper.requestError('The policy limits you supplied are invalid.'));
                return;
            }

            fulfill(true);
        });
    }
};