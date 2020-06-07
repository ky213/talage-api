/**
 * Send messages to our Slack API
 */

'use strict';

const request = require('request');
const util = require('util');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('/helpers/tracker.js');

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
 * @returns {boolean} for success state
 */
exports.send = async function(channel, message_type, message, attachment){
	// Return a promise
	// moving to right be for POST to slack.
	// If we are are running automated tests, do not send
	// if(global.settings.ENV === 'test'){
	// 	return true;
	// }

	// Build the data object to be sent
	const slackData = {
		'attachment': attachment,
		'channel': channel,
		'message': message,
		'message_type': message_type
	};

	// Send the request

	const slackResp = await send2SlackInternal(slackData).catch(function(err){
		log.error("Sending to Slack error: " + err + __location)
		return false;
	});

	return slackResp;
};


exports.send2SlackJSON = async function(slackReqJSON){

	const resp = await send2SlackInternal(slackReqJSON).catch(function(err){
		throw err;
	});

	return resp;
}

var send2SlackInternal = async function(slackReqJSON){

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


	if(!slackReqJSON || typeof slackReqJSON !== 'object' || Object.keys(slackReqJSON).length === 0){
		log.error('send2SlackInternal No data was received' + __location);
		throw new Error('send2SlackInternal No data was received');
	}

	log.verbose(util.inspect(slackReqJSON) + __location);

	// Validate Channel
	if(slackReqJSON.channel){

		slackReqJSON.channel = slackReqJSON.channel.toLowerCase();

		if(slackReqJSON.channel.charAt(0) !== '#'){
			slackReqJSON.channel = `#${slackReqJSON.channel}`; // Add # to beginning of channel
		}

		if(!/^#[a-z_-]{1,22}$/.test(slackReqJSON.channel)){
			log.error(`Channel ${slackReqJSON.channel} is not valid`);
			throw new Error(`Channel ${slackReqJSON.channel} is not valid`);
		}


		if(!valid_channels.includes(slackReqJSON.channel)){
			log.warn(`Invalid channel: ${slackReqJSON.channel}. Defaulted to #debug` + __location);
			response_messages.invalid_channel = `Invalid channel: ${slackReqJSON.channel}. Defaulted to #debug`;
			slackReqJSON.channel = '#debug';
		}


	}
	else{
		log.warn('Missing property: channel. Defaulted to #debug.' + __location);
		response_messages.missing_channel = 'Missing Property: channel. Defaulted to #debug.';
		footer = '*A channel was not provided with this message*';
		slackReqJSON.channel = '#debug';
	}


	if(slackReqJSON.message_type){

		slackReqJSON.message_type = slackReqJSON.message_type.toLowerCase();

		if(!/^[a-z]{1,10}$/.test(slackReqJSON.message_type)){
			log.error(`send2SlackInternal: Message type ${slackReqJSON.message_type} is not valid` + __location);
			throw new Error(`Message type ${slackReqJSON.message_type} is not valid`);
		}

		if(!valid_message_types.includes(slackReqJSON.message_type)){
			log.warn(`send2SlackInternal: Invalid message_type: ${slackReqJSON.message_type}. Message still sent to slack.` + __location);
			response_messages.invalid_message_type = `Invalid message_type: ${slackReqJSON.message_type}. Message still sent to slack.`;
		}

		// Figure out colors and message type
		switch(slackReqJSON.message_type){
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
	}
	else{
		log.warn('send2SlackInternal: Missing property: message_type' + __location);
		response_messages.missing_message_type = 'Missing property: message_type';
	}


	// Message
	if(slackReqJSON.message){

		if(typeof slackReqJSON.message !== 'string'){
			log.error('send2SlackInternal: Message must be given as a string' + __location);
			throw new Error('Message must be a string');
		}

	}
	else{
		log.error('send2SlackInternal: Missing property: message' + __location);
		throw new Error('Missing property: message');
	}

	if(slackReqJSON.attachment){

		if(slackReqJSON.attachment.title && typeof slackReqJSON.attachment.title !== 'string'){
			log.error('send2SlackInternal: Attachment title must be given as a string' + __location);
			throw new Error('Attachment title must be given as a string');
		}

		if(slackReqJSON.attachment.text && typeof slackReqJSON.attachment.text !== 'string'){
			log.error('send2SlackInternal: Attachment text must be given as a string' + __location);

			throw new Error('Attachment text must be given as a string');
		}


		// Attachment_fields sanitization
		if(slackReqJSON.attachment.fields){
			if(typeof slackReqJSON.attachment.fields instanceof Array){
				log.error('send2SlackInternal: Attachment Fields must be given as an array of JSON objects' + __location);

				throw new Error('Attachment Fields must be given as an array of JSON objects');
			}

			if(!slackReqJSON.attachment.fields.length){
				log.warn('send2SlackInternal: Attachment Fields must have at least one object' + __location);
				response_messages.empty_fields = 'Attachment Fields must have at least one object';
			}

			// Indexes are used so they can be given back to the user if something goes wrong
			for(let i = 0; i < slackReqJSON.attachment.fields.length; ++i){
				if(!slackReqJSON.attachment.fields[i].title){
					log.error(`send2SlackInternal: The field at index ${i} is missing title` + __location);
					throw new Error(`The field at index ${i} is missing title`);
				}

				if(!slackReqJSON.attachment.fields[i].value){
					log.error(`send2SlackInternal: The attachment field at index ${i} is missing value` + __location);
					throw new Error(`The attachment field at index ${i} is missing value`);
				}

				if(slackReqJSON.attachment.fields[i].short){
					if(typeof slackReqJSON.attachment.fields[i].short === 'string'){
						if(slackReqJSON.attachment.fields[i].short === 'true'){
							slackReqJSON.attachment.fields[i].short = true;
						}
						else if(slackReqJSON.attachment.fields[i].short === 'false'){
							slackReqJSON.attachment.fields[i].short = false;
						}
						else{
							log.error(`send2SlackInternal: he attachment field at index ${i} has short that is not true or false` + __location);
							throw new Error(`The attachment field at index ${i} has short that is not true or false`);
						}
					}
					else if(typeof slackReqJSON.attachment.fields[i].short !== 'boolean'){
						log.error(`send2SlackInternal: The attachment field at index ${i} has short that is not a boolean` + __location);
						throw new Error(`The attachment field at index ${i} has short that is not a boolean`);
					}
				}
			}

		}
	}

	// App ID sanitization
	if(slackReqJSON.attachment && slackReqJSON.attachment.application_id && !/^\d{3,5}$/.test(slackReqJSON.attachment.application_id)){
		log.error(`send2SlackInternal: Application id ${slackReqJSON.attachment.application_id} is not valid` + __location);
		throw new Error(`Application id ${slackReqJSON.attachment.application_id} is not valid`);

	}

	// Add a message for testing
	if(global.settings.ENV !== 'production' && slackReqJSON.channel !== '#debug'){
		footer = `*In production this would be sent to the ${slackReqJSON.channel} channel*, From: ${global.settings.ENV} `;
		slackReqJSON.channel = '#debug';
	}

	// Create fallback text
	fallback_text = slackReqJSON.message;
	if(fallback_text.indexOf('ALL quotes') !== -1){
		fallback_text = `${slackReqJSON.attachment.text} and received ALL quotes`;
	}
	else if(fallback_text.indexOf('SOME quotes') !== -1){
		fallback_text = `${slackReqJSON.attachment.text} and received SOME quotes`;
	}
	else if(fallback_text.indexOf('NO quotes') !== -1){
		fallback_text = `${slackReqJSON.attachment.text} and received NO quotes`;
	}

	const post_data = {
		'attachments': [{
			'actions': [],
			'color': color,
			'fallback': fallback_text
		}],
		'channel': slackReqJSON.channel, // Defaults to debug in above check
		'icon_emoji': icon_emoji,
		'username': username
	};

	if(slackReqJSON.attachment && slackReqJSON.attachment.application_id){
		const url = `https://${global.settings.SITE_URL}/administrator/index.php?option=com_talage&view=application&layout=edit&id=${slackReqJSON.attachment.application_id}`;

		post_data.attachments[0].actions.push({
			'style': button_style,
			'text': 'View Application',
			'type': 'button',
			'url': url
		});
	}

	// For alerts and debug channels all instance info
	log.info(`slackReqJSON.channel: ${slackReqJSON.channel}`);
	if(slackReqJSON.channel === '#debug' || slackReqJSON.channel === '#alerts'){
		if(process.env.HOSTNAME && process.env.INSTANCE_ID){
			footer = `${footer} HOSTNAME: ${process.env.HOSTNAME} INSTANCE: ${process.env.INSTANCE_ID}`;
		}
	}

	if(slackReqJSON.attachment && slackReqJSON.attachment.text){
		post_data.attachments[0].pretext = slackReqJSON.message;
		post_data.attachments[0].text = slackReqJSON.attachment.text;
	}
	else{
		post_data.attachments[0].text = slackReqJSON.message;
	}


	// Add the message to the 'title' of the message and add fields to the body of the message
	if(slackReqJSON.attachment){

		if(slackReqJSON.attachment.fields){
			post_data.attachments[0].fields = slackReqJSON.attachment.fields;
		}
		if(slackReqJSON.attachment.title){
			post_data.attachments[0].title = slackReqJSON.attachment.title;
		}
	}

	if(slackReqJSON.message_type === 'celebrate'){
		post_data.attachments[0].image_url = celebration_gifs[Math.floor(Math.random() * celebration_gifs.length)];
	}

	// Add footer if it exists
	if(footer !== ''){
		post_data.attachments[0].footer = footer;
	}

	log.info(`Post data: ${util.inspect(post_data)}`);

	// eslint-disable-next-line no-extra-parens
	if(global.settings.ENV === 'test' || (global.settings.SLACK_DO_NOT_SEND && global.settings.SLACK_DO_NOT_SEND === "YES")){
		log.info("Not sending to Slack do to config")
		return true;
	}

	await request.post('https://hooks.slack.com/services/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', {'json': post_data}, (error, slackRes, body) => {
		if(error){
			log.error("Slack API error: resp: " + slackRes + " error: " + error + " body " + body + __location);
			throw error;
		}
		else{
			log.info(`Slack API statusCode: ${slackRes.statusCode}` + __location);
			log.info(`Slack API body: ${body}` + __location);
			return body;
		}
	});

}