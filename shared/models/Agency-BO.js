'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const AgencyNetworkBO = require('./AgencyNetwork-BO.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const fileSvc = global.requireShared('services/filesvc.js');
const { 'v4': uuidv4 } = require('uuid');
var AgencyEmail = require('mongoose').model('AgencyEmail');

const additionalInfo2toplevel = ['donotShowEmailAddress'];

const s3AgencyLogoPath = "public/agency-logos/";
const tableName = 'clw_talage_agencies'
const skipCheckRequired = false;
module.exports = class AgencyBO {

  #dbTableORM = null;
  doNotSnakeCase = ['additionalInfo'];

  constructor() {
    this.id = 0;
    this.#dbTableORM = new DbTableOrm(tableName);
    this.#dbTableORM.doNotSnakeCase = this.doNotSnakeCase;
  }


  /**
 * Save Model 
   *
 * @param {object} newObjectJSON - newObjectJSON JSON
 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
 */
  saveModel(newObjectJSON) {
    return new Promise(async (resolve, reject) => {
      if (!newObjectJSON) {
        reject(new Error(`empty ${tableName} object given`));
      }
      await this.cleanupInput(newObjectJSON);
      //propery mapping 
      if (newObjectJSON.caLicenseNumber) {
        newObjectJSON.ca_license_number = newObjectJSON.caLicenseNumber
      }

      if (newObjectJSON.id) {
        await this.#dbTableORM.getById(newObjectJSON.id).catch(function (err) {
          log.error(`Error getting ${tableName} from Database ` + err + __location);
          reject(err);
          return;
        });
        this.updateProperty();
        this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
        if(!this.#dbTableORM.additionalInfo){
          this.#dbTableORM.additionalInfo= {}
        }
        for (let i = 0; i < additionalInfo2toplevel.length; i++) {
          const featureName = additionalInfo2toplevel[i]
          if (newObjectJSON[featureName] || newObjectJSON[featureName] === false) {
            this.#dbTableORM.additionalInfo[featureName] = newObjectJSON[featureName];
          }
        }

        // Logo are not sent in during agency create
        // file naming requires agencyId
        if (newObjectJSON.logo && newObjectJSON.logo.startsWith('data:')) {

          if (this.logo) {
            //removed old logo from S3.
            try {
              log.debug("Removing logo " + s3AgencyLogoPath + this.logo);
              await fileSvc.deleteFile(s3AgencyLogoPath + this.logo)
            } catch (e) {
              log.error("Agency Logo delete error: " + e + __location);
            }
          }

          try {
            let fileName = await this.processLogo(newObjectJSON);
            newObjectJSON.logo = fileName;
            this.logo = fileName;
            this.#dbTableORM.logo = fileName;
            log.debug("new logo file " + newObjectJSON.logo);
          }
          catch (e) {
            log.error("Agency SaveModel error processing logo " + e + __location);
            //newObjectJSON.logo = null;
            delete newObjectJSON.logo
          }
        }
      }
      else {
        this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
      }
      log.debug("preSave logo " + this.#dbTableORM.logo)
      //save
      await this.#dbTableORM.save().catch(function (err) {
        reject(err);
      });
      this.updateProperty();
      this.id = this.#dbTableORM.id;

      resolve(true);

    });
  }

  processLogo(newObjectJSON) {
    return new Promise(async (fulfill, reject) => {
      // Handle the logo file
      if (newObjectJSON.logo) {
        let rejected = false;
        // If the logo is base64, we need to save it; otherwise, assume no changes were made
        if (newObjectJSON.logo.startsWith('data:')) {

          // If this is an existing record, attempt to remove the old logo first

          // Isolate the extension
          const extension = newObjectJSON.logo.substring(11, newObjectJSON.logo.indexOf(';'));
          if (!['gif',
            'jpeg',
            'png'].includes(extension)) {
            reject(serverHelper.requestError('Please upload your logo in gif, jpeg, or preferably png format.'));
            return;
          }

          // Isolate the file data from the type prefix
          const logoData = newObjectJSON.logo.substring(newObjectJSON.logo.indexOf(',') + 1);

          // Check the file size (max 150KB)
          if (logoData.length * 0.75 > 150000) {
            reject(serverHelper.requestError('Logo too large. The maximum file size is 150KB.'));
            return;
          }

          // Generate a random file name (defeats caching issues issues)
          const fileName = `${this.id}-${uuidv4().substring(24)}.${extension}`;

          // Store on S3
          log.debug("Agency saving logo " + fileName)
          await fileSvc.PutFile(s3AgencyLogoPath + fileName, logoData).catch(function (err) {
            log.error("Agency add logo error " + err + __location);
            reject(err)
            rejected = true;
          });
          if (rejected) {
            return;
          }

          // Save the file name locally
          fulfill(fileName);
        }
      }


    });
  }


  /**
 * saves businessContact.
   *
 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
 */

  save(asNew = false) {
    return new Promise(async (resolve, reject) => {
      //validate

      resolve(true);
    });
  }

  loadFromId(id) {
    return new Promise(async (resolve, reject) => {
      //validate
      if (id && id > 0) {
        await this.#dbTableORM.getById(id).catch(function (err) {
          log.error(`Error getting  ${tableName} from Database ` + err + __location);
          reject(err);
          return;
        });
        this.updateProperty();
        this.moveAdditionalInfoFeatures(this)
        resolve(true);
      }
      else {
        reject(new Error('no id supplied'))
      }
    });
  }

  getList(queryJSON, getAgencyNetwork = false) {
    return new Promise(async (resolve, reject) => {

      let agencyNetworkList = null;
      if (getAgencyNetwork === true) {
        const agencyNetworkBO = new AgencyNetworkBO();
        try {
          agencyNetworkList = await agencyNetworkBO.getList()
        }
        catch (err) {
          log.error("Error getting Agency Network List " + err + __location);
        }
      }

      let rejected = false;
      // Create the update query
      let sql = `
                  select * from ${tableName}  
              `;
      let hasWhere = false;
      if (queryJSON) {
        if (queryJSON.agency_network) {
          sql += hasWhere ? " AND " : " WHERE ";
          sql += ` agency_network = ${db.escape(queryJSON.agency_network)} `
          hasWhere = true;
        }
        if (queryJSON.name) {
          sql += hasWhere ? " AND " : " WHERE ";
          sql += ` name like ${db.escape(`%${queryJSON.name}%`)} `
          hasWhere = true;
        }
        if (queryJSON.state) {
          sql += hasWhere ? " AND " : " WHERE ";
          sql += ` state = ${db.escape(queryJSON.state)} `
          hasWhere = true;
        }
        else {
          sql += hasWhere ? " AND " : " WHERE ";
          sql += ` state > 0 `
          hasWhere = true;
        }
      }
      else {
        sql += hasWhere ? " AND " : " WHERE ";
        sql += ` state > 0 `
        hasWhere = true;
      }


      // Run the query
      //log.debug("AgencyBO getlist sql: " + sql);
      const result = await db.query(sql).catch(function (error) {
        // Check if this was

        rejected = true;
        log.error(`getList ${tableName} sql: ${sql}  error ` + error + __location)
        reject(error);
      });
      if (rejected) {
        return;
      }
      let boList = [];
      if (result && result.length > 0) {
        for (let i = 0; i < result.length; i++) {
          let agencyBO = new AgencyBO();
          await agencyBO.#dbTableORM.decryptFields(result[i]);
          await agencyBO.#dbTableORM.convertJSONColumns(result[i]);
          const resp = await agencyBO.loadORM(result[i], skipCheckRequired).catch(function (err) {
            log.error(`getList error loading object: ` + err + __location);
          })
          if (!resp) {
            log.debug("Bad BO load" + __location)
          }
          this.moveAdditionalInfoFeatures(agencyBO)
          if (agencyBO.agency_network && getAgencyNetwork === true && agencyNetworkList && agencyNetworkList.length > 0) {
            try {
              let agencyNetwork = agencyNetworkList.find(agencyNetwork => agencyNetwork.id === agencyBO.agency_network);
              agencyBO.agencyNetworkName = agencyNetwork.name;
            }
            catch (err) {
              log.error("Error getting agency network name " + err + __location);
            }
          }
          boList.push(agencyBO);
        }
        resolve(boList);
      }
      else {
        //Search so no hits ok.
        resolve([]);
      }


    });
  }
  getById(id, getAgencyNetwork = false) {
    return new Promise(async (resolve, reject) => {
      //validate
      if (id && id > 0) {
        await this.#dbTableORM.getById(id).catch(function (err) {
          log.error(`Error getting  ${tableName} from Database ` + err + __location);
          reject(err);
          return;
        });


        this.updateProperty();
        let cleanObjJson = this.#dbTableORM.cleanJSON();
        this.moveAdditionalInfoFeatures(cleanObjJson)
        if (getAgencyNetwork === true) {
          const agencyNetworkBO = new AgencyNetworkBO();
          try {
            const agencyNetworkJSON = await agencyNetworkBO.getById(this.agency_network);
            cleanObjJson.agencyNetworkName = agencyNetworkJSON.name;


          }
          catch (err) {
            log.error("Error getting Agency Network List " + err + __location);
          }
        }
        resolve(cleanObjJson);
      }
      else {
        reject(new Error('no id supplied'))
      }
    });
  }

  moveAdditionalInfoFeatures(jsonObject) {
    if (jsonObject && jsonObject.additionalInfo) {
      for (let i = 0; i < additionalInfo2toplevel.length; i++) {
        const featureName = additionalInfo2toplevel[i]
        if (jsonObject.additionalInfo[featureName]) {
          jsonObject[featureName] = jsonObject.additionalInfo[featureName];
        }
        else {
          jsonObject[featureName] = false;
        }
      }
    }
    else if (jsonObject) {
      for (let i = 0; i < additionalInfo2toplevel.length; i++) {
        const featureName = additionalInfo2toplevel[i]
        jsonObject[featureName] = false;
      }
    }
  }

  async cleanupInput(inputJSON) {
    for (const property in properties) {
      if (inputJSON[property]) {
        // Convert to number
        try {
          if (properties[property].type === "number" && "string" === typeof inputJSON[property]) {
            if (properties[property].dbType.indexOf("int") > -1) {
              inputJSON[property] = parseInt(inputJSON[property], 10);
            }
            else if (properties[property].dbType.indexOf("float") > -1) {
              inputJSON[property] = parseFloat(inputJSON[property]);
            }
          }
        }
        catch (e) {
          log.error(`Error converting property ${property} value: ` + inputJSON[property] + __location)
        }
      }
    }
  }

  updateProperty() {
    const dbJSON = this.#dbTableORM.cleanJSON()
    // eslint-disable-next-line guard-for-in
    for (const property in properties) {
      this[property] = dbJSON[property];
    }
  }

  /**
* Load new object JSON into ORM. can be used to filter JSON to object properties
*
* @param {object} inputJSON - input JSON
* @returns {void} 
*/
  async loadORM(inputJSON) {
    await this.#dbTableORM.load(inputJSON, skipCheckRequired);
    this.updateProperty();
    return true;
  }

  markWholeSaleSignedById(id) {
    return new Promise(async (resolve, reject) => {
      //validate
      if (id && id > 0) {

        //Remove old records.
        const sql = `Update ${tableName} 
                        SET SET wholesale_agreement_signed = CURRENT_TIMESTAMP()
                        WHERE id = ${db.escape(id)}
                `;
        let rejected = false;
        const result = await db.query(sql).catch(function (error) {
          // Check if this was
          log.error("Database Object ${tableName} UPDATE wholesale_agreement_signed error :" + error + __location);
          rejected = true;
          reject(error);
        });
        if (rejected) {
          return false;
        }
        resolve(true);

      }
      else {
        reject(new Error('no id supplied'))
      }
    });
  }
  // ############ Email content retrievial methods ###############################
  // AgencyNetwork does not need to be loaded AgencyNetwork Id is passed in.
  // methods are async returning the contentJSON {"emailBrand": brandName message:" messageTemplate, "subject:" subjectTemplate}..

  /**
 * getEmailContentAgencyAndCustomer
   *
 * @param {string} agencyId - string or integer for agencyNetwork Id
   * @param {string} agencyContentProperty - string for Agency's template property
   * @param {string} customerContentProperty - string for Customer's template property
   * 
 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with BrandName. message template and subject template, or an Error if rejected
 */
  async getEmailContentAgencyAndCustomer(agencyId, agencyContentProperty, customerContentProperty) {
    if (agencyId) {
      try {
        await this.loadFromId(agencyId);
      }
      catch (err) {
        log.error("Error getting Agnecy Network " + err + __location)
        throw new Error('Error getting Agnecy Network');
      }
      if (this.id) {
        //get AgencyNetwork 1st than replace with Agency overwrites
        const agencyNetworkBO = new AgencyNetworkBO();
        let emailTemplateJSON = await agencyNetworkBO.getEmailContentAgencyAndCustomer(this.agency_network, agencyContentProperty, customerContentProperty).catch(function (err) {
          log.error(`Email content Error Unable to get email content for no quotes.  error: ${err}` + __location);
          throw new Error(`Email content Error Unable to get email content for no quotes.  error: ${err}`)
        });

        let query = { active: true };
        query.agencyMySqlId = agencyId

        let agencyEmailDB = null;
        try {
          agencyEmailDB = await AgencyEmail.findOne(query, '-__v');
        }
        catch (err) {
          log.error(`Getting AgencyEmail error agencyId ${agencyId}` + err + __location);
        }
        if (agencyEmailDB) {
          if (agencyEmailDB[agencyContentProperty] && agencyEmailDB[agencyContentProperty].subject) {

            emailTemplateJSON.agencyMessage = agencyEmailDB[agencyContentProperty].message;
            emailTemplateJSON.agencySubject = agencyEmailDB[agencyContentProperty].subject;
          }
          if (agencyEmailDB[customerContentProperty] && agencyEmailDB[customerContentProperty].subject) {

            emailTemplateJSON.customerMessage = agencyEmailDB[customerContentProperty].message;
            emailTemplateJSON.customerSubject = agencyEmailDB[customerContentProperty].subject;
          }
        }
        log.debug("");
        log.debug("emailTemplateJSON:  " + JSON.stringify(emailTemplateJSON));
        return emailTemplateJSON;
      }
      else {
        log.error("No agencyId supplied " + __location)
        throw new Error("No agencyId supplied");
      }

    }
  }

  /**
 * getEmailContent 
   *
 * @param {string} agencyId - string or integer for agencyNetwork Id
   * @param {string} contentProperty - string for template property
   * 
 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with BrandName. message template and subject template, or an Error if rejected
 */
  async getEmailContent(agencyId, contentProperty) {

    if (agencyId) {
      try {
        await this.loadFromId(agencyId);
      }
      catch (err) {
        log.error("Error getting Agnecy Network " + err + __location)
        throw new Error('Error getting Agnecy Network');
      }
      if (this.id) {
        //get AgencyNetwork 1st than replace with Agency overwrites
        const agencyNetworkBO = new AgencyNetworkBO();
        const emailTemplateJSON = await agencyNetworkBO.getEmailContent(this.agency_network, contentProperty, customerContentProperty).catch(function (err) {
          log.error(`Email content Error Unable to get email content for no quotes.  error: ${err}` + __location);
          throw new Error(`Email content Error Unable to get email content for no quotes.  error: ${err}`)
        });

        let query = { active: true };
        query.agencyMySqlId = agencyId

        let agencyEmailDB = null;
        try {
          agencyEmailDB = await AgencyEmail.findOne(query, '-__v');
        }
        catch (err) {
          log.error(`Getting AgencyEmail error agencyId ${agencyId}` + err + __location);
        }
        if (agencyEmailDB) {
          if (agencyEmailDB[contentProperty]) {
            emailTemplateJSON.message = agencyEmailDB[contentProperty].message;
            emailTemplateJSON.subject = agencyEmailDB[contentProperty].subject;
          }
        }
        return emailTemplateJSON;
      }
      else {
        log.error("No agencyId supplied " + __location)
        throw new Error("No agencyId supplied");
      }

    }
  }
}

