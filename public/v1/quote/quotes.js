'use strict';

// const util = require('util');
// const Application = require('./helpers/models/Application.js');
const jwt = require('jsonwebtoken');
const serverHelper = require('../../../server.js');

async function queryDB(sql, queryDescription) {
	let result = null;
	try {
		result = await db.query(sql);
	} catch (error) {
		log.error(`ERROR: ${queryDescription}: ${error} ${location}`);
		return null;
	}
	return result;
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
		console.log('missing token');
		return next(serverHelper.requestError('Missing parameters.'));
	}
	let tokenPayload = null;
	try {
		tokenPayload = jwt.verify(req.query.token, global.settings.AUTH_SECRET_KEY);
	} catch (error) {
		console.log('expired token');
		return next(serverHelper.invalidCredentialsError('Expired token.'));
	}

	// Set the last quote ID retrieved
	let lastQuoteID = 0;
	if (req.query.after) {
		lastQuoteID = req.query.after;
	}
	console.log('lastQuoteID', lastQuoteID);

	// Retrieve quotes newer than the last quote ID
	let sql = `
		SELECT id, amount, policy_type
		FROM clw_talage_quotes
		WHERE
			application = ${tokenPayload.applicationID}
			AND id > ${lastQuoteID}
	`;
	let result = await queryDB(sql, `retrieving quotes for application ${tokenPayload.applicationID}`);
	if (result === null) {
		return next(serverHelper.internalError('Error retrieving quotes'));
	}

	// If there are not any newer quotes, check if we are complete
	if (result.length === 0) {
		sql = `
			SELECT progress
			FROM clw_talage_application_quote_progress
			WHERE id = ${tokenPayload.applicationQuoteProgressID}
		`;
		result = await queryDB(sql, `retrieving quote progress for application quote progress ${tokenPayload.applicationQuoteProgressID}`);
		if (result === null) {
			return next(serverHelper.internalError('Error retrieving quote progress'));
		}
		if (result[0].progress === 'complete') {
			res.send(200, { complete: true });
			return next();
		}
	}

	// Get the insurer for this quote

	const quotes = [];
	// Build the quote result for the frontend
	result.forEach((q) => {
		const newQuote = {
			id: q.id,
			policy_type: q.policy_type
		};
		if (q.amount !== null) {
			newQuote['amount'] = q.amount;
		} else {
			newQuote['message'] = `Declined to quote`;
		}
		quotes.push(newQuote);
	});

	// quote: {
	// 	amount: amount,
	// 	id: quotes.length + 1,
	// 	instant_buy: Math.random() >= 0.5,
	// 	insurer: {
	// 		id: insurer.id,
	// 		logo: `${global.settings.SITE_URL}/${insurer.logo}`,
	// 		name: insurer.name,
	// 		rating: insurer.rating
	// 	},
	// 	limits: limits,
	// 	payment_options: payment_options,
	// 	policy_type: policy.type
	// }

	res.send(200, quotes);
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGet('Get quotes ', `${basePath}/quotes`, getQuotes);
};
