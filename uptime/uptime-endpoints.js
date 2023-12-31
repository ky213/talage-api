'use strict';
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO');

/**
 * Gets the current server uptime
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getUptime(req, res, next){
    res.setHeader('content-type', 'application/xml');
    const startTime = process.hrtime();

    // Check the database connection by getting agencyNetworkID: 1
    let error = false;
    const agencyNetworkBO = new AgencyNetworkBO();
    await agencyNetworkBO.getById(1).catch(function(e){
        log.error(e.message + __location);
        error = true;
    });

    // Calculate the elapsed time
    const elapsed = process.hrtime(startTime)[1] / 1000000;

    // Send the appropriate response
    if(error){
        res.end(`<pingdom_http_custom_check> <status>DOWN</status> <response_time>${elapsed.toFixed(8)}</response_time> <version>${global.version}</version> </pingdom_http_custom_check>`);
        return next();
    }
    res.end(`<pingdom_http_custom_check> <status>OK</status> <response_time>${elapsed.toFixed(8)}</response_time> <version>${global.version}</version> </pingdom_http_custom_check>`);
    return next();
}

exports.registerEndpoints = (server) => {
    server.addGet('Uptime Check', '/', getUptime);
    // AWS load balancers are up to request /uptime
    server.addGet('Uptime Check', '/uptime', getUptime);
};