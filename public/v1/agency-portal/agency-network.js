/* eslint-disable no-loop-func */
/* eslint-disable prefer-const */
/* eslint-disable array-element-newline */
'use strict';
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const serverHelper = global.requireRootPath('server.js');
//const auth = require('./helpers/auth-agencyportal.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const InsurerBO = global.requireShared('models/Insurer-BO.js');
const InsurerPolicyTypeBO = global.requireShared('models/InsurerPolicyType-BO.js');


/**
 * Returns the record for a single Agency Network
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencyNetwork(req, res, next) {
    let error = false;
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    const agencyNetworkId = req.authentication.agencyNetworkId;
    if (agencyNetworkId) {
        // agency network user.
        // check request matches rights.
        if (agencyNetworkId !== id) {
            res.send(403);
            return next(serverHelper.forbiddenError('Do Not have Permissions'));
        }
    }
    else {
        // agency user. lookup agency network
        const agency_network = req.authentication.agencyNetworkId
        if (agency_network !== id) {
            res.send(403);
            return next(serverHelper.forbiddenError('Do Not have Permissions'));
        }
    }

    let agencyNetworkBO = new AgencyNetworkBO();

    const getResp = await agencyNetworkBO.getById(id).catch(function(err) {
        log.error("agencyNetworkBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    if (getResp) {
        res.send(200, agencyNetworkBO);
        return next();
    }
    else {
        log.debug(`No object returned from getByID ${id} ` + __location)
        res.send(404);
        return next(serverHelper.notFoundError('Agency Network not found'));
    }
}

/**
 * Retrieves the list of insurers, their logo, name, agencyId, agentId, polityTypes, and territoires
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencyNetworkInsurersList(req, res, next) {
    // makesure agency network info avail
    let error = false;
    const agencyNetworkId = stringFunctions.santizeNumber(req.params.id, true);
    if (!agencyNetworkId) {
        return next(new Error("bad parameter"));
    }

    const authAgencyNetwork = req.authentication.agencyNetworkId;
    if (authAgencyNetwork) {
        // agency network user.
        // check request matches rights.
        if (authAgencyNetwork !== agencyNetworkId) {
            res.send(403);
            log.error(`Error, the agency network id passed and one retrieved from auth do not match.`);
            return next(serverHelper.forbiddenError('Do Not have Permissions'));
        }
    }
    else {
        // agency user. lookup agency network
        const authAgencyNetworkId = req.authentication.agencyNetworkId
        if (authAgencyNetworkId !== agencyNetworkId) {
            res.send(403);
            return next(serverHelper.forbiddenError('Do Not have Permissions'));
        }
    }

    let networkInsurers = [];
    try{
        //const queryAgencyNetwork = {"agencyNetworkId": agencyNetworkId}
        let agencyNetworkBO = new AgencyNetworkBO();
        const agencyNetworkJSON = await agencyNetworkBO.getById(agencyNetworkId).catch(function(err) {
            log.error("agencyNetworkBO load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }

        // eslint-disable-next-line prefer-const
        let insurerIdArray = agencyNetworkJSON.insurerIds;

        if(insurerIdArray.length > 0){
            const insurerBO = new InsurerBO();
            const insurerPolicyTypeBO = new InsurerPolicyTypeBO();
            const query = {"insurerId": insurerIdArray}
            let insurerDBJSONList = await insurerBO.getList(query);
            if(insurerDBJSONList && insurerDBJSONList.length > 0){
                for(let insureDB of insurerDBJSONList){
                    insureDB.territories = await insurerBO.getTerritories(insureDB.insurerId);
                    //check if any insurerPolicyType is wheelhouse enabled.
                    // eslint-disable-next-line object-property-newline
                    const queryPT = {
                        "wheelhouse_support": true,
                        insurerId: insureDB.insurerId
                    };
                    insureDB.policyTypes = [];
                    const insurerPtDBList = await insurerPolicyTypeBO.getList(queryPT)
                    if(insurerPtDBList && insurerPtDBList.length > 0){
                        insureDB.policyTypes = insurerPtDBList;
                    }
                    else {
                        log.info(`No wheelhouse enabled products for insurer ${insureDB.insurerId}` + __location)
                    }
                    //outside wheelhouse support logic. in case we are toggling an insurer on/off at system level.
                    networkInsurers.push(insureDB)
                }
            }
        }

    }
    catch(err){
        log.error(`Error get Agency Network Insurer List ` + err + __location);
    }

    const response = {"networkInsurers": networkInsurers};

    // Return the response
    res.send(200, response);
    return next();
}

/**
 * Updates the record for a single Agency Network
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function updateAgencyNetwork(req, res, next) {
    let error = false;
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    const agencyNetwork = req.authentication.agencyNetworkId;
    if (agencyNetwork) {
        // agency network user.
        // check request matches rights.
        if (agencyNetwork !== id) {
            res.send(403);
            return next(serverHelper.forbiddenError('Do Not have Permissions'));
        }
    }
    else {
        res.send(403);
        return next(serverHelper.forbiddenError('Do Not have Permissions'));
    }

    let agencyNetworkBO = new AgencyNetworkBO();

    const agencyNetworkJSON = await agencyNetworkBO.getById(id).catch(function(err) {
        log.error("agencyNetworkBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    if (!agencyNetworkJSON) {
        log.debug(`No object returned from getByID ${id} ` + __location)
        res.send(404);
        return next(serverHelper.notFoundError('Agency Network not found'));
    }

    //agencyNetworkBO as current database.
    //update agencyNetworkBO and load for saveModel
    let agencyNetworkUpdate = {
        "agencyNetworkUuidId": agencyNetworkJSON.agencyNetworkUuidId,
        agencyNetworkId: agencyNetworkJSON.agencyNetworkId,
        id: agencyNetworkJSON.agencyNetworkId
    }
    const allowedPropertyUpdateList = ["feature_json", "phone"]
    let hasUpdate = false;
    for(var i = 0; i < allowedPropertyUpdateList.length; i++){
        if(req.body[allowedPropertyUpdateList[i]]){
            if(allowedPropertyUpdateList[i] === "feature_json" && typeof req.body[allowedPropertyUpdateList[i]] === "object"){
                agencyNetworkUpdate.featureJson = req.body.feature_json
                hasUpdate = true;
            }
            else if(allowedPropertyUpdateList[i] !== "feature_json") {
                agencyNetworkUpdate[allowedPropertyUpdateList[i]] = req.body[allowedPropertyUpdateList[i]];
                hasUpdate = true
            }
        }

    }
    if(hasUpdate){
        const saveResp = await agencyNetworkBO.saveModel(agencyNetworkUpdate).catch(function(err) {
            log.error("agencyNetworkBO save error " + err + __location);
            error = err;
        });

        if(saveResp){
            const newAgencyNetworkJSON = await agencyNetworkBO.getById(id).catch(function(err) {
                log.error("agencyNetworkBO load error " + err + __location);
                error = err;
            });
            res.send(200, newAgencyNetworkJSON);
            return next();
        }
        else {
            return next(serverHelper.internalError('Save error'));
        }
    }
    else {
        res.send(200, agencyNetworkJSON);
        return next();
    }
}

/**
 * Retrieves the agency network logo and network name based on the url passed to the function
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencyNetworkLogo (req,res, next){
    
    if(!req.query || !req.query.url){
        return next(serverHelper.requestError('Missing URL'));
    }
    
    // convert incoming url into a URL Object 
    let incomingUrl = null;
    try {
        incomingUrl = new URL(req.query.url);
    } catch (error) {
        log.warn(`Invalid Url ${req.query.url} `+ __location);
        return next(serverHelper.requestError('Invalid Url'));
    }
    let agencyNetworkBO = new AgencyNetworkBO();

    // Default logoName and Agency Network Name
    let logoName = '1-wheelhouse.png';
    let networkName = 'Wheelhouse';
    
    // Const for agency network environmentSettings property
    const agencyNetworkEnvironment = 'PORTAL_URL';

    // The current environment, used to grab correct value from agency network
    const deploymentEnvironment = global.settings.ENV;
    
    // grab all the agency networks
    const listOfAgencyNetworks = await agencyNetworkBO.getList().catch(function(err) {
        log.error("Retrieving list of all agency networks error " + err + __location);
    });
    if(listOfAgencyNetworks && listOfAgencyNetworks.length > 0){

        //find the one with matching url, grab the logo and network name
        for(let i = 0; i < listOfAgencyNetworks.length; i++){
            const agencyNetwork = listOfAgencyNetworks[i];

            // make sure agency network has properties before trying to access them
            if(agencyNetwork.hasOwnProperty('additionalInfo') 
                && agencyNetwork.additionalInfo.hasOwnProperty('environmentSettings') 
                && agencyNetwork.additionalInfo.environmentSettings.hasOwnProperty(`${deploymentEnvironment}`) 
                && agencyNetwork.additionalInfo.environmentSettings[`${deploymentEnvironment}`].hasOwnProperty(`${agencyNetworkEnvironment}`)){
                
                // Grab the agency network environment object
                const agencyNetworkEnvironmentObj = agencyNetwork.additionalInfo.environmentSettings[`${deploymentEnvironment}`];
                
                // Variable to hold the URL object created using the agency network environment settings url string
                let agencyNetworkUrl = null;
                let error = null;
                
                // try to create new URL object from the agency network environment settings url string
                try {
                    agencyNetworkUrl = new URL(agencyNetworkEnvironmentObj[`${agencyNetworkEnvironment}`]);
                 } catch (err) {
                     log.warn(`Invalid Url ${agencyNetworkEnvironmentObj[`${agencyNetworkEnvironment}`]} for agency network ${agencyNetwork.agencyNetworkId}. Please fix issue `+ err + __location);
                     error = err;
                 }
                 
                 // TODO: Handle localhost environment -> all of them will have localhost8081 for agency portal for local dev, for now grab the first one
                 // If there was not an error, and we have agencyNetworkUrl and the agencyNetworkUrl domain and incoming Url domain match
                 if(!error && agencyNetworkUrl && agencyNetworkUrl.hostname === incomingUrl.hostname){
                     if(agencyNetwork.hasOwnProperty('logo')){
                         logoName = agencyNetwork.logo;
                     }
                     if(agencyNetwork.hasOwnProperty('name')){
                         networkName = agencyNetwork.name;
                     }
                    break;
                 }
            } 
        }
    }
    // TODO: Maybe something we need to worry about: spacing in the logo name? S3 doesn't have spacing in name
    const logoUrl = `${global.settings.IMAGE_URL}/public/agency-network-logos/${logoName}`;
    res.send(200, {logoUrl, networkName});
    return next();

}

/**
 * Retrieves the agency network feature json given an agency network id
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencyNetworkFeatures(req, res, next) {
    let error = false;
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    const agencyNetworkId = req.authentication.agencyNetworkId;
    if (agencyNetworkId) {
        // agency network user.
        // check request matches rights.
        if (agencyNetworkId !== id) {
            res.send(403);
            return next(serverHelper.forbiddenError('Do Not have Permissions'));
        }
    }
    else {
        // agency user. lookup agency network
        const agency_network = req.authentication.agencyNetworkId
        if (agency_network !== id) {
            res.send(403);
            return next(serverHelper.forbiddenError('Do Not have Permissions'));
        }
    }

    let agencyNetworkBO = new AgencyNetworkBO();

    const agencyNetworkJSON = await agencyNetworkBO.getById(id).catch(function(err) {
        log.error("agencyNetworkBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    // Send back a success response
    if (agencyNetworkJSON && agencyNetworkJSON.hasOwnProperty('feature_json')) {
        res.send(200, {'featureJson': agencyNetworkJSON.feature_json});
        return next();
    }
    else {
        log.debug(`No object returned from getByID ${id} ` + __location)
        res.send(404);
        return next(serverHelper.notFoundError('No Feature Information found for for Agency Network'));
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addGet('Get Landing Page Logo', `${basePath}/agency-network/logo`, getAgencyNetworkLogo);
    server.addGetAuth('Get AgencyNetwork', `${basePath}/agency-network/:id`, getAgencyNetwork, 'agencies', 'view');
    server.addPutAuth('PUT AgencyNetwork', `${basePath}/agency-network/:id`, updateAgencyNetwork, 'agencies', 'manage');
    server.addGetAuth('Get AgencyNetwork Features',`${basePath}/agency-network/features/:id`, getAgencyNetworkFeatures,'agencies', 'view')
    //must be 'applications' so users with applications.view can load applications.
    server.addGetAuth('Get AgencyNetworkInsurers', `${basePath}/agency-network/insurers-list/:id`, getAgencyNetworkInsurersList, 'applications', 'view');
};