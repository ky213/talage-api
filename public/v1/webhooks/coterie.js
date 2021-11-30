const ApplicationBO = global.requireShared('./models/Application-BO.js');
const QuoteBO = global.requireShared('./models/Quote-BO.js');
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
            log.error(`Can't find quotes (appid: ${req.body.Metadata}): ${JSON.stringify(quotes, null, 2)} ${__location}`);
            res.send(500, {success: false});
            return next();
        }

        // If this quote has been bound.
        if (req.body.Status === 'Active') {
            await quoteModel.markQuoteAsBound(curQuote.quoteId, req.body.Metadata, 'system', {
                policyId : req.body.policyId,
                policyNumber: req.body.PolicyNumber,
                policyEffectiveDate: moment(req.body.StartDate).format('YYYY-MM-DD'),
                policyPremium: req.body.Premium,
                policyUrl: ''
            });
            await quoteModel.appendToLog(curQuote.quoteId, `<br><br>
                --------======= Policy Webhook received from Coterie =======--------<br>
                <pre>${JSON.stringify(req.body, null, 2)}</pre>
                `);
            log.debug(`Marked quote ${curQuote.quoteId} as bound (in application ${req.body.Metadata}) due to Coterie webhook`);

            // Mark application as bound
            await applicationBo.updateStatus(req.body.Metadata, 'bound', 90);
            // Re-calculate quote metrics after binding.
            await applicationBo.recalculateQuoteMetrics(req.body.Metadata);
        }
        else {
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