const properties = {
  "id": {
    "default": 0,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "number",
    "dbType": "int(11) unsigned"
  },
  "state": {
    "default": "1",
    "encrypted": false,
    "hashed": false,
    "required": true,
    "rules": null,
    "type": "number",
    "dbType": "tinyint(1)"
  },
  "agency_network": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "number",
    "dbType": "int(11) unsigned"
  },
  "ca_license_number": {
    "default": null,
    "encrypted": true,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "blob"
  },
  "email": {
    "default": null,
    "encrypted": true,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "blob"
  },
  "fname": {
    "default": null,
    "encrypted": true,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "blob"
  },
  "lname": {
    "default": null,
    "encrypted": true,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "blob"
  },
  "logo": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "varchar(75)"
  },
  "name": {
    "default": "",
    "encrypted": false,
    "hashed": false,
    "required": true,
    "rules": null,
    "type": "string",
    "dbType": "varchar(50)"
  },
  "phone": {
    "default": null,
    "encrypted": true,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "blob"
  },
  "slug": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "varchar(30)"
  },
  "website": {
    "default": null,
    "encrypted": true,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "string",
    "dbType": "blob"
  },
  "wholesale": {
    "default": 0,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "number",
    "dbType": "tinyint(1)"
  },
  "wholesale_agreement_signed": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "datetime",
    "dbType": "datetime"
  },
  "enable_optout": {
    "default": 0,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "number",
    "dbType": "tinyint(1)"
  },
  "additionalInfo": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "json",
    "dbType": "json"
  },
  "created": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "timestamp",
    "dbType": "timestamp"
  },
  "created_by": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "number",
    "dbType": "int(11) unsigned"
  },
  "modified": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "timestamp",
    "dbType": "timestamp"
  },
  "modified_by": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "number",
    "dbType": "int(11) unsigned"
  },
  "deleted": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "timestamp",
    "dbType": "timestamp"
  },
  "deleted_by": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "number",
    "dbType": "int(11) unsigned"
  },
  "checked_out": {
    "default": 0,
    "encrypted": false,
    "hashed": false,
    "required": true,
    "rules": null,
    "type": "number",
    "dbType": "int(11)"
  },
  "checked_out_time": {
    "default": null,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "datetime",
    "dbType": "datetime"
  },
  "do_not_report": {
    "default": 0,
    "encrypted": false,
    "hashed": false,
    "required": false,
    "rules": null,
    "type": "number",
    "dbType": "tinyint(1)"
  }
}

class DbTableOrm extends DatabaseObject {

  constructor(tableName) {
    super(tableName, properties);
  }

}