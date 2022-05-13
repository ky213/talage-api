'use strict';

const apiVersion = 'v1';
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO');

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
    const agencyNetworkBO = new AgencyNetworkBO();
    await agencyNetworkBO.getById(1).catch(function(e){
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

    // Webhooks
    registerEndpoint(server, 'webhooks', 'coterie');

    // Activities removed in 1.5.0
    // RegisterEndpoint(server, 'agency-portal', 'activities');
    registerEndpoint(server, 'agency-portal', 'agencies');
    registerEndpoint(server, 'agency-portal', 'agency');
    registerEndpoint(server, 'agency-portal', 'agency-network');
    registerEndpoint(server, 'agency-portal', 'agency-location');
    registerEndpoint(server, 'agency-portal', 'agency-user');
    registerEndpoint(server, 'agency-portal', 'application');
    registerEndpoint(server, 'agency-portal', 'application-notes');
    registerEndpoint(server, 'agency-portal', 'applications');
    registerEndpoint(server, 'agency-portal', 'banners');
    registerEndpoint(server, 'agency-portal', 'change-password');
    registerEndpoint(server, 'agency-portal', 'city-territory');
    registerEndpoint(server, 'agency-portal', 'color-schemes');
    registerEndpoint(server, 'agency-portal', 'create-agency');
    registerEndpoint(server, 'agency-portal', 'landing-page');
    registerEndpoint(server, 'agency-portal', 'landing-pages');
    registerEndpoint(server, 'agency-portal', 'pending-applications-rt');
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
    registerEndpoint(server, 'agency-portal', 'acord-ocr');

    // Auth
    registerEndpoint(server, 'auth', 'administration');
    registerEndpoint(server, 'auth', 'agency-portal');
    registerEndpoint(server, 'auth', 'token');
    registerEndpoint(server, 'auth', 'openid-auth');

    // Code
    registerEndpoint(server, 'code', 'activity-codes');
    registerEndpoint(server, 'code', 'industry-categories');
    registerEndpoint(server, 'code', 'industry-codes');

    // Doc
    registerEndpoint(server, 'doc', 'acord-form-wc');

    // Question
    registerEndpoint(server, 'question', 'questions');

    // Site
    registerEndpoint(server, 'site', 'brand');

    // Administration
    registerEndpoint(server, 'administration', 'color-scheme');
    registerEndpoint(server, 'administration', 'message');
    registerEndpoint(server, 'administration', 'business-data-lookup');
    registerEndpoint(server, 'administration', 'insurer');
    registerEndpoint(server, 'administration', 'insurer-policy-type-rt');
    registerEndpoint(server, 'administration', 'agency-network-rt');
    registerEndpoint(server, 'administration', 'agency-network-user-rt');
    registerEndpoint(server, 'administration', 'agency-rt');
    registerEndpoint(server, 'administration', 'agency-email-rt');
    registerEndpoint(server, 'administration', 'agency-location-rt');
    registerEndpoint(server, 'administration', 'territory-rt');
    registerEndpoint(server, 'administration', 'question-rt');
    registerEndpoint(server, 'administration', 'question-categories-rt');
    registerEndpoint(server, 'administration', 'question-preview-rt');
    registerEndpoint(server, 'administration', 'activity-code-rt');
    registerEndpoint(server, 'administration', 'industry-code-rt');
    registerEndpoint(server, 'administration', 'industry-code-association-rt');
    registerEndpoint(server, 'administration', 'industry-code-category-rt');
    registerEndpoint(server, 'administration', 'industry-code-activity-codes-rt');
    registerEndpoint(server, 'administration', 'activity-code-industry-codes-rt');
    registerEndpoint(server, 'administration', 'insurer-industry-code-rt');
    registerEndpoint(server, 'administration', 'insurer-activity-code-rt');
    registerEndpoint(server, 'administration', 'insurer-question-rt');
    registerEndpoint(server, 'administration', 'insurer-logo-rt');
    registerEndpoint(server, 'administration', 'insurer-portal-user-group-rt');
    registerEndpoint(server, 'administration', 'insurer-portal-user-rt');
    registerEndpoint(server, 'administration', 'question-type-rt');
    registerEndpoint(server, 'administration', 'policy-type-rt');
    registerEndpoint(server, 'administration', 'payment-plan-rt');
    registerEndpoint(server, 'administration', 'user-group-rt');
    registerEndpoint(server, 'administration', 'code-group-rt');
    registerEndpoint(server, 'administration', 'mapping-rt');


    registerEndpoint(server, 'api', 'industry-categories-rt');
    registerEndpoint(server, 'api', 'industry-codes-rt');
    registerEndpoint(server, 'api', 'activity-codes-rt');
    registerEndpoint(server, 'api', 'application-rt');
    registerEndpoint(server, 'api', 'auth-api-rt');

    registerEndpoint(server, 'api-login', 'api-login-rt');

    // new quote app endpoints
    registerEndpoint(server, 'mitsumori', 'route-planner-rt');
    registerEndpoint(server, 'mitsumori', 'resources-rt');
    registerEndpoint(server, 'mitsumori', 'load-application-rt');
    registerEndpoint(server, 'mitsumori', 'agency-quote-rt');
    registerEndpoint(server, 'mitsumori', 'application-meta-rt');
    registerEndpoint(server, 'mitsumori', 'auth-quote-rt');

    // digalent quote app endpoints
    registerEndpoint(server, 'digalent', 'resources-rt');
    registerEndpoint(server, 'digalent', 'load-application-rt');
    registerEndpoint(server, 'digalent', 'agency-quote-rt');
    registerEndpoint(server, 'digalent', 'application-meta-rt');
    registerEndpoint(server, 'digalent', 'auth-quote-rt');

    // Insurer Portal Endpoints
    registerEndpoint(server, 'insurer-portal', 'auth-rt');
    registerEndpoint(server, 'insurer-portal', 'agency-rt');
    registerEndpoint(server, 'insurer-portal', 'winloss-rt');
    registerEndpoint(server, 'insurer-portal', 'dashboard-rt');
    registerEndpoint(server, 'insurer-portal', 'applications-rt');

    // Server.AddGet('Uptime Check', '/', GetUptime);
    // AWS load balancers and pingdom send /uptime
    server.addGet('Uptime Check', '/uptime', getUptime);
};
