'use strict';

const apiVersion = 'v1';

function RegisterEndpoint(server, basePath, endpointName) {
	if (basePath != null) {
		require(`./${basePath}/${endpointName}.js`).RegisterEndpoint(`/${apiVersion}/${basePath}`, server);
	} else {
		require(`./${endpointName}.js`).RegisterEndpoint(`/${apiVersion}`, server);
	}
}

exports.RegisterEndpoints = (server) => {
	log.info(`Loading ${apiVersion} endpoints`);
	// auth
	RegisterEndpoint(server, 'auth', 'agency-portal');
	RegisterEndpoint(server, 'auth', 'token');

	// code
	RegisterEndpoint(server, 'code', 'activity-codes');
	RegisterEndpoint(server, 'code', 'industry-categories');
	RegisterEndpoint(server, 'code', 'industry-codes');

	// doc
	RegisterEndpoint(server, 'doc', 'acord-form-wc');
	RegisterEndpoint(server, 'doc', 'certificate');

	// question
	RegisterEndpoint(server, 'question', 'questions');

	// quote
	RegisterEndpoint(server, 'quote', 'application');
	RegisterEndpoint(server, 'quote', 'bind');
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
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');
	// RegisterEndpoint(server, '', '');


	RegisterEndpoint(server, null, 'uptime');
};
