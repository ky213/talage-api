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

        log.info(colors.green("Processing..."));

        const existingNCCIActivityCodes = (await InsurerActivityCode.find({
            insurerId: 9, // NCCI insurer (fake)
            active: true
        })).map(({code}) => code);

        const libertyMutualCodes = await InsurerActivityCode.find({
            insurerId: 14,
            active: true
        }, {_id: 0}).lean()

        const markelCodes = await InsurerActivityCode.find({
            insurerId: 3,
            active: true
        }, {_id: 0}).lean()

        const amtrustCodes = await InsurerActivityCode.find({
            insurerId: 19,
            active: true
        }, {_id: 0}).lean()

        const finalCodes = []
        const processedCodes = []

        //Process Codes: we use Liberty Mututal as a main source and then fill the missing ones from Markel and AmTrust

        libertyMutualCodes.forEach((activityCode) => {
            if(!existingNCCIActivityCodes.includes(activityCode.code) && !processedCodes.includes(activityCode.code)){
                finalCodes.push(activityCode)
                processedCodes.push(activityCode.code)
            }
        })

        markelCodes.forEach((activityCode) => {
            if(!existingNCCIActivityCodes.includes(activityCode.code) && !processedCodes.includes(activityCode.code)){
                finalCodes.push(activityCode)
                processedCodes.push(activityCode.code)
            }
        })

        amtrustCodes.forEach((activityCode) => {
            if(!existingNCCIActivityCodes.includes(activityCode.code) && !processedCodes.includes(activityCode.code)){
                finalCodes.push(activityCode)
                processedCodes.push(activityCode.code)
            }
        })


        finalCodes.forEach((activityCode) => {
            activityCode.insurerId = 9; // NCCI insurer (fake)
            activityCode.insurerActivityCodeId = null; // for mongoose hook to generate new uuid (unique constraint)
        });

        await InsurerActivityCode.insertMany(finalCodes);

        log.info(colors.green("Done"));
        log.info(colors.green(`Total migrated: ${finalCodes.length} code(s)`));
        process.exit(0);
    }
    catch (error) {
        log.error(colors.red("Error migrating NCCI code: ", error.message, ",", __location));
        process.exit(1);
    }
}

main()