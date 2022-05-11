const serverHelper = global.requireRootPath('server.js');

const ApplicationMongooseModel = global.mongoose.Application;
const QuoteMongooseModel = global.mongoose.Quote;
//const Quote =global.mongoose.Quote;
const ActivityCode = global.mongoose.ActivityCode;

const InsurerIndustryCodeModel = global.mongoose.InsurerIndustryCode;

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

    if((req.params.insurerSlug && req.params.insurerSlug.length  > 1) || req.params.insurerQuoteStatusId > -1
    || (req.params.quoteNumber && req.params.quoteNumber.length > 2)){

        // basic lookup
        const query = {
            insurerId: insurerId,
            createdAt: {
                $gte: startPeriod,
                $lte: endPeriod
            }
        }

        try {
            const appDocs = await ApplicationMongooseModel.find();

            res.send(200, appDocs);


        }
        catch (err) {
            log.error(`Application Docs error ` + err + __location);
        }

        return next();

    }
 }