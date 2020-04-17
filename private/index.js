'use strict';

exports.RegisterEndpoints = (server) => {
	// Load every API version
	require('./v1').RegisterEndpoints(server);

};