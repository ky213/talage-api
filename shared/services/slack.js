/**
 * Send messages to our Slack API
 */

'use strict';

const http = require('http');

/**
 * Gets all questions that match the provided information for a business
 *
 * @param {string} channel -  The channel to which the message will be posted
 * @param {string} message_type -  The type of message to be sent (celebrate, ok, warning, or error)
 * @param {string} message - The message to be sent
 * @param {object} attachment - (optional) An object containing the details for an attachment. The available fields are:
 *		{int} application_id - (optional) The Talage ID for a single application. This generates a button that will link to the Application in our admin backend
 *		{array} fields - (optional) An array of objects each defining a single field to be shown in the message. The available fields are:
 *					{boolean} short - If true, the field will be placed on the same line as another short field
 *					{text} - The text of the field
 *					{title} - The title of the field
 *		{string} text - (optional) The text that will be printed in the body of the attachment
 *		{string} title - (optional) The title of the attachment
 * @returns {Promise.<array, Error>} A promise that returns an array of database results if resolved, or an Error if rejected
 */
module.exports = function (channel, message_type, message, attachment) {
	// Return a promise
	return new Promise((fullfil, reject) => {

		// If we are are running automated tests, do not send
		if (settings.NODE_ENV === 'test') {
			fullfil(true);
			return;
		}

		// Build the data object to be sent
		const data = JSON.stringify({
			'attachment': attachment,
			'channel': channel,
			'message': message,
			'message_type': message_type
		});

		// Set the options for connecting to the Question API
		const options = {
			'agent': false,
			'headers': {
				'Authorization': `Bearer ${settings.TEST_API_TOKEN}`,
				'Content-Length': data.length,
				'Content-Type': 'application/json'
			},
			'hostname': 'slack',
			'method': 'POST',
			'path': `/post-to-channel`
		};

		// Send the request
		const req = http.request(options, function (res) {
			let raw_data = '';

			// Grab each chunk of data
			res.on('data', function (d) {
				raw_data += d;
			});

			res.on('end', function () {
				if (res.statusCode === 200) {
					fullfil(true);
				} else {
					if (raw_data) {
						raw_data = JSON.parse(raw_data);
					}
					log.error(`Unable to send Slack message (${res.statusCode}${raw_data.message ? `: ${raw_data.message}` : ''})`);
					reject(new Error(false));
				}
			});
		});

		req.on('error', function (e) {
			log.error(`Unable to send Slack message (${e.message})`);
			reject(new Error(false));
		});

		req.write(data);
		req.end();
	});
};