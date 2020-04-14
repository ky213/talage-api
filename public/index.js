'use strict';

// Load the environment
const environment = require('dotenv').config({ path: '../aws.env' });
if (environment.error) {
	throw environment.error;
}

// Register global function to load public/private shared modules
global.sharedPath = require('path').join(__dirname, '..', 'shared');
global.requireShared = (moduleName) => require(`${sharedPath}/${moduleName}`);

// Load the logger
requireShared('./services/logger.js');

// Determine the version number
global.version = '1.0.0'; //requireShared('./helpers/version.js')();

// Require files and establish globals
global.db = requireShared('./services/db.js');
// global.restify = require('restify');
const restify = require('restify');
// global.server = restify.createServer({
const server = restify.createServer({
	'dtrace': true,
	'name': 'Talage Auth API',
	'version': global.version
});

// CORS
const corsMiddleware = require('restify-cors-middleware');
const cors = corsMiddleware({
	'origins': ['*']
});

server.pre(cors.preflight);
server.use(cors.actual);
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser({
	'mapFiles': false,
	'mapParams': true
}), cors.actual);

// Sanitize paths
server.pre(restify.plugins.pre.dedupeSlashes());
server.pre(restify.plugins.pre.sanitizePath());

// TO DO: REMOVE THIS AFTER gettoken IS REMOVED
server.use(restify.plugins.bodyParser({
	'mapFiles': false,
	'mapParams': true
}));

// Log Every Request
server.pre(function (res, req, next) {
	log.info(`${req.socket.parser.incoming.method} ${req.socket.parser.incoming.url}`);
	next();
});

// Register v1 endpoints
const apiV1 = require('./v1');
apiV1.RegisterEndpoints(server);

const port = process.env.PORT || 8888;

// Start the server
if (!server.address() && !module.parent) {
	server.listen(port, function () {
		const startMsg = `Auth API Server version ${global.version} listening on ${port} (${process.env.NODE_ENV} mode)`;
		log.info(startMsg);
		console.log(startMsg); // eslint-disable-line no-console
	});
}


/*
// ============================================================================
// Tests
// ============================================================================

// Setup the environment like AWS.
// Copy ../aws.env.example to ../aws.env and populate it.
const environment = require('dotenv').config({path: '../aws.env'});
if (environment.error) {
	throw environment.error;
}


// Load the tests
const testMigration = require('./testMigration.js');

// Ensure the shared modules load
testMigration.TestSharedModules();

// Tests End
// ============================================================================
*/
