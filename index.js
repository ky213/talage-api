'use strict';

const colors = require('colors')

// Ensure we have a run mode argument ('public' or 'private')
if (process.argv.length != 3 || (process.argv[2] !== 'public' && process.argv[2] !== 'private')) {
	console.log(`${colors.red('Error:')} missing run mode argument`);
	console.log('Usage: node index.js [public | private]');
	console.log(`    Run the public API:  ${colors.green('node index.js public')}`);
	console.log(`    Run the private API: ${colors.green('node index.js private')}`);
	process.exit(-1);
}
const runMode = process.argv[2];

// Load the environment
const environment = require('dotenv').config({ path: 'aws.env' });
if (environment.error) {
	throw environment.error;
}

// Register global function to load public/private shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
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

let listenAddress = null;
let listenPort;

// Register v1 endpoints
switch (runMode) {
	case 'public':
		listenAddress = '0.0.0.0';
		listenPort = process.env.PUBLIC_API_PORT || 3000;
		require('./public').RegisterEndpoints(server);
		break;
	case 'private':
		listenAddress = '127.0.0.1';
		listenPort = process.env.PRIVATE_API_PORT || 4000;
		require('./private').RegisterEndpoints(server);
		break;
	default:
		log.error(`Unknown run mode '${runMode}'. Must be 'public' or 'private'`);
		process.exit(-1);
}

// Display all routes
log.info(colors.cyan('Registered routes'));
log.info(colors.cyan('-'.padEnd(80, '-')));
const routes = server.router.getRoutes();
for (const routeName in routes) {
	const route = routes[routeName];
	log.info(`${colors.green(route.method.padEnd(4, ' '))} ${route.path.padEnd(40, ' ')} ${route.spec.name.includes('deprecated') ? colors.red(route.spec.name) : route.spec.name}`);
}

// Start the server
server.listen(listenPort, listenAddress, () => {
	const startMsg = `Auth API Server version ${global.version} listening on ${listenAddress}:${listenPort} (${process.env.NODE_ENV} mode)`;
	log.info(startMsg);
	console.log(startMsg); // eslint-disable-line no-console
});
