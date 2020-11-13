'use strict';

const jwt = require('jsonwebtoken');
const serverHelper = global.requireRootPath('server.js');
const fileSvc = global.requireShared('./services/filesvc.js');
const ApplicationBO = global.requireShared('./models/Application-BO.js');

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
 * @param {Number} quoteID - Quote ID for the summary
 *
 * @returns {Object} quote summary
 */
async function createQuoteSummary(quoteID) {
    // Get the quote
    let sql = `SELECT id, amount, policy_type, insurer, aggregated_status, quote_letter FROM #__quotes WHERE id = ${quoteID}`;
    let result = await queryDB(sql, `retrieving quote ${quoteID}`);
    if (result === null || result.length === 0) {
        return null;
    }
    const quote = result[0];

    // Get the insurer
    sql = `SELECT id, logo, name, rating FROM #__insurers WHERE id = ${quote.insurer}`;
    result = await queryDB(sql, `retrieving insurer ${quote.insurer}`);
    if (result === null || result.length === 0) {
        return null;
    }
    const insurer = result[0];

    switch (quote.aggregated_status) {
        case 'declined':
            return {
                id: quote.id,
                policy_type: quote.policy_type,
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
            const instantBuy = quote.aggregated_status === 'quoted';

            // Get the limits for the quote
            sql = `
				SELECT quoteLimits.id, quoteLimits.amount, limits.description
				FROM #__quote_limits AS quoteLimits
				LEFT JOIN #__limits AS limits ON limits.id = quoteLimits.limit
				WHERE quote = ${quote.id} ORDER BY quoteLimits.limit ASC;
			`;

            result = await queryDB(sql, `retrieving limits for quote ${quote.id}`);
            if (result === null || result.length === 0) {
                return null;
            }
            const quoteLimits = result;
            // Create the limits object
            const limits = {};
            quoteLimits.forEach((quoteLimit) => {
                // NOTE: frontend expects a string. -SF
                limits[quoteLimit.description] = `${quoteLimit.amount}`;
            });

            // Get the payment options for this insurer
            sql = `
				SELECT
					insurerPaymentPlans.premium_threshold,
					paymentPlans.id,
					paymentPlans.name,
					paymentPlans.description
				FROM #__insurer_payment_plans AS insurerPaymentPlans
				LEFT JOIN #__payment_plans AS paymentPlans ON paymentPlans.id = insurerPaymentPlans.payment_plan
				WHERE insurer = ${quote.insurer};
			`;
            result = await queryDB(sql, `retrieving payment plans for insurer ${quote.insurer}`);
            if (result === null || result.length === 0) {
                return null;
            }
            const paymentPlans = result;

            // Create the payment options object
            const paymentOptions = [];
            paymentPlans.forEach((pp) => {
                if (quote.amount > pp.premium_threshold) {
                    paymentOptions.push({
                        id: pp.id,
                        name: pp.name,
                        description: pp.description
                    });
                }
            });

            let quoteLetterContent = '';
            const quoteLetterName = quote.quote_letter;

            // If we have a quote letter then retrieve the file from our cloud storage service
            if (quoteLetterName) {
                // Get the file from our cloud storage service
                // TODO Secure
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
                id: quoteID,
                policy_type: quote.policy_type,
                amount: quote.amount,
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
    // needs to change for Mongo/uuid ID.
    // use createdAt Datetime instead.
    const sql = `
		SELECT id
		FROM #__quotes
		WHERE
			application = ${tokenPayload.applicationID}
			AND id > ${lastQuoteID}
		ORDER BY id ASC
    `;
    // Error Try???
    const result = await queryDB(sql, `retrieving quotes for application ${tokenPayload.applicationID}`);
    if (result === null) {
        log.warn(`Got no quotes from a finished App Quoting AppId ${tokenPayload.applicationID} ` + __location)
        //return next(serverHelper.internalError('Error retrieving quotes'));
    }
    const quotes = [];
    if (result && result.length > 0) {
        // Build the quote result for the frontend
        for (let i = 0; i < result.length; i++) {
            const quoteSummary = await createQuoteSummary(result[i].id);
            if (quoteSummary !== null) {
                quotes.push(quoteSummary);
            }
        }
    }

    res.send(200, {
        complete: complete,
        quotes: quotes
    });
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGet('Get quotes ', `${basePath}/quotes`, getQuotes);
};