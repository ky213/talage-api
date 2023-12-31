/* eslint-disable prefer-const */
/* eslint-disable object-curly-newline */
'use strict';

const serverHelper = global.requireRootPath('server.js');
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const InsurerBO = global.requireShared('models/Insurer-BO.js');
const InsurerPolicyTypeBO = global.requireShared('models/InsurerPolicyType-BO.js');

/**
 * Returns data necessary for creating an agency
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function createAgency(req, res, next){
    // Make sure this is an agency network
    if (req.authentication.isAgencyNetworkUser === false){
        log.info('Forbidden: User is not authorized to create agecies');
        return next(serverHelper.forbiddenError('You are not authorized to access this resource'));
    }

    // Begin building the response
    const response = {
        "showUseAgencyPrime": false,
        "insurers": [],
        "territories": {}
    };

    // Get all insurers for this agency network
    // Begin compiling a list of territories
    let territoryAbbreviations = [];
    const agencyNetworkId = req.authentication.agencyNetworkId


    // eslint-disable-next-line prefer-const
    let insurers = [];
    try{
        const agencyNetworkBO = new AgencyNetworkBO();
        const agencyNetwork = await agencyNetworkBO.getById(agencyNetworkId);
        if(agencyNetwork.featureJson && agencyNetwork.featureJson.enablePrimeAgency) {
            response.showUseAgencyPrime = agencyNetwork.featureJson.enablePrimeAgency
        }

        // eslint-disable-next-line prefer-const
        let insurerIdArray = agencyNetwork.insurerIds;

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
                    const queryPT = {"wheelhouse_support": true, insurerId: insureDB.insurerId};
                    const insurerPtDBList = await insurerPolicyTypeBO.getList(queryPT)
                    if(insurerPtDBList && insurerPtDBList.length > 0){
                        if(insureDB.territories){
                            territoryAbbreviations = territoryAbbreviations.concat(insureDB.territories);
                        }
                        insurers.push(insureDB)
                    }
                    else {
                        log.info(`No wheelhouse enabled products for insurer ${insureDB.insurerId}` + __location)
                    }
                }
            }
        }

    }
    catch(err){
        log.error(`Error get Agency Network Insurer List ` + err + __location);
    }

    // Add the insurers to the response
    response.insurers = insurers;
    const TerritoryBO = global.requireShared('./models/Territory-BO.js');
    const territoryBO = new TerritoryBO();
    let error = null;
    const territories = await territoryBO.getAbbrNameList().catch(function(err) {
        log.error("territory get getAbbrNameList " + err + __location);
        error = err;
    });
    if(error){
        log.error('DB query for territories list failed: ' + error.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    // Add each of these territories to the response
    territories.forEach(function(territory){
        response.territories[territory.abbr] = territory.name;
    });


    // Return the response
    res.send(200, response);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Create Agency', `${basePath}/create-agency`, createAgency, 'agencies', 'manage');
};