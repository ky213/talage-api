/**
 * Defines a single insurer
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
//const moment_timezone = require('moment-timezone');
const InsurerBO = global.requireShared('./models/Insurer-BO.js');
const InsurerPolicyTypeBO = global.requireShared('./models/InsurerPolicyType-BO.js');
const InsurerOutageBO = global.requireShared('./models/InsurerOutage-BO.js');


module.exports = class Insurer {
    constructor() {
        this.id = 0;
        this.logo = '';
        this.name = '';
        this.outage = false;
        //this.packages = [];
        this.password = '';
        //this.payment_options = [];
        this.policy_types = [];
        this.policy_type_details = {};
        this.rating = '';
        this.slug = '';
        this.state = 1;
        this.useSandbox = global.settings.ENV === 'production' ? 0 : 1;
        this.test_password = '';
        this.test_username = '';
        this.username = '';
    }

    /**
	 * Returns the decrypted password for authenticating to this insurer's API. If
	 * we are in test mode, the test password will be returned instead.
	 *
	 * @return {string} - The password used to sign in to this insurer's API
	 */
    get_password() {
        if (this.useSandbox) {
            return this.test_password;
        }
        return this.password;
    }

    /**
	 * Returns the decrypted username for authenticating to this insurer's API. If
	 * we are in test mode, the test username will be returned instead.
	 *
	 * @return {string} - The username used to sign in to this insurer's API
	 */
    get_username() {
        if (this.useSandbox) {
            return this.test_username;
        }
        return this.username;
    }

    /**
	 * Initializes the insurer, getting the information we need about them from the database
	 *
	 * @param {int} id - The ID of the insurer
	 * @returns {Promise.<object, Error>} True on success, Error on failure.
	 */
    async init(id) {

        //Switch to BO.
        let insurerJson = null;
        const insurerBO = new InsurerBO();
        try{
            insurerJson = await insurerBO.getById(id);
        }
        catch(err){
            log.error(`Error getting insurer ${id} error: ${err} ${__location}`);
            return new Error('Database error');
        }
        // Build a query to get some basic information about this insurer from the database
        // const sql = `
        // 		SELECT i.id, i.state, i.logo, i.name, i.slug, i.rating, i.test_username, i.test_password, i.username
        // 			,i.password, GROUP_CONCAT(DISTINCT ipt.policy_type) AS 'policy_types'
        // 			,ipt.slug as policyslug
        // 		FROM clw_talage_insurers AS i
        // 			 LEFT JOIN clw_talage_insurer_policy_types AS ipt ON ipt.insurer = i.id
        // 		WHERE i.id = ${db.escape(parseInt(id, 10))}
        // 		GROUP BY i.id;
        // 	`;

        if(insurerJson){
            //fill in model.
            for (const property in insurerJson) {
                // Make sure this property is part of the rows[0] object and that it is alsoa. property of this object
                if (Object.prototype.hasOwnProperty.call(insurerJson, property) && Object.prototype.hasOwnProperty.call(this, property)) {
                    this[property] = insurerJson[property];
                }
            }


            //Get insure policy Types
            try{
                const insurerPolicyTypeBO = new InsurerPolicyTypeBO();
                const insurerPolicyTypeList = await insurerPolicyTypeBO.getList({"insureId": id});
                if(insurerPolicyTypeList && insurerPolicyTypeList.length > 0){
                    //override slug with policyslug if policyslug exists.
                    if(insurerPolicyTypeList[0].policyslug && insurerPolicyTypeList[0].policyslug.length > 0){
                        insurerJson.slug = insurerPolicyTypeList[0].policyslug
                    }
                    //list of policyttypes.
                    this.policy_types = [];
                    for(const insurerPolicyTypeJSON of insurerPolicyTypeList){
                        this.policy_types.push(insurerPolicyTypeJSON.policy_type);
                        this.policy_type_details[insurerPolicyTypeJSON.policy_type] = {
                            'api_support': insurerPolicyTypeJSON.api_support,
                            'acord_support': insurerPolicyTypeJSON.acord_support
                        }
                    }
                }
            }
            catch(err){
                log.error(`Error getting InsurerPolicyType list insurer ${id} error: ${err} ${__location}`);
                return new Error('Database error');
            }
        }
        else {
            log.error(`Empty results when querying the database for insurer ${id} information ${__location}`);
            return new Error('Invalid insurer');
        }

        const insurerOutageBO = new InsurerOutageBO();
        this.outage = await insurerOutageBO.isInOutage(parseInt(id, 10));

        return this;
    }
};