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
function registerEndpoint(server, namespace, endpointName) {
    if (namespace === null) {
        require(`./${endpointName}.js`).registerEndpoint(server, `/${apiVersion}`);
    }
    else {
        require(`./${namespace}/${endpointName}.js`).registerEndpoint(server, `/${apiVersion}/${namespace}`);
    }
}

// TODO move later....
/**
 * Gets the uptime for the public API
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function getUptime(req, res, next) {
    res.setHeader('content-type', 'application/xml');
    const startTime = process.hrtime();

    // Check the database connection by selecting all active activity codes
    let error = false;
    await db.query('SELECT COUNT(*) FROM `#__api_users`').catch(function(e) {
        log.error(e.message + __location);
        error = true;
    });

    // Calculate the elapsed time
    const elapsed = process.hrtime(startTime)[1] / 1000000;

    // Send the appropriate response
    if (error) {
        res.end(`<pingdom_http_custom_check> <status>DOWN</status> <response_time>${elapsed.toFixed(8)}</response_time> <version>${global.version}</version> </pingdom_http_custom_check>`);
        return next();
    }
    res.end(`<pingdom_http_custom_check> <status>OK</status> <response_time>${elapsed.toFixed(8)}</response_time> <version>${global.version}</version> </pingdom_http_custom_check>`);
    return next();
}

exports.registerEndpoints = (server) => {
    // Agency portal
    registerEndpoint(server, 'agency-portal', 'account');

    // Activities removed in 1.5.0
    // RegisterEndpoint(server, 'agency-portal', 'activities');
    registerEndpoint(server, 'agency-portal', 'agencies');
    registerEndpoint(server, 'agency-portal', 'agency');
    registerEndpoint(server, 'agency-portal', 'agency-network');
    registerEndpoint(server, 'agency-portal', 'agency-location');
    registerEndpoint(server, 'agency-portal', 'agency-user');
    registerEndpoint(server, 'agency-portal', 'application');
    registerEndpoint(server, 'agency-portal', 'applications');
    registerEndpoint(server, 'agency-portal', 'banners');
    registerEndpoint(server, 'agency-portal', 'change-password');
    registerEndpoint(server, 'agency-portal', 'city-territory');
    registerEndpoint(server, 'agency-portal', 'color-schemes');
    registerEndpoint(server, 'agency-portal', 'create-agency');
    registerEndpoint(server, 'agency-portal', 'landing-page');
    registerEndpoint(server, 'agency-portal', 'landing-pages');
    registerEndpoint(server, 'agency-portal', 'questions');
    registerEndpoint(server, 'agency-portal', 'quote-letter');
    registerEndpoint(server, 'agency-portal', 'reports');
    registerEndpoint(server, 'agency-portal', 'resend-onboarding-email');
    registerEndpoint(server, 'agency-portal', 'reset-password');
    registerEndpoint(server, 'agency-portal', 'terms-of-service');
    registerEndpoint(server, 'agency-portal', 'user-info');
    registerEndpoint(server, 'agency-portal', 'validate-token');
    registerEndpoint(server, 'agency-portal', 'wholesale-agreement');
    registerEndpoint(server, 'agency-portal', 'user');
    registerEndpoint(server, 'agency-portal', 'user-groups');
    registerEndpoint(server, 'agency-portal', 'users');
    // Application
    registerEndpoint(server, 'application', 'application');
    // Auth
    registerEndpoint(server, 'auth', 'administration');
    registerEndpoint(server, 'auth', 'agency-portal');
    registerEndpoint(server, 'auth', 'token');

    // Code
    registerEndpoint(server, 'code', 'activity-codes');
    registerEndpoint(server, 'code', 'industry-categories');
    registerEndpoint(server, 'code', 'industry-codes');

    // Doc
    registerEndpoint(server, 'doc', 'acord-form-wc');

    // Question
    registerEndpoint(server, 'question', 'questions');

    // Quote
    registerEndpoint(server, 'quote', 'quote-agency');
    registerEndpoint(server, 'quote', 'application');
    registerEndpoint(server, 'quote', 'quotes');

    // Site
    registerEndpoint(server, 'site', 'brand');

    // Administration
    registerEndpoint(server, 'administration', 'color-scheme');
    registerEndpoint(server, 'administration', 'message');
    registerEndpoint(server, 'administration', 'insurer');
    registerEndpoint(server, 'administration', 'insurer-contact-rt');
    registerEndpoint(server, 'administration', 'insurer-outage');
    registerEndpoint(server, 'administration', 'insurer-payment-plan-rt');
    registerEndpoint(server, 'administration', 'insurer-policy-type-rt');
    registerEndpoint(server, 'administration', 'insurer-writer-rt');
    registerEndpoint(server, 'administration', 'agency-network-rt');
    registerEndpoint(server, 'administration', 'agency-network-user-rt');
    registerEndpoint(server, 'administration', 'agency-rt');
    registerEndpoint(server, 'administration', 'agency-email-rt');
    registerEndpoint(server, 'administration', 'agency-location-rt');
    registerEndpoint(server, 'administration', 'territory-rt');
    registerEndpoint(server, 'administration', 'question-rt');
    registerEndpoint(server, 'administration', 'activity-code-rt');
    registerEndpoint(server, 'administration', 'insurer-ncci-code-rt');
    registerEndpoint(server, 'administration', 'industry-code-rt');
    registerEndpoint(server, 'administration', 'industry-code-association-rt');
    registerEndpoint(server, 'administration', 'industry-code-question-rt');
    registerEndpoint(server, 'administration', 'industry-code-category-rt');
    registerEndpoint(server, 'administration', 'industry-code-activity-codes-rt');
    registerEndpoint(server, 'administration', 'activity-code-industry-codes-rt');
    registerEndpoint(server, 'administration', 'industry-code-insurer-industry-codes-rt');
    registerEndpoint(server, 'administration', 'industry-code-to-insurer-industry-code-rt');
    registerEndpoint(server, 'administration', 'insurer-industry-code-rt');
    registerEndpoint(server, 'administration', 'insurer-activity-code-rt');
    registerEndpoint(server, 'administration', 'insurer-question-rt');
    registerEndpoint(server, 'administration', 'insurer-logo-rt');
    registerEndpoint(server, 'administration', 'question-answer-rt');
    registerEndpoint(server, 'administration', 'question-type-rt');
    registerEndpoint(server, 'administration', 'question-activity-codes-rt');
    registerEndpoint(server, 'administration', 'question-insurer-industry-codes-rt');
    registerEndpoint(server, 'administration', 'insurer-industry-code-talage-questions-rt');
    registerEndpoint(server, 'administration', 'activity-code-questions-rt');
    registerEndpoint(server, 'administration', 'activity-code-association-rt');
    registerEndpoint(server, 'administration', 'payment-plan-rt');
    registerEndpoint(server, 'administration', 'policy-type-rt');
    registerEndpoint(server, 'administration', 'user-group-rt');
    registerEndpoint(server, 'administration', 'mapping-rt');

    if(global.settings.ENABLE_GENERIC_API === "YES"){
        registerEndpoint(server, 'api', 'industry-categories-rt');
        registerEndpoint(server, 'api', 'industry-codes-rt');
        registerEndpoint(server, 'api', 'activity-codes-rt');
        registerEndpoint(server, 'api', 'application-rt');
        registerEndpoint(server, 'api', 'auth-api-rt');

        // new quote app endpoints
        registerEndpoint(server, 'mitsumori', 'route-planner-rt');
        registerEndpoint(server, 'mitsumori', 'resources-rt');
        registerEndpoint(server, 'mitsumori', 'agency-quote-rt');
        registerEndpoint(server, 'mitsumori', 'application-meta-rt');
        registerEndpoint(server, 'mitsumori', 'auth-quote-rt');
    }

    // Server.AddGet('Uptime Check', '/', GetUptime);
    // AWS load balancers and pingdom send /uptime
    server.addGet('Uptime Check', '/uptime', getUptime);
};