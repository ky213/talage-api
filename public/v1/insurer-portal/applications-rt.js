
const serverHelper = global.requireRootPath('server.js');
// const ApplicationMongooseModel = global.mongoose.Application;
// const QuoteMongooseModel = global.mongoose.Quote;
const Quote = global.mongoose.Quote;

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
    const agrQuery = [
        {$match: {
            insurerId: req.authentication.insurerId,
            createdAt: {$gte: new Date("2022-01-01T00:08:00.000Z")}
        }},
        { 
            $group : { 
                _id : { 
                    applicationId : "$applicationId", 
                    amount : "$amount", 
                    quoteStatus: "$quoteStatusDescription",
                    quoteNumber: "$quoteNumber"
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
        }
    ]

    if(req.query && req.query.quoteStatus){
        agrQuery[0]['$match'].quoteStatusDescription = {$in: req.query.quoteStatus }
    }

    try {
        const insurerUniqueQuotes = await Quote.aggregate(agrQuery);
        res.send(200, insurerUniqueQuotes);
    }
    catch(err){
        log.error('Unique Quote Error ' + err + __location);
    }
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetInsurerPortalAuth('Get Unique Quotes by InsurerId', `${basePath}/applications/getuniquequotes`, getUniqueQuotes, 'applications', 'view');
};