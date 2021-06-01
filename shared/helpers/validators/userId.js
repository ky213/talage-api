'use strict';

const validator = global.requireShared('./helpers/validator.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

module.exports = async function(val, agencyId, isAgencyNetwork){
    if(!validator.integer(val) || agencyId && !validator.integer(agencyId)){
        return false;
    }

    const query = {agencyPortalUserId: parseInt(val, 10)};
    if(agencyId){
        if(isAgencyNetwork){
            query.agencyNetworkId = parseInt(agencyId, 10);
        }
        else{
            query.agencyId = parseInt(agencyId, 10);
        }
    }


    let had_error = false;
    const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
    const agencyPortalUserBO = new AgencyPortalUserBO();
    log.debug(`Validator UserId query ${JSON.stringify(query)}`);
    const result = await agencyPortalUserBO.getList(query).catch(function(error){
        log.error(error + __location);
        had_error = true;
    });
    if(had_error){
        return false;
    }

    if(result && result.length > 0){
        return true;
    }
    else {
        return false;
    }

};