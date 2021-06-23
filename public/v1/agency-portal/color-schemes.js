/* eslint-disable no-unused-vars */
'use strict';

const serverHelper = global.requireRootPath('server.js');
const colorConverter = require('color-converter').default;
const ColorSchemeBO = global.requireShared('./models/ColorScheme-BO.js');

/**
 * Calculates an accent color for a custom color scheme
 *
 * @param {object} rgbColorString - A color
 *
 * @returns {string} The color's accent color
 */
function calculateAccentColor(rgbColorString) {
    // TODO: move this to retrieving the color scheme so that we can adjust this on-the-fly -SF
    // We calculate the accents based on the HSV color space.
    const color = colorConverter.fromHex(rgbColorString);
    // Keep the saturation in the range of 0.2 - 0.8
    if (color.saturation > 0.5) {
        color.saturation = Math.max(0.2, color.saturation - 0.5);
    }
    else {
        color.saturation = Math.min(0.8, color.saturation + 0.5);
    }
    return color.toHex();
}

/**
 * Validates the input to the endpoint
 *
 * @param {object} request - HTTP request object
 *
 * @returns {String} The validated request data
 */
async function validate(request) {
    // Establish default values
    const data = {
        primary: '',
        primary_accent: '',
        secondary: '',
        secondary_accent: '',
        tertiary: '',
        tertiary_accent: ''
    };

    // For now only validating the primary and secondary color schemes
    if (!Object.prototype.hasOwnProperty.call(request.body, 'primary') || !request.body.primary) {
        throw new Error('You must choose a primary color');
    }
    else {
        data.primary = request.body.primary;
    }
    if (!Object.prototype.hasOwnProperty.call(request.body, 'secondary') || !request.body.secondary) {
        throw new Error('You must choose a secondary color');
    }
    else {
        data.secondary = request.body.secondary;
    }
    return data;
}

/**
 * Retrieves available color schemes
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getColorSchemes(req, res, next) {
    // Build a query that will return all of the landing pages
    // We are excluding custom colors name
    const colorSchemeBO = new ColorSchemeBO()
    let colorSchemaList = null;
    try {
        colorSchemaList = await colorSchemeBO.getListStandard();
    }
    catch (error) {
        log.error(`Could not retrieve color schemes: ${error} ${__location}`);
        return serverHelper.sendError(res, next, 'Internal Error');
    }
    res.send(200, colorSchemaList);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get Color Schemes', `${basePath}/color-schemes`, getColorSchemes, 'pages', 'view');
};