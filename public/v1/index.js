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

	// wheelhouse
	RegisterEndpoint(server, 'wheelhouse', 'account');
	RegisterEndpoint(server, 'wheelhouse', 'activities');
	RegisterEndpoint(server, 'wheelhouse', 'agencies');
	RegisterEndpoint(server, 'wheelhouse', 'agency');
	RegisterEndpoint(server, 'wheelhouse', 'application');
	RegisterEndpoint(server, 'wheelhouse', 'applications');
	RegisterEndpoint(server, 'wheelhouse', 'banners');
	RegisterEndpoint(server, 'wheelhouse', 'change-password');
	RegisterEndpoint(server, 'wheelhouse', 'color-schemes');
	RegisterEndpoint(server, 'wheelhouse', 'create-agency');
	RegisterEndpoint(server, 'wheelhouse', 'landing-page');
	RegisterEndpoint(server, 'wheelhouse', 'landing-pages');
	RegisterEndpoint(server, 'wheelhouse', 'questions');
	RegisterEndpoint(server, 'wheelhouse', 'quote-letter');
	RegisterEndpoint(server, 'wheelhouse', 'reports');
	RegisterEndpoint(server, 'wheelhouse', 'resend-onboarding-email');
	RegisterEndpoint(server, 'wheelhouse', 'reset-password');
	RegisterEndpoint(server, 'wheelhouse', 'settings');
	RegisterEndpoint(server, 'wheelhouse', 'terms-of-service');
	RegisterEndpoint(server, 'wheelhouse', 'user-info');
	RegisterEndpoint(server, 'wheelhouse', 'validate-token');
	RegisterEndpoint(server, 'wheelhouse', 'wholesale-agreement');
};