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
    registerEndpoint(server, 'email', 'email');
    registerEndpoint(server, 'file', 'file');
    registerEndpoint(server, 'slack', 'post-to-channel');
};