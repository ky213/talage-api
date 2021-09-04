/* eslint-disable array-element-newline */
/* eslint-disable dot-notation */
/* eslint-disable no-case-declarations */
/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


// /**
//  * GET returns resources Quote Engine needs
//  *
//  * @param {object} req - HTTP request object
//  * @param {object} res - HTTP response object
//  * @param {function} next - The next function to execute
//  *
//  * @returns {void}
//  */
// async function GetResources(req, res, next){
//     const responseObj = {};
//     let rejected = false;

//     responseObj.legalArticles = {};
//     rejected = false;
//     const PolicyTypeBO = global.requireShared('./models/PolicyType-BO.js');
//     const policyTypeBO = new PolicyTypeBO();
//     const policyTypeList = await policyTypeBO.getList({wheelhouse_support: true}).catch(function(error) {
//         // Check if this was
//         rejected = true;
//         log.error(`policyTypeBO error on getList ` + error + __location);
//     });
//     if (!rejected && policyTypeList) {
//         responseObj.policyTypes = policyTypeList;
//     }

//     rejected = false;
//     const TerritoryBO = global.requireShared('./models/Territory-BO.js');
//     const territoryBO = new TerritoryBO();
//     const territories = await territoryBO.getAbbrNameList().catch(function(err) {
//         log.error("territory get getAbbrNameList " + err + __location);
//     });

//     if (territories) {
//         responseObj.territories = territories;
//     }

//     res.send(200, responseObj);
//     return next();


// }


// /**
//  * GET returns resources Quote Engine needs
//  *
//  * @param {object} req - HTTP request object
//  * @param {object} res - HTTP response object
//  * @param {function} next - The next function to execute
//  *
//  * @returns {void}
//  */
// async function CheckZip(req, res, next){
//     const responseObj = {};
//     if(req.body && req.body.zip){
//         //make sure we have a valid zip code
//         const zipCodeBO = new ZipCodeBO();
//         let error = null;
//         const zipCode = stringFunctions.santizeNumber(req.body.zip, false);
//         if(!zipCode){
//             responseObj['error'] = true;
//             responseObj['message'] = 'The zip code you entered is invalid.';
//             res.send(404, responseObj);
//             return next(serverHelper.requestError('The zip code you entered is invalid.'));
//         }
//         const zipCodeJson = await zipCodeBO.loadByZipCode(zipCode).catch(function(err) {
//             error = err;
//             log.error("Unable to get ZipCode records for " + req.body.zip + err + __location);
//         });
//         if (error) {
//             if(error.message === "not found"){
//                 responseObj['error'] = true;
//                 responseObj['message'] = 'The zip code you entered is invalid.';
//                 res.send(404, responseObj);
//                 return next(serverHelper.requestError('The zip code you entered is invalid.'));

//             }
//             else {
//                 responseObj['error'] = true;
//                 responseObj['message'] = 'internal error.';
//                 res.send(500, responseObj);
//                 return next(serverHelper.requestError('internal error'));
//             }
//         }

//         if(zipCodeJson.state){
//             responseObj.territory = zipCodeJson.state;
//             res.send(200, responseObj);
//             return next();
//         }
//         else {
//             responseObj['error'] = true;
//             responseObj['message'] = 'The zip code you entered is invalid.';
//             res.send(404, responseObj);
//             return next(serverHelper.requestError('The zip code you entered is invalid.'));
//         }

//         // log.debug("zipCodeBO: " + JSON.stringify(zipCodeBO.cleanJSON()))
//     }

// }

//Remove GetAssociations after Oct 1st, 2021

/**
 * GET returns associations Quote Engine needs
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetAssociations(req, res, next){
    const responseObj = {};
    if(req.query && req.query.territories){

        const territoryList = req.query.territories.split(',')
        const AssociationSvc = global.requireShared('./services/associationsvc.js');
        responseObj['error'] = false;
        responseObj['message'] = '';
        responseObj['associations'] = AssociationSvc.GetAssociationList(territoryList);
        res.send(200, responseObj);
        return next();
    }
    else {
        responseObj['error'] = true;
        responseObj['message'] = 'Invalid input received.';
        res.send(400, responseObj);
        return next(serverHelper.requestError('Bad request'));
    }

}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    //POSTs Quote Application workflow steps
    // server.addPostAuthAppWF('Checkzip for Quote Engine', `${basePath}/applicationwf/checkzip`, CheckZip)
    // server.addPostAuthAppWF('Checkzip for Quote Engine', `${basePath}wf/checkzip`, CheckZip)
    server.addGetAuthAppWF('GetAssociations for Quote Engine', `${basePath}/applicationwf/getassociations`, GetAssociations)
    server.addGetAuthAppWF('GetAssociations for Quote Engine', `${basePath}wf/getassociations`, GetAssociations)

};


//agencyemail