'use strict';

const AWS = require('aws-sdk');

exports.RegisterEndpoints = (server) => {
	// Connect to s3
	// Setup S3
	log.info('Connecting to Amazon S3');
	AWS.config.update({
		accessKeyId: process.env.S3_ACCESS_KEY_ID,
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
	});
	global.s3 = new AWS.S3();

	// Load every API version
	require('./v1').RegisterEndpoints(server);

};