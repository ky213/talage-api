'use strict';

const http = require('http');
const serverHelper = require('../../server.js');

/**
 * Gets all questions that match the provided information for a business
 *
 * @param {array} activity_codes - An array containing activity codes
 * @param {int} industry_code - A Talage industry code ID
 * @param {array} zip_codes - The postal code of each location of the business
 * @param {array} policy_types - A list of policy types
 * @param {array} ins - A list of Talage insurer IDs
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
module.exports = function (activity_codes, industry_code, zip_codes, policy_types, ins) {
	// Insurers are not always needed, parse them out, and if there are none, leave it blank
	let insurers = '';
	if (ins) {
		insurers = `&insurers=${ins.join(',')}`;
	}

	// Return a promise
	return new Promise((fullfil, reject) => {
		// Set the options for connecting to the Question API
		const options = {
			'agent': false,
			'headers': { 'Authorization': `Bearer ${settings.TEST_API_TOKEN}` },
			'hostname': `localhost`,
			'port': settings.PUBLIC_API_PORT,
			'method': 'GET',
			'path': `/v1/question/list?activity_codes=${activity_codes.join(',')}&industry_code=${industry_code}${insurers}&policy_types=${policy_types.join(',')}&zips=${zip_codes.join(',')}&hidden=true`
		};

		// Send the request
		const req = http.request(options, function (res) {
			let raw_data = '';

			// Grab each chunk of data
			res.on('data', function (d) {
				raw_data += d;
			});

			res.on('end', function () {
				if (raw_data) {
					raw_data = JSON.parse(raw_data);
				}
				if (res.statusCode === 200) {

					// Let's do some cleanup to avoid confusion
					if (raw_data && typeof raw_data === 'object') {
						raw_data.forEach((question) => {
							question.possible_answers = {};
							if (Object.prototype.hasOwnProperty.call(question, 'answers')) {
								question.answers.forEach((answer) => {
									question.possible_answers[parseInt(answer.id, 10)] = answer;
								});
								delete question.answers;
							}
						});
					}

					fullfil(raw_data);
				} else {
					log.warn(`Unable to connect to Question API (${res.statusCode}${raw_data.message ? `: ${raw_data.message}` : ''})`);
					reject(serverHelper.InternalError('Unable to connect to Question API.'));
				}
			});
		});

		req.on('error', function (e) {
			log.error(e.message);
			reject(serverHelper.InternalError('Unable to connect to Question API'));
		});

		req.end();
	});
};