/* eslint-disable no-process-exit */
'use strict';

/*
    CURRENT SNAPSHOT OF INSURERS (slugs) THAT HAVE INDUSTRY CODES (see validInsurers array):

    cna,
    chubb,
    acuity,
    btis,
    liberty,
    markel-fitness,
    hiscox

    Use these slugs to generate mapping files.
*/

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

function logErrorAndExit(message){
    // eslint-disable-next-line no-console
    console.log(colors.red(message));
    process.exit(-1);
}

function logStatus(message){
    // eslint-disable-next-line no-console
    console.log(colors.yellow(message));
}

function logSuccess(message){
    // eslint-disable-next-line no-console
    console.log(colors.green(message));
}

// NOTE: This list will need to be updated as we add insurers (or update existing insurers) with Industry Codes
// To add an insurer, simply add the insurer slug to the list below...
const validInsurers = [
    "cna",
    "chubb",
    "acuity",
    "btis",
    "liberty",
    "markel-fitness",
    "hiscox"
];

/**
 * Main entrypoint
 *
 * @returns {void}
 */
async function main(){

    // Get slug from command line arguments
    const cliArgs = process.argv.slice(2);
    if (!cliArgs || !cliArgs.length > 0) {
        logErrorAndExit('Insurer slug not provided as command line argument. Stopping.');
    } else if (!validInsurers.includes(cliArgs[0])) {
        logErrorAndExit(
            `Provided insurer slug "${cliArgs[0]}" is not valid. Please provide one of the following:\n` + 
            `${validInsurers.join(', ')}.\n` + 
            `If this insurer has been updated to have Industry Codes, please update the validInsurers array in this script with their slug. Stopping.`
        );
    }

    // Get insurer information using passed in slug
    let insurer = null;
    try {
        insurer = await getInsurer(cliArgs[0]);
    } catch (e) {
        logErrorAndExit(`There was an error getting the insurer from the database: ${e}. Stopping.`);
    }

    if (!insurer) {
        logErrorAndExit(`Could not find insurer from provided Insurer slug ${cliArgs[0]}. Stopping.`);
    }

    logSuccess('\n');
    logSuccess("========================================================================");
    logSuccess(`Creating CSV file for ${insurer.slug} Industry Code to Talage Industry Code Mappings`);
    logSuccess("========================================================================");
    logSuccess('\n');

    // Load the settings from a .env file - Settings are loaded first
    if(!globalSettings.load()){
        logErrorAndExit('Error loading variables. Stopping.');
    }

    // Initialize the version
    if(!await version.load()){
        logErrorAndExit('Error initializing version. Stopping.');
    }

    // Connect to the logger
    if(!logger.connect()){
        logErrorAndExit('Error connecting to logger. Stopping.');
    }

    // Connect to the database
    if(!await db.connect()){
        logErrorAndExit('Error connecting to database. Stopping.');
    }

    // Load the database module and make it globally available
    global.db = global.requireShared('./services/db.js');

    let sql = `
        SELECT ic.id, ic.description AS 'Talage Industry', iic.code AS 'code', iic.description AS '${insurer.slug} Industry', iic.territory
        FROM clw_talage_industry_codes AS ic
            LEFT JOIN industry_code_to_insurer_industry_code AS ictiic ON 
                (ic.id = ictiic.talageIndustryCodeId)
            LEFT JOIN clw_talage_insurer_industry_codes AS iic ON
                (ictiic.insurerIndustryCodeId = iic.id)
        WHERE iic.insurer = ${insurer.id}
            AND ic.state = 1
        `;

    let results = null;

    logStatus("\nRetrieving database records...");

    // Get all the Industry Codes for CNA linked to internal Talage Industry Codes
    try {
        results = await db.query(sql);
    } catch (e) {
        logErrorAndExit(`There was an error getting industry codes from the database: ${e}. Stopping.`);
    }

    if (!results || !results.length > 0) {
        logErrorAndExit(`Could not find any industry code mappings for ${insurer.slug}. Stopping.`);
    }

    logSuccess(`${results.length} records retrieved.\n`);

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
        logErrorAndExit(`There was an error getting insurer information from the database: ${e}. Stopping.`);
    }

    if (!result) {
        logErrorAndExit(`Could not retrieve insurer information for slug = ${insurerSlug}. Stopping.`);
    }
    
    return result[0];
}

function writeToCSV(activityCodes, headers, writePath) {
    let csv = activityCodes.map(row => headers.map(fieldName => JSON.stringify(row[fieldName])).join(';'));
    csv.unshift(headers.join(';'));
    csv = csv.join('\r\n');

    logStatus('Generating .CSV file...');

    try {
        fs.writeFileSync(writePath, csv);
    } catch (e) {
        logErrorAndExit(`Couldn't write out activity codes: ${e}.`);
    }

    logSuccess(`.CSV file generated at ${writePath}`);
}

main();