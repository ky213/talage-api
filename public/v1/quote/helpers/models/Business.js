/* eslint-disable valid-jsdoc */
/* eslint-disable prefer-const */
/**
 * Defines a single industry code
 */

'use strict';

const Contact = require('./Contact.js');
const Location = require('./Location.js');
const moment = require('moment');
//const {reject} = require('async');
const validator = global.requireShared('./helpers/validator.js');
const crypt = global.requireShared('./services/crypt.js');
const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

//const ZipCodeBO = global.requireShared('./models/ZipCode-BO.js');


module.exports = class Business {

    constructor() {
        this.appId = '';
        this.appPolicyTypeList = [];
        this.association = 0;
        this.association_id = '';
        this.bureau_number = 0;
        this.contacts = [];
        this.dba = '';
        this.entity_type = '';
        this.experience_modifier = 1.00;
        this.founded = '';
        this.industry_code = 0;
        this.industry_code_description = '';
        this.locations = [];
        this.mailing_address = '';
        this.mailing_address2 = '';
        this.mailing_city = '';
        this.mailing_territory = '';
        this.mailing_state_abbr = '';
        this.mailing_zipcode = '';
        this.name = '';
        this.num_owners = NaN;
        this.phone = 0;
        this.primary_territory = '';
        this.website = '';
        this.years_of_exp = 0;
        this.zip = 0;

        // WC Policies
        this.corporation_type = '';
        this.management_structure = '';
        this.owners_included = true;
        this.owners = [];
    }

    /**
	 * Returns a list of all territories present in the application
	 *
	 * @returns {array} - A list of territory abbreviations
	 */
    getTerritories() {
        const territories = [];

        this.locations.forEach(function(loc) {
            if (!territories.includes(loc.state)) {
                territories.push(loc.state);
            }
        });

        return territories;
    }

    /**
	 * Returns a list of all zip codes present in the application
	 *
	 * @returns {array} - A list of zip codes
	 */
    getZips() {
        const zips = [];

        this.locations.forEach(function(loc) {
            if (!zips.includes(loc.zipcode)) {
                zips.push(loc.zipcode);
            }
        });

        return zips;
    }

    setPolicyTypeList(appPolicyTypeList) {
        this.appPolicyTypeList = appPolicyTypeList;
        this.locations.forEach(function(loc) {
            loc.setPolicyTypeList(appPolicyTypeList);
        });

    }


    //mapping function
    mapToSnakeCaseJSON(sourceJSON, targetJSON, propMappings){
        for(const sourceProp in sourceJSON){
            if(typeof sourceJSON[sourceProp] !== "object"){
                if(propMappings[sourceProp]){
                    const appProp = propMappings[sourceProp]
                    targetJSON[appProp] = sourceJSON[sourceProp];
                }
                else {
                //check if snake_case
                    targetJSON[sourceProp.toSnakeCase()] = sourceJSON[sourceProp];
                }

            }
        }
    }


    /**
	 * Populates this object with data from the request
	 *
     * @param {object} applicationDoc - The App data
	 * @returns  returns true , or an Error if rejected
	 */
    async load(applicationDoc) {
        this.appId = applicationDoc.applicationId;
        let data2 = {}
        let applicationDocJSON = JSON.parse(JSON.stringify(applicationDoc))
        //ein not part of Schema some it has been copied.
        //applicationDocJSON.ein = applicationDoc.ein;

        const propMappings = {}
        this.mapToSnakeCaseJSON(applicationDocJSON, data2, propMappings);
        //log.debug("data2 " + JSON.stringify(data2));
        //population from database record
        try {
            Object.keys(this).forEach((property) => {
                if (!Object.prototype.hasOwnProperty.call(data2, property)) {
                    return;
                }
                // Trim whitespace
                if (typeof data2[property] === 'string') {
                    data2[property] = data2[property].trim();
                }
                switch (property) {
                    case 'website':
                        this[property] = data2[property] ? data2[property].toLowerCase() : '';
                        break;
                    default:
                        if (data2[property]) {
                            this[property] = data2[property];
                        }
                        break;
                }
            });
            //log.debug("Business: " + JSON.stringify(this));
            //backward compatible for integration code.
            this.zip = applicationDocJSON.mailingZipcode;
            this.mailing_zip = applicationDocJSON.mailingZipcode;
            this.mailing_territory = applicationDocJSON.mailingState;
            this.mailing_state_abbr = applicationDocJSON.mailingState;
        }
        catch (e) {
            log.error('populating business from db error: ' + e + __location)
        }
        this.name = applicationDocJSON.businessName;
        this.founded = moment(applicationDocJSON.founded);
        this.owners = applicationDocJSON.owners;
        this.industry_code = applicationDocJSON.industryCode.toString();
        try{
            const industryCodeBO = new IndustryCodeBO();
            const industryCodeJson = await industryCodeBO.getById(applicationDocJSON.industryCode);
            if(industryCodeJson){
                this.industry_code_description = industryCodeJson.description;
            }
        }
        catch(err){
            log.error("Error getting industryCodeBO " + err + __location);
        }

        this.owners_included = applicationDocJSON.ownersCovered;
        this.years_of_exp = applicationDocJSON.yearsOfExp;
        this.primary_territory = applicationDocJSON.mailingState;
        this.num_owners = applicationDocJSON.numOwners;
        //owner number fix
        if(applicationDocJSON.owners && applicationDocJSON.owners.length > 0){
            this.num_owners = applicationDocJSON.owners.length;
        }


        if (applicationDocJSON.contacts && applicationDocJSON.contacts.length > 0) {
            this.phone = applicationDocJSON.contacts[0].phone;
            for (let i = 0; i < applicationDocJSON.contacts.length; i++) {
                const contact = new Contact();
                contact.load(applicationDocJSON.contacts[i]);
                this.contacts.push(contact);
            }
        }
        if (applicationDocJSON.locations && applicationDocJSON.locations.length > 0) {
            for (let i = 0; i < applicationDocJSON.locations.length; i++) {
                const appDocLocation = applicationDocJSON.locations[i];
                const location = new Location();
                try {
                    await location.load(appDocLocation);
                }
                catch (err) {
                    log.error(`Unable to load location ${JSON.stringify(appDocLocation)}: ${err} ${__location}`);
                    throw err;
                }
                location.business_entity_type = applicationDocJSON.entityType;
                location.identification_number = stringFunctions.santizeNumber(applicationDocJSON.ein);
                this.locations.push(location);
            }
        }
        else {
            log.error("Missing locations application  " + applicationDocJSON.applicationId + __location);
        }
    }
}