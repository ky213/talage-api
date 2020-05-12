/* eslint-disable */

/* eslint sort-keys: 0 */
// NOTE: disable sorting keys for now until this code is ready

/**
 * Provides functions for logging data
 */

'use strict';

const winston = require('winston');
const colors = require('colors');
const elasticsearch = require('elasticsearch');
const awsHttpClient = require('http-aws-es');
const AWS = require('aws-sdk');
const WinstonElasticsearch = require('winston-elasticsearch');

/*
 * Var metadata = require('node-ec2-metadata');
 * var Q = require('q');
 */

const { format } = require('winston');
const { combine, timestamp, printf } = format;

exports.connect = () => {

	console.log('Connecting to log server'); // eslint-disable-line no-console

	const defaultMetaData = {'SystemName': 'not EC2 - Local Dev'};

	// Name special
	if(process.env.name){
		defaultMetaData.PROCESS_NAME = process.env.name;
		defaultMetaData.SystemName = process.env.name;
	}
	const envToAddList = ['name',
		'ENV',
		'HOSTNAME',
		'USER',
		'AWS_REGION',
		'INSTANCE_ID',
		'AMP_ID',
		'PUBLIC_HOSTNAME',
		'PUBLIC_IPV4'];

	for(const value of envToAddList){
		if(process.env[value]){
			defaultMetaData[value] = process.env[value];
		}
	}

	/*
	 *  Console.log("defaultMetaData: " + JSON.stringify(defaultMetaData));
	 * var runningOnEC2 = false;
	 *  Enhanced logging for when we are running on Cycle (not needed in development)
	 * if(process.env.CYCLE_CONTAINER_IDENTIFIER && process.env.NODE_ENV !== 'test'){
	 */

	const transports = [];
	const apiLogTransports = [];

	const myFormat = printf(({ level, message, timestamp }) => {
		return `${timestamp} ${level.toUpperCase()}: ${message}`;
	});
	
	//always log to console. (pm2 logs in production)
	//console logging
	var consoleLevel = 'debug';
	if (global.settings.CONSOLE_LOGLEVEL) {
		consoleLevel = global.settings.CONSOLE_LOGLEVEL;
	}
	var consoleOptions = {
		level: consoleLevel,
		handleExceptions: true,
		json: false,
		colorize: true,
		format: combine(timestamp(),
			myFormat)
	};
	transports.push(new winston.transports.Console(consoleOptions));



	if(global.settings.AWS_LOG_TO_AWS_ELASTICSEARCH === 'YES'){
		console.log(colors.green('\tLogging to ElasticSearch')); // eslint-disable-line no-console

		// Setup AWS ElasticSearch and Console.
		console.log('Setting up AWS ElasticSearch logging'); // eslint-disable-line no-console

		const myFormat = printf(({
			level, message, timestampValue
		}) => `${timestampValue} ${level.toUpperCase()}: ${message}`);

		// AWS ElasticSearch ####################################################

		// NOTE: These are guaranteed to exist now. -SF
		let elasticSearchLevel = 'info';
		if(global.settings.AWS_ELASTICSEARCH_LOGLEVEL){
			elasticSearchLevel = global.settings.AWS_ELASTICSEARCH_LOGLEVEL;
		}
		// Console.log('elasticSearchLevel: ' + elasticSearchLevel);
		let awsRegion = 'us-west-1';
		if(global.settings.AWS_REGION){
			awsRegion = global.settings.AWS_REGION;
		}
		AWS.config.region = awsRegion;

		let awsEndPoint = '';
		if(global.settings.AWS_ELASTICSEARCH_ENDPOINT){
			awsEndPoint = global.settings.AWS_ELASTICSEARCH_ENDPOINT;
		}

		let AccessKeyId = '';
		if(global.settings.AWS_KEY){
			AccessKeyId = global.settings.AWS_KEY;
		}

		let SecretAccessKey = '';
		if(global.settings.AWS_SECRET){
			SecretAccessKey = global.settings.AWS_SECRET;
		}

		AWS.config.update({
			'credentials': new AWS.Credentials(AccessKeyId, SecretAccessKey),
			'region': awsRegion
		});

		// AWS ElasticSearch
		const awsClient = new elasticsearch.Client({
			'host': awsEndPoint,
			'connectionClass': awsHttpClient // ,
			/*
			 * AmazonES: {
			 *      credentials: new AWS.Credentials(AccessKeyId,SecretAccessKey)
			 *  }
			 */
		});

		if(awsClient){
			const elasticSearchOptions = {
				'level': elasticSearchLevel,
				'client': awsClient,
				'buffering': false,
				'indexSuffixPattern': 'YYYY'
				// Setup differentindex

			};
			var winstonElasticsearch = new WinstonElasticsearch(elasticSearchOptions);
			if(winstonElasticsearch){
				transports.push(winstonElasticsearch);
			}else{
				console.log('no winstonElasticsearch'); // eslint-disable-line no-console
			}

			// ApiLogging  - level in hardwared
			const elasticSearchOptionsAPI = {
				'level': elasticSearchLevel,
				'client': awsClient,
				'buffering': false,
				'indexPrefix': 'apilogs',
				'indexSuffixPattern': 'YYYY'
			};
			const winstonElasticsearchAPI = new WinstonElasticsearch(elasticSearchOptionsAPI);
			if(winstonElasticsearchAPI){
				apiLogTransports.push(winstonElasticsearchAPI);

				/*
				 * Transports.push(winstonElasticsearchAPI);
				 * console.log('ADD AWS WinstonElasticsearchAPI');
				 */
			}else{
				console.log('no winstonElasticsearchAPI'); // eslint-disable-line no-console
			}
		}else{
			console.log('no awsClient'); // eslint-disable-line no-console
		}

		// Console.log(defaultMetaData);

		// eslint-disable-next-line new-cap
		const logger = new winston.createLogger({
			'format': combine(timestamp(), winston.format.json()),
			'transports': transports,
			'defaultMeta': defaultMetaData,
			'exitOnError': false,
			'level': consoleLevel
		});

		winston.loggers.add('apilogger', {
			'format': combine(timestamp(),
				winston.format.json()),
			'transports': apiLogTransports,
			'defaultMeta': defaultMetaData,
			'exitOnError': false,
			'level': elasticSearchLevel
		});
		global.log = logger;
	// BP it runs on its setting.... env does not matter.	
	// }else if(global.settings.ENV !== 'test' && global.settings.ENV !== 'development' && global.settings.ENV !== 'local'){
	// 	console.log(colors.red('ERROR: logstash server is not available on AWS')); // eslint-disable-line no-console
	// 	return false;
	}else{
		console.log("NOT logging to AWS ElasticSearch")
	
		var logger = new winston.createLogger({
			format: combine(timestamp(),
				winston.format.json()),
			transports: transports,
			defaultMeta: defaultMetaData,
			exitOnError: false,
			level: consoleLevel
		});

		global.log = logger;
	}
	return true;
};
