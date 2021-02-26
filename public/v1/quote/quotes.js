'use strict';

const jwt = require('jsonwebtoken');
const serverHelper = global.requireRootPath('server.js');
const fileSvc = global.requireShared('./services/filesvc.js');
const ApplicationBO = global.requireShared('./models/Application-BO.js');
const QuoteBO = global.requireShared('./models/Quote-BO.js');
const InsurerBO = global.requireShared('./models/Insurer-BO.js');
const InsurerPaymentPlanBO = global.requireShared('./models/InsurerPaymentPlan-BO.js');
const PaymentPlanBO = global.requireShared('./models/PaymentPlan-BO.js');
const LimitsBO = global.requireShared('./models/Limits-BO.js');

/**
 * Execute a query and log an error if it fails (testing a pattern)
 *
 * @param {object} sql - SQL query to run
 * @param {object} queryDescription - Description of the query
 *
 * @returns {Object} query result
 */
async function queryDB(sql, queryDescription) {
    let result = null;
    try {
        result = await db.query(sql);
    }
    catch (error) {
        log.error(`ERROR: ${queryDescription}: ${error} ${__location}`);
        return null;
    }
    return result;
}

/**
 * Create a quote summary to return to the frontend
 *
 * @param {Object} quote - Quote JSON to be summarized
 *
 * @returns {Object} quote summary
 */
async function createQuoteSummary(quote) {
    // Retrieve the quote
    if(!quote){
        log.error(`Quote object not supplied to createQuoteSummary ` + __location);
        return null;
    }
    // Retrieve the insurer
    const insurerModel = new InsurerBO();
    let insurer = null;
    try {
        insurer = await insurerModel.getById(quote.insurerId);
    }
    catch (error) {
        log.error(`Could not get insurer for ${quote.insurerId}:` + error + __location);
        return null;
    }

    switch (quote.aggregatedStatus) {
        case 'declined':
            // Return a declined quote summary
            return {
                id: quote.mysqlAppId,
                policy_type: quote.policyType,
                status: 'declined',
                message: `${insurer.name} has declined to offer you coverage at this time`,
                insurer: {
                    id: insurer.id,
                    logo: global.settings.SITE_URL + '/' + insurer.logo,
                    name: insurer.name,
                    rating: insurer.rating
                }
            };
        case 'quoted_referred':
        case 'quoted':
            const instantBuy = quote.aggregatedStatus === 'quoted';

            // Retrieve the limits and create the limits object
            const limits = {};
            const limitsModel = new LimitsBO();
            for (const quoteLimit of quote.limits) {
                try {
                    const limit = await limitsModel.getById(quoteLimit.limitId);
                    // NOTE: frontend expects a string. -SF
                    limits[limit.description] = `${quoteLimit.amount}`;
                }
                catch (error) {
                    log.error(`Could not get limits for ${quote.insurerId}:` + error + __location);
                    return null;
                }
            }

            // Retrieve the insurer's payment plan
            const insurerPaymentPlanModel = new InsurerPaymentPlanBO();
            let insurerPaymentPlanList = null;
            try {
                insurerPaymentPlanList = await insurerPaymentPlanModel.getList({"insurer": quote.insurerId});
            }
            catch (error) {
                log.error(`Could not get insurer payment plan for ${quote.insurerId}:` + error + __location);
                return null;
            }

            // Retrieve the payment plans and create the payment options object
            const paymentOptions = [];
            const paymentPlanModel = new PaymentPlanBO();
            for (const insurerPaymentPlan of insurerPaymentPlanList) {
                if (quote.amount > insurerPaymentPlan.premium_threshold) {
                    try {
                        const paymentPlan = await paymentPlanModel.getById(insurerPaymentPlan.payment_plan);
                        paymentOptions.push({
                            id: paymentPlan.id,
                            name: paymentPlan.name,
                            description: paymentPlan.description
                        });
                    }
                    catch (error) {
                        log.error(`Could not get payment plan for ${insurerPaymentPlan.id}:` + error + __location);
                        return null;
                    }
                }
            }

            // If we have a quote letter then retrieve the file from our cloud storage service
            let quoteLetterContent = '';
            const quoteLetterName = quote.quoteLetter;
            if (quoteLetterName) {
                // Get the file from our cloud storage service
                let error = null;
                const data = await fileSvc.GetFileSecure(`secure/quote-letters/${quoteLetterName}`).catch(function(err) {
                    log.error('file get error: ' + err.message + __location);
                    error = err;
                });
                if(error){
                    return null;
                }

                // Return the response
                if (data && data.Body) {
                    quoteLetterContent = data.Body;
                }
                else {
                    log.error('file get error: no file content' + __location);
                }
            }
            // Return the quote summary
            return {
                id: quote.mysqlId,
                policy_type: quote.policyType,
                amount: quote.amount,
                deductible: quote.deductible,
                instant_buy: instantBuy,
                letter: quoteLetterContent,
                insurer: {
                    id: insurer.id,
                    logo: 'https://img.talageins.com/' + insurer.logo,
                    name: insurer.name,
                    rating: insurer.rating
                },
                limits: limits,
                payment_options: paymentOptions
            };
        default:
            // We don't return a quote for any other aggregated status
            // log.error(`Quote ${quote.id} has a unknow aggregated status of ${quote.aggregated_status} when creating quote summary ${__location}`);
            return null;
    }
}

/**
 * Get quotes for a given application quote token
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getQuotes(req, res, next) {
    // Validate JWT
    if (!req.query.token) {
        // Missing token
        return next(serverHelper.requestError('Missing parameters.'));
    }
    let tokenPayload = null;
    try {
        tokenPayload = jwt.verify(req.query.token, global.settings.AUTH_SECRET_KEY);
    }
    catch (error) {
        // Expired token
        return next(serverHelper.invalidCredentialsError('Expired token.'));
    }

    // Set the last quote ID retrieved
    let lastQuoteID = 0;
    if (req.query.after) {
        lastQuoteID = req.query.after;
    }

    // Retrieve if we are complete. Must be done first or we may miss quotes.
    // return not complete if there is db error.
    // app will try again.
    let progress = 'quoting';
    const applicationBO = new ApplicationBO();
    try{
        progress = await applicationBO.getProgress(tokenPayload.applicationID);
        log.debug("Application progress check " + progress + __location);
    }
    catch(err){
        log.error(`Error getting application progress appId = ${req.body.id}. ` + err + __location);
    }

    const complete = progress !== 'quoting';

    // Retrieve quotes newer than the last quote ID
    // use createdAt Datetime instead.
    const quoteBO = new QuoteBO();
    let quoteList = null;

    const query = {
        mysqlAppId: tokenPayload.applicationID,
        lastMysqlId: lastQuoteID
    };
    try {
        quoteList = await quoteBO.getNewAppQuotes(query);
    }
    catch (error) {
        log.error(`Could not get quote list for appId ${tokenPayload.applicationID} error:` + error + __location);
        return null;
    }
    if(!quoteList){
        return null;
    }
    // eslint-disable-next-line prefer-const
    let returnedQuoteList = [];
    for(const quote of quoteList){
        const quoteSummary = await createQuoteSummary(quote);
        if (quoteSummary !== null) {
            returnedQuoteList.push(quoteSummary);
        }
    }

    res.send(200, {
        complete: complete,
        quotes: returnedQuoteList
    });
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGet('Get quotes ', `${basePath}/quotes`, getQuotes);
};