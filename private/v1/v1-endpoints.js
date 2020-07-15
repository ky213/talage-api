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
// The private endpoints are for hte use of the PHP Administrator app.
exports.registerEndpoints = (server) => {
    registerEndpoint(server, 'application', 'application');
    registerEndpoint(server, 'docusign', 'embedded');
    registerEndpoint(server, 'email', 'email');
    registerEndpoint(server, 'encryption', 'decrypt');
    registerEndpoint(server, 'encryption', 'encrypt');
    registerEndpoint(server, 'encryption', 'verify-password');
    //registerEndpoint(server, 'encryption', 'hash');
    registerEndpoint(server, 'encryption', 'hash-password');
    registerEndpoint(server, 'file', 'file');
    registerEndpoint(server, 'slack', 'post-to-channel');
};