'use strict';

exports.registerEndpoints = (server) => {
	require('./v1/v1-endpoints.js').registerEndpoints(server);
};