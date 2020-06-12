'use strict';

const AWS = require('aws-sdk');
const colors = require('colors');

exports.connect = async() => {
	// Setup S3
	// eslint-disable-next-line no-console
	console.log('Connecting to Amazon S3');
	AWS.config.update({
		'accessKeyId': global.settings.AWS_KEY,
		'secretAccessKey': global.settings.AWS_SECRET
	});

	global.s3 = new AWS.S3();

	try{
		await global.s3.listObjectsV2({
			'Bucket': global.settings.S3_BUCKET,
			'MaxKeys': 1
		}).promise();
	}
catch(error){
		// eslint-disable-next-line no-console
		console.log(colors.red(`\tError connecting to S3: ${error}`));
		return false;
	}

	// eslint-disable-next-line no-console
	console.log(colors.green('\tConnected'));
	return true;
};