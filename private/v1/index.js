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
	RegisterEndpoint(server, 'docusign', 'embedded');
	RegisterEndpoint(server, 'email', 'email');
	RegisterEndpoint(server, 'encryption', 'decrypt');
	RegisterEndpoint(server, 'encryption', 'encrypt');
	RegisterEndpoint(server, 'encryption', 'verify-password');
	RegisterEndpoint(server, 'encryption', 'hash');
	RegisterEndpoint(server, 'encryption', 'hash-password');
	RegisterEndpoint(server, 'file', 'file');
	RegisterEndpoint(server, 'file', 'list');
	RegisterEndpoint(server, 'slack', 'post-to-channel');
};