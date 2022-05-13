const QuoteBO = require("../../../shared/models/Quote-BO");

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
    const applicationBO = new ApplicationBO();
    const quoteBO = new QuoteBO();
    const quoteDocs = await quoteBO.getList({insurerId: req.authentication.insurerId});
    let appDocs = null;
    try {
        appDocs = await applicationBO.getAppListForAgencyPortalSearch({applicationId: {$in: quoteDocs.map(t => t.applicationId)}});
    }
    catch (err) {
        log.error('Application Docs-2 error lookup' + err + __location);
        return next(serverHelper.requestError('Bad Request: Invalid Query'));
    }

    try {
        const appList = [];
        const agencyBO = new AgencyBO();

        for(const appDoc of appDocs) {
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
        res.send(200, appList)
    }
    catch (err){
        log.error('Application finding Agency ' + err + __location);
    }
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetInsurerPortalAuth('Get Applications by InsurerId', `${basePath}/applications`, getApplications, 'applications', 'view');
    // server.addPost('Get Applications by InsurerId', `${basePath}/applications`, getApplications);
};