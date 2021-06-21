/* eslint-disable require-jsdoc */
'use strict';

const ColorSchemeBO = global.requireShared('./models/ColorScheme-BO.js');
const serverHelper = global.requireRootPath('server.js');

async function readColorSchemeList(req, res, next) {
    // Retrieve the color schemes from the database.
    // Obviously this is only quick and dirty just to test the administration client API. This code should go into a model object.
    //TODO use BO


    const colorSchemeBO = new ColorSchemeBO()
    let colorSchemaList = null;
    try {
        colorSchemaList = await colorSchemeBO.getListStandard();
    }
    catch (error) {
        log.error(`Could not retrieve color schemes: ${error} ${__location}`);
        return serverHelper.sendError(res, next, 'Internal Error');
    }

    // Build the color schemes response
    const colorSchemes = [];
    colorSchemaList.forEach((colorScheme) => {
        colorSchemes.push({
            id: colorScheme.colorSchemeId,
            name: colorScheme.name,
            primaryColor: colorScheme.primary,
            primaryAccentColor: colorScheme.primary_accent,
            secondaryColor: colorScheme.secondary,
            secondaryAccentColor: colorScheme.secondary_accent
        });
    });

    // Send the response
    return serverHelper.send(colorSchemes, res, next);
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('Read color scheme list', `${basePath}/color-scheme`, readColorSchemeList, 'administration', 'all');
};