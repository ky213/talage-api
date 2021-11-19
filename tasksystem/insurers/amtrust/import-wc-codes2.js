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
 const DO_REMOVAL_CHECK = false;
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
     const InsurerActivityCodeModel = require('mongoose').model('InsurerActivityCode');
     const ActivityCode = require('mongoose').model('ActivityCode');
     const Insurer = require('mongoose').model('Insurer');
 
     const amtrustAddCodes = stateList;
     const newUnMappedCodes = [];
     const updateIacCount = 1;
     const updateRemoveTerritoryCount = 0;
     const iacExpiredCount = 1;
 
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
 
     //send email with the above stats to integrations@talageins.com
     console.log('Update has run ...');
     if(amtrustAddCodes.length > 0){
         //trigger to send email since codes were addeded
         const sendResult = false;
         let messageTable = '';
         for (const codes in amtrustAddCodes) {
             messageTable = messageTable + `<tr>
                    <td class="col">${codes}.  ${amtrustAddCodes[codes]}</td>
                </tr>`
         }
         const sendMessage = `
             <table class="table-striped">
                 <thead>
                     <tr>
                         <th class="thread-dark">${amtrustAddCodes.length} new IAC records to AmTrust codes</th>
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
                     <tr>
                         <td>Updates Territory Removed Processed ${updateRemoveTerritoryCount} IAC </td>
                     </tr>
                     <tr>
                         <td>IAC Straight Expired Processed ${iacExpiredCount}</td>
                     <tr>
                 </tbody>
             </table>
             </div>
         `
         try{
             sendResult = await emailSvc.send('carlo+esend@talageins.com','New Codes were Added to AmTrust',sendMessage);
             if(!sendResult){
                 console.log('An error occured when sending notification. Please contact us for details');
             }
         }
         catch(err) {
             console.log('error-sending email :', err);
         }
     }
 
     return amtrustClassCodeMap;
 }
 
 
 module.exports = {CodeImport: CodeImport};