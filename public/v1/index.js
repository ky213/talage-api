'use strict';

const apiVersion = 'v1';

function RegisterEndpoint(server, namespace, endpointName) {
	if (namespace != null) {
		require(`./${namespace}/${endpointName}.js`).RegisterEndpoint(server, `/${apiVersion}/${namespace}`);
	} else {
		require(`./${endpointName}.js`).RegisterEndpoint(server, `/${apiVersion}`);
	}
}

exports.RegisterEndpoints = (server) => {
	// agency portal
	RegisterEndpoint(server, 'agency-portal', 'account');
	//activities removed in 1.5.0
	//RegisterEndpoint(server, 'agency-portal', 'activities');
	RegisterEndpoint(server, 'agency-portal', 'agencies');
	RegisterEndpoint(server, 'agency-portal', 'agency');
	RegisterEndpoint(server, 'agency-portal', 'application');
	RegisterEndpoint(server, 'agency-portal', 'applications');
	RegisterEndpoint(server, 'agency-portal', 'banners');
	RegisterEndpoint(server, 'agency-portal', 'change-password');
	RegisterEndpoint(server, 'agency-portal', 'color-schemes');
	RegisterEndpoint(server, 'agency-portal', 'create-agency');
	RegisterEndpoint(server, 'agency-portal', 'landing-page');
	RegisterEndpoint(server, 'agency-portal', 'landing-pages');
	RegisterEndpoint(server, 'agency-portal', 'questions');
	RegisterEndpoint(server, 'agency-portal', 'quote-letter');
	RegisterEndpoint(server, 'agency-portal', 'reports');
	RegisterEndpoint(server, 'agency-portal', 'resend-onboarding-email');
	RegisterEndpoint(server, 'agency-portal', 'reset-password');
	RegisterEndpoint(server, 'agency-portal', 'settings');
	RegisterEndpoint(server, 'agency-portal', 'terms-of-service');
	RegisterEndpoint(server, 'agency-portal', 'user-info');
	RegisterEndpoint(server, 'agency-portal', 'validate-token');
	RegisterEndpoint(server, 'agency-portal', 'wholesale-agreement');

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
	RegisterEndpoint(server, 'quote', 'quotes');

	// site
	RegisterEndpoint(server, 'site', 'brand');
};