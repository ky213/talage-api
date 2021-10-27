/* eslint-disable require-jsdoc */


const AgencyPortalUserBO = global.requireShared('./models/AgencyPortalUser-BO.js');


async function getUsersByAgency(agencyId, policyTypeList = []){
    let recipientsString = '';

    if(agencyId){
        // look up agencyportal users by agencyNotificationList
        const agencyPortalUserBO = new AgencyPortalUserBO();
        const query = {agencyNotificationList: agencyId}
        try{
            const anUserList = await agencyPortalUserBO.getList(query)
            if(anUserList && anUserList.length > 0){
                for(const anUser of anUserList){
                    let addUser = false;
                    //check notificationpolicyTypelist
                    if(policyTypeList?.length > 0 && anUser?.notificationPolicyTypeList?.length > 0){
                        addUser = policyTypeList.some(x => anUser.notificationPolicyTypeList.indexOf(x) > -1);
                    }
                    else {
                        addUser = true;
                    }
                    if(addUser){
                        if(recipientsString.length > 0){
                            recipientsString += `,`;
                        }
                        log.debug(`getUsersByAgency for agency ${agencyId} adding ${anUser.email}` + __location)
                        recipientsString += anUser.email
                    }
                }
            }
        }
        catch(err){
            log.error(`Error get agencyportaluser notification list ${err}` + __location);
        }
    }
    return recipientsString;

}


// eslint-disable-next-line object-curly-newline
module.exports = {
    getUsersByAgency: getUsersByAgency
// eslint-disable-next-line object-curly-newline
}