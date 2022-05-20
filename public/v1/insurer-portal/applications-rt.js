// const QuoteBO = require("../../../shared/models/Quote-BO");

const serverHelper = global.requireRootPath('server.js');

// const ApplicationMongooseModel = global.mongoose.Application;
// const QuoteMongooseModel = global.mongoose.Quote;
const Quote = global.mongoose.Quote;
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
    let appDocs = null;
    try {
        const quoteDocs = await Quote.aggregate([
            {$match: {
                insurerId: req.authentication.insurerId,
                createdAt: {$gte: new Date("2022-01-01T00:08:00.000Z")}
            }},
            {$limit: 500},
            {$group : {
                    _id : {
                        applicationId : "$applicationId", 
                        amount : "$amount", 
                        quoteStatus: "$quoteStatusDescription",
                        updatedAt : {
                            $max : [
                                "$updatedAt"
                            ]
                        }
                    }
                }
            }, 
        ]);

        appDocs = await applicationBO.getAppListForAgencyPortalSearch({applicationId: {$in: quoteDocs.map(t => t._id.applicationId)}});
    
        // add quote value and quote_status
        const aDocs = await appDocs.map(q => {
            const y = quoteDocs.filter(x => x._id.applicationId == q.applicationId);
            if(y[0] && y[0]._id && y[0]._id.quoteStatus){
                q.quoteStatus = y._id.quoteStatus;
            }
            else {
                q.quoteStatus = "";
            }
            if(y[0] && y[0]._id && y[0]._id.amount){
                q.quoteAmount = y._id.amount;
            }
            else {
                q.quoteAmount = 0;
            }
        })

    }
    catch (err) {
        log.error('Application Docs-2 error lookup' + err + __location);
        return next(serverHelper.requestError('Bad Request: Invalid Query'));
    }

    try {
        const appList = [];
        const agencyBO = new AgencyBO();

        for(const appDoc of aDocs) {
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

/**
 * Responds to get unique quotes for current insurer id the application page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
 async function getUniqueQuotes(req, res, next){

    try {
        const insurerUniqueQuotes = await Quote.aggregate([
            {$match: {
                insurerId: req.authentication.insurerId,
                createdAt: {$gte: new Date("2022-01-01T00:08:00.000Z")}
            }},
            { 
                $group : { 
                    _id : { 
                        applicationId : "$applicationId", 
                        updatedAt : { 
                            $max : [
                                "$updatedAt"
                            ]
                        },
                        amount : "$amount", 
                        quoteStatus: "$quoteStatusDescription",
                    }
                }
            }, 
            { 
                $lookup : { 
                    from : "applications", 
                    localField : "_id.applicationId", 
                    foreignField : "applicationId", 
                    as : "appl"
                }
            },
            {
                $project : {
                    "appl.questions": 0,
                    "appl.locations": 0
                }
            },
            { 
                $lookup : { 
                    from : "agencies", 
                    localField : "appl.agencyId", 
                    foreignField : "systemId", 
                    as : "agency"
                }
            }, 
            { 
                $unwind : { 
                    path : "$appl"
                }
            }, 
            { 
                $unwind : { 
                    path : "$appl.policies"
                }
            }, 
            { 
                $unwind : { 
                    path : "$agency"
                }
            },
            { $limit: 500 },
        ]);
        res.send(200, insurerUniqueQuotes);
    }
    catch(err){
        log.error('Unique Quote Error ' + err + __location);
    }
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetInsurerPortalAuth('Get Applications by InsurerId', `${basePath}/applications`, getApplications, 'applications', 'view');
    server.addGetInsurerPortalAuth('Get Unique Quotes by InsurerId', `${basePath}/applications/getuniquequotes`, getUniqueQuotes, 'applications', 'view');
    // server.addPost('Get Applications by InsurerId', `${basePath}/applications`, getApplications);
};