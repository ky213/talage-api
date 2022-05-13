const serverHelper = global.requireRootPath('server.js');

const ApplicationMongooseModel = global.mongoose.Application;
// const QuoteMongooseModel = global.mongoose.Quote;
// const Quote =global.mongoose.Quote;
// const ActivityCode = global.mongoose.ActivityCode;

// const InsurerIndustryCodeModel = global.mongoose.InsurerIndustryCode;

const ApplicationBO = global.requireShared('./models/Application-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');

/**
 * Responds to get requests for the applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getApplications(req, res, next){
    const query = {agencyNetworkId: req.authentication.insurerId}

    if(req.params.alt) {

        // basic lookup
        try {
            const appDocs = await ApplicationMongooseModel.find(query);
            res.send(200, appDocs);
        }
        catch (err) {
            log.error(`Application Docs error ` + err + __location);
            return next(serverHelper.requestError('Bad Request: No data received'));
        }
    }
    else{

        const applicationBO = new ApplicationBO();
        const appDocs = await applicationBO.getAppListForAgencyPortalSearch(query).catch(err => {
            log.error('Application Docs-2 error lookup' + err + __location);
            return next(serverHelper.requestError('Bad Request: Invalid Query'));
        });

        try {
            const appList = [];
            let appDoc = {};
            const agencyBO = new AgencyBO();
            for(const app in appDocs){
                if(app){
                    appDoc = appDocs[app];
                    if(appDoc.applicationId){
                        const appx = await agencyBO.getById(appDoc.agencyId)
                        appDoc.agencyOwnerName = appx.firstName + ' ' + appx.lastName;
                        appDoc.agencyOwnerEmail = appx.email;
                        if(appx.phone){
                            appDoc.agencyPhone = appx.phone;
                        }
                        else{
                            appDoc.agencyPhone = '';
                        }
                        if(appDoc.metrics && appDoc.metrics.appValue){
                            appDoc.appValue = appDoc.metrics.appValue;
                        }
                        else {
                            appDoc.appValue = 0;
                        }
                        appList.push(appDoc);
                    }
                }
            }
            res.send(200, appList)
        }
        catch (err){
            log.error('Application finding Agency ' + err + __location);
        }
    }
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get Applications by InsurerId', `${basePath}/applications`, getApplications, 'applications', 'view', {insurerPortal: true});
    // server.addPost('Get Applications by InsurerId', `${basePath}/applications`, getApplications);

};