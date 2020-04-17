'use strict';

exports.RegisterEndpoints = (server) => {
	require('./v1').RegisterEndpoints(server);
};