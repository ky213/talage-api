'use strict';

const AWS = require('aws-sdk');
const colors = require('colors');

exports.RegisterEndpoints = (server) => {
	// Setup S3
	console.log('Connecting to Amazon S3');
	AWS.config.update({
		accessKeyId: process.env.S3_ACCESS_KEY_ID,
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
	});
	global.s3 = new AWS.S3();
	// TODO: force a connection -SF
	console.log(colors.green('\tConnected'));

	// Load every API version
	require('./v1').RegisterEndpoints(server);

};