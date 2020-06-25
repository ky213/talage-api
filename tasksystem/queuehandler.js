
'use strict';

const AWS = require('aws-sdk');
const responseObject = require('./response-object.js')

let sqs = null; // Will be set later

// eslint-disable-next-line valid-jsdoc
/**
 * Read queue item.
 *
 * @returns json for {success:  true/false, message: data, error: errorMessage} mssage.
 */
exports.getTaskQueueItem = async function(){
	const params = {
		'QueueUrl': global.settings.SQS_TASK_QUEUE,
		'MaxNumberOfMessages': 1,
		'WaitTimeSeconds': 10,
		'MessageAttributeNames': [
			"All"
		],
		'AttributeNames': ['All']
	};

	// eslint-disable-next-line prefer-const
	let err = null;
	const data = await sqs.receiveMessage(params).promise();
	if(err !== null){
		return {
			'success': false,
			'error': err
		};
	}
	else if(data){
		// log.debug('Queue data:')
		// log.debug(JSON.stringify(data));
		if(data.Messages === null){
			return {
				'success': false,
				'error': 'no data in message'
			};
		}
		else {
			return {
				'success': true,
				'data': data
			};
		}
	}
}


exports.deleteTaskQueueItem = async function(messageReceiptHandle){
	if(messageReceiptHandle === "TEST"){
		return responseObject.success;
	}
    const params = {
		'QueueUrl': global.settings.SQS_TASK_QUEUE,
        "ReceiptHandle": messageReceiptHandle
    };

    let errorMessage = null;
	await sqs.deleteMessage(params, function(err){
		if (err){
            log.error("delete queueitem error: " + err+ __location);
			errorMessage = err;
		}
	}).promise();
	if (errorMessage){
		return responseObject.error(errorMessage);
	}
	return responseObject.success;

}

exports.initialize = async function(){

    // AWS Setup
	AWS.config.update({
		'accessKeyId': global.settings.AWS_KEY,
		'secretAccessKey': global.settings.AWS_SECRET,
		'region': global.settings.AWS_REGION
	});

    sqs = new AWS.SQS({'apiVersion': global.settings.awsApiVersion});
    return true;

}