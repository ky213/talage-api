/**
 * Provides functions for logging data
 */

'use strict';

const winston = require('winston');
const colors = require('colors');
const common = require('winston/lib/winston/common');
const elasticsearch = require('elasticsearch');
const awsHttpClient = require('http-aws-es');
const AWS = require('aws-sdk');
var WinstonElasticsearch = require('winston-elasticsearch');
// var metadata = require('node-ec2-metadata');
// var Q = require('q');

const { createLogger, format } = require('winston');
const { combine, timestamp, label, prettyPrint, printf } = format;

exports.Connect = async () => {
	console.log('Connecting to log server');

	let defaultMetaData = { SystemName: "not EC2 - Local Dev" }

	//name special
	if (process.env.name) {
		defaultMetaData.PROCESS_NAME = process.env.name;
		defaultMetaData.SystemName = process.env.name;
	}
	var envToAddList = ["name", "ENV", "HOSTNAME", "USER", "AWS_REGION", "INSTANCE_ID", "AMP_ID", "PUBLIC_HOSTNAME", "PUBLIC_IPV4"];

	for (const value of envToAddList) {
		if (process.env[value]) {
			defaultMetaData[value] = process.env[value];
		}
	}

	// console.log("defaultMetaData: " + JSON.stringify(defaultMetaData));
	//var runningOnEC2 = false;
	// Enhanced logging for when we are running on Cycle (not needed in development)
	//if(process.env.CYCLE_CONTAINER_IDENTIFIER && process.env.NODE_ENV !== 'test'){

	var transports = [];
	var apiLogTransports = [];

	//console.log('process.env.AWS_LOG_TO_AWS_ELASTICSEARCH: ' + process.env.AWS_LOG_TO_AWS_ELASTICSEARCH );

	if (settings.AWS_LOG_TO_AWS_ELASTICSEARCH === "YES") {
		console.log(colors.green('\tLogging to ElasticSearch'));

		//Setup AWS ElasticSearch and Console.
		console.log('Setting up AWS ElasticSearch logging')

		const myFormat = printf(({ level, message, timestamp }) => {
			return `${timestamp} ${level.toUpperCase()}: ${message}`;
		});

		function myFormat2(options) {
			//options.formatter = null
			options.systemName = defaultMetaData.SystemName;
			return options;
		}
		//console logging
		var consoleLevel = 'debug';

		if (process.env.CONSOLE_LOGLEVEL) {
			consoleLevel = process.env.CONSOLE_LOGLEVEL;
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

		//AWS ElasticSearch ####################################################

		// NOTE: These are guaranteed to exist now. -SF
		var elasticSearchLevel = 'info';
		if (settings.AWS_ELASTICSEARCH_LOGLEVEL) {
			elasticSearchLevel = settings.AWS_ELASTICSEARCH_LOGLEVEL;
		}
		//console.log('elasticSearchLevel: ' + elasticSearchLevel);
		let awsRegion = "us-west-1";
		if (settings.AWS_REGION) {
			awsRegion = settings.AWS_REGION;
		}
		AWS.config.region = awsRegion;

		let awsEndPoint = "";
		if (settings.AWS_ELASTICSEARCH_ENDPOINT) {
			awsEndPoint = settings.AWS_ELASTICSEARCH_ENDPOINT;
		}

		var AccessKeyId = "";
		if (settings.AWS_KEY) {
			AccessKeyId = settings.AWS_KEY;
		}

		var SecretAccessKey = "";
		if (settings.AWS_SECRET) {
			SecretAccessKey = settings.AWS_SECRET;
		}

		AWS.config.update({
			credentials: new AWS.Credentials(AccessKeyId, SecretAccessKey),
			region: awsRegion
		});

		//AWS ElasticSearch
		const awsClient = new elasticsearch.Client({
			host: awsEndPoint,
			connectionClass: awsHttpClient //,
			// amazonES: {
			//      credentials: new AWS.Credentials(AccessKeyId,SecretAccessKey)
			//  }
		});

		if (awsClient) {
			var elasticSearchOptions = {
				level: elasticSearchLevel,
				client: awsClient,
				buffering: false,
				indexSuffixPattern: "YYYY"
				//setup differentindex

			};
			let winstonElasticsearch = new WinstonElasticsearch(elasticSearchOptions)
			if (winstonElasticsearch) {
				transports.push(winstonElasticsearch);
			}
			else {
				console.log('no winstonElasticsearch');
			}

			//apiLogging  - level in hardwared
			var elasticSearchOptionsAPI = {
				level: elasticSearchLevel,
				client: awsClient,
				buffering: false,
				indexPrefix: "apilogs",
				indexSuffixPattern: "YYYY"
			};
			let winstonElasticsearchAPI = new WinstonElasticsearch(elasticSearchOptionsAPI)
			if (winstonElasticsearchAPI) {
				apiLogTransports.push(winstonElasticsearchAPI);
				//transports.push(winstonElasticsearchAPI); 
				//console.log('ADD AWS WinstonElasticsearchAPI');
			}
			else {
				console.log('no winstonElasticsearchAPI');
			}
		}
		else {
			console.log('no awsClient')
		}

		// console.log(defaultMetaData);

		var logger = new winston.createLogger({
			format: combine(timestamp(),
				winston.format.json()),
			transports: transports,
			defaultMeta: defaultMetaData,
			exitOnError: false,
			level: consoleLevel
		});

		winston.loggers.add('apilogger', {
			format: combine(timestamp(),
				winston.format.json()),
			transports: apiLogTransports,
			defaultMeta: defaultMetaData,
			exitOnError: false,
			level: elasticSearchLevel
		});
		global.log = logger;
	} else {
		if (settings.ENV !== 'test' && settings.ENV !== 'development' && settings.ENV !== 'local') {
			console.log(colors.green('\tLogging to logstash'));

			throw (colors.red('ERROR: logstash server is not available on AWS'));

			const LogstashTransport = requireShared('services/winston-logstash-transport.js').LogstashTransport;

			// Add some data that will automatically be included with each log entry
			const appendMetaInfo = winston.format(function (info) {
				return Object.assign(info, {
					'@version': global.version,
					'app': process.env.CYCLE_CONTAINER_IDENTIFIER,
					'container': process.env.CYCLE_CONTAINER_ID,
					'container_instance': process.env.CYCLE_INSTANCE_ID,
					'instance_num': process.env.CYCLE_INSTANCE_IPV6_IP.split(':')[4],
					'ip': process.env.CYCLE_INSTANCE_IPV6_IP,
					'provider': process.env.CYCLE_PROVIDER_IDENTIFIER,
					'server': process.env.CYCLE_SERVER_ID,
					'system_type': 'api'
				});
			});

			// Create the logger
			global.log = winston.createLogger({
				'format': winston.format.combine(appendMetaInfo(), winston.format.json()),
				'level': 'verbose',
				'transports': new LogstashTransport({
					'host': `logstash`,
					'ipv6': true,
					'port': 5000
				})
			});
			//module.exports = global.log;
		} else {
			console.log(colors.green('\tConnected (logging locally)'));

			// When not running on Cycle, simply log to console
			global.log = winston.createLogger({
				'transports': new winston.transports.Console({
					'format': winston.format.combine(winston.format.colorize(),
						winston.format.printf((info) => `${info.level}: ${info.message}`)),
					'level': settings.ENV === 'test' ? 'error' : 'silly'
				})
			});
			//module.exports = global.log;
		}
	}
	return true;
};