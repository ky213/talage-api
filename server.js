/* eslint-disable no-lonely-if */
'use strict';

const colors = require('colors');
const restify = require('restify');
const RestifyError = require('restify-errors');
const restifyCORS = require('restify-cors-middleware');
const jwtRestify = require('restify-jwt-community');
const jwt = require('jsonwebtoken');
const auth = require('./public/v1/agency-portal/helpers/auth.js');
const moment = require('moment');
const util = require('util');
const socketIO = require('socket.io');

/**
 * JWT handlers
 */

/**
 * Middleware for authenticated endpoints
 *
 * @returns {void}
 */
function processJWT() {
    return jwtRestify({
        algorithms: ['HS256', 'RS256'],
        requestProperty: 'authentication',
        secret: global.settings.AUTH_SECRET_KEY,
        credentialsRequired: false
    });
}

/**
 * Middlware for authenticated endpoints which validates the JWT
 *
 * @param {Object} options - Contains properties handler (next function call), and options permission and permissionType.
 * @returns {void}
 */
function validateJWT(options) {
    return async(req, res, next) => {
        if (!Object.prototype.hasOwnProperty.call(req, 'authentication') || !req.authentication) {
            log.info('Forbidden: User is not authenticated');
            return next(new RestifyError.ForbiddenError('User is not authenticated'));
        }

        // Validate the JWT
        if (options.agencyPortal === true) {
            const errorMessage = await auth.validateJWT(req, options.permission, options.permissionType);
            if (errorMessage) {
                // There was an error. Return a Forbidden error (403)
                return next(new RestifyError.ForbiddenError(errorMessage));
            }
            return options.handler(req, res, next);
        }
        else {
            return options.handler(req, res, next);
        }
    };
}


/**
 * Middlware for authenticated endpoints which validates the JWT
 *
 * @param {Object} options - Contains properties handler (next function call), and options permission and permissionType.
 * @returns {void}
 */
function validateCognitoJWT(options) {
    return async(req, res, next) => {
        // eslint-disable-next-line no-extra-parens
        let jwtToken = req.headers.authorization || (req.body && req.body.access_token) || (req.query && req.query.access_token) || req.headers.token;
        if(jwtToken){
            jwtToken = jwtToken.replace("Bearer ","");
           // log.debug("jwtToken: " + jwtToken);
            //check Cognito if the Token is good and get groups.
            cognitoSvc.getUserByToken(jwtToken, function(err, cognitoUser){
                if(err){
                    log.error(`Error returned by cognitoSvc.getUserByToken ${err}` + __location)
                    return next(new RestifyError.ForbiddenError("access denied"));
                }
                else {
                    //log.debug("Cognito user: " + JSON.stringify(data));
                    // must be in group.  TalageAdminUser
                    if(cognitoUser.Groups){
                        let hasAccess = false;
                        for(let i = 0; i < cognitoUser.Groups.length; i++){
                            if(cognitoUser.Groups[i].GroupName === "TalageAdminUser"){
                                hasAccess = true;
                            }
                        }
                        if(hasAccess){
                            req.user = cognitoUser;
                            log.debug("cognitoUser " + JSON.stringify(cognitoUser))
                            options.handler(req, res, next);
                        }
                        else {
                            log.warn(`CognitoUser on in approved a group.` + __location)
                            return next(new RestifyError.ForbiddenError("access denied"));
                        }
                    }
                    else {
                        log.warn(`CognitoUser had no groups.` + __location)
                        return next(new RestifyError.ForbiddenError("access denied"));
                    }
                }
            })
        }
        else {
            log.debug("no cognito JWT " + __location);
            return next(new RestifyError.ForbiddenError("access denied"));
        }
    }
}

/**
 * Wrapper to catch unhandled exceptions in endpoint handlers
 *
 * @param {String} path - Path to the endpoint
 * @param {Function} handler - Handler function
 *
 * @returns {Object} next() returned object
 */
function handlerWrapper(path, handler) {
    return async(req, res, next) => {
        let result = null;
        try {
            result = await handler(req, res, next);
        }
        catch (error) {
            log.error(`Unhandled exception in endpoint ${path}: ${error}`);
            return next(new RestifyError.InternalServerError('Internal Server Error'));
        }
        return result;
    };
}

class AbstractedHTTPServer {
    constructor(server) {
        this.server = server;
        this.socketPaths = [];
    }

    addPost(name, path, handler) {
        this.server.post({
            name: name,
            path: path
        },
            handlerWrapper(path, handler));
    }

