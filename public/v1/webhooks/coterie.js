const ApplicationBO = global.requireShared('./models/Application-BO.js');
const QuoteBO = global.requireShared('./models/Quote-BO.js');
const QuoteBind = global.requireRootPath('quotesystem/models/QuoteBind.js');
const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');
const {applicationStatus} = global.requireShared('./models/status/applicationStatus.js');
const moment = require('moment');

const onApplicationChange = async(req, res, next) => {
    // Right now we don't do anything with this webhook.
    res.send(200, {success: true});
    next();
};

const onQuoteChange = async(req, res, next) => {
    // Right now we don't do anything with this webhook.
    res.send(200, {success: true});
    next();
};

const onPolicyChange = async(req, res, next) => {
    // Ignore if no Talage application ID provided. Then likely policy is not
    // bound.
    if (!req.body.Metadata) {
        log.error('No Metadata provided by Coterie. Ignoring...');
        res.send(200, {success: true});
        return next();
    }

    try {
        const quoteModel = new QuoteBO();
        const applicationBo = new ApplicationBO();
        const quotes = await quoteModel.getByApplicationId(req.body.Metadata);
        // Find this Coterie quote ID
        const curQuote = quotes.find(q => q.insurerId === 29);

        if (!curQuote) {
            //only error in production.
            // test might be coming from 4 different systems or any engineers notebook
            if(global.settings.ENV === 'production'){
                log.error(`Can't find quotes (appid: ${req.body.Metadata}): ${JSON.stringify(quotes, null, 2)} ${__location}`);
                res.send(500, {success: false});
            }
            else {
                log.warn(`Can't find quotes on ${global.settings.ENV} (appid: ${req.body.Metadata}): ${JSON.stringify(quotes, null, 2)} ${__location}`);
                res.send(200, {success: true});
            }
            return next();
        }

        // If this quote has been bound.
        if (req.body.Status === 'Active' && curQuote.quoteStatusId < quoteStatus.bound.id) {
            const policyInfo = {
                policyId : req.body.policyId,
                policyNumber: req.body.PolicyNumber,
                policyEffectiveDate: moment(req.body.StartDate).format('YYYY-MM-DD'),
                policyPremium: req.body.Premium,
                policyUrl: ''
            };
            const DO_NOT_SEND_SLACK_NOTIFICATION = false;
            await quoteModel.markQuoteAsBound(curQuote.quoteId, req.body.Metadata, 'system' ,policyInfo, DO_NOT_SEND_SLACK_NOTIFICATION);
            await quoteModel.appendToLog(curQuote.quoteId, `<br><br>
                --------======= Policy Webhook received from Coterie =======--------<br>
                <pre>${JSON.stringify(req.body, null, 2)}</pre>
                `);
            log.debug(`Marked quote ${curQuote.quoteId} as bound (in application ${req.body.Metadata}) due to Coterie webhook`);

            // Mark application as bound
            await applicationBo.updateStatus(req.body.Metadata, 'bound', applicationStatus.bound.id);
            // Re-calculate quote metrics after binding.
            await applicationBo.recalculateQuoteMetrics(req.body.Metadata);

            const quoteBind = new QuoteBind();
            //default to yearly payment plan not important for notification.
            await quoteBind.load(curQuote.quoteId, 1, null, null);
            try{
                await quoteBind.send_slack_notification("boundWebHook");
            }
            catch(err){
                log.error(`appid ${curQuote.applicationId} quote ${curQuote.quoteId} had Slack API Bind Check  error ${err}` + __location);
            }
        }
        else if(curQuote.quoteStatusId < quoteStatus.bound.id) {
            log.debug(`Not Marked as bound from Coterie: ${JSON.stringify(req.body, null, 2)}`);

        }
        res.send(200, {success: true});
    }
    catch (ex) {
        log.error(`Error when parsing Coterie webhook: ${ex} ${__location}`);
        res.send(500, {success: false});
    }
    next();
};

/**
 * Coterie webhooks!
 *
 * For more information, visit: https://docs.coterieinsurance.com/#4ef7ac77-27f8-4c39-82b1-df65e1d39731
 *
 * @param {*} server server
 * @param {*} basePath basePath
 * @returns {void}
 */
exports.registerEndpoint = (server, basePath) => {
    server.addPost('Webhook for Coterie - Application change', `${basePath}/coterie/application`, onApplicationChange);
    server.addPost('Webhook for Coterie - Quote change', `${basePath}/coterie/quote`, onQuoteChange);
    server.addPost('Webhook for Coterie - Policies change', `${basePath}/coterie/policies`, onPolicyChange);
};