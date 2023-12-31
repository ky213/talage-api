/* eslint-disable no-loop-func */
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const AgencyPortalUserBO = global.requireShared('./models/AgencyPortalUser-BO.js');
const crypt = global.requireShared('./services/crypt.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
//const moment = require("moment")

const AgencyNetworkBO = global.requireShared(`./models/AgencyNetwork-BO.js`)
const AgencyBO = global.requireShared(`./models/Agency-BO.js`)

async function findAll(req, res, next) {
    log.debug(`Admin users find all ${JSON.stringify(req.query)}`)
    let error = null;
    if(req.query.agency_network){
        req.query.agencyNetworkId = req.query.agency_network;
        delete req.query.agency_network
    }

    if(req.query.agencynetworkid){
        req.query.agencyNetworkId = req.query.agencynetworkid;
        delete req.query.agencynetworkid
    }
    //only agencyNetwork users.
    req.query.isAgencyNetworkUser = true;
    const agencyPortalUserBO = new AgencyPortalUserBO();
    const rows = await agencyPortalUserBO.getList(req.query).catch(function(err) {
        error = err;
    })
    if (error) {
        return next(error);
    }
    if (rows) {

        res.send(200, rows);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Agency Users not found'));
    }
}

async function findGroupAll(req, res, next) {

    let error = null;
    const agencyPortalUserBO = new AgencyPortalUserBO();
    const forTalageAdmin = true;
    const agencyNetworkRoles = true;
    const rows = await agencyPortalUserBO.getGroupList(forTalageAdmin, agencyNetworkRoles).catch(function(err) {
        error = err;
    })
    if (error) {
        return next(error);
    }
    if (rows) {

        res.send(200, rows);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Agency Users not found'));
    }
}

async function findAgencyNetworkAllAgenciesUsers(req, res, next){
    const agencyNetworkId = stringFunctions.santizeNumber(req.query.agencyNetworkId, true);
    if(!agencyNetworkId){
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyNetworkBO = new AgencyNetworkBO();
    const agencyNetworkJSON = await agencyNetworkBO.getById(agencyNetworkId).catch(function(err){
        log.error(`Error retrieving list of agencies for agency network id ${agencyNetworkId}: ` + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    // get list of all agencies for this network
    const agencyBO = new AgencyBO();
    const agencyList = await agencyBO.getByAgencyNetwork(agencyNetworkId).catch(function(err){
        log.error(`Error retrieving list of agencies for agency network id ${agencyNetworkId}: ` + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    if(!agencyList){
        return next(new Error("bad agency lookup "));
    }
    // eslint-disable-next-line array-element-newline
    const removeProps = ["legalAcceptance","tableOptions","notificationPolicyTypeList","enableGlobalView","openidAuthConfigId","password"]
    // for each agency grab the agency users
    const allAgencyUserList = [];
    if(agencyList.length > 0){
        const agencyPortalUserBO = new AgencyPortalUserBO();
        for(let i = 0; i < agencyList.length; i++){
            let agencyUserListDB = await agencyPortalUserBO.getList({agencyId: parseInt(agencyList[i].systemId, 10)}).catch(function(err) {
                error = err;
            })
            if (error) {
                log.error(`Error retrieving list of users for agency id ${agencyList[i].systemId}: ` + error + __location);
                break;
            }
            let agencyUserList = JSON.parse(JSON.stringify(agencyUserListDB))
            for(let j = 0; j < agencyUserList.length; j++){
                let user = agencyUserList[j];

                for(const prop of removeProps){
                    if(user[prop]){
                        delete user[prop]
                    }
                }
                user.agencyName = agencyList[i].name.replace(/,/g,"");
                user.agencyNetwork = agencyNetworkJSON.name
                user.marketingChannel = agencyNetworkJSON.marketingChannel;
            }
            if(agencyUserList && agencyUserList.length > 0){
                allAgencyUserList.push(agencyUserList);
            }
        }
    }
    if (error) {
        return next(error);
    }
    if(allAgencyUserList.length > 0){
        const flattenedArrayOfAllUsers = allAgencyUserList.flat();
        res.send(200, flattenedArrayOfAllUsers);
    }
    else {
        return next(serverHelper.notFoundError('Agency users not found'));
    }
}
async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyPortalUserBO = new AgencyPortalUserBO();
    // Load the request data into it
    const userJSON = await agencyPortalUserBO.getById(id).catch(function(err) {
        log.error("agencyPortalUserBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    if(userJSON.password){
        delete userJSON.password
    }
    // Send back a success response
    if (userJSON) {
        res.send(200, userJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Agency Location not found'));
    }

}

async function add(req, res, next) {

    if (req.body.agencynetworkid || req.body.agency_network) {
        if(req.body.agencynetworkid){
            req.body.agency_network = req.body.agencynetworkid;
            delete req.body.agencynetworkid
        }
    }
    else {
        return next(serverHelper.requestError('Missing agencynetworkid'))
    }

    if (!req.body.password) {
        return next(serverHelper.requestError('Missing password'))
    }

    if (req.body.email) {
        //validate email
    }
    else {
        return next(serverHelper.requestError('Missing email'))
    }
    if (req.body.group) {
        //validate group
    }
    else {
        return next(serverHelper.requestError('Missing group'))
    }

    if (req.body.password) {
        //process hashing
        req.body.password = await crypt.hashPassword(req.body.password);
    }

    const allowedPropsInsert = ['password',
        'email',
        'group',
        'reset_required',
        'timezone',
        "agency_network"]
    let insertJSON = {state: 1}
    let needToUpdate = false;
    for(let i = 0; i < allowedPropsInsert.length; i++) {
        if(req.body[allowedPropsInsert[i]]){
            insertJSON[allowedPropsInsert[i]] = req.body[allowedPropsInsert[i]];
            needToUpdate = true
        }
    }
    if(req.body.group){
        insertJSON.agencyPortalUserGroupId = req.body.group
    }
    if(req.body.reset_required){
        insertJSON.resetRequired = req.body.reset_required
    }
    if(req.body.agency_network){
        insertJSON.agencyNetworkId = req.body.agency_network
        insertJSON.isAgencyNetworkUser = true;
    }


    if(needToUpdate){
        const agencyPortalUserBO = new AgencyPortalUserBO();
        let error = null;
        await agencyPortalUserBO.saveModel(insertJSON).catch(function(err) {
            log.error("agencyPortalUserBO load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }

        const userJSON = await agencyPortalUserBO.getById(agencyPortalUserBO.id).catch(function(err) {
            log.error("agencyPortalUserBO load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
        if(userJSON.password){
            delete userJSON.password
        }

        res.send(200, userJSON);
        return next();
    }
    else{
        return next(serverHelper.requestError('Missing creation properties'))
    }

}


async function update(req, res, next) {

    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    if (req.body.password) {
        //process hashing
        req.body.password = await crypt.hashPassword(req.body.password);
    }
    const allowedPropsUpdate = ['password',
        'email',
        'group',
        'require_set',
        'reset_required',
        'can_sign',
        'timezone']
    let updateJSON = {id: id}
    let needToUpdate = false;
    for(let i = 0; i < allowedPropsUpdate.length; i++) {
        let value = req.body[allowedPropsUpdate[i]]
        if(value || value === '' || value === 0){
            updateJSON[allowedPropsUpdate[i]] = req.body[allowedPropsUpdate[i]];
            needToUpdate = true
        }
    }

    if(req.body.group){
        updateJSON.agencyPortalUserGroupId = req.body.group
    }
    if(req.body.reset_required){
        updateJSON.resetRequired = req.body.reset_required
    }

    if(needToUpdate){
        if(req.body.email){
            updateJSON.clear_email = req.body.email;
        }
        //only agencyNetworkUsers
        updateJSON.isAgencyNetworkUser = true;
        const agencyPortalUserBO = new AgencyPortalUserBO();
        let error = null;
        await agencyPortalUserBO.saveModel(updateJSON).catch(function(err) {
            log.error("agencyPortalUserBO load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
        const userJSON = await agencyPortalUserBO.getById(id).catch(function(err) {
            log.error("agencyPortalUserBO load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }

        if(userJSON.password){
            delete userJSON.password
        }

        res.send(200, userJSON);
        return next();
    }
    else {
        return next(serverHelper.requestError('Missing updatable property'))
    }


}


async function deleteObject(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyPortalUserBO = new AgencyPortalUserBO();
    await agencyPortalUserBO.deleteSoftById(id).catch(function(err) {
        log.error("agencyPortalUserBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, {"success": true});
    return next();

}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('Get Agency Network Users list', `${basePath}/agency-network-user`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Agency Network User  Object', `${basePath}/agency-network-user/:id`, findOne, 'administration', 'all');
    server.addPutAuthAdmin('PUT Agency Network User', `${basePath}/agency-network-user/:id`, update, 'administration', 'all');
    server.addPostAuthAdmin('POST Agency Network User', `${basePath}/agency-network-user`, add, 'administration', 'all');
    server.addDeleteAuthAdmin('Delete Agency Network User', `${basePath}/agency-network-user/:id`, deleteObject, 'administration', 'all');
    server.addGetAuthAdmin('Get Agency Network User Groups list', `${basePath}/agency-network-user/groups`, findGroupAll, 'administration', 'all');
    server.addGetAuthAdmin('Get Agency Network All Agencies User list', `${basePath}/agency-network-all-agency-users`, findAgencyNetworkAllAgenciesUsers, 'administration', 'all');
};