/* eslint-disable prefer-const */
/* eslint-disable array-element-newline */
'use strict';
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const serverHelper = global.requireRootPath('server.js');
//const auth = require('./helpers/auth.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

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
    const agencyNetwork = req.authentication.agencyNetwork;
    if (agencyNetwork) {
        // agency network user.
        // check request matches rights.
        if (agencyNetwork !== id) {
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
	const agencyNetworkId = stringFunctions.santizeNumber(req.params.id, true);
	if (!agencyNetworkId) {
		return next(new Error("bad parameter"));
	}

    const  authAgencyNetwork = req.authentication.agencyNetwork;
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
	const networkInsurersSQL = `
		SELECT
			i.id,
			i.logo,
			i.name,
			i.agency_id_label,
			i.agent_id_label,
			i.enable_agent_id,
			GROUP_CONCAT(it.territory) AS territories
		FROM clw_talage_agency_network_insurers AS agi
		LEFT JOIN clw_talage_insurers AS i ON agi.insurer = i.id
		LEFT JOIN clw_talage_insurer_territories AS it ON i.id = it.insurer
		LEFT JOIN clw_talage_insurer_policy_types AS pti ON i.id = pti.insurer
		WHERE
			i.id IN (select insurer from clw_talage_agency_network_insurers where agency_network = ${agencyNetworkId}) AND
			i.state = 1 AND
			pti.wheelhouse_support = 1

		GROUP BY i.id
		ORDER BY i.name ASC;
	`;
	const networkInsurers = await db.query(networkInsurersSQL).catch(function(err){
        log.error('DB query failed: ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	});

	    // Convert the network insurer territory data into an array
		networkInsurers.map(function(networkInsurer) {
			if(networkInsurer.territories){
				networkInsurer.territories = networkInsurer.territories.split(',');
			}
			return networkInsurer;
		});
		// For each network insurer grab the policy_types
		for (let i = 0; i < networkInsurers.length; i++) {
			const insurer = networkInsurers[i];
			// Grab all of the policy type and accord support for a given insurer
			const policyTypeSql = `
				SELECT policy_type, acord_support
				FROM clw_talage_insurer_policy_types
				WHERE
					insurer = ${insurer.id}
			`
			let policyTypesResults = null;
			try {
				policyTypesResults = await db.query(policyTypeSql);
			}
			catch (err) {
				log.error(`Could not retrieve policy and accord_support for insurer ${insurer} :  ${err}  ${__location}`);
				return next(serverHelper.internalError('Internal Error'));
			}
			// Push policy types and accord support for said policy type into an array
			insurer.policyTypes = [];
			policyTypesResults.forEach((policyType) => {
				insurer.policyTypes.push(policyType);
			});
		}
		const response = {
			"networkInsurers": networkInsurers,
		};
		log.debug('Get Network Insurers' + JSON.stringify(response))
	
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
    const agencyNetwork = req.authentication.agencyNetwork;
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

    const getResp = await agencyNetworkBO.getById(id).catch(function(err) {
        log.error("agencyNetworkBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    if (!getResp) {
        log.debug(`No object returned from getByID ${id} ` + __location)
        res.send(404);
        return next(serverHelper.notFoundError('Agency Network not found'));
    }

    //agencyNetworkBO as current database.
    //update agencyNetworkBO and load for saveModel
    const allowedPropertyUpdateList = ["feature_json", "phone"]
    for(var i = 0; i < allowedPropertyUpdateList.length; i++){
        if(req.body[allowedPropertyUpdateList[i]]){
            if(allowedPropertyUpdateList[i] === "feature_json" && typeof req.body[allowedPropertyUpdateList[i]] === "object"){
                agencyNetworkBO.feature_json = req.body.feature_json
            }
            else if(allowedPropertyUpdateList[i] !== "feature_json") {
                agencyNetworkBO[allowedPropertyUpdateList[i]] = req.body[allowedPropertyUpdateList[i]];
            }
        }
    }
    const saveResp = await agencyNetworkBO.save().catch(function(err) {
        log.error("agencyNetworkBO save error " + err + __location);
        error = err;
    });
    if(saveResp){
        res.send(200, agencyNetworkBO);
        return next();
    }
    else {
        return next(serverHelper.internalError('Save error'));
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get AgencyNetwork', `${basePath}/agency-network/:id`, getAgencyNetwork, 'agencies', 'view');
	server.addPutAuth('PUT AgencyNetwork', `${basePath}/agency-network/:id`, updateAgencyNetwork, 'agencies', 'manage');
	server.addGetAuth('Get AgencyNetworkInsurers', `${basePath}/agency-network/insurers-list/:id`, getAgencyNetworkInsurersList, 'agencies', 'view');
};