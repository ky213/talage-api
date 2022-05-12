const serverHelper = global.requireRootPath('server.js');

const ApplicationMongooseModel = global.mongoose.Application;
// const QuoteMongooseModel = global.mongoose.Quote;
// const Quote =global.mongoose.Quote;
// const ActivityCode = global.mongoose.ActivityCode;

// const InsurerIndustryCodeModel = global.mongoose.InsurerIndustryCode;

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

    if(req.params.insurerId) {

        
        // basic lookup
        const query = {
            agencyNetworkId: req.params.insurerId,
        }
        
        log.debug('application lookup --' + req.params.insurerId);
        try {
            const appDocs = await ApplicationMongooseModel.find({agencyNetworkId:req.params.insurerId});
            res.send(200, appDocs);
        }
        catch (err) {
            log.error(`Application Docs error ` + err + __location);
        }      
    }

    return next();
 }

 /* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    //TODO add proper auth
    server.addPost('Get Applications by InsurerId', `${basePath}/applications`, getApplications);
};