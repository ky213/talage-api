'use strict';

const util = require('util');
const serverHelper = global.requireRootPath('server.js');
const slackSvc = global.requireShared('./services/slacksvc.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

/**
 * Responds to post requests for slack messages
 *
 * @param {object} req - Expects a message, channel, message_type
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns the state of the message (if it was sent)
 */
async function postToChannel(req, res, next){
	// Default message data
	const response_messages = {};

	// Type sanitization
	const valid_message_types = ['celebrate',
'okay',
'ok',
'warning',
'attention',
'error'];

	const valid_channels = [
		'#live_chat',
		'#marketing',
		'#alerts',
		'#bugs',
		'#customer_success',
		'#debug',
		'#development',
		'#food-and-drink',
		'#general',
		'#git',
		'#in-the-news',
		'#suggestion_box',
		'#where-am-i'
	];

	if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0){
		log.warn('No data was received' + __location);
		res.send(400, {
			"error": true,
			"message": 'No data was received'
		});
		return next(serverHelper.badRequestError('No data was received'));
	}

	log.verbose(util.inspect(req.body) + __location);

	// Validate Channel
	if (req.body.channel){
		req.body.channel = req.body.channel.toLowerCase();

		if (req.body.channel.charAt(0) !== '#'){
			req.body.channel = `#${req.body.channel}`; // Add # to beginning of channel
		}

		if (!/^#[a-z_-]{1,22}$/.test(req.body.channel)){
			log.warn(`Channel ${req.body.channel} is not valid` + __location);
			res.send(400, {
				"channel": `Channel ${req.body.channel} is not valid`,
				"error": true
			});

			return next(serverHelper.badRequestError(`Channel ${req.body.channel} is not valid`));
		}

		if (!valid_channels.includes(req.body.channel)){
			log.warn(`Invalid channel: ${req.body.channel}. Defaulted to #debug` + __location);
			response_messages.invalid_channel = `Invalid channel: ${req.body.channel}. Defaulted to #debug`;
			req.body.channel = '#debug';
		}
	}
 else {
		log.warn('Missing property: channel. Defaulted to #debug.' + __location);
		response_messages.missing_channel = 'Missing Property: channel. Defaulted to #debug.';
		req.body.channel = '#debug';
	}

	if (req.body.message_type){
		req.body.message_type = req.body.message_type.toLowerCase();

		if (!/^[a-z]{1,10}$/.test(req.body.message_type)){
			log.warn(`Message type ${req.body.message_type} is not valid` + __location);

			const response = {
				"error": true,
				"message_type": `Message type ${req.body.message_type} is not valid`
			};

			res.send(400, Object.assign(response, response_messages));
		}

		if (!valid_message_types.includes(req.body.message_type)){
			log.warn(`Invalid message_type: ${req.body.message_type}. Message still sent to slack.` + __location);
			response_messages.invalid_message_type = `Invalid message_type: ${req.body.message_type}. Message still sent to slack.`;
		}
	}
 else {
		log.warn('Missing property: message_type' + __location);
		response_messages.missing_message_type = 'Missing property: message_type';
	}

	// Message
	if (req.body.message){
		if (typeof req.body.message !== 'string'){
			log.warn('Message must be given as a string' + __location);

			const response = {
				"error": true,
				"message": 'Message must be a string'
			};

			res.send(400, Object.assign(response, response_messages));
			return next(serverHelper.badRequestError('Message must be given as a string'));
		}
	}
 else {
		log.warn('Missing property: message' + __location);

		const response = {
			"error": true,
			"message": 'Missing property: message'
		};

		res.send(400, Object.assign(response, response_messages));

		return next(serverHelper.badRequestError('Missing property: message'));
	}

	if (req.body.attachment){
		if (req.body.attachment.title && typeof req.body.attachment.title !== 'string'){
			log.warn('Attachment title must be given as a string');

			const response = {
				"error": true,
				"message": 'Attachment title must be given as a string'
			};

			res.send(400, Object.assign(response, response_messages));

			return next(serverHelper.badRequestError('Attachment title must be given as a string'));
		}

		if (req.body.attachment.text && typeof req.body.attachment.text !== 'string'){
			log.warn('Attachment text must be given as a string' + __location);

			const response = {
				"error": true,
				"message": 'Attachment text must be given as a string'
			};

			res.send(400, Object.assign(response, response_messages));

			return next(serverHelper.badRequestError('Attachment text must be given as a string'));
		}

		// Attachment_fields sanitization
		if (req.body.attachment.fields){
			if (typeof req.body.attachment.fields instanceof Array){
				log.warn('Attachment Fields must be given as an array of JSON objects' + __location);

				const response = {
					'Attachment Fields': 'Attachment Fields must be given as an array of JSON objects',
					"error": true
				};

				res.send(400, Object.assign(response, response_messages));

				return next(serverHelper.badRequestError('Attachment Fields must be given as an array of JSON objects'));
			}

			if (!req.body.attachment.fields.length){
				log.warn('Attachment Fields must have at least one object' + __location);
				response_messages.empty_fields = 'Attachment Fields must have at least one object';
			}

			// Indexes are used so they can be given back to the user if something goes wrong
			for (let i = 0; i < req.body.attachment.fields.length; ++i){
				if (!req.body.attachment.fields[i].title){
					log.warn(`The field at index ${i} is missing title` + __location);
					const response = {
						'Attachment Fields': `The field at index ${i} is missing title`,
						"error": true
					};

					res.send(400, Object.assign(response, response_messages));

					return next(serverHelper.badRequestError(`The field at index ${i} is missing title`));
				}

				if (!req.body.attachment.fields[i].value){
					log.warn(`The attachment field at index ${i} is missing value` + __location);

					const response = {
						'Attachment Fields': `The attachment field at index ${i} is missing value`,
						"error": true
					};

					res.send(400, Object.assign(response, response_messages));

					return next(serverHelper.badRequestError(`The field at index ${i} is missing value`));
				}

				if (req.body.attachment.fields[i].short){
					if (typeof req.body.attachment.fields[i].short === 'string'){
						if (req.body.attachment.fields[i].short === 'true'){
							req.body.attachment.fields[i].short = true;
						}
 else if (req.body.attachment.fields[i].short === 'false'){
							req.body.attachment.fields[i].short = false;
						}
 else {
							log.warn(`The attachment field at index ${i} has short that is not true or false` + __location);

							const response = {
								'Attachment Fields': `The field at index ${i} has short that is not true or false`,
								"error": true
							};

							res.send(400, Object.assign(response, response_messages));

							return next(serverHelper.badRequestError(`The field at index ${i} has short that is not true or false`));
						}
					}
 else if (typeof req.body.attachment.fields[i].short !== 'boolean'){
						log.warn(`The attachment field at index ${i} has short that is not a boolean` + __location);

						const response = {
							'Attachment Fields': `The field at index ${i} has short that is not a boolean`,
							"error": true
						};

						res.send(400, Object.assign(response, response_messages));

						return next(serverHelper.badRequestError(`The field at index ${i} has short that is not a boolean`));
					}
				}
			}
		}
	}

	// App ID sanitization
	if (req.body.attachment && req.body.attachment.application_id && !/^\d{3,5}$/.test(req.body.attachment.application_id)){
		log.warn(`Application id ${req.body.attachment.application_id} is not valid` + __location);

		const response = {
			'Application id': `Application id ${req.body.attachment.application_id} is not valid`,
			"error": true
		};

		res.send(400, Object.assign(response, response_messages));

		return next(serverHelper.badRequestError(`Application id ${req.body.attachment.application_id} is not valid`));
	}

	if (!slackSvc){
		log.error('bad slackSvc reference' + __location);
	}
	const slackResp = await slackSvc.send2SlackJSON(req.body).catch(function(err){
		log.error(err + __location);
		const respbody = {
			"error": true,
			"body": err,
			"status": err.statusCode
		};
		res.send(err.statusCode, respbody);
	});
	if (slackResp){
		const response = {
			"body": slackResp,
			"error": Object.keys(response_messages).length !== 0,
			"message": 'Message sent',
			"status": 200
		};
		res.send(200, Object.assign(response, response_messages));
	}
 else {
		const response = {
			"error": Object.keys(response_messages).length !== 0,
			"message": 'Message sent',
			"status": 200
		};
		res.send(200, Object.assign(response, response_messages));
	}

	// await request.post('https://hooks.slack.com/services/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', {'json': post_data}, (error, slackRes, body) => {
	// 	if(error){
	// 		log.error(error);
	// 		res.send(error.statusCode, {
	// 			'body': body,
	// 			'error': true,
	// 			'status': error.statusCode
	// 		});
	// 	}else{
	// 		log.info(`statusCode: ${slackRes.statusCode}`);
	// 		log.info(`body: ${body}`);
	// 		const response = {
	// 			'body': body,
	// 			'error': Object.keys(response_messages).length !== 0,
	// 			'message': 'Message sent',
	// 			'status': 200
	// 		};

	// 		res.send(200, Object.assign(response, response_messages));
	// 	}
	// });
	return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Post message', `${basePath}/post-to-channel`, postToChannel);
};