    addPostAuth(name, path, handler, permission = null, permissionType = null) {
        name += ' (auth)';
        this.server.post({
            name: name,
            path: path
        },
            processJWT(),
            validateJWT({
                handler: handlerWrapper(path, handler),
                permission: permission,
                permissionType: permissionType,
                agencyPortal: true
            }));
    }

    addPostAuthAppWF(name, path, handler, permission = null, permissionType = null) {
        name += ' (authAppWF)';
        this.server.post({
            name: name,
            path: path
        },
            processJWT(),
            validateJWT({
                handler: handlerWrapper(path, handler),
                permission: permission,
                permissionType: permissionType,
                agencyPortal: false
            }));
    }

    addGetAuthAppWF(name, path, handler, permission = null, permissionType = null) {
        name += ' (authAppWF)';
        this.server.get({
            name: name,
            path: path
        },
            processJWT(),
            validateJWT({
                handler: handlerWrapper(path, handler),
                permission: permission,
                permissionType: permissionType,
                agencyPortal: false
            }));
    }

    addGet(name, path, handler) {
        this.server.get({
            name: name,
            path: path
        },
            handlerWrapper(path, handler));
    }

    addGetAuth(name, path, handler, permission = null, permissionType = null) {
        name += ' (auth)';
        this.server.get({
            name: name,
            path: path
        },
            processJWT(),
            validateJWT({
                handler: handlerWrapper(path, handler),
                permission: permission,
                permissionType: permissionType,
                agencyPortal: true
            }));
    }

    addPut(name, path, handler) {
        this.server.put({
            name: name,
            path: path
        },
            processJWT(),
            handlerWrapper(path, handler));
    }

    addPutAuth(name, path, handler, permission = null, permissionType = null) {
        name += ' (auth)';
        this.server.put({
            name: name,
            path: path
        },
            processJWT(),
            validateJWT({
                handler: handlerWrapper(path, handler),
                permission: permission,
                permissionType: permissionType,
                agencyPortal: true
            }));
    }

    addDelete(name, path, handler) {
        this.server.del({
            name: name,
            path: path
        },
            handlerWrapper(path, handler));
    }

    addDeleteAuth(name, path, handler, permission = null, permissionType = null) {
        name += ' (auth)';
        this.server.del({
            name: name,
            path: path
        },
            processJWT(),
            validateJWT({
                handler: handlerWrapper(path, handler),
                permission: permission,
                permissionType: permissionType,
                agencyPortal: true
            }));
    }

    addSocket(name, path, connectHandler) {
        this.socketPaths.push({
            name: name,
            path: path
        });
        const io = socketIO(this.server.server, {path: path});

        // Force authentication on Socket.io connections
        io.use(function(socket, next) {
            if (socket.handshake.query && socket.handshake.query.token) {
                jwt.verify(socket.handshake.query.token, global.settings.AUTH_SECRET_KEY, function(err) {
                    if (err) {
                        log.info(`Socket ${path}: Invalid JWT`);
                        return next(new Error('Invalid authentication token'));
                    }
                    next();
                });
            }
            else {
                log.info(`Socket ${path}: Could not find JWT in handshake`);
                return next(new Error('An authentication token must be provided'));
            }
        });

        // Handle Socket.io connections
        io.on('connection', connectHandler);
    }

    //******* administration Auth **********************

    addGetAuthAdmin(name, path, handler, permission = null, permissionType = null) {
        name += ' (authAdmin)';
        this.server.get({
            name: name,
            path: path
        },
            processJWT(),
            validateCognitoJWT({
                handler: handlerWrapper(path, handler),
                permission: permission,
                permissionType: permissionType
            }));
    }

    addPostAuthAdmin(name, path, handler, permission = null, permissionType = null) {
        name += ' (authAdmin)';
        this.server.post({
            name: name,
            path: path
        },
            processJWT(),
            validateCognitoJWT({
                handler: handlerWrapper(path, handler),
                permission: permission,
                permissionType: permissionType
            }));
    }

    addPutAuthAdmin(name, path, handler, permission = null, permissionType = null) {
        name += ' (authAdmin)';
        this.server.put({
            name: name,
            path: path
        },
            processJWT(),
            validateCognitoJWT({
                handler: handlerWrapper(path, handler),
                permission: permission,
                permissionType: permissionType
            }));
    }

