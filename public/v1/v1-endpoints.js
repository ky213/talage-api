'use strict';

const apiVersion = 'v1';

/**
 * Registers an endpoint
 *
 * @param {object} server - Server object
 * @param {object} namespace - The namespace for this endpoint
 * @param {function} endpointName - The endpoint name
 *
 * @returns {void}
 */
function registerEndpoint(server, namespace, endpointName){
	if(namespace === null){
		require(`./${endpointName}.js`).registerEndpoint(server, `/${apiVersion}`);
	}else{
		require(`./${namespace}/${endpointName}.js`).registerEndpoint(server, `/${apiVersion}/${namespace}`);
	}
}

exports.registerEndpoints = (server) => {
	// Agency portal
	registerEndpoint(server, 'agency-portal', 'account');

	/*
	 * Activities removed in 1.5.0
	 * registerEndpoint(server, 'agency-portal', 'activities');
	 */
	registerEndpoint(server, 'agency-portal', 'agencies');
	registerEndpoint(server, 'agency-portal', 'agency');
	registerEndpoint(server, 'agency-portal', 'application');
	registerEndpoint(server, 'agency-portal', 'applications');
	registerEndpoint(server, 'agency-portal', 'banners');
	registerEndpoint(server, 'agency-portal', 'change-password');
	registerEndpoint(server, 'agency-portal', 'color-schemes');
	registerEndpoint(server, 'agency-portal', 'create-agency');
	registerEndpoint(server, 'agency-portal', 'landing-page');
	registerEndpoint(server, 'agency-portal', 'landing-pages');
	registerEndpoint(server, 'agency-portal', 'questions');
	registerEndpoint(server, 'agency-portal', 'quote-letter');
	registerEndpoint(server, 'agency-portal', 'reports');
	registerEndpoint(server, 'agency-portal', 'resend-onboarding-email');
	registerEndpoint(server, 'agency-portal', 'reset-password');
	registerEndpoint(server, 'agency-portal', 'settings');
	registerEndpoint(server, 'agency-portal', 'terms-of-service');
	registerEndpoint(server, 'agency-portal', 'user-info');
	registerEndpoint(server, 'agency-portal', 'validate-token');
	registerEndpoint(server, 'agency-portal', 'wholesale-agreement');
	registerEndpoint(server, 'agency-portal', 'user');
	registerEndpoint(server, 'agency-portal', 'users');

	// Auth
	registerEndpoint(server, 'auth', 'agency-portal');
	registerEndpoint(server, 'auth', 'token');

	// Code
	registerEndpoint(server, 'code', 'activity-codes');
	registerEndpoint(server, 'code', 'industry-categories');
	registerEndpoint(server, 'code', 'industry-codes');

	// Doc
	registerEndpoint(server, 'doc', 'acord-form-wc');
	registerEndpoint(server, 'doc', 'certificate');

	// Question
	registerEndpoint(server, 'question', 'questions');

	// Quote
	registerEndpoint(server, 'quote', 'application');
	registerEndpoint(server, 'quote', 'bind');
	registerEndpoint(server, 'quote', 'quotes');

	// Site
	registerEndpoint(server, 'site', 'brand');
};