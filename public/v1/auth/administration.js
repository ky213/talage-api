'use strict';

const jwt = require('jsonwebtoken');
const server = require('../../../server.js');

async function login(req, res, next) {
	// Get the user information.
	const user = {
		id: 1,
		type: 'administrator',
		name: 'Talage McTalageUser',
		username: 'tmcuser@talageins.com',
		lastLogin: '2020/07/20T12:34:00Z',
		permissions: {
			administration: {
				all: true
			}
		}
	};

	// Generate a JWT
	const tokenPayload = {
		userID: user.id,
		permissions: user.permissions
	};
	const token = jwt.sign(tokenPayload, global.settings.AUTH_SECRET_KEY, { expiresIn: '5d' });

	// Create the response object.
	const response = {
		token,
		user
	};

	// Send a successful response.
	return server.send(response, res, next);
}

async function refresh(req, res, next) {
	// Send an unsuccessful response.
	return server.sendError('NOT IMPLEMENTED', res, next);
}

exports.registerEndpoint = (server, basePath) => {
	server.addPost('Administration authentication login', `${basePath}/administration`, login);
	server.addPutAuth('Administration authentication refresh', `${basePath}/administration`, refresh);
};
