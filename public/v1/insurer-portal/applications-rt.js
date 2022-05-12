const { forEach } = require("lodash");

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
     const query = {
            agencyNetworkId: req.params.insurerId,
        }
        
    if(req.params.alt) {
            
        // basic lookup
        log.debug('application lookup --' + req.params.insurerId);
        try {
            const appDocs = await ApplicationMongooseModel.find(query);
            res.send(200, appDocs);
        }
        catch (err) {
            log.error(`Application Docs error ` + err + __location);
        }      
    }
    else{
        // traditional lookup
        log.debug('trad lookup --' + req.params.insurerId);
        
        const applicationBO = new ApplicationBO;

        const appDocs = await applicationBO.getAppListForAgencyPortalSearch(query).catch(err=>{
            log.error('Application Docs-2 error lookup' + err + __location);
        });

        try {
            let appList = [];
            let appDoc = {};
            const agencyBO = new AgencyBO;

            for(const app in appDocs){
                appDoc  = appDocs[app]
                if(appDoc.applicationId){
                    let appx = await agencyBO.getById(appDoc.agencyId)
                    // log.debug('agency id ' + JSON.stringify(appx, '', 4));
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
    //TODO add proper auth
    server.addPost('Get Applications by InsurerId', `${basePath}/applications`, getApplications);
};