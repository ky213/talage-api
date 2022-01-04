/* eslint-disable require-jsdoc */
/* eslint-disable no-process-exit */
/* eslint-disable no-console */
/**
 *  Markel Code Importer
 *
 * This importer relies on the spreadsheet having the following columns and format:
 *
 * Class Code: the 4 digit NCCI code
 * State: the two character state abbreviation
 * Quote Action: one of 'autoquote', 'decline', or 'refer'
 */
const moment = require("moment");
const amtrust = require('./amtrust-client.js');
const emailSvc = global.requireShared('./services/emailsvc.js');
//
const DO_REMOVAL_CHECK = true;
// NOWW removed
const stateList = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "DC",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WV",
    "WI"
];

const ncciStates = ["RI",
    "IA",
    "SC",
    "NH",
    "NC",
    "SD",
    "NY",
    "TN",
    "KS",
    "UT",
    "VT",
    "NM",
    "MA",
    "MD",
    "TX",
    "ME",
    "LA",
    "KY",
    "OK",
    "GA",
    "DC",
    "ID",
    "FL",
    "AL",
    "VA",
    "CO",
    "HI",
    "IL",
    "CT",
    "AZ",
    "AR",
    "WV",
    "NE",
    "NV",
    "WI",
    "MS",
    "MO",
    "MT",
    "IN"];

const paDeStates = ["PA", "DE"];
const logPrefix = "AmTrust Importing WC codes ";

