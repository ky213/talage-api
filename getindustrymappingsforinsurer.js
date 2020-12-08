/* eslint-disable no-process-exit */
'use strict';

// Add global helpers to load shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.rootPath = require('path').join(__dirname, '/');
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);

const colors = require('colors');
const logger = require('./shared/services/logger.js');
const db = require('./shared/services/db.js');
const globalSettings = require('./settings.js');
const version = require('./version.js');
const fs = require('fs');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
global.tracker = tracker;

/**
 * Convenience method to log errors both locally and remotely. This is used to display messages both on the console and in the error logs.
 *
 * @param {string} message - The message to be logged
 * @returns {void}
 */
function logLocalErrorMessageAndExit(message){
    if(global.log){
        log.error(message);
    }
    // eslint-disable-next-line no-console
    console.log(colors.red(message));

    process.exit(-1);
}

/**
 * Main entrypoint
 *
 * @returns {void}
 */
async function main(){

    console.log('\n');
    console.log(colors.green("========================================================================"));
    console.log(colors.green("Creating CSV file for CNA Industry Code to Talage Industry Code Mappings"));
    console.log(colors.green("========================================================================"));
    console.log('\n');

    // Load the settings from a .env file - Settings are loaded first
    if(!globalSettings.load()){
        logLocalErrorMessageAndExit('Error loading variables. Stopping.');
    }

    // Initialize the version
    if(!await version.load()){
        logLocalErrorMessageAndExit('Error initializing version. Stopping.');
    }

    // Connect to the logger
    if(!logger.connect()){
        logLocalErrorMessageAndExit('Error connecting to logger. Stopping.');
    }

    // Connect to the database
    if(!await db.connect()){
        logLocalErrorMessageAndExit('Error connecting to database. Stopping.');
    }

    // Load the database module and make it globally available
    global.db = global.requireShared('./services/db.js');

    const cliArgs = process.argv.slice(2);
    if (!cliArgs || !cliArgs.length > 0) {
        logLocalErrorMessageAndExit('Insurer slug not provided as command line argument. Stopping.');
    }

    let insurer = null;
    try {
        insurer = await getInsurer(cliArgs[0]);
    } catch (e) {
        logLocalErrorMessageAndExit(`There was an error getting the insurer from the database: ${e}. Stopping.`);
    }

    if (!insurer) {
        logLocalErrorMessageAndExit(`Could not find insurer from provided Insurer slug ${cliArgs[0]}. Stopping.`);
    }

    let sql = `
        SELECT ic.id, ic.description AS 'Talage Industry', iic.code AS 'SIC', iic.description AS 'CNA Industry', iic.territory
        FROM clw_talage_industry_codes AS ic
            LEFT JOIN clw_talage_insurer_industry_codes AS iic ON 
                (ic.sic = iic.code)
        WHERE iic.insurer = 4
            AND ic.state = 1
        `;

    let results = null;

    console.log(colors.yellow("\nRetrieving database records..."));

    // Get all the Industry Codes for CNA linked to internal Talage Industry Codes
    try {
        results = await db.query(sql);
    } catch (e) {
        logLocalErrorMessageAndExit(`There was an error getting industry codes from the database: ${e}. Stopping.`);
    }

    console.log(colors.green(`${results.length} records retrieved.\n`));

    const resultMap = {};
    
    // Map the results, reducing the many territory entries to a single id with an array of those territories
    results.forEach(result => {
        const {id, territory} = result;
        delete result.id;
        delete result.territory;
        if (!resultMap.hasOwnProperty(id)) {
            resultMap[id] = result;
            resultMap[id].territories = [territory];
        } else {
            resultMap[id].territories.push(territory);
        }
    });

    // Convert the data into csv shaped data
    const csvData = Object.values(resultMap);
    csvData.map(data => {
        data.Territories = data.territories.join(", ");
        delete data.territories;
    });

    // Create the headers for the CSV file
    const headers = Object.keys(csvData[0]);
    headers.map(header => `"${header}"`);

    // Generate the CSV file
    writeToCSV(csvData, headers, `${__dirname}/insurer industry mapping files/Mapped ${insurer.slug} Industries.CSV`);
}

async function getInsurer(insurerSlug) {
    const sql = `
		SELECT id, name, slug
		FROM clw_talage_insurers
		WHERE slug = '${insurerSlug}'
    `;
    
    let result = null;
    try {
        result = await db.query(sql);
    } catch (e) {
        logLocalErrorMessageAndExit(`There was an error getting insurer information from the database: ${e}. Stopping.`);
    }

    if (!result) {
        logLocalErrorMessageAndExit(`Could not retrieve insurer information for slug = ${insurerSlug}. Stopping.`);
    }
    
    return result[0];
}

function writeToCSV(activityCodes, headers, writePath) {
    let csv = activityCodes.map(row => headers.map(fieldName => JSON.stringify(row[fieldName])).join(';'));
    csv.unshift(headers.join(';'));
    csv = csv.join('\r\n');

    console.log(colors.yellow('Generating .CSV file...'));

    try {
        fs.writeFileSync(writePath, csv);
    } catch (e) {
        logLocalErrorMessageAndExit(`Couldn't write out activity codes: ${e}.`);
    }

    console.log(colors.green(`.CSV file generated at ${writePath}`));
}

main();