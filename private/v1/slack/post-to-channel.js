'use strict';

const request = require('request');
const util = require('util');

/**
 * Responds to post requests for slack messages
 *
 * @param {object} req - Expects a message, channel, message_type
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns the state of the message (if it was sent)
 */
async function PostToChannel(req, res, next) {
	// Gifs for celebrations
	const celebration_gifs = [
		'https://media.giphy.com/media/87NS05bya11mg/giphy.gif',
		'https://media.giphy.com/media/Is1O1TWV0LEJi/giphy.gif',
		'https://media1.giphy.com/media/KYElw07kzDspaBOwf9/giphy.gif?cid=790b76115d01821f56734268639f05af&rid=giphy.gif',
		'https://media2.giphy.com/media/LSNqpYqGRqwrS/giphy.gif?cid=6104955e5d018f673361726555e333c3&rid=giphy.gif',
		'https://media2.giphy.com/media/l46CimW38a7TFxLVe/giphy.gif?cid=6104955e5d018f9151324e6c6b0967ce&rid=giphy.gif',
		'https://media1.giphy.com/media/doPrWYzSG1Vao/giphy-downsized.gif?cid=6104955e5d018fb36432454e49a53221&rid=giphy-downsized.gif',
		'https://media3.giphy.com/media/ZUomWFktUWpFu/giphy-downsized.gif?cid=6104955e5d018fc47055725849382e16&rid=giphy-downsized.gif',
		'https://media0.giphy.com/media/RDbZGZ3O0UmL6/giphy-downsized.gif?cid=6104955e5d018fdb6a44586e6377ac59&rid=giphy-downsized.gif',
		'https://media1.giphy.com/media/Hd3GXtH7xs1CU/giphy-downsized.gif?cid=6104955e5d018ff236386e6677d659d6&rid=giphy-downsized.gif',
		'https://media2.giphy.com/media/DKnMqdm9i980E/giphy-downsized.gif?cid=6104955e5d0190046772335245b4f4ce&rid=giphy-downsized.gif',
		'https://media1.giphy.com/media/yoJC2COHSxjIqadyZW/giphy-downsized.gif?cid=6104955e5d019016565733495910ed39&rid=giphy-downsized.gif',
		'https://media1.giphy.com/media/GStLeae4F7VIs/giphy-downsized.gif?cid=6104955e5d0190296876395951f16bcf&rid=giphy-downsized.gif',
		'https://media0.giphy.com/media/yCjr0U8WCOQM0/giphy-downsized.gif?cid=6104955e5d01903c4871482e4d0bea33&rid=giphy-downsized.gif',
		'https://media3.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy-downsized.gif?cid=6104955e5d01904e66456f4c6b06de66&rid=giphy-downsized.gif',
		'https://media1.giphy.com/media/6oMKugqovQnjW/giphy-downsized.gif?cid=6104955e5d019082477a37653674a7b0&rid=giphy-downsized.gif',
		'https://media3.giphy.com/media/18pjPEqqIt2k8/giphy-downsized.gif?cid=6104955e5d0190ad7133465645ff3a75&rid=giphy-downsized.gif',
		'https://media1.giphy.com/media/1PMVNNKVIL8Ig/giphy-downsized.gif?cid=6104955e5d0190d63249595249b97ea9&rid=giphy-downsized.gif',
		'https://media2.giphy.com/media/d2Z9QYzA2aidiWn6/giphy-downsized.gif?cid=6104955e5d0190f6644e62432eccf939&rid=giphy-downsized.gif',
		'https://media2.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy-downsized.gif?cid=6104955e5d01910a556f327241d4bd4a&rid=giphy-downsized.gif',
		'https://media3.giphy.com/media/ZKW68Qo3vvxss/giphy-downsized.gif?cid=6104955e5d0191174a7a5a35596aaffd&rid=giphy-downsized.gif',
		'https://media0.giphy.com/media/Afu7T2y2V7cdi/giphy-downsized.gif?cid=6104955e5d01912d484230496f22f4a2&rid=giphy-downsized.gif',
		'https://media3.giphy.com/media/Z6f7vzq3iP6Mw/giphy.gif?cid=6104955e5d01916d4c4f58367338e8e4&rid=giphy.gif',
		'https://media0.giphy.com/media/dkGhBWE3SyzXW/giphy-downsized.gif?cid=6104955e5d0191865a4544546f599cb9&rid=giphy-downsized.gif',
		'https://media2.giphy.com/media/em4i0bDs9Hm2Q/giphy-downsized.gif?cid=6104955e5d01919a34786c3836248656&rid=giphy-downsized.gif',
		'https://media3.giphy.com/media/xTiN0CNHgoRf1Ha7CM/giphy-downsized.gif?cid=6104955e5d0191e72f50624a6bbf73b7&rid=giphy-downsized.gif',
		'https://media3.giphy.com/media/5GoVLqeAOo6PK/giphy-downsized.gif?cid=6104955e5d0191fd305a52572eea9528&rid=giphy-downsized.gif',
		'https://media0.giphy.com/media/11sBLVxNs7v6WA/giphy-downsized.gif?cid=6104955e5d01920d6a394e6b631f6fd0&rid=giphy-downsized.gif',
		'https://media2.giphy.com/media/3oEduUGL2JaSK7oS76/giphy-downsized.gif?cid=6104955e5d0192214c6854764d8317a7&rid=giphy-downsized.gif',
		'https://media0.giphy.com/media/ckeHl52mNtoq87veET/giphy-downsized.gif?cid=6104955e5d01923169374e314d27f62d&rid=giphy-downsized.gif',
		'https://media3.giphy.com/media/NFgfxZFfMSylO/giphy.gif?cid=6104955e5d0192492f77756b73386c5f&rid=giphy.gif',
		'https://media3.giphy.com/media/MMQrQQ87G2MmY/giphy.gif?cid=6104955e5d0192795a45702f6ba0f598&rid=giphy.gif',
		'https://media3.giphy.com/media/EgkNhBeY289z2/giphy-downsized.gif?cid=6104955e5d01928f66554f573652ead9&rid=giphy-downsized.gif',
		'https://media0.giphy.com/media/DpB9NBjny7jF1pd0yt2/giphy-downsized.gif?cid=6104955e5d0192c06b4536424d84e0da&rid=giphy-downsized.gif',
		'https://media0.giphy.com/media/tsX3YMWYzDPjAARfeg/giphy-downsized.gif?cid=6104955e5d0192d95446473263468806&rid=giphy-downsized.gif',
		'https://media2.giphy.com/media/UO5elnTqo4vSg/giphy-downsized.gif?cid=6104955e5d01930a68663063734e6986&rid=giphy-downsized.gif',
		'https://media0.giphy.com/media/TcKmUDTdICRwY/giphy-downsized.gif?cid=6104955e5d0193472f7a594d454e10d5&rid=giphy-downsized.gif',
		'https://media3.giphy.com/media/nXxOjZrbnbRxS/giphy.gif?cid=6104955e5d01935f736b5651553fc70a&rid=giphy.gif',
		'https://media1.giphy.com/media/DffShiJ47fPqM/giphy-downsized.gif?cid=6104955e5d01936d4878687232537fe5&rid=giphy-downsized.gif',
		'https://media3.giphy.com/media/nFjDu1LjEADh6/giphy-downsized.gif?cid=6104955e5d0193d36f6152776f744be1&rid=giphy-downsized.gif',
		'https://media3.giphy.com/media/Dg0hzaN9wiEjS/giphy-downsized.gif?cid=6104955e5d0193ef5753647755aff9e9&rid=giphy-downsized.gif',
		'https://media2.giphy.com/media/dYZuqJLDVsWMLWyIxJ/giphy.gif?cid=6104955e5d0193fe4663694a32f00e0c&rid=giphy.gif',
		'https://media0.giphy.com/media/pa37AAGzKXoek/giphy.gif?cid=6104955e5d0194ca4f72334e518b8899&rid=giphy.gif',
		'https://media0.giphy.com/media/rjkJD1v80CjYs/giphy-downsized.gif?cid=6104955e5d0195f44767625273359962&rid=giphy-downsized.gif',
		'https://media1.giphy.com/media/5wWf7H0WTquIU1DFY4g/giphy.gif?cid=6104955e5d01960a536f327559921e54&rid=giphy.gif',
		'https://media2.giphy.com/media/10UtqJNULHPfxe/giphy-downsized.gif?cid=6104955e5d0197766f6549712eb7666a&rid=giphy-downsized.gif',
		'https://media2.giphy.com/media/10UtqJNULHPfxe/giphy-downsized.gif?cid=6104955e5d0197766f6549712eb7666a&rid=giphy-downsized.gif',
		'https://media2.giphy.com/media/Ge86XF8AVY1KE/giphy.gif?cid=6104955e5d0197a7427874444d5b17f7&rid=giphy.gif',
		'https://media1.giphy.com/media/cEYFeDB8PpXqYekMuPK/giphy-downsized.gif?cid=6104955e5d01a7cc4d647764591a19f6&rid=giphy-downsized.gif',
		'https://media0.giphy.com/media/3EfgWHj0YIDrW/giphy-downsized.gif?cid=6104955e5d01a830584c706649339ebf&rid=giphy-downsized.gif',
		'https://media2.giphy.com/media/yoJC2GnSClbPOkV0eA/giphy.gif?cid=6104955e5d01a8452e45577263cd5eb0&rid=giphy.gif',
		'https://media1.giphy.com/media/fGU4lCGuH1sSffgNIE/giphy.gif?cid=6104955e5d01a9b873356c3345f4fa57&rid=giphy.gif',
		'https://media2.giphy.com/media/8rFgzA7aBR0aomiOMj/giphy-downsized.gif?cid=6104955e5d01a9ed466b767a2e0a685e&rid=giphy-downsized.gif',
		'https://media1.giphy.com/media/3oEdv3F6gzBh8diueA/giphy-downsized.gif?cid=6104955e5d01aa146d38713551f4bf1d&rid=giphy-downsized.gif',
		'https://media3.giphy.com/media/RgfGmnVvt8Pfy/giphy-tumblr.gif?cid=6104955e5d01ab00324f3272777c472e&rid=giphy-tumblr.gif',
		'https://media0.giphy.com/media/6fScAIQR0P0xW/giphy-downsized.gif?cid=6104955e5d01ab394d30352e5983fd96&rid=giphy-downsized.gif'

	];

	// Default message data
	let icon_emoji = ':male_mage:';
	const username = 'Slack API';
	let color = '#000000';
	let fallback_text = '';
	let footer = '';
	let button_style = 'default';
	const response_messages = {};

	// Type sanitization
	const valid_message_types = ['celebrate',
		'okay',
		'ok',
		'warning',
		'attention',
		'error'];

	const valid_channels = ['#live_chat',
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
		'#where-am-i'];


	if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
		log.warn('No data was received');
		res.send(400, {
			'error': true,
			'message': 'No data was received'
		});
		return next(ServerBadRequestError('No data was received'));
	}

	log.verbose(util.inspect(req.body));

	// Validate Channel
	if (req.body.channel) {

		req.body.channel = req.body.channel.toLowerCase();

		if (req.body.channel.charAt(0) !== '#') {
			req.body.channel = `#${req.body.channel}`; // Add # to beginning of channel
		}

		if (!/^#[a-z_-]{1,22}$/.test(req.body.channel)) {
			log.warn(`Channel ${req.body.channel} is not valid`);
			res.send(400, {
				'channel': `Channel ${req.body.channel} is not valid`,
				'error': true
			});

			return next(ServerBadRequestError(`Channel ${req.body.channel} is not valid`));
		}


		if (!valid_channels.includes(req.body.channel)) {
			log.warn(`Invalid channel: ${req.body.channel}. Defaulted to #debug`);
			response_messages.invalid_channel = `Invalid channel: ${req.body.channel}. Defaulted to #debug`;
			req.body.channel = '#debug';
		}


	} else {
		log.warn('Missing property: channel. Defaulted to #debug.');
		response_messages.missing_channel = 'Missing Property: channel. Defaulted to #debug.';
		footer = '*A channel was not provided with this message*';
		req.body.channel = '#debug';
	}


	if (req.body.message_type) {

		req.body.message_type = req.body.message_type.toLowerCase();

		if (!/^[a-z]{1,10}$/.test(req.body.message_type)) {
			log.warn(`Message type ${req.body.message_type} is not valid`);

			const response = {
				'error': true,
				'message_type': `Message type ${req.body.message_type} is not valid`
			};

			res.send(400, Object.assign(response, response_messages));
		}

		if (!valid_message_types.includes(req.body.message_type)) {
			log.warn(`Invalid message_type: ${req.body.message_type}. Message still sent to slack.`);
			response_messages.invalid_message_type = `Invalid message_type: ${req.body.message_type}. Message still sent to slack.`;
		}

		// Figure out colors and message type
		switch (req.body.message_type) {
			case 'celebrate':
				button_style = 'primary';
				color = '#0000FF';
				icon_emoji = ':tada:';
				break;
			case 'ok': case 'okay':
				button_style = 'primary';
				color = '#00FF00';
				icon_emoji = ':ok_hand:';
				break;
			case 'warning':
				button_style = 'danger';
				color = '#FFFF00';
				icon_emoji = ':warning:';
				break;
			case 'attention':
				button_style = 'danger';
				color = '#FF0000';
				icon_emoji = ':x:';
				break;
			case 'error':
				button_style = 'danger';
				color = '#FF0000';
				icon_emoji = ':skull_and_crossbones:';
				break;
			default:
				break; // Everything has a default value already. See variable declarations
		}
	} else {
		log.warn('Missing property: message_type');
		response_messages.missing_message_type = 'Missing property: message_type';
	}


	// Message
	if (req.body.message) {

		if (typeof req.body.message !== 'string') {
			log.warn('Message must be given as a string');

			const response = {
				'error': true,
				'message': 'Message must be a string'
			};

			res.send(400, Object.assign(response, response_messages));

			return next(ServerBadRequestError('Message must be given as a string'));
		}

	} else {
		log.warn('Missing property: message');

		const response = {
			'error': true,
			'message': 'Missing property: message'
		};

		res.send(400, Object.assign(response, response_messages));

		return next(ServerBadRequestError('Missing property: message'));
	}

	if (req.body.attachment) {

		if (req.body.attachment.title && typeof req.body.attachment.title !== 'string') {
			log.warn('Attachment title must be given as a string');

			const response = {
				'error': true,
				'message': 'Attachment title must be given as a string'
			};

			res.send(400, Object.assign(response, response_messages));

			return next(ServerBadRequestError('Attachment title must be given as a string'));
		}

		if (req.body.attachment.text && typeof req.body.attachment.text !== 'string') {
			log.warn('Attachment text must be given as a string');

			const response = {
				'error': true,
				'message': 'Attachment text must be given as a string'
			};

			res.send(400, Object.assign(response, response_messages));

			return next(ServerBadRequestError('Attachment text must be given as a string'));
		}


		// Attachment_fields sanitization
		if (req.body.attachment.fields) {
			if (typeof req.body.attachment.fields instanceof Array) {
				log.warn('Attachment Fields must be given as an array of JSON objects');

				const response = {
					'Attachment Fields': 'Attachment Fields must be given as an array of JSON objects',
					'error': true
				};

				res.send(400, Object.assign(response, response_messages));

				return next(ServerBadRequestError('Attachment Fields must be given as an array of JSON objects'));
			}

			if (!req.body.attachment.fields.length) {
				log.warn('Attachment Fields must have at least one object');
				response_messages.empty_fields = 'Attachment Fields must have at least one object';
			}

			// Indexes are used so they can be given back to the user if something goes wrong
			for (let i = 0; i < req.body.attachment.fields.length; ++i) {
				if (!req.body.attachment.fields[i].title) {
					log.warn(`The field at index ${i} is missing title`);
					const response = {
						'Attachment Fields': `The field at index ${i} is missing title`,
						'error': true
					};

					res.send(400, Object.assign(response, response_messages));

					return next(ServerBadRequestError(`The field at index ${i} is missing title`));
				}

				if (!req.body.attachment.fields[i].value) {
					log.warn(`The attachment field at index ${i} is missing value`);

					const response = {
						'Attachment Fields': `The attachment field at index ${i} is missing value`,
						'error': true
					};

					res.send(400, Object.assign(response, response_messages));

					return next(ServerBadRequestError(`The field at index ${i} is missing value`));
				}

				if (req.body.attachment.fields[i].short) {
					if (typeof req.body.attachment.fields[i].short === 'string') {
						if (req.body.attachment.fields[i].short === 'true') {
							req.body.attachment.fields[i].short = true;
						} else if (req.body.attachment.fields[i].short === 'false') {
							req.body.attachment.fields[i].short = false;
						} else {
							log.warn(`The attachment field at index ${i} has short that is not true or false`);

							const response = {
								'Attachment Fields': `The field at index ${i} has short that is not true or false`,
								'error': true
							};

							res.send(400, Object.assign(response, response_messages));

							return next(ServerBadRequestError(`The field at index ${i} has short that is not true or false`));
						}
					} else if (typeof req.body.attachment.fields[i].short !== 'boolean') {
						log.warn(`The attachment field at index ${i} has short that is not a boolean`);

						const response = {
							'Attachment Fields': `The field at index ${i} has short that is not a boolean`,
							'error': true
						};

						res.send(400, Object.assign(response, response_messages));

						return next(ServerBadRequestError(`The field at index ${i} has short that is not a boolean`));
					}
				}
			}

		}
	}

	// App ID sanitization
	if (req.body.attachment && req.body.attachment.application_id && !/^\d{3,5}$/.test(req.body.attachment.application_id)) {
		log.warn(`Application id ${req.body.attachment.application_id} is not valid`);

		const response = {
			'Application id': `Application id ${req.body.attachment.application_id} is not valid`,
			'error': true
		};

		res.send(400, Object.assign(response, response_messages));

		return next(ServerBadRequestError(`Application id ${req.body.attachment.application_id} is not valid`));
	}

	// Add a message for testing
	if (settings.ENV !== 'production' && req.body.channel !== '#debug') {
		footer = `*In production this would be sent to the ${req.body.channel} channel*`;
		req.body.channel = '#debug';
	}

	// Create fallback text
	fallback_text = req.body.message;
	if (fallback_text.indexOf('ALL quotes') !== -1) {
		fallback_text = `${req.body.attachment.text} and received ALL quotes`;
	} else if (fallback_text.indexOf('SOME quotes') !== -1) {
		fallback_text = `${req.body.attachment.text} and received SOME quotes`;
	} else if (fallback_text.indexOf('NO quotes') !== -1) {
		fallback_text = `${req.body.attachment.text} and received NO quotes`;
	}

	const post_data = {
		'attachments': [{
			'actions': [],
			'color': color,
			'fallback': fallback_text
		}],
		'channel': req.body.channel, // Defaults to debug in above check
		'icon_emoji': icon_emoji,
		'username': username
	};

	if (req.body.attachment && req.body.attachment.application_id) {
		let url = `https://${settings.SITE_URL}/administrator/index.php?option=com_talage&view=application&layout=edit&id=${req.body.attachment.application_id}`;

		post_data.attachments[0].actions.push({
			'style': button_style,
			'text': 'View Application',
			'type': 'button',
			'url': url
		});
	}

	if (req.body.attachment && req.body.attachment.text) {
		post_data.attachments[0].pretext = req.body.message;
		post_data.attachments[0].text = req.body.attachment.text;
	} else {
		post_data.attachments[0].text = req.body.message;
	}


	// Add the message to the 'title' of the message and add fields to the body of the message
	if (req.body.attachment) {

		if (req.body.attachment.fields) {
			post_data.attachments[0].fields = req.body.attachment.fields;
		}
		if (req.body.attachment.title) {
			post_data.attachments[0].title = req.body.attachment.title;
		}
	}

	if (req.body.message_type === 'celebrate') {
		post_data.attachments[0].image_url = celebration_gifs[Math.floor(Math.random() * celebration_gifs.length)];
	}

	// Add footer if it exists
	if (footer !== '') {
		post_data.attachments[0].footer = footer;
	}

	log.info(`Post data: ${util.inspect(post_data)}`);
	await request.post('https://hooks.slack.com/services/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', { 'json': post_data }, (error, slackRes, body) => {
		if (error) {
			log.error(error);
			res.send(error.statusCode, {
				'body': body,
				'error': true,
				'status': error.statusCode
			});
		} else {
			log.info(`statusCode: ${slackRes.statusCode}`);
			log.info(`body: ${body}`);
			const response = {
				'body': body,
				'error': Object.keys(response_messages).length !== 0,
				'message': 'Message sent',
				'status': 200
			};

			res.send(200, Object.assign(response, response_messages));
		}
	});
	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath) => {
	ServerAddPost('Post message', basePath + '/post-to-channel', PostToChannel);
};