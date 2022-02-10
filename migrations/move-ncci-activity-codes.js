/* eslint-disable no-console */
/* eslint-disable no-process-exit */

// Add global helpers to load shared modules
global.rootPath = require("path").join(__dirname, "..");
global.sharedPath = require("path").join(global.rootPath, "/shared");
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
global.requireShared("./helpers/tracker.js");

const logger = global.requireShared("/services/logger.js");
const globalSettings = global.requireRootPath("./settings.js");
const colors = require("colors");

const mongoose = require("../mongoose");

/**
 * Copy insurer's activity codes from Liberty Mututal, AmTrust, and Markel to NCCI insurer (unique copy)
 *
 * @returns {void}
 */
async function main() {
    // Load the settings from a .env file - Settings are loaded first
    if (!globalSettings.load()) {
        log.error(colors.red("Error loading variables. Stopping."));
        return;
    }

    // Connect to the logger
    if (!logger.connect()) {
        log.error(colors.red("Error connecting to log. Stopping."));
        return;
    }

    try {
        log.info(colors.green("Init."));
        await mongoose.init();
        const InsurerActivityCode = global.mongoose.InsurerActivityCode;

        const previousNCCIActivityCodes = await InsurerActivityCode.find({insurerId: 9}); // NCCI fake insurer
        const existingFullCodes = previousNCCIActivityCodes.map(({
            code, sub
        }) => code + sub);
        const allActivityCodes = await InsurerActivityCode.aggregate([
            //eslint-disable-next-line
            {$match: {insurerId: {$in: [3, 14, 19]}}},//Markel, Liberty Mutual, AmTrust
            {$addFields: {totalTerritories: {$size: "$territoryList"}}}, // Activity code that cover most territories come first.
            {$sort: {totalTerritories: -1}},
            {$project: {
                _id: 0,
                totalTerritories: 0
            }}
        ]);

        log.info(colors.green("Processing..."));

        //Remove duplicates
        const uniqueActivityCodes = [];
        const alreadyProcessedCodes = [];

        allActivityCodes.forEach((activityCode) => {
            const fullCode = activityCode.code + activityCode.sub;

            if (!existingFullCodes.includes(fullCode) && !alreadyProcessedCodes.includes(fullCode)) {
                activityCode.insurerId = 9; // NCCI fake insurer
                activityCode.insurerActivityCodeId = null; // for mongoose hook to generate new uuid
                uniqueActivityCodes.push(activityCode);
                alreadyProcessedCodes.push(fullCode);
            }
        });

        await InsurerActivityCode.insertMany(uniqueActivityCodes);

        log.info(colors.green("Done"));
        log.info(colors.green(`Total migrated: ${uniqueActivityCodes.length} code(s)`));
        process.exit(0);
    }
    catch (error) {
        log.error(colors.red("Error migrating NCCI code"));
        log.error(error);
        process.exit(1);
    }
}

main()