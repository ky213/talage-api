'use strict';

const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
const ApplicationBO = global.requireShared('./models/Application-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');

/**
 * Responds to get requests for the applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencies(req, res, next){
    let error = false;
    let retAgencies = null;

    if(req.query.isAggregate) {
        return getAgenciesAggregate(req, res, next);
    }

    try{
        error = null;

        // eslint-disable-next-line no-unneeded-ternary
        const getCount = req.query.getcount ? true : false;
        if(req.query.getcount){
            delete req.query.getcount
        }

        let getTopAgencies = req.query.hasOwnProperty("numTopAgencies");
        let numTopAgencies = 0;
        if(getTopAgencies) {
            try{
                numTopAgencies = parseInt(req.query.numTopAgencies, 10);
                if(isNaN(numTopAgencies)){
                    getTopAgencies = false;
                }
            }
            catch{
                getTopAgencies = false;
            }
            delete req.query.numTopAgencies;
        }

        const query = req.query;
        let addAppCount = true;
        if(query.hasOwnProperty("skipappcount")){
            if(query.skipappcount === "y"){
                addAppCount = false
            }
            delete query.skipappcount
        }

        let addLocations = false;
        if(query.hasOwnProperty("addlocations")){
            if(query.addlocations === "y"){
                addLocations = true;
            }
            delete query.addlocations
        }

        if(req.authentication.isAgencyNetworkUser){
            query.agencyNetworkId = req.authentication.agencyNetworkId
            //Global View Check
            if(req.authentication.isAgencyNetworkUser && req.authentication.agencyNetworkId === 1
                && req.authentication.permissions.talageStaff === true
                && req.authentication.enableGlobalView === true){

                delete query.agencyNetworkId
            }

        }
        else {
            // Get the agents that we are permitted to view
            const agents = await auth.getAgents(req).catch(function(e){
                error = e;
            });
            if (error){
                return next(error);
            }
            // Make sure we got agents
            if (!agents.length){
                log.info('Bad Request: No agencies permitted');
                return next(serverHelper.requestError('Bad Request: No agencies permitted'));
            }

            query.systemId = agents
        }

        if(query.systemId && query.systemId.includes(",")){
            query.systemId = query.systemId.split(',');
        }

        const agencyBO = new AgencyBO();
        const GET_AGENCY_NETWORK = true;
        retAgencies = await agencyBO.getList(query, GET_AGENCY_NETWORK).catch(function(err) {
            error = err;
        });
        if (error) {
            return next(error);
        }

        let returnAgencyList = null;
        if(retAgencies){
            //Get app count.
            returnAgencyList = [];
            const applicationBO = new ApplicationBO();
            const agencyLocationBO = new AgencyLocationBO();
            for(let i = 0; i < retAgencies.length; i++){
                try{
                    // eslint-disable-next-line prefer-const
                    let agencyInfo = {};
                    agencyInfo.id = retAgencies[i].systemId;
                    agencyInfo.name = retAgencies[i].name;
                    agencyInfo.agencyNetworkName = retAgencies[i].agencyNetworkName;
                    agencyInfo.email = retAgencies[i].email;
                    agencyInfo.state = retAgencies[i].active ? "Active" : "Inactive";
                    if(retAgencies[i].primaryAgency === null || typeof retAgencies[i].primaryAgency === 'undefined'){
                        agencyInfo.primaryAgency = false;
                    }
                    else {
                        agencyInfo.primaryAgency = retAgencies[i].primaryAgency;
                    }
                    if(retAgencies[i].slug){
                        agencyInfo.slug = retAgencies[i].slug;
                    }
                    if(retAgencies[i].firstName){
                        agencyInfo.firstName = retAgencies[i].firstName;
                    }
                    if(retAgencies[i].lastName){
                        agencyInfo.lastName = retAgencies[i].lastName;
                    }
                    const _query = {"agencyId": retAgencies[i].systemId};
                    //use getAppListForAgencyPortalSearch get hit redis cache
                    //const appCount = await applicationBO.getAppListForAgencyPortalSearch(query);
                    if(addAppCount === true){
                        const appCount = await applicationBO.getAppListForAgencyPortalSearch(_query, [], {count: 1});
                        agencyInfo.applications = appCount.count;
                    }
                    if(addLocations === true){
                        const queryLoc = {"agencyId": retAgencies[i].systemId}
                        const getAgencyName = false;
                        const getChildren = false;
                        const useAgencyPrimeInsurers = false;

                        const locationList = await agencyLocationBO.getList(queryLoc, getAgencyName, getChildren, useAgencyPrimeInsurers).catch(function(err){
                            log.error(err.message + __location);
                        });
                        if(locationList){
                            agencyInfo.locations = locationList;
                        }
                        else {
                            agencyInfo.locations = [];
                        }
                    }

                    if(req.authentication.permissions.talageStaff) {
                        agencyInfo.tierId = retAgencies[i].tierId;
                        agencyInfo.tierName = retAgencies[i].tierName;
                    }

                    returnAgencyList.push(agencyInfo);
                }
                catch(err){
                    log.error(`Error getting Application count for Agency ${retAgencies[i].id}`)
                }
            }
        }

        if (returnAgencyList) {
            // if we're getting only the top x agencies, sort the list to top agencies and splice it accordingly
            if(getTopAgencies){
                // sort by number of applications, descending
                returnAgencyList.sort((a1, a2) => a2.applications - a1.applications);
                returnAgencyList.splice(numTopAgencies);
            }
            if(getCount){
                const countQuery = {
                    ...query,
                    count: true
                };
                const count = await agencyBO.getList(countQuery).catch(function(err) {
                    error = err;
                });
                if (error) {
                    return next(error);
                }

                res.send(200, {
                    rows: returnAgencyList,
                    ...count
                });
            }
            else {
                // Old pattern keep in Jan 1st, 2022
                res.send(200, returnAgencyList);
            }
            return next();
        }
        else {
            res.send(404);
            return next(serverHelper.notFoundError('agencies not found'));
        }
    }
    catch(err){
        log.error("getAgencies load error " + err + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }
}

/**
 * Retrieves the list of agencies, but using aggregate mongodb function
 * Enables:
 * - Sorting for foriegn keys/values with proper pagination
 * - Centralized or single query from the DB
 * Future Development:
 * - Location List - (Not Yet Included)
 * @param {object} req - HTTP request object
 * @param {object} req.query - HTTP request object
 * @param {object} req.query.match - $match format from mongodb aggregation (query)
 * @param {object} req.query.sort - $sort format from mongodb aggregation (also caters 'asc' or 'desc')
 * @param {number} req.query.page - page number (pagination)
 * @param {number} req.query.limit - $limit format from mongodb aggregation (page limit - pagination)
 * @param {string} req.query.getcount - return total number of docs (preferably 'y' or 'n', but better uninitialized if 'n' - pagination)
 * @param {string} req.query.skipappcount - return number of applications per agency (preferably 'y' or 'n', but better uninitialized if 'n')
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgenciesAggregate(req, res, next){
    try{
        const queryJSON = req.query;
        // If non talage super user, remove these fields from final projection
        if (!req.authentication.permissions.talageStaff) {
            queryJSON.postProjection = {};
            queryJSON.postProjection.tierId = 0;
            queryJSON.postProjection.tierName = 0;
            queryJSON.postProjection = JSON.stringify(queryJSON.postProjection);
        }

        queryJSON.match = JSON.parse(queryJSON.match || '{}');
        // Check agency view permission
        if(req.authentication.isAgencyNetworkUser){
            queryJSON.match.agencyNetworkId = req.authentication.agencyNetworkId;
            //Not Global View Check
            if(req.authentication.isAgencyNetworkUser &&
                req.authentication.agencyNetworkId === 1 &&
                req.authentication.permissions.talageStaff === true &&
                req.authentication.enableGlobalView === true){
                delete queryJSON.match.agencyNetworkId;
            }
        }
        else {
            let agents = '';
            try {
                agents = await auth.getAgents(req);
            }
            catch (e) {
                return next(e);
            }

            if (!agents.length){
                log.info('Bad Request: No agencies permitted');
                return next(serverHelper.requestError('Bad Request: No agencies permitted'));
            }

            queryJSON.match.systemId = agents.includes(',') ? {$in: agents.split(',')} : agents;
        }

        queryJSON.match = JSON.stringify(queryJSON.match);

        // Query Get List aggregation
        const agencyBO = new AgencyBO();
        let agencies = {};
        try {
            agencies = await agencyBO.getListAggregate(queryJSON);
        }
        catch (error) {
            return next(error);
        }

        // Validate return value
        if (agencies && agencies[0] && agencies[0].hasOwnProperty('count') && agencies[0].count > 0) {
            // With count
            res.send(200, agencies[0]);
            return next();
        }
        else if(agencies && agencies.length > 0 && !agencies[0].hasOwnProperty('count')) {
            // Without count
            res.send(200, agencies);
            return next();
        }
        else {
            res.send(404);
            return next(serverHelper.notFoundError('agencies not found'));
        }
    }
    catch(err){
        log.error("getAgencies load error " + err + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get agencies', `${basePath}/agencies`, getAgencies, 'agencies', 'view');
};