'use strict';

exports.RegisterEndpoints = (server) => {
	require('./v1/v1-endpoints.js').RegisterEndpoints(server);
};