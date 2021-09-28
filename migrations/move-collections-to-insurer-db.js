// Add global helpers to load shared modules
global.rootPath = require('path').join(__dirname, '..');
global.sharedPath = require('path').join(global.rootPath , '/shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
const talageEvent = global.requireShared('services/talageeventemitter.js');
global.requireShared('./helpers/tracker.js');
const cliProgress = require('cli-progress');

const logger = global.requireShared('/services/logger.js');
const globalSettings = global.requireRootPath('./settings.js');

const mongoose = require('../mongoose');

const collectionsToMigrate = [
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
 * 
 * @returns 
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

    for (const curCollection of collectionsToMigrate) {
        const rows = await global.mongodb.collection(curCollection).find({});
        const promises = [];
        const bar1 = new cliProgress.SingleBar({
            format: `{bar} {percentage}% | {value}/{total} | ${curCollection} Importer`,
        }, cliProgress.Presets.legacy);
        bar1.start(await rows.count(), 0);
        if (await rows.count() <= 0) {
            throw new Error(`Why are there no rows to import in mongodb.${curCollection}? We can't really import nothing.`);
        }

        // Check that count is zero in the receiving collection.
        const rowsInNewCollection = await global.insurerMongodb.collection(curCollection).find({});
        if (await rowsInNewCollection.count() > 0) {
            throw new Error(`Row count in insurerDatabase.${curCollection} contains rows. So not sure if it's save to do import`);
        }

        await rows.forEach(async (row) => {
            promises.push(global.insurerMongodb.collection(curCollection).insertOne(row)
                .then(() => bar1.increment()));
        });
        await Promise.all(promises);
        bar1.stop();

        const checkRows1 = await global.mongodb.collection(curCollection).find({});
        const checkRows2 = await global.insurerMongodb.collection(curCollection).find({});
        if (await checkRows1.count() !== await checkRows2.count()) {
            throw new Error(`Cannot continue. Insurer database rows in ${curCollection} does not equal old database rows.`);
        } else {
        }
    }

    console.log('Done!');
    process.exit(0);
}

main()
    .catch(err => { console.log(err); process.exit(0); });