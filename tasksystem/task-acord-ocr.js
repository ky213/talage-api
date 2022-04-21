const moment = require('moment');
const ApplicationUploadBO = global.requireShared('./models/ApplicationUpload-BO.js');
const ApplicationUploadStatusBO = global.requireShared('./models/ApplicationUploadStatus-BO.js');
const AgencyPortalUserBO = global.requireShared('./models/AgencyPortalUser-BO.js');
const emailsvc = global.requireShared('./services/emailsvc.js');
const _ = require('lodash');

/**
 * AmtrustImport Task processor
 *
 * @returns {void}
 */
async function processtask(){
    // list of User IDs to send emails to if they have finished OCR jobs.
    let sendFinishEmails = [];
    const agencyPortalUserBO = new AgencyPortalUserBO();

    // Check and wait until OCR is finished for files in the queue.
    try {
        const applicationUploadBO = new ApplicationUploadBO();
        const applicationUploadStatusBO = new ApplicationUploadStatusBO();

        const results = await applicationUploadStatusBO.getPendingApplications();

        await Promise.all(results.map(async(uploadStatus) => {
            const requestId = uploadStatus.requestId;

            // This will block until OCR is finished.
            const result = await applicationUploadBO.getOcrResult(requestId);
            if (_.get(result, 'status') === 'ERROR') {
                log.error(`OCR microservice error: ${result.message}`);
                return;
            }
            await applicationUploadBO.saveOcrResult(requestId, result, uploadStatus, uploadStatus.markAsPending);
            sendFinishEmails.push(uploadStatus.agencyPortalUserId);
        }));
    }
    catch (ex) {
        log.error("Error when saving OCR results " + ex.message + __location);
    }

    //de-dup this array.
    sendFinishEmails = _.uniqBy(sendFinishEmails);

    // Send an email to notify the users that their OCR operations are complete.
    for (const userId of sendFinishEmails) {
        try {
            const user = await agencyPortalUserBO.getById(userId);
            const emailData = {
                'html': `Your Acord forms have been successfully imported! You can view them in the Agency Portal.`,
                'subject': 'Your Acord forms have been successfully imported'
            };

            await emailsvc.send(user.email, emailData.subject, emailData.html, {}, user.agencyNetworkId, emailData.brand);
        }
        catch (ex) {
            log.error("Error when emailing OCR results " + ex.message + __location);
        }
    }
}

module.exports = {processtask: processtask};