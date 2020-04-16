'use strict';

const colors = require('colors');
const restify = require('restify');
const RestifyError = require('restify-errors');
const restifyCORS = require('restify-cors-middleware');
const jwt = require('restify-jwt-community');
const auth = require('./public/v1/wheelhouse/helpers/auth.js');
const moment = require('moment');

let server = null;

/**
 * Create a new server
 */

global.CreateServer = (listenAddress, listenPort, endpointPath, useCORS, isDevelopment, logHandler) => {
	server = restify.createServer({
		'dtrace': true,
		'name': 'Talage API',
		'version': global.version
	});

	// Log Every Request. If they don't reach the endpoints, then CORS returned a preflight error.
	server.on('after', (req, res, route, error) => {
		logHandler(`${moment().format()} ${req.connection.remoteAddress} ${req.method} ${req.url} => ${res.statusCode} '${res.statusMessage}'`);
	});

	// CORS
	if (useCORS) {
		// Note: This should be set to something other than '*' -SF
		const cors = restifyCORS({
			'origins': ['*'],
			'allowHeaders': ['Authorization']
		});
		server.pre(cors.preflight);
		server.use(cors.actual);
	}

	// Query string and body parsing
	server.use(restify.plugins.queryParser());
	server.use(restify.plugins.bodyParser({
		'mapFiles': false,
		'mapParams': true
	}));

	// Sanitize paths
	server.pre(restify.plugins.pre.dedupeSlashes());
	server.pre(restify.plugins.pre.sanitizePath());

	// Set some default headers for security
	server.use((req, res, next) => {
		// Strict-Transport-Security (note: do not send this in development as we don't use SSL in development)
		if (!isDevelopment) {
			res.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
		}
		// Esnables the Cross-site scripting (XSS) filter built into most recent web browsers
		res.header('X-XSS-Protection', '1; mode=block');
		return next();
	});

	// Register endpoints 
	require(`./${endpointPath}`).RegisterEndpoints(server);

	// Display all registered routes
	log.info(colors.cyan('Registered routes'));
	log.info(colors.cyan('-'.padEnd(80, '-')));
	const routes = server.router.getRoutes();
	for (const routeName in routes) {
		const route = routes[routeName];
		// Color code the route name
		let name = route.spec.name;
		name = name.replace('(deprecated)', colors.red('(deprecated)'));
		name = name.replace('(authenticated)', colors.yellow('(authenticated)'));
		// Display the full route information
		log.info(`${colors.green(route.method.padEnd(6, ' '))} ${route.path.padEnd(40, ' ')} ${name}`);
	}

	// Start the server
	server.listen(listenPort, listenAddress, () => {
		const startMsg = `Auth API Server version ${global.version} listening on ${listenAddress}:${listenPort} (${process.env.NODE_ENV} mode)`;
		log.info(startMsg);
		console.log(startMsg); // eslint-disable-line no-console
	});
};

/**
 * JWT handlers
 */

function ProcessJWT() {
	return jwt({
		'algorithms': ['HS256', 'RS256'],
		'requestProperty': 'authentication',
		'secret': process.env.AUTH_SECRET_KEY
	})
};

function ValidateJWT(nextCall) {
	return async (req, res, next) => {
		try {
			await auth.validateJWT(req);
		} catch (error) {
			return next(error);
		}
		return nextCall(req, res, next);
	}
}

/**
 * Add endpoints
 */

global.ServerAddPost = (name, path, handler) => {
	server.post({ name, path }, handler);
}

global.ServerAddPostAuth = (name, path, handler) => {
	name += ' (authenticated)';
	server.post({ name, path }, ProcessJWT(), ValidateJWT(handler));
}

global.ServerAddGet = (name, path, handler) => {
	server.get({ name, path }, handler);
}

global.ServerAddGetAuth = (name, path, handler) => {
	name += ' (authenticated)';
	server.get({ name, path }, ProcessJWT(), ValidateJWT(handler));
}

global.ServerAddPut = (name, path, handler) => {
	server.put({ name, path }, handler);
}

global.ServerAddPutAuth = (name, path, handler) => {
	name += ' (authenticated)';
	server.put({ name, path }, ProcessJWT(), ValidateJWT(handler));
}

global.ServerAddDelete = (name, path, handler) => {
	server.del({ name, path }, handler);
}

global.ServerAddDeleteAuth = (name, path, handler) => {
	name += ' (authenticated)';
	server.del({ name, path }, ProcessJWT(), ValidateJWT(handler));
}

/**
 * Report errors
 */

global.ServerRequestError = (message) => {
	return new RestifyError.BadRequestError(message);
};

global.ServerInternalError = (message) => {
	return new RestifyError.InternalServerError(message);
}

global.ServerBadInvalidCredentialsError = (message) => {
	return new RestifyError.InvalidCredentialsError(message);
}

global.ServerForbiddenError = (message) => {
	return new RestifyError.ForbiddenError(message);
}

global.ServerNotFoundError = (message) => {
	return new RestifyError.NotFoundError(message);
}

global.ServerNotAuthorizedError = (message) => {
	return new RestifyError.NotAuthorizedError(message);
}