'use strict';

const colors = require('colors');
const restify = require('restify');
const RestifyError = require('restify-errors');
const restifyCORS = require('restify-cors-middleware');
const jwt = require('restify-jwt-community');
const auth = require('./public/v1/agency-portal/helpers/auth.js');
const moment = require('moment');
const util = require('util');
const socketIO = require('socket.io');

/**
 * JWT handlers
 */

 // JWT middleware for authenticated endpoints
function ProcessJWT() {
	return jwt({
		'algorithms': ['HS256', 'RS256'],
		'requestProperty': 'authentication',
		'secret': settings.AUTH_SECRET_KEY
	})
};

// Wrap an authenticated endpoint callback with a JWT check
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

class AbstractedHTTPServer {
	constructor(server) {
		this.server = server;
	}

	AddPost(name, path, handler) {
		this.server.post({ name, path }, handler);
	}

	AddPostAuth(name, path, handler) {
		name += ' (auth)';
		this.server.post({ name, path }, ProcessJWT(), ValidateJWT(handler));
	}

	AddGet(name, path, handler) {
		this.server.get({ name, path }, handler);
	}

	AddGetAuth(name, path, handler) {
		name += ' (auth)';
		this.server.get({ name, path }, ProcessJWT(), ValidateJWT(handler));
	}

	AddPut(name, path, handler) {
		this.server.put({ name, path }, handler);
	}

	AddPutAuth(name, path, handler) {
		name += ' (auth)';
		this.server.put({ name, path }, ProcessJWT(), ValidateJWT(handler));
	}

	AddDelete(name, path, handler) {
		this.server.del({ name, path }, handler);
	}

	AddDeleteAuth(name, path, handler) {
		name += ' (auth)';
		this.server.del({ name, path }, ProcessJWT(), ValidateJWT(handler));
	}

	AddSocket(name, path, connectHandler) {
		const io = socketIO(this.server.server, { 'path': path });

		// Force authentication on Socket.io connections
		io.use(function (socket, next) {
			if (socket.handshake.query && socket.handshake.query.token) {
				jwt.verify(socket.handshake.query.token, settings.AUTH_SECRET_KEY, function (err) {
					if (err) {
						return next(new Error('Invalid authentication token'));
					}
					next();
				});
			} else {
				return next(new Error('An authentication token must be provided'));
			}
		});

		// Handle Socket.io connections
		io.on('connection', connectHandler);
	}

	server;
}

/**
 * Create a new server
 */

module.exports = {
	Create: async (listenAddress, listenPort, endpointPath, useCORS, isDevelopment, logInfoHandler, logErrorHandler) => {
		const server = restify.createServer({
			'dtrace': true,
			'name': `Talage API: ${endpointPath}`,
			'version': version
		});

		// Log Every Request. If they don't reach the endpoints, then CORS returned a preflight error.
		server.on('after', (req, res, route, error) => {
			logInfoHandler(`${moment().format()} ${req.connection.remoteAddress} ${req.method} ${req.url} => ${res.statusCode} '${res.statusMessage}'`);
		});
		server.on('error', function (err) {
			logErrorHandler(`${moment().format()} ${err.toString()}'`);
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
		console.log(`Registering ${endpointPath} endpoints`);
		require(`./${endpointPath}`).RegisterEndpoints(new AbstractedHTTPServer(server));
		console.log(colors.green('\tCompleted'));

		// Display all registered routes
		console.log(colors.cyan('-'.padEnd(80, '-')));
		console.log(colors.cyan(`Registered ${endpointPath} endpoints`));
		console.log(colors.cyan('-'.padEnd(80, '-')));
		const routes = server.router.getRoutes();
		for (const routeName in routes) {
			const route = routes[routeName];
			// Color code the route name
			let name = route.spec.name;
			name = name.replace('(depr)', colors.red('(depr)'));
			name = name.replace('(auth)', colors.yellow('(auth)'));
			// Display the full route information
			console.log(`${colors.green(route.method.padEnd(6, ' '))} ${route.path.padEnd(40, ' ')} ${name}`);
		}

		// Start the server
		const serverListen = util.promisify(server.listen.bind(server));
		try {
			await serverListen(listenPort, listenAddress);
		} catch (error) {
			logErrorHandler(`Error running ${endpointPath} server: ${error}`);
			return false;
		}
		const startMsg = `Talage API ${endpointPath} server (v${version}) listening on ${listenAddress}:${listenPort} (${settings.ENV} mode)`;
		logInfoHandler(startMsg);

		return true;
	},

	RequestError: (message) => {
		return new RestifyError.BadRequestError(message);
	},

	InternalError: (message) => {
		return new RestifyError.InternalServerError(message);
	},

	InvalidCredentialsError: (message) => {
		return new RestifyError.InvalidCredentialsError(message);
	},

	ForbiddenError: (message) => {
		return new RestifyError.ForbiddenError(message);
	},

	NotFoundError: (message) => {
		return new RestifyError.NotFoundError(message);
	},

	NotAuthorizedError: (message) => {
		return new RestifyError.NotAuthorizedError(message);
	},

	ServiceUnavailableError: (message) => {
		return new RestifyError.ServiceUnavailableError(message);
	}
};