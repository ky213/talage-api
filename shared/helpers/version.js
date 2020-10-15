'use strict';

/**
 * Retrieves the version number of this API from its CHANGELOG.md file
 *
 * @return {string} - The version number, or if it cannot find one, 0.0.0
 */
module.exports = function(){
    try{
        // Readin the CHANGELOG.md file
        const contents = require('fs').readFileSync('CHANGELOG.md', 'utf8');

        // Extract the version number from CHANGELOG.md
        return contents.substring(contents.indexOf('"') + 1, contents.indexOf('"', contents.indexOf('"') + 1));
    }
    catch(e){
        log.warn('Unable to find CHANGELOG.md. Version number will default to 0.0.0.');
        log.verbose(e);
        return '0.0.0';
    }
};