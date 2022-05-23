const InsurerPortalUserBO = global.requireShared('./models/InsurerPortalUser-BO.js');
const InsurerPortalUserGroupBO = global.requireShared('./models/InsurerPortalUserGroup-BO.js');
const crypt = global.requireShared('./services/crypt.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
//const moment = require("moment")

async function findAll(req, res, next) {
    log.debug(`Admin users find all ${JSON.stringify(req.query)}`)
    let rows = null;
    try {
        const insurerPortalUserBO = new InsurerPortalUserBO();
        rows = await insurerPortalUserBO.getList(req.query);
    }
    catch(err) {
        return next(err);
    }
    if (rows) {
        res.send(200, rows);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Insurer Portal Users not found'));
    }
}

async function findGroupAll(req, res, next) {

    let rows = null;
    try {
        const insurerPortalUserBO = new InsurerPortalUserBO();
        rows = await insurerPortalUserBO.getGroupList();
    }
    catch(err) {
        return next(err);
    }
    if (rows) {
        res.send(200, rows);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Insurer Portal not found'));
    }
}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let userJSON = null;
    try {
        const insurerPortalUserBO = new InsurerPortalUserBO();
        // Load the request data into it
        userJSON = await insurerPortalUserBO.getById(id);
    }
    catch(err) {
        log.error("insurerPortalUserBO load error " + err + __location);
        return next(err);
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
        return next(serverHelper.notFoundError('Insurer Location not found'));
    }

}

async function add(req, res, next) {
    if (!req.body.insurerId) {
        return next(serverHelper.requestError('Missing insurerId'));
    }
    if (!req.body.email) {
        return next(serverHelper.requestError('Missing email'))
    }
    if (!req.body.insurerPortalUserGroupId) {
        return next(serverHelper.requestError('Missing group'))
    }
    if (req.body.password) {
        req.body.password = await crypt.hashPassword(req.body.password);
    }
    else {
        return next(serverHelper.requestError('Missing password'));
    }
    const allowedPropsInsert = [
        'password',
        'email',
        'insurerPortalUserGroupId',
        'timezone',
        'insurerId'
    ];
    const insertJSON = {state: 1}
    let needToUpdate = false;
    for(let i = 0; i < allowedPropsInsert.length; i++) {
        if(req.body[allowedPropsInsert[i]]){
            insertJSON[allowedPropsInsert[i]] = req.body[allowedPropsInsert[i]];
            needToUpdate = true
        }
    }

    try {
        const insurerPortalUserGroupBO = new InsurerPortalUserGroupBO();
        const insurerPortalUserGroup = await insurerPortalUserGroupBO.getById(insertJSON.insurerPortalUserGroupId);
        if(insurerPortalUserGroup.permissions?.globalUser && !/@talageins.com$/.test(insertJSON.email)) {
            log.warn("Can't add non-talage email user as a global user " + __location);
            return next(serverHelper.requestError('Non-talage email cannot be a global user'));
        }
    }
    catch(err) {
        log.error("insurerPortalUserBO load error " + err + __location);
        return next(err);
    }

    if(needToUpdate){
        const insurerPortalUserBO = new InsurerPortalUserBO();
        try {
            await insurerPortalUserBO.saveModel(insertJSON);
        }
        catch(err) {
            log.error("insurerPortalUserBO load error " + err + __location);
            return next(err);
        }
        let userJSON = null;
        try {
            userJSON = await insurerPortalUserBO.getById(insurerPortalUserBO.id);
        }
        catch(err) {
            log.error("insurerPortalUserBO load error " + err + __location);
            return next(err);
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
    const allowedPropsUpdate = [
        'password',
        'email',
        'insurerPortalUserGroupId',
        'requireSet',
        'canSign',
        'timezone'
    ];
    const updateJSON = {id: id}
    let needToUpdate = false;
    for(let i = 0; i < allowedPropsUpdate.length; i++) {
        const value = req.body[allowedPropsUpdate[i]]
        if(value || value === '' || value === 0){
            updateJSON[allowedPropsUpdate[i]] = req.body[allowedPropsUpdate[i]];
            needToUpdate = true;
        }
    }

    try {
        const insurerPortalUserGroupBO = new InsurerPortalUserGroupBO();
        const insurerPortalUserGroup = await insurerPortalUserGroupBO.getById(updateJSON.insurerPortalUserGroupId);
        if(insurerPortalUserGroup.permissions?.globalUser && !/@talageins.com$/.test(updateJSON.email)) {
            log.warn("Can't add non-talage email user as a global user " + __location);
            return next(serverHelper.requestError('Non-talage email cannot be a global user'));
        }
    }
    catch(err) {
        log.error("insurerPortalUserBO load error " + err + __location);
        return next(err);
    }

    if(needToUpdate){
        if(updateJSON.email){
            updateJSON.clear_email = req.body.email;
        }
        const insurerPortalUserBO = new InsurerPortalUserBO();
        let userJSON = null;
        try {
            await insurerPortalUserBO.saveModel(updateJSON)
            userJSON = await insurerPortalUserBO.getById(id)
        }
        catch(err) {
            log.error("insurerPortalUserBO load error " + err + __location);
            return next(err);
        }

        if(userJSON.password){
            delete userJSON.password
        }
        res.send(200, userJSON);
        return next();
    }
    else {
        return next(serverHelper.requestError('Missing updatable property'));
    }


}


async function deleteUser(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    const insurerPortalUserBO = new InsurerPortalUserBO();
    try {
        await insurerPortalUserBO.deleteSoftById(id);
    }
    catch(err) {
        log.error("insurerPortalUserBO load error " + err + __location);
        return next(err);
    }
    res.send(200, {"success": true});
    return next();

}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Insurer Portal Users list', `${basePath}/insurer-portal/user`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Insurer Portal User  Object', `${basePath}/insurer-portal/user/:id`, findOne, 'administration', 'all');
    server.addGetAuthAdmin('GET Insurer Portal User Groups list', `${basePath}/insurer-portal/user-groups`, findGroupAll, 'administration', 'all');
    server.addPutAuthAdmin('PUT Insurer Portal User', `${basePath}/insurer-portal/user/:id`, update, 'administration', 'all');
    server.addPostAuthAdmin('POST Insurer Portal User', `${basePath}/insurer-portal/user`, add, 'administration', 'all');
    server.addDeleteAuthAdmin('DELETE Insurer Portal User', `${basePath}/insurer-portal/user/:id`, deleteUser, 'administration', 'all');
};