async function CodeImport() {
    const InsurerActivityCodeModel = global.insurerMongodb.model('InsurerActivityCode');
    const ActivityCode = global.mongodb.model('ActivityCode');
    const Insurer = global.insurerMongodb.model('Insurer');

    const insurer = await Insurer.findOne({slug: 'amtrust'});
    if (!insurer) {
        log.error("Importing WC codes Could not find insurer.");
    }

    log.info(`Importing WC codes for insurer ${insurer.name} (id=${insurer.insurerId})` + __location);

    // Authorize the client
    log.info(logPrefix + "Authorizing");
    await amtrust.authorize();

    log.info(logPrefix + "Authorized");

    const amtrustClassCodeMap = {};
    const updateDatabase = "Y";

    for (const state of stateList) {
        log.info(logPrefix + `Retrieving class codes for ${state}`);
        const classCodes = await amtrust.getClassCodes(state);
        if (classCodes) {
            amtrustClassCodeMap[state] = classCodes;
        }
    }


    // Map their eligibility property to our code result value
    const classCodeEligibilityMap = {
        "Refer": "Refer",
        "BindOnline": "BindOnline",
        "Decline": "Decline"
    };
    const queryProjection = {"__v": 0}
    let updateIacCount = 0;
    const amtrustAddCodes = [];
    const newUnMappedCodes = [];
    const startImportDate = moment();
    // const insurerActivityCodesUpdateList = [];
    // // Map all of the codes to the code list
    // // const codeList = new CodeList(CodeList.TYPE_WC, insurer.name, insurer.insurerId);
    for (const state of Object.keys(amtrustClassCodeMap)) {
        log.info(logPrefix + `processing ${state} `);
        let i = 0;
        for (const amTrustClassCode of amtrustClassCodeMap[state]) {
            if (!classCodeEligibilityMap.hasOwnProperty(amTrustClassCode.Eligibility)) {
                log.error(logPrefix + `Unknown class code eligibility: ${amTrustClassCode.Eligibility} ${JSON.stringify(amTrustClassCode)}` + __location);
            }
            if (amTrustClassCode.ClassDescription) {
                let description = amTrustClassCode.ClassDescription.trim();
                description = description.replace(/^\d+\s*/, "");
            }
            let needToAdd = false;
            // look up to see if have it.
            const query = {
                insurerId: insurer.insurerId,
                code: amTrustClassCode.ClassCode,
                sub: amTrustClassCode.ClassDescriptionCode,
                territoryList: state,
                active: true
            }

            const insurerAcDoc = await InsurerActivityCodeModel.findOne(query, queryProjection).catch((err) => {
                log.error(logPrefix + `Error fixing existing Insurer ActivityCodes ${JSON.stringify(query)} error: ${err}` + __location);
            });
            if(insurerAcDoc){
                //update attributes
            }
            else if(!insurerAcDoc && (ncciStates.indexOf(state) > -1 || paDeStates.indexOf(state) > -1)){
                ///Check GA for the code
                let checkState = "GA"
                if(paDeStates.indexOf(state) > -1){
                    checkState = state === "PA" ? "DE" : "PA";
                }

                const queryGA = {
                    insurerId: insurer.insurerId,
                    code: amTrustClassCode.ClassCode,
                    sub: amTrustClassCode.ClassDescriptionCode,
                    territoryList: checkState,
                    active: true
                }
                const insurerAcDocGA = await InsurerActivityCodeModel.findOne(queryGA, queryProjection).catch((err) => {
                    log.error(logPrefix + `Error fixing existing Insurer ActivityCodes ${JSON.stringify(query)} error: ${err}` + __location);
                });
                if(insurerAcDocGA){
                    //add to IAC - all ncci state should have the same questions.
                    updateIacCount++;
                    log.info(logPrefix + `- Updating IAC  ${insurerAcDocGA.code}-${insurerAcDocGA.sub} updating for ${state} ` + __location);
                    if(updateDatabase === "Y"){
                        insurerAcDocGA.territoryList.push(state);
                        if(typeof insurerAcDocGA.attributes !== "object"){
                            insurerAcDocGA.attributes = {}
                        }
                        insurerAcDocGA.attributes[state] = amTrustClassCode;
                        await insurerAcDocGA.save();
                    }
                }
                else {
                    needToAdd = true;
                }

            }
            else {
                needToAdd = true;
            }
            if(needToAdd){
                // Attempt to map to Talage ActivityCode.
                //try other Amtrust
                let talageActivityCodeIdList = null;
                //look similar code and sub code
                const queryIAC = {
                    insurerId: insurer.insurerId,
                    active: true,
                    // code: amTrustClassCode.ClassCode,
                    // sub: amTrustClassCode.ClassDescriptionCode,
                    description: amTrustClassCode.ClassDescription,
                    "talageActivityCodeIdList.0": {$exists: true}
                }
                const insurerAcDoc2 = await InsurerActivityCodeModel.findOne(queryIAC).catch((err) => {
                    log.error(logPrefix + `Error looking for similar Insurer ActivityCodes ${JSON.stringify(queryIAC)} error: ${err}` + __location);
                });
                if(insurerAcDoc2 && insurerAcDoc2.talageActivityCodeIdList?.length > 0){
                    talageActivityCodeIdList = insurerAcDoc2.talageActivityCodeIdList;
                }
                //Try AAC on Text match.
                if(!talageActivityCodeIdList){
                    const queryTAC = {
                        talageStandard: true,
                        active: true,
                        description: amTrustClassCode.ClassDescription
                    }
                    const acDoc = await ActivityCode.findOne(queryTAC).catch((err) => {
                        log.error(logPrefix + `Error fixing existing Insurer ActivityCodes ${JSON.stringify(queryTAC)} error: ${err}` + __location);
                    });
                    if(acDoc){
                        talageActivityCodeIdList = [];
                        talageActivityCodeIdList.push(acDoc.activityCodeId);
                    }
                }

                amTrustClassCode.state = state;
                amtrustAddCodes.push(amTrustClassCode)
                log.info(`${moment().toISOString()} - Adding IAC  ${amTrustClassCode.ClassCode}-${amTrustClassCode.ClassDescriptionCode} for ${state} ` + __location);
                if(updateDatabase === "Y"){
                    const newIACJson = {
                        "insurerId" : insurer.insurerId,
                        "code" : amTrustClassCode.ClassCode,
                        "sub" : amTrustClassCode.ClassDescriptionCode,
                        "description" : amTrustClassCode.ClassDescription,
                        "effectiveDate": moment("1980-01-01T08:00:00.000Z"),
                        "expirationDate": moment("2100-01-01T08:00:00.000Z"),
                        territoryList : [state],
                        attributes: {}
                    }
                    newIACJson.attributes[state] = amTrustClassCode;
                    if(talageActivityCodeIdList) {
                        newIACJson.talageActivityCodeIdList = talageActivityCodeIdList;
                    }
                    const newIACDoc = new InsurerActivityCodeModel(newIACJson);
                    await newIACDoc.save();
                    if(!talageActivityCodeIdList) {
                        newUnMappedCodes.push(newIACDoc);
                    }
                }

            }

            i++;
            if(i % 100 === 0){
                log.debug(logPrefix + `- Processed Codes ${i} of ${amtrustClassCodeMap[state].length} for ${state} ` + __location);
            }
        }
    }
    //look for missing - removed codes
    let iacExpiredCount = 0;
    const expiredIACArray = [];
    const removedToExistingCodeArray = [];
    let updateRemoveTerritoryCount = 0;
    if(DO_REMOVAL_CHECK){
        const queryIAC = {
            insurerId: insurer.insurerId,
            createdAt: {$lt: startImportDate},
            active: true
        }
        const insurerAcDocList = await InsurerActivityCodeModel.find(queryIAC, queryProjection).catch((err) => {
            log.error(logPrefix + `Error fixing existing Insurer ActivityCodes ${JSON.stringify(queryIAC)} error: ${err}}` + __location);
        });
        let i = 0;
        for(const iac of insurerAcDocList){
            let modified = false;
            //is in code list
            //loop territory List.
            const removeTerritoryList = [];
            if(iac.territoryList?.length > 0){
                for(const territory of iac.territoryList){
                    if(amtrustClassCodeMap[territory]){
                        const insurerCode = amtrustClassCodeMap[territory].find((importCode) => importCode.ClassCode === iac.code && importCode.ClassDescriptionCode === iac.sub)
                        if(!insurerCode){
                            modified = true;
                            removeTerritoryList.push(territory)
                        }
                    }
                }
            }
            // commented to prevent updates of removed codes
            if(modified){
                if(iac.territoryList.length === removeTerritoryList.length){
                    log.info(logPrefix + `- ${i} - IAC not in new list ${iac.code}-${iac.sub} ${removeTerritoryList}`);
                    iac.expirationDate = moment();
                    // await iac.save();
                    iacExpiredCount++;
                    expiredIACArray.push(iac);
                }
                else {
                    //         remove removeTerritoryList from IAC save
                    updateRemoveTerritoryCount++;
                    iac.removeTerritoryList = removeTerritoryList;
                    iac.territoryList = iac.territoryList.filter((el) => !removeTerritoryList.includes(el));
                    //         await iac.save();
                    removedToExistingCodeArray.push(iac)
                }
            }
            i++;
            if(i % 100 === 0){
                log.info(logPrefix + `- Checking Existing Codes ${i} of ${insurerAcDocList.length}` + __location);
            }
        }
    }

    log.info(logPrefix + `- AMTRUST CODE IMPORT ENDED ---------------------------------------`);

    // if(expiredIACArray.length > 0){
    //     fs.writeFileSync('amtrust/CodeExpires.json',JSON.stringify(expiredIACArray), 'utf8');
    // }
    // if(removedToExistingCodeArray.length > 0){
    //     fs.writeFileSync('amtrust/RemovedFromExistingCode.json',JSON.stringify(removedToExistingCodeArray), 'utf8');
    // }
    //newUnMappedCodes
    // if(newUnMappedCodes.length > 0){
    //     fs.writeFileSync('amtrust/NewAmtrustCodeNotMapped.json',JSON.stringify(newUnMappedCodes), 'utf8');
    // }

    log.info(logPrefix + `- ${amtrustAddCodes.length} new IAC records to AmTrust codes `);
    log.info(logPrefix + `- ${newUnMappedCodes.length} Unmapped new IAC records to AmTrust codes `);
    log.info(logPrefix + `- ${updateIacCount} updates to AmTrust codes `);
    log.info(logPrefix + `- Updates Territory Removed Processed ${updateRemoveTerritoryCount} IAC `);
    log.info(logPrefix + `- IAC Straight Expired Processed ${iacExpiredCount} `);

    let messageTable = '';
    //send email with the above stats to integrations@talageins.com
    if(amtrustAddCodes.length > 0){
        //trigger to send email since codes were addeded

        for (const codes in amtrustAddCodes) {
            if({}.hasOwnProperty.call(amtrustAddCodes, codes)){
                messageTable += `<tr>
                       <td>Added: ${codes}.  ${amtrustAddCodes[codes].code}-${amtrustAddCodes[codes].description}</td>
                   </tr>`
            }
        }
    }

    if(updateRemoveTerritoryCount > 0){
        messageTable += `<tr>
                <td><b>Updates Territory Removed Processed ${updateRemoveTerritoryCount}</b></td>
                </tr>`
        for(const territoryCount in removedToExistingCodeArray) {
            if({}.hasOwnProperty.call(removedToExistingCodeArray, territoryCount)){
                messageTable += `<tr>
                        <td>${removedToExistingCodeArray[territoryCount].code}-${removedToExistingCodeArray[territoryCount].description}</td>
                        </tr>`
            }
        }
    }

    if(iacExpiredCount > 0){
        messageTable += `<tr>
                <td><b>IAC Straight Expored Processed ${iacExpiredCount}</b></td>
                </tr>`
        for(const exIAC in expiredIACArray){
            if({}.hasOwnProperty.call(expiredIACArray, exIAC)){
                messageTable += `<tr>
                        <td>${expiredIACArray[exIAC].code}-${expiredIACArray[exIAC].sub} ${expiredIACArray[exIAC].territoryList}</td>
                    </td>`
            }
        }
    }

    const sendMessage = `
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>${amtrustAddCodes.length} new IAC records to AmTrust codes</th>
                </tr>
            </thead>
            <tbody>
                ${messageTable}
            </tbody>
        </table>
        <table class="thread-light mt-5">
            <thead>
                <tr>
                    <th>${newUnMappedCodes.length} Unmapped new IAC records to AmTrust codes</th>
                </tr>
            <thead>
            <tbody>
                <tr>
                    <td>${updateIacCount} updates to AmTrust codes</td>
                </tr>
            </tbody>
        </table>
        </div>
    `
    try{
        const sendResult = await emailSvc.send('integrations@talageins.com','New Codes were added to AmTrust',sendMessage);
        if(!sendResult){
            console.log('An error occured when sending notification. Please contact us for details');
        }
    }
    catch(err) {
        console.log('error-sending email from :', err);
    }


    return amtrustClassCodeMap;
}


module.exports = {CodeImport: CodeImport};