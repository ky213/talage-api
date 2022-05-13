/* eslint-disable no-unused-vars */
/* eslint-disable no-lonely-if */
'use strict';

const colors = require('colors');
const restify = require('restify');
const RestifyError = require('restify-errors');
const restifyCORS = require('restify-cors-middleware');
const jwtRestify = require('restify-jwt-community');
const jwt = require('jsonwebtoken');
const agencyportalAuth = require('./public/v1/agency-portal/helpers/auth-agencyportal.js');
const insurerPortalAuth = require('./public/v1/insurer-portal/helpers/auth-insurerportal.js');
const moment = require('moment');
const util = require('util');
const socketIO = require('socket.io');
const CookieParser = require('restify-cookies');

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
 * Middlware for authenticated endpoints which validates the JWT for AgencyPortal and Qoute App V1
 *
 * @param {Object} options - Contains properties handler (next function call), and options permission and permissionType.
 * @returns {void}
 */
function validateJWT(options) {
    return async(req, res, next) => {
        if (!Object.prototype.hasOwnProperty.call(req, 'authentication') || !req.authentication) {
            log.info('Forbidden: User is not authenticated' + __location);
            return next(new RestifyError.ForbiddenError('User is not authenticated'));
        }

        // Validate the JWT and user permissions - for Agency Portal
        if (options.agencyPortal) {
            const errorMessage = await agencyportalAuth.validateJWT(req, options.permission, options.permissionType);
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
 * Middlware for authenticated endpoints which validates the JWT for AgencyPortal MFA
 *
 * @param {Object} options - Contains properties handler (next function call), and options permission and permissionType.
 * @returns {void}
 */
function validateJWTforMFA(options) {
    return async(req, res, next) => {
        if (!Object.prototype.hasOwnProperty.call(req, 'authentication') || !req.authentication) {
            log.info('MFA Forbidden: User is not authenticated' + __location);
            return next(new RestifyError.ForbiddenError('User is not authenticated'));
        }
        log.debug(`validateJWTforMFA ${JSON.stringify(req.authentication)}` + __location);
        if (req.authentication.mfaCheck === true && req.authentication.userId && parseInt(req.authentication.userId,10) > 0){
            return options.handler(req, res, next)
        }
        else {
            log.info('MFA Forbidden: User is not authenticated' + __location);
            return next(new RestifyError.ForbiddenError('User is not authenticated'));
        }
    };
}

/**
 * Middlware for authenticated endpoints which validates the JWT for Administration site
 *
 * @param {Object} options - Contains properties handler (next function call), and options permission and permissionType.
 * @returns {void}
 */
function validateCognitoJWT(options) {
    return async(req, res, next) => {

        const permission = options.permission;
        //, options.permissionType
        // eslint-disable-next-line no-extra-parens
        let jwtToken = req.headers.authorization || (req.body && req.body.access_token) || (req.query && req.query.access_token) || req.headers.token;
        if(jwtToken){
            jwtToken = jwtToken.replace("Bearer ","");
            // log.debug("jwtToken: " + jwtToken);
            //check Cognito if the Token is good and get groups.
            cognitoSvc.getUserByToken(jwtToken, function(err, cognitoUser){
                if(err){
                    if(err.message?.includes("NotAuthorizedException")){
                        log.info(`NotAuthorizedException returned by cognitoSvc.getUserByToken ${err}` + __location)
                    }
                    else {
                        log.error(`Error returned by cognitoSvc.getUserByToken ${err}` + __location)
                    }
                    return next(new RestifyError.ForbiddenError("access denied"));
                }
                else {
                    // must be in group.  TalageAdminUser
                    if(cognitoUser.Groups){
                        let hasAccess = false;
                        for(let i = 0; i < cognitoUser.Groups.length; i++){
                            //log.debug(`check ${cognitoUser.Groups[i].GroupName} === ${permission}` + __location)
                            if(cognitoUser.Groups[i].GroupName === permission){
                                hasAccess = true
                            }
                            if(cognitoUser.Groups[i].GroupName === "TalageFullAdmin"){
                                hasAccess = true;
                            }
                        }

                        if(hasAccess){
                            //environment check.
                            let hasEnvAccess = false;
                            for(let i = 0; i < cognitoUser.Groups.length; i++){
                                if(cognitoUser.Groups[i].GroupName.toLowerCase() === global.settings.ENV.toLowerCase()){
                                    hasEnvAccess = true
                                }
                            }
                            if(hasEnvAccess){
                                req.user = cognitoUser;
                                //  log.debug("cognitoUser " + JSON.stringify(cognitoUser))
                                options.handler(req, res, next);
                            }
                            else{
                                log.error(`CognitoUser not approved for environment.` + __location)
                                return next(new RestifyError.ForbiddenError("access denied"));
                            }
                        }
                        else {
                            log.warn(`CognitoUser not in approved a group.` + __location)
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
 * Middleware for authenticated endpoints which validates the JWT for Insurer Portal
 *
 * @param {Object} options - Contains properties handler (next function call), and options permission and permissionType.
 * @returns {void}
 */
function validateInsurerPortalJWT(options) {
    return async(req, res, next) => {
        if (!Object.prototype.hasOwnProperty.call(req, 'authentication') || !req.authentication) {
            log.info('Forbidden: User is not authenticated' + __location);
            return next(new RestifyError.ForbiddenError('User is not authenticated'));
        }

        const errorMessage = await insurerPortalAuth.validateJWT(req, options.permission, options.permissionType);
        if (errorMessage) {
            return next(new RestifyError.ForbiddenError(errorMessage));
        }
        return options.handler(req, res, next);
    };
}


/**
 * get JWT from request.
 *
 * @param {Object} req - Contains properties handler (next function call), and options permission and permissionType.
 * @returns {string} JWT token
 */
async function getUserTokenDataFromJWT(req){
    let userTokenData = null;
    let jwtToken = req.headers.authorization || req.body && req.body.access_token || req.query && req.query.access_token || req.headers.token;
    if(jwtToken){
        jwtToken = jwtToken.replace("Bearer ","");
        req.jwtToken = jwtToken;
        try{
            const redisResponse = await global.redisSvc.getKeyValue(jwtToken)
            if(redisResponse && redisResponse.found && redisResponse.value){
                userTokenData = JSON.parse(redisResponse.value)
            }
            else {
                log.warn(`Did not find JWT in Redis ` + __location);
            }
        }
        catch(err){
            log.error("Checking validateAppApiJWT JWT " + err + __location);
        }
    }
    return userTokenData;

}

/**
 * Middlware for authenticated endpoints which validates the JWT for Application API
 *
 * @param {Object} options - Contains properties handler (next function call), and options permission and permissionType.
 * @returns {void}
 */
function validateAppApiJWT(options) {
    return async(req, res, next) => {
        if (!Object.prototype.hasOwnProperty.call(req, 'authentication') || !req.authentication) {
            log.info('Forbidden: User is not authenticated' + __location);
            return next(new RestifyError.ForbiddenError('User is not authenticated'));
        }

        let goodJWT = false;
        const userTokenData = await getUserTokenDataFromJWT(req);
        if(userTokenData){
            if(userTokenData.apiToken || userTokenData.quoteApp){
                log.debug("good JWT validateAppApiJWT")
                goodJWT = true;
                req.userTokenData = userTokenData;
            }
        }
        if (goodJWT === true) {
            return options.handler(req, res, next);
        }
        else {
            return next(new RestifyError.ForbiddenError("access denied"));
        }
    };
}


/**
 * Middlware for authenticated endpoints which validates the JWT for Application API
 *
 * @param {Object} options - Contains properties handler (next function call), and options permission and permissionType.
 * @returns {void}
 */
function validateQuoteAppV2JWT(options) {
    return async(req, res, next) => {
        if (!Object.prototype.hasOwnProperty.call(req, 'authentication') || !req.authentication) {
            log.info('Forbidden: User is not authenticated' + __location);
            return next(new RestifyError.ForbiddenError('User is not authenticated'));
        }
        let goodJWT = false;
        const userTokenData = await getUserTokenDataFromJWT(req);
        if(userTokenData){
            if(userTokenData.quoteApp){
                log.debug("good JWT validateQuoteAppV2JWT")
                goodJWT = true;
                req.userTokenData = userTokenData;
            }
        }
        if (goodJWT === true) {
            return options.handler(req, res, next);
        }
        else {
            return next(new RestifyError.ForbiddenError("access denied"));
        }
    };
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

    addPostAuth(name, path, handler, permission = null, permissionType = null, options = {agencyPortal: true}) {
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
            ...options
        }));
    }

    addPostMFA(name, path, handler, permission = null, permissionType = null, options = {agencyPortal: true}) {
        name += ' (auth)';
        this.server.post({
            name: name,
            path: path
        },
        processJWT(),
        validateJWTforMFA({
            handler: handlerWrapper(path, handler),
            permission: permission,
            permissionType: permissionType,
            ...options
        }));
    }


    addPostAuthAppApi(name, path, handler, permission = null, permissionType = null) {
        name += ' (authAPI)';
        this.server.post({
            name: name,
            path: path
        },
        processJWT(),
        validateAppApiJWT({
            handler: handlerWrapper(path, handler),
            permission: permission,
            permissionType: permissionType,
            agencyPortal: false
        }));
    }

    addPutAuthAppApi(name, path, handler, permission = null, permissionType = null) {
        name += ' (authAPI)';
        this.server.put({
            name: name,
            path: path
        },
        processJWT(),
        validateAppApiJWT({
            handler: handlerWrapper(path, handler),
            permission: permission,
            permissionType: permissionType,
            agencyPortal: false
        }));
    }

    addGetAuthAppApi(name, path, handler, permission = null, permissionType = null) {
        name += ' (authAPI)';
        this.server.get({
            name: name,
            path: path
        },
        processJWT(),
        validateAppApiJWT({
            handler: handlerWrapper(path, handler),
            permission: permission,
            permissionType: permissionType,
            agencyPortal: false
        }));
    }


    addPostAuthQuoteApp(name, path, handler, permission = null, permissionType = null) {
        name += ' (authQuoteAPI)';
        this.server.post({
            name: name,
            path: path
        },
        processJWT(),
        validateQuoteAppV2JWT({
            handler: handlerWrapper(path, handler),
            permission: permission,
            permissionType: permissionType,
            agencyPortal: false
        }));
    }

    addPutAuthQuoteApp(name, path, handler, permission = null, permissionType = null) {
        name += ' (authQuoteAPI)';
        this.server.put({
            name: name,
            path: path
        },
        processJWT(),
        validateQuoteAppV2JWT({
            handler: handlerWrapper(path, handler),
            permission: permission,
            permissionType: permissionType,
            agencyPortal: false
        }));
    }

    addGetAuthQuoteApp(name, path, handler, permission = null, permissionType = null) {
        name += ' (authQuoteAPI)';
        this.server.get({
            name: name,
            path: path
        },
        processJWT(),
        validateQuoteAppV2JWT({
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

    addGetAuth(name, path, handler, permission = null, permissionType = null, options = {agencyPortal: true}) {
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
            ... options
        }));
    }

    addPut(name, path, handler) {
        this.server.put({
            name: name,
            path: path
        },
        handlerWrapper(path, handler));
    }

    addPutAuth(name, path, handler, permission = null, permissionType = null, options = {agencyPortal: true}) {
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
            ...options
        }));
    }

    addPutAuthNotAP(name, path, handler, permission = null, permissionType = null) {
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
            agencyPortal: false
        }));
    }

    addDelete(name, path, handler) {
        this.server.del({
            name: name,
            path: path
        },
        handlerWrapper(path, handler));
    }

    addDeleteAuth(name, path, handler, permission = null, permissionType = null, options = {agencyPortal: true}) {
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
            ...options
        }));
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


    //******* administration Auth **********************

    addGetInsurerPortalAuth(name, path, handler, permission = null, permissionType = null) {
        name += ' (insurerPortalAuth)';
        this.server.get({
            name: name,
            path: path
        },
        processJWT(),
        validateInsurerPortalJWT({
            handler: handlerWrapper(path, handler),
            permission: permission,
            permissionType: permissionType
        }));
    }

    addPostInsurerPortalAuth(name, path, handler, permission = null, permissionType = null) {
        name += ' (insurerPortalAuth)';
        this.server.post({
            name: name,
            path: path
        },
        processJWT(),
        validateInsurerPortalJWT({
            handler: handlerWrapper(path, handler),
            permission: permission,
            permissionType: permissionType
        }));
    }

    addPutInsurerPortalAuth(name, path, handler, permission = null, permissionType = null) {
        name += ' (insurerPortalAuth)';
        this.server.put({
            name: name,
            path: path
        },
        processJWT(),
        validateInsurerPortalJWT({
            handler: handlerWrapper(path, handler),
            permission: permission,
            permissionType: permissionType
        }));
    }

    addDeleteInsurerPortalAuth(name, path, handler, permission = null, permissionType = null) {
        name += ' (insurerPortalAuth)';
        this.server.del({
            name: name,
            path: path
        },
        processJWT(),
        validateInsurerPortalJWT({
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
                allowHeaders: ['Authorization', 'access-control-allow-origin'],
                origins: ['*']
            });
            server.pre(cors.preflight);
            server.use(cors.actual);
        }

        // Cookie support
        server.use(CookieParser.parse);

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