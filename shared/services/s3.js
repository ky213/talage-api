'use strict';

const AWS = require('aws-sdk');
const colors = require('colors');

exports.Connect = async() => {
	// Setup S3
	console.log('Connecting to Amazon S3');
	AWS.config.update({
		'accessKeyId': settings.S3_ACCESS_KEY_ID,
		'secretAccessKey': settings.S3_SECRET_ACCESS_KEY
	});

	global.s3 = new AWS.S3();

	let s3Objects = null;
	try{
		s3Objects = await s3.listObjectsV2({
			'Bucket': settings.S3_BUCKET,
			'MaxKeys': 1
		}).promise();
	}catch(error){
		console.log(colors.red(`\tError connecting to S3: ${error}`));
		return false;
	}

	console.log(colors.green('\tConnected'));
	return true;
};