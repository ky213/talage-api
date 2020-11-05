'use strict';

const moment = require('moment');

// NOTE: This is no longer being used.
// Event Bridge rules have been disable.  2020-11-05

/**
 * Checkin Records Task processor
 *
 * @param {string} queueMessage - message from queue
 * @returns {void}
 */
exports.processtask = async function(queueMessage){

    if(queueMessage && queueMessage.Attributes && queueMessage.Attributes.SentTimestamp){
        let error = null;
        // Check sent time. over 30 minutes seconds do not process.
        const sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp / 1000).utc();
        const now = moment().utc();
        const messageAge = now.unix() - sentDatetime.unix();
        if(messageAge < 1800){
            // DO STUFF

            await checkinRecordsTask().catch(err => error = err);
            await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
                error = err;
            });
            if(error){
                log.error("Error checkinRecordsTask deleteTaskQueueItem " + error + __location);
            }
            return;
        }
        else {
            log.warn('removing old checkinRecordsTask Message from queue');
            await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
            if(error){
                log.error("Error checkinRecordsTask deleteTaskQueueItem old " + error + __location);
            }
            return;
        }
    }
    else {
        log.error("Task Checkin bad queueMessage " + JSON.stringify(queueMessage) + __location);
        return
    }
}

/**
 * Exposes checkinRecordsTask for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function(){
    let error = null;
    const resp = await checkinRecordsTask().catch(err => error = err);
    if(error){
        log.error('abandonAppTask external: ' + error);
    }
    return resp;
}

/**
 * Exposes checkinRecordsTask for testing
 *
 * @returns {void}
 */
var checkinRecordsTask = async function(){

    const tables = [
        'clw_talage_activity_codes',
        'clw_talage_affiliates',
        'clw_talage_agencies',
        'clw_talage_applications',
        'clw_talage_associations',
        'clw_talage_businesses',
        'clw_talage_industry_codes',
        'clw_talage_industry_code_categories',
        'clw_talage_insurers',
        'clw_talage_landing_pages',
        'clw_talage_messages',
        'clw_talage_outages',
        'clw_talage_policies',
        'clw_talage_questions',
        'clw_talage_territories'
    ];

    for(let i = 0; i < tables.length; i++){
        const updateSQL = `
            UPDATE ${tables[i]} 
            SET checked_out = 0,
                checked_out_time = "0000-00-00 00:00:00"
            WHERE checked_out != 0
            
        `;
        log.info("removing checkouts from " + tables[i])
        await db.query(updateSQL).catch(function(e){
            log.error(`Checkin records for table ${tables[i]} caused an error: ` + e.message + __location);

        });
    }
    return true;
}