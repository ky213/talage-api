/* eslint-disable no-loop-func */
/* eslint-disable prefer-const */
/* eslint-disable array-element-newline */
'use strict';
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const serverHelper = global.requireRootPath('server.js');
//const auth = require('./helpers/auth.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const AgencyNetworkInsurerBO = global.requireShared('./models/AgencyNetworkInsurer-BO.js');
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
        const agencyNetworkInsurerBO = new AgencyNetworkInsurerBO();
        const queryAgencyNetwork = {"agencyNetworkId": agencyNetworkId}
        const agencyNetworkInsurers = await agencyNetworkInsurerBO.getList(queryAgencyNetwork)
        // eslint-disable-next-line prefer-const
        let insurerIdArray = [];
        agencyNetworkInsurers.forEach(function(agencyNetworkInsurer){
            if(agencyNetworkInsurer.insurer){
                insurerIdArray.push(agencyNetworkInsurer.insurer);
            }
        });
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
                        insurerPtDBList.forEach((policyTypeObj) => {
                            //TODO refactor AP to use full JSON from here.  (Territories not handled correctly)
                            let reducedPolicyTypeObj = {};
                            if(typeof policyTypeObj.policy_type !== 'undefined'){
                                reducedPolicyTypeObj.policy_type = policyTypeObj.policy_type;
                            }
                            if(typeof policyTypeObj.acord_support !== 'undefined'){
                                reducedPolicyTypeObj.acord_support = policyTypeObj.acord_support;
                            }
                            if(insureDB.insurerId === 1 && global.settings.DISABLE_BINDING !== "YES"){
                                reducedPolicyTypeObj.api_bind_support = 1;
                            }
                            insureDB.policyTypes.push(reducedPolicyTypeObj);
                        });
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

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get AgencyNetwork', `${basePath}/agency-network/:id`, getAgencyNetwork, 'agencies', 'view');
    server.addPutAuth('PUT AgencyNetwork', `${basePath}/agency-network/:id`, updateAgencyNetwork, 'agencies', 'manage');
    server.addGetAuth('Get AgencyNetworkInsurers', `${basePath}/agency-network/insurers-list/:id`, getAgencyNetworkInsurersList, 'agencies', 'view');
};