'use strict';

const apiVersion = 'v1';

function RegisterEndpoint(server, namespace, endpointName) {
	if (namespace != null) {
		require(`./${namespace}/${endpointName}.js`).RegisterEndpoint(`/${apiVersion}/${namespace}`, server);
	} else {
		require(`./${endpointName}.js`).RegisterEndpoint(`/${apiVersion}`, server);
	}
}

exports.RegisterEndpoints = (server) => {
	log.info(`Loading private ${apiVersion} endpoints`);

	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
};