    addDeleteAuthAdmin(name, path, handler, permission = null, permissionType = null) {
        name += ' (authAdmin)';
        this.server.del({
            name: name,
            path: path
        },
            processJWT(),
            validateCognitoJWT({
                handler: handlerWrapper(path, handler),
                permission: permission,
                permissionType: permissionType
            }));
    }
}

module.exports = {
    create: async(listenAddress, listenPort, endpointPath, useCORS, isDevelopment, logInfoHandler, logErrorHandler) => {
        const server = restify.createServer({
            dtrace: true,
            name: `Talage API: ${endpointPath}`,
            version: global.version
        });

        // Log Every Request. If they don't reach the endpoints, then CORS returned a preflight error.
        // eslint-disable-next-line no-unused-vars
        server.on('after', (req, res, route, error) => {
            // Skip if uptime
            if ((req.url.includes('uptime') === true || listenPort === 3008) === false) {
                logInfoHandler(`${moment().format()} ${req.connection.remoteAddress} ${req.method} ${req.url} => ${res.statusCode} '${res.statusMessage}'`);
            }
        });
        server.on('error', function(err) {
            logErrorHandler(`${moment().format()} ${err.toString()}'`);
        });
        // CORS
        if (useCORS) {
            // Note: This should be set to something other than '*' -SF
            const cors = restifyCORS({
                allowHeaders: ['Authorization'],
                origins: ['*']
            });
            server.pre(cors.preflight);
            server.use(cors.actual);
        }

        // Query string and body parsing
        server.use(restify.plugins.queryParser());
        server.use(restify.plugins.bodyParser({
            mapFiles: false,
            mapParams: true
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
        console.log(`Registering ${endpointPath} endpoints`); // eslint-disable-line no-console
        const abstractedServer = new AbstractedHTTPServer(server);
        require(`./${endpointPath}`).registerEndpoints(abstractedServer);
        console.log(colors.green('\tCompleted')); // eslint-disable-line no-console

        // Display all registered routes
        console.log(); // eslint-disable-line no-console
        console.log(colors.cyan('-'.padEnd(80, '-'))); // eslint-disable-line no-console
        console.log(colors.cyan(`Registered ${endpointPath} endpoints`)); // eslint-disable-line no-console
        console.log(colors.cyan('-'.padEnd(80, '-'))); // eslint-disable-line no-console
        const routes = server.router.getRoutes();
        const routeKeys = Object.keys(routes);
        for (let i = 0; i < routeKeys.length; i++) {
            const route = routes[routeKeys[i]];
            // Color code the route name
            let name = route.spec.name;
            name = name.replace('(depr)', colors.red('(depr)'));
            name = name.replace('(auth)', colors.yellow('(auth)'));
            // Display the full route information
            console.log(`${colors.green(route.method.padEnd(6, ' '))} ${route.path.padEnd(40, ' ')} ${name}`); // eslint-disable-line no-console
        }
        // Display the websocket paths. These are not stored in the restify server so we manage them in a separate list
        abstractedServer.socketPaths.forEach((socket) => {
            console.log(`${colors.yellow('SOCKET')} ${socket.path.padEnd(40, ' ')} ${socket.name}`); // eslint-disable-line no-console
        });
        console.log(); // eslint-disable-line no-console

        // Start the server
        const serverListen = util.promisify(server.listen.bind(server));
        try {
            await serverListen(listenPort, listenAddress);
        }
        catch (error) {
            logErrorHandler(`Error running ${endpointPath} server: ${error}`);
            return false;
        }
        const startMsg = `Talage API ${endpointPath} server (v${global.version}) listening on ${listenAddress}:${listenPort} (${global.settings.ENV} mode)`;
        logInfoHandler(startMsg);

        return true;
    },

    forbiddenError: (message) => new RestifyError.ForbiddenError(message),

    internalError: (message) => new RestifyError.InternalServerError(message),

    invalidCredentialsError: (message) => new RestifyError.InvalidCredentialsError(message),

    notAuthorizedError: (message) => new RestifyError.NotAuthorizedError(message),

    notFoundError: (message) => new RestifyError.NotFoundError(message),

    requestError: (message) => new RestifyError.BadRequestError(message),

    serviceUnavailableError: (message) => new RestifyError.ServiceUnavailableError(message),

    send: (data, res, next) => {
        res.send({
            error: null,
            data: data
        });
        return next();
    },

    sendError: (errorMessage, res, next) => {
        res.send({
            error: errorMessage,
            data: null
        });
        return next();
    }
};