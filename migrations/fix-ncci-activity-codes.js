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
const moment = require('moment')
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

        const existingNCCIActivityCodeDocList = await InsurerActivityCode.find({
            insurerId: 9, // NCCI insurer (fake)
            talageActivityCodeIdList: {$ne:null},
            active: true
        });


        const existingNCCIActivityCodes = existingNCCIActivityCodeDocList.map(({code}) => code);

        // const libertyMutualCodes = await InsurerActivityCode.find({
        //     insurerId: 14,
        //     talageActivityCodeIdList: {$ne:null},
        //     active: true
        // }, {_id: 0}).lean()

        // const markelCodes = await InsurerActivityCode.find({
        //     insurerId: 3,
        //     talageActivityCodeIdList: {$ne:null},
        //     active: true
        // }, {_id: 0}).lean()

        const amtrustCodes = await InsurerActivityCode.find({
            insurerId: 19,
            talageActivityCodeIdList: {$ne:null},
            active: true
        }, {_id: 0}).lean()

        const finalCodes = []
        const processedCodes = []
        let updateCount = 0;
        //Process Codes: we use Liberty Mututal as a main source and then fill the missing ones from Markel and AmTrust

        // libertyMutualCodes.forEach((activityCode) => {
        //      this misses territories.  Why 8810 is only in one state note 43-50 states like it should be.
        //     if(!existingNCCIActivityCodes.includes(activityCode.code) && !processedCodes.includes(activityCode.code)){
        //         finalCodes.push(activityCode)
        //         processedCodes.push(activityCode.code)
        //     }
        // })

        // markelCodes.forEach((activityCode) => {
        //     if(!existingNCCIActivityCodes.includes(activityCode.code) && !processedCodes.includes(activityCode.code)){
        //         finalCodes.push(activityCode)
        //         processedCodes.push(activityCode.code)
        //     }
        // })

        //amtrustCodes.forEach((activityCode) => {
        for(const activityCode of amtrustCodes){
            try{
                //complete miss
                if(!existingNCCIActivityCodes.includes(activityCode.code) && !processedCodes.includes(activityCode.code)){
                    finalCodes.push(activityCode)
                    processedCodes.push(activityCode.code)
                }
                else {
                    // Hard march check for nfor needing to add its territory
                    const existingMatchCode = existingNCCIActivityCodeDocList.find((ncci_iac) => ncci_iac.code === activityCode.code);
                    if(existingMatchCode){
                        let updateExisting = false;
                        if(existingMatchCode.description === "n/a"){
                            updateExisting = true;
                            existingMatchCode.description = activityCode.description
                        }
                        for(const tacId of activityCode.talageActivityCodeIdList){
                            if(existingMatchCode.talageActivityCodeIdList.indexOf(tacId) === -1){
                                if(activityCode.code === "8810"){
                                    log.info(`adding TAC to ncci ${existingMatchCode.code}`)
                                }
                                updateExisting = true;
                                existingMatchCode.talageActivityCodeIdList.push(tacId)
                            }
                        }

                        // if(activityCode.code === "8810"){
                        //     log.info(`existingMatchCode.territoryList ${existingMatchCode.code} ${existingMatchCode.insurerActivityCodeId} territories ${existingMatchCode.territoryList}`)
                        // }
                        //for(const territoryCd of activityCode.territoryList){
                        for(let i = 0; i < activityCode.territoryList.length; i++){
                            const territoryCd = activityCode.territoryList[i];
                            if(existingMatchCode.territoryList.indexOf(territoryCd) === -1){
                                updateExisting = true;
                                if(activityCode.code === "8810"){
                                    log.info(`adding state ${territoryCd} to ncci ${existingMatchCode.code}`)
                                }
                                existingMatchCode.territoryList.push(territoryCd)
                            }
                        }


                        if(updateExisting){
                            log.info(`update ncci ${existingMatchCode.code}`)
                            await existingMatchCode.save();
                            updateCount++
                        }
                        continue;
                    }

                    //match on newOnes to be added for add AMtrust this about collasping to just code not sub codes.
                    const newMatchCode = existingNCCIActivityCodeDocList.find((ncci_iac) => ncci_iac.code = activityCode.code);
                    if(newMatchCode){
                        //check to add talageActivityCodes
                        for(const tacId of activityCode.talageActivityCodeIdList){
                            if(!newMatchCode.talageActivityCodeIdList.includes(tacId)){
                                newMatchCode.talageActivityCodeIdList.push(tacId)
                            }
                        }
                        for(const territoryCd of activityCode.territoryList){
                            if(!newMatchCode.territoryList.includes(territoryCd)){
                                newMatchCode.territoryList.push(territoryCd)
                            }
                        }

                    }
                }
            }
            catch(err){
                log.debug(`fix ncci lookup Error ${err} on ${JSON.stringify(activityCode)}` + __location)
            }
        }


        finalCodes.forEach((activityCode) => {
            activityCode.insurerId = 9; // NCCI insurer (fake)
            activityCode.insurerActivityCodeId = null; // for mongoose hook to generate new uuid (unique constraint)
            activityCode.createdAt = moment()
            activityCode.updatedAt = moment()
        });

        await InsurerActivityCode.insertMany(finalCodes);
        log.debug(`finalCodes  ${JSON.stringify(finalCodes)}`)

        log.info(colors.green("Done"));
        log.info(colors.green(`Total migrated: ${finalCodes.length} code(s)`));
        log.info(colors.green(`Total updated: ${updateCount} code(s)`));
        process.exit(0);
    }
    catch (error) {
        log.error(colors.red("Error migrating NCCI code: ", error.message, ",", __location));
        process.exit(1);
    }
}

main()