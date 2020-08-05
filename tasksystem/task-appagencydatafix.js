/* eslint-disable array-element-newline */
/* eslint-disable prefer-const */
/* eslint-disable object-curly-newline */
'use strict';

const moment = require('moment');


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


/**
 * App Agency Null fix Task processor
 *
 * @param {string} queueMessage - message from queue
 * @returns {void}
 */
exports.processtask = async function(queueMessage) {
    let error = null;
    // check sent time. over 30 seconds seconds do not process.
    var sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp / 1000).utc();
    var now = moment().utc();
    const messageAge = now.unix() - sentDatetime.unix();
    if (messageAge < 30) {
        // DO STUFF
        await appDataFixTask().catch(err => error = err);
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err) {
            error = err;
        });
        if (error) {
            log.error("Error App Agency Null fix deleteTaskQueueItem " + error + __location);
        }
        //Queue next task (< 5 mintues)
        return;
    }
    else {
        log.debug('removing old expirePoliciesTask Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if (error) {
            log.error("Error App Agency Null fix deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}

/**
 * Exposes appDataFixTask for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function() {
    let error = null;
    await appDataFixTask().catch(err => error = err);
    if (error) {
        log.error('App Agency Null fix external: ' + error + __location);
    }
    return;
}

/**
 * expirePoliciesTask for testing
 *
 * @returns {void}
 */
var appDataFixTask = async function() {
    const updateSQL = `
    UPDATE clw_talage_applications 
        SET agency = 1, agency_location = 1
        WHERE agency is NULL
    `;
    await db.query(updateSQL).catch(function(e) {
        log.error(`App Agency Null fix caused an error: ` + e.message + __location);
    });

    //const datetimeFormat = 'YYYY-MM-DD hh:mm';
    const oneHourAgo = moment().subtract(1,'h');

    // update missing Policy type JSON caused by Joomla admin updates to agencylocation
    // and update anything with Agency_location changes or missing policy_type_info in last hour (this runs very 5 minutes)
    const updatePolicyJSONSQL = `
        SELECT agli.*
        FROM clw_talage_agency_location_insurers agli
            inner join clw_talage_agency_locations agl on agl.id = agli.agency_location
        WHERE agl.modified > '${oneHourAgo.format()}' OR agli.policy_type_info is NULL    
    `;
    let results = null;
    try {
        results = await db.query(updatePolicyJSONSQL);
    }
    catch (e) {
        log.error(`clw_talage_agency_location_insurers policy_type fix caused an error: ` + e.message + __location);
        return;
    }
    const policyTypeList = ["GL", "WC", "BOP"];
    //log.debug("results.length: " + results.length)
    for (var i = 0; i < results.length; i++) {

        let alInsurerDBJson = results[i];
        if (alInsurerDBJson.policy_type_info) {
            alInsurerDBJson.policy_type_info = JSON.parse(alInsurerDBJson.policy_type_info)
        }
        else {
            alInsurerDBJson.policy_type_info = {
                "GL": {
                    "enabled": false,
                    "useAcord": false,
                    "acordInfo": {
                        "sendToEmail": ""
                    }
                },
                "WC": {
                    "enabled": false,
                    "useAcord": false,
                    "acordInfo": {
                        "sendToEmail": ""
                    }
                },
                "BOP": {
                    "enabled": false,
                    "useAcord": false,
                    "acordInfo": {
                        "sendToEmail": ""
                    }
                }
            };
        }
        for (let j = 0; j < policyTypeList.length; j++) {
            const policyType = policyTypeList[j];
            if (!alInsurerDBJson.policy_type_info[policyType]) {
                alInsurerDBJson.policy_type_info[policyType] = {
                    "enabled": false,
                    "useAcord": false,
                    "acordInfo": {
                        "sendToEmail": ""
                    }
                }
            }
            alInsurerDBJson.policy_type_info[policyType].enabled = alInsurerDBJson[policyType.toLowerCase()] === 1;
        }
        const updatePolicyTypeInfo = JSON.stringify(alInsurerDBJson.policy_type_info);
        const updateSQPolicy = `
            UPDATE clw_talage_agency_location_insurers 
            SET policy_type_info = '${updatePolicyTypeInfo}'
            WHERE id = ${alInsurerDBJson.id}
        `;
        await db.query(updateSQPolicy).catch(function(e) {
            log.error(`Updating clw_talage_agency_location_insurers caused an error: ` + e.message + __location);
        });
        log.info(`Datafix: Updated clw_talage_agency_location_insurers ${alInsurerDBJson.id} `)

    }

    return;
}