/* eslint-disable no-console */
/* eslint-disable no-process-exit */
/* eslint sort-keys: "off"*/

// Add global helpers to load shared modules
global.rootPath = require('path').join(__dirname, '..');
global.sharedPath = require('path').join(global.rootPath , '/shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
global.requireShared('./helpers/tracker.js');
const cliProgress = require('cli-progress');

const logger = global.requireShared('/services/logger.js');
const globalSettings = global.requireRootPath('./settings.js');
const colors = require('colors');

const mongoose = require('../mongoose');

/**
 * Convenience method to log errors both locally and remotely. This is used to display messages both on the console and in the error logs.
 *
 * @param {string} message - The message to be logged
 * @returns {void}
 */
function logError(message) {
    if (global.log) {
        log.error(message);
    }
    else{
        // eslint-disable-next-line no-console
        console.log(colors.red(message));
    }
}

const collectionsToMigrate = [
    'activitycodes',
    'activitycodes_history',
    'codegroups',
    'industrycodecategories',
    'industrycodecategories_history',
    'industrycodes',
    'industrycodes_history',
    'insureractivitycodes',
    'insureractivitycodes_history',
    'insurerindustrycodes',
    'insurerindustrycodes_history',
    'insurerpolicytypes',
    'insurerpolicytypes_history',
    'insurerquestions',
    'insurerquestions_history',
    'insurers',
    'insurers_history',
    'questions',
    'questions_history'
];

/**
 * Copies the contents of the collections in collectionsToMigrate from
 * MONGODB_DATABASENAME to MONGODB_INSURER_DATABASENAME database.
 *
 * @returns {void}
 */
async function main() {
    // Load the settings from a .env file - Settings are loaded first
    if (!globalSettings.load()) {
        logError('Error loading variables. Stopping.');
        return;
    }

    // Connect to the logger
    if (!logger.connect()) {
        logError('Error connecting to log. Stopping.');
        return;
    }

    await mongoose.init();
    log.info(`starting migration`)

    for (const curCollection of collectionsToMigrate) {
        log.info(`Getting ${curCollection}`)
        const rows = await global.mongodb.collection(curCollection).find({});
        const promises = [];
        const bar1 = new cliProgress.SingleBar({format: `{bar} {percentage}% | {value}/{total} | ${curCollection} Importer`}, cliProgress.Presets.legacy);
        bar1.start(await rows.count(), 0);
        if (await rows.count() <= 0) {
            throw new Error(`Why are there no rows to import in mongodb.${curCollection}? We can't really import nothing.`);
        }

        // Check that count is zero in the receiving collection.
        log.info(`Checking ${curCollection} at DEST`)
        const rowsInNewCollection = await global.insurerMongodb.collection(curCollection).find({});
        if (await rowsInNewCollection.count() > 0) {
            throw new Error(`Row count in insurerDatabase.${curCollection} contains rows. So not sure if it's save to do import`);
        }
        if(curCollection.indexOf("_history") === -1){
            log.info(`setting up indexes for ${curCollection}`)
            const indexesSource = await global.mongodb.collection(curCollection).getIndexes({full: false});
            const indexesDest = await global.insurerMongodb.collection(curCollection).getIndexes({full: false});
            log.debug(`indexes ${JSON.stringify(indexesSource)}`)
            // eslint-disable-next-line guard-for-in
            for (const indexKey in indexesSource){
                if(!indexesDest[indexKey]){
                    await global.insurerMongodb.collection(curCollection).createIndex(indexesSource[indexKey])
                }
            }
        }
        log.info(`Moving ${curCollection} to DEST`)
        await rows.forEach(async(row) => {
            promises.push(global.insurerMongodb.collection(curCollection).insertOne(row).
                then(() => bar1.increment()));
        });
        await Promise.all(promises);
        bar1.stop();

        const checkRows1 = await global.mongodb.collection(curCollection).find({});
        const checkRows2 = await global.insurerMongodb.collection(curCollection).find({});
        if (await checkRows1.count() !== await checkRows2.count()) {
            throw new Error(`Cannot continue. Insurer database rows in ${curCollection} does not equal old database rows.`);
        }
        else {
            // If everything looks OK, then keep the old dataset for now. It's
            // safer that way. But if you want to uncomment this on your local,
            // then go for it!
            // await global.mongodb.collection(curCollection).drop();
        }
    }

    console.log('Done!');
    process.exit(0);
}

main().catch(err => {
    console.log(err);
    process.exit(0);
});