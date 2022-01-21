/* eslint-disable require-jsdoc */
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const ApplicationNotesBO = global.requireShared('models/ApplicationNotes-BO.js');
const {Error} = require('mongoose');

async function getApplicationNotes(req, res, next){
    // Check for data
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    // Make sure basic elements are present
    if (!req.query.applicationId) {
        log.error('Bad Request: Missing application id ' + __location);
        return next(serverHelper.requestError('Bad Request: You must supply an application id'));
    }

    const id = req.query.applicationId;

    // Get the agents that we are permitted to view

    const applicationBO = new ApplicationBO();
    //get application and valid agency
    try{
        const applicationDB = await applicationBO.getById(req.query.applicationId);
        const passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB?.agencyId, applicationDB?.agencyNetworkId)

        // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
        if (!passedAgencyCheck) {
            log.info('Forbidden: User is not authorized to access the requested application');
            return next(serverHelper.forbiddenError('You are not authorized to access the requested application'));
        }

        if(!applicationDB){
            return next(serverHelper.requestError('Not Found'));
        }
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    const applicationNotesBO = new ApplicationNotesBO();
    let applicationNotesJSON = null;
    try{
        // Return the response
        log.debug(`Getting app notes using app id  ${id} from mongo` + __location)
        res.send(200, await applicationNotesBO.getByApplicationId(id));
        return next();
    }
    catch(err){
        log.error("Error Getting application notes doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }
}

async function addApplicationNotes(req, res, next) {
    if (!req.body || typeof req.body !== 'object') {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    if (!req.body.applicationId) {
        log.error('Bad Request: Missing applicationId ' + __location);
        return next(serverHelper.requestError('Bad Request: Missing applicationId'));
    }

    const applicationBO = new ApplicationBO();
    try{
        const applicationDB = await applicationBO.getById(req.body.applicationId);
        const passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB?.agencyId, applicationDB?.agencyNetworkId)

        if(!passedAgencyCheck){
            log.info('Forbidden: User is not authorized for this agency' + __location);
            return next(serverHelper.forbiddenError('You are not authorized for this agency'));
        }
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    let responseAppNotesDoc = null;
    let userId = null;
    try{
        userId = req.authentication.userID;
    }
    catch(err){
        log.error("Error gettign userID " + err + __location);
    }
    try{
        const applicationNotesBO = new ApplicationNotesBO();
        log.debug('Saving app notes doc');
        responseAppNotesDoc = await applicationNotesBO.insertMongo(req.body, userId);
    }
    catch(err){
        //mongoose parse errors will end up there.
        log.error("Error saving application notes " + err + __location)
        return next(serverHelper.requestError(`Bad Request: Save error ${err}`));
    }

    if(responseAppNotesDoc){
        const responseAppNotesJSON = JSON.parse(JSON.stringify(responseAppNotesDoc));
        res.send(200, responseAppNotesJSON.map(t => t.applicationNotesJSON));
        return next();
    }
    else{
        // res.send(500, "No updated document");
        return next(serverHelper.internalError(new Error('No updated document')));
    }
}

async function saveApplicationNotes(req, res, next){
    if (!req.body || typeof req.body !== 'object') {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    if (!req.body.applicationId) {
        log.error('Bad Request: Missing applicationId ' + __location);
        return next(serverHelper.requestError('Bad Request: Missing applicationId'));
    }

    const applicationBO = new ApplicationBO();
    //get application and valid agency
    let passedAgencyCheck = false;
    try{
        const applicationDB = await applicationBO.getById(req.body.applicationId);
        passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB?.agencyId, applicationDB?.agencyNetworkId)
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(passedAgencyCheck === false){
        log.info('Forbidden: User is not authorized for this agency' + __location);
        return next(serverHelper.forbiddenError('You are not authorized for this agency'));
    }

    let responseAppNotesDoc = null;
    let userId = null;
    try{
        userId = req.authentication.userID;
    }
    catch(err){
        log.error("Error gettign userID " + err + __location);
    }
    try{
        const applicationNotesBO = new ApplicationNotesBO();
        log.debug('Saving app notes doc');
        responseAppNotesDoc = await applicationNotesBO.saveModel(req.body, userId);
    }
    catch(err){
        //mongoose parse errors will end up there.
        log.error("Error saving application notes " + err + __location)
        return next(serverHelper.requestError(`Bad Request: Save error ${err}`));
    }

    if(responseAppNotesDoc){
        const resposeAppNotesJSON = JSON.parse(JSON.stringify(responseAppNotesDoc));
        res.send(200, {applicationNotes: resposeAppNotesJSON});
        return next();
    }
    else{
        // res.send(500, "No updated document");
        return next(serverHelper.internalError(new Error('No updated document')));
    }
}

async function createApplicationNote(req, res, next){
    if (!req.body || typeof req.body !== 'object') {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    if (!req.body.applicationId) {
        log.error('Bad Request: Missing applicationId ' + __location);
        return next(serverHelper.requestError('Bad Request: Missing applicationId'));
    }

    const applicationBO = new ApplicationBO();
    //get application and valid agency
    let passedAgencyCheck = false;
    try{
        const applicationDB = await applicationBO.getById(req.body.applicationId);
        passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB?.agencyId, applicationDB?.agencyNetworkId)
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(passedAgencyCheck === false){
        log.info('Forbidden: User is not authorized for this agency' + __location);
        return next(serverHelper.forbiddenError('You are not authorized for this agency'));
    }

    let responseAppNotesDoc = null;
    let userId = null;
    try{
        userId = req.authentication.userID;
    }
    catch(err){
        log.error("Error gettign userID " + err + __location);
    }
    try{
        const applicationNotesBO = new ApplicationNotesBO();
        log.debug('Saving app notes doc');
        responseAppNotesDoc = await applicationNotesBO.insertMongo(req.body, userId);
        if(!responseAppNotesDoc){
            // res.send(500, "No updated document");
            return next(serverHelper.internalError(new Error('No updated document')));
        }
        res.send(200, {applicationNotes: await applicationNotesBO.getByApplicationId(req.body.applicationId)});
        return next();

    } catch(err){
        //mongoose parse errors will end up there.
        log.error("Error saving application notes " + err + __location)
        return next(serverHelper.requestError(`Bad Request: Save error ${err}`));
    }
}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('GET Application Notes', `${basePath}/application/notes`, getApplicationNotes, 'applications', 'view');
    server.addPostAuth('POST Create Application Notes', `${basePath}/application/notes`, createApplicationNote, 'applications', 'manage');
    server.addPutAuth('PUT Update Application Notes', `${basePath}/application/notes`, saveApplicationNotes, 'applications', 'manage');
};
