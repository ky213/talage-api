/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */


const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
//const moment = require("moment")

async function findAll(req, res, next) {
    let error = null;
    const agencyNetworkBO = new AgencyNetworkBO();

    const rows = await agencyNetworkBO.getList(req.query).catch(function(err) {
        log.error("admin agencynetwork error: " + err + __location);
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
        return next(serverHelper.notFoundError('Agency Network not found'));
    }


}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyNetworkBO = new AgencyNetworkBO();
    // Load the request data into it
    const objectJSON = await agencyNetworkBO.getById(id).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (objectJSON) {
        // log.debug(`Agency Network returned: ${JSON.stringify(objectJSON)}` + __location)
        res.send(200, objectJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Agency Network not found'));
    }

}
//add
async function add(req, res, next) {


    if(req.body && req.body.feature_json){
        req.body.featureJson = req.body.feature_json
    }

    const agencyNetworkBO = new AgencyNetworkBO();
    let error = null;
    await agencyNetworkBO.saveModel(req.body).catch(function(err) {
        log.error("agency network save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    const newdoc = await agencyNetworkBO.getById(agencyNetworkBO.id).catch(function(err) {
        log.error("agency network get error " + err + __location);
        error = err;
    });

    res.send(200, newdoc);

    return next();

}


//update
async function update(req, res, next) {
    //log.debug("AgencyNetwork PUT:  " + JSON.stringify(req.body))
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    if(req.body.feature_json){
        req.body.featureJson = req.body.feature_json
    }
    const agencyNetworkBO = new AgencyNetworkBO();
    let error = null;
    await agencyNetworkBO.saveModel(req.body).catch(function(err) {
        log.error("agency network save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    const newdoc = await agencyNetworkBO.getById(agencyNetworkBO.id).catch(function(err) {
        log.error("agency network get error " + err + __location);
        error = err;
    });

    res.send(200, newdoc);
    return next();

}


exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('Get Agency Network list', `${basePath}/agency-network`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get Agency Network Object', `${basePath}/agency-network/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post Agency Network Object', `${basePath}/agency-network`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put Agency Network Object', `${basePath}/agency-network/:id`, update, 'administration', 'all');

};