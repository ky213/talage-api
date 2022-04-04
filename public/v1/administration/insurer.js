
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerBO = global.requireShared('./models/Insurer-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const moment = require('moment');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const emailsvc = global.requireShared('./services/emailsvc.js');

async function sendEmailNotification(insurer){
    const emailData = {
        html: `
            <p>
                A new insurer was created with the following info:
            </p>
            <ul>
                <li><b>Insurer Id</b>: ${insurer.insurerId}</li>
                <li><b>Name</b>: ${insurer.name}</li>
                <li><b>Slug</b>: ${insurer.slug}</li>
            </ul>
        `,
        subject: 'New Insurer was created',
        to: 'brian@talageins.com'
    };

    const emailResponse = await emailsvc.send(emailData.to, emailData.subject, emailData.html);
    if(emailResponse === false){
        log.error(`Failed to send the new Insurer email notification to ${emailData.to}.`);
    }
    else {
        log.info(`New Insurer email notification was sent successfully to ${emailData.to}.`);
    }
}

async function findAll(req, res, next) {
    let error = null;
    const insurerBO = new InsurerBO();
    if(req.query && req.query.agencysearch){
        delete req.query.agencysearch
    }

    const rows = await insurerBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('Insurer not found'));
    }


}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerBO = new InsurerBO();
    // Load the request data into it
    const insurerJSON = await insurerBO.getById(id).catch(function(err) {
        log.error("Insurer load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (insurerJSON) {
        res.send(200, insurerJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Insurer not found'));
    }

}
//add
async function add(req, res, next) {
    const insurerBO = new InsurerBO();
    let error = null;
    if(!req.body.slug && req.body.name){
        req.body.slug = req.body.name.replace(/\s+/g, '').toLowerCase();
    }

    if(!req.body.description && req.body.name){
        req.body.description = req.body.name;
    }
    await insurerBO.saveModel(req.body).catch(function(err) {
        log.error("Insurer load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    sendEmailNotification(insurerBO.mongoDoc);

    res.send(200, insurerBO.mongoDoc);
    return next();
}


//update
async function update(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const insurerBO = new InsurerBO();
    let error = null;
    await insurerBO.saveModel(req.body).catch(function(err) {
        log.error("Insurer load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerBO.mongoDoc);
    return next();

}

//
// Return Insurer List used for selecting a Insurer
//
// @param {object} req - HTTP request object
// @param {object} res - HTTP response object
// @param {function} next - The next function to execute
//
// @returns {void}
//
async function getSelectionList(req, res, next) {
    //log.debug('getSelectionList: ' + JSON.stringify(req.body))
    let error = false;

    // Initialize an agency object
    const insurerBO = new InsurerBO();

    // Load the request data into it
    const insurerList = await insurerBO.getList({active: true}).catch(function(err) {
        log.error("Insurer load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    res.send(200, insurerList);
    return next();
}

//
// Return Insurer List used for selecting a Insurer
//
// @param {object} req - HTTP request object
// @param {object} res - HTTP response object
// @param {function} next - The next function to execute
//
// @returns {void}
//
async function activityReport(req, res, next) {
    //log.debug('getSelectionList: ' + JSON.stringify(req.body))


    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    const insurerId = parseInt(id,10);
    //Report begin
    //const reportBeginDtm = moment().startOf('month').subtract(3, 'months')
    const reportBeginDtm = moment.tz("America/Los_Angeles").subtract(6,'M').startOf('month')
    let activityReportJSON = [];
    var QuoteModel = global.mongoose.Quote;
    try{
        activityReportJSON = await QuoteModel.aggregate([
            {$match: {insurerId: insurerId, quoteStatusId: {$gte: 20}, createdAt: {$gte: reportBeginDtm.toDate()}}},
            {$project: {
                creationMonth: {$month: {
                    date: '$createdAt', timezone: "America/Los_Angeles"
                }},
                creationYear: {$year: {
                    date: '$createdAt', timezone: "America/Los_Angeles"
                }},
                quoteStatusId: 1,
                quoteStatusDescription: 1,
                insurerId: 1,
                amount: 1
            }},
            {$group: {
                _id: {
                    month: '$creationMonth',
                    year: '$creationYear',
                    quoteStatusId: '$quoteStatusId',
                    quoteStatusDescription: '$quoteStatusDescription',
                    insurerId: '$insurerId'
                },
                count: {$sum: 1},
                premium: {$sum: '$amount'}
            }},
            {$sort: {
                '_id.insurerId': 1,
                '_id.year': 1,
                '_id.month': 1,
                '_id.quoteStatusId': 1,
                '_id.quoteStatusDescription': 1
            }},
            {$replaceRoot: {"newRoot":
            {"$mergeObjects": ["$_id", {
                "count": "$count" ,
                "Premium": "$premium"
            }]
            }
            }},
            {$project: {
                month: 1,
                year: 1,
                quoteStatusId: 1,
                quoteStatusDescription: 1,
                insurerId: 1,
                count: 1,
                Premium: 1,
                quoteRequests : {
                    $cond : [{
                        $in : ["$quoteStatusId", [20,
                            40,
                            50,
                            55,
                            60,
                            58,
                            65,
                            100]]
                    },
                    "$count",
                    null]
                },
                declined : {
                    $cond : [{
                        $eq : ["$quoteStatusId", 20]
                    },
                    "$count",
                    null]
                },
                referred : {
                    $cond : [{
                        $eq : ["$quoteStatusId", 40]
                    },
                    "$count",
                    null]
                },
                quoted : {
                    $cond : [{
                        $in : ["$quoteStatusId", [50,
                            55,
                            60,
                            58,
                            65,
                            100]]
                    },
                    "$count",
                    null]
                },
                bound : {
                    $cond : [{
                        $eq : ["$quoteStatusId", 100]
                    },
                    "$count",
                    null]
                },
                boundPremium : {
                    $cond : [{
                        $eq : ["$quoteStatusId", 100]
                    },
                    "$Premium",
                    null]
                }

            }},
            {
                $group : {
                    _id: {
                        month: '$month',
                        year: '$year'
                    },
                    premium: {$sum: '$Premium'},
                    quoteRequestsCount : {
                        $sum : "$quoteRequests"
                    },
                    quotedCount : {
                        $sum : "$quoted"
                    },
                    boundCount : {
                        $sum : "$bound"
                    },
                    boundPremiumAmount : {
                        $sum : "$boundPremium"
                    }
                }
            },
            {$sort: {
                '_id.year': 1,
                '_id.month': 1
            }},
            {$replaceRoot: {"newRoot":
            {"$mergeObjects": ["$_id", {
                "quoteRequests": "$quoteRequestsCount" ,
                "quotedCount": "$quotedCount" ,
                "quotedPremium": "$premium" ,
                "boundCount": "$boundCount" ,
                "BoundPremium": "$boundPremiumAmount"
            }]
            }
            }}
        ]);
        //turn statuses in columns.


    }
    catch(err){
        log.error("Insurer Activty Report error " + err + __location);
    }
    const options = {
        //  'columns': columns,
        'header': true
    };

    const csvStringify = require('csv-stringify');
    csvStringify(activityReportJSON, options, function(err, output){
        // Check if an error was encountered while creating the CSV data
        if(err){
            log.error(`Insurer Activity Report Export to CSV error: ${err} ${__location}`);
            return next(err);
        }
        log.info(`Finishing CSV output ` + __location)
        // Send the CSV data
        // Set the headers so the browser knows we are sending a CSV file
        res.writeHead(200, {
            'Content-Disposition': `attachment; filename=${id}-activty-report.csv`,
            'Content-Length': output?.length,
            'Content-Type': 'text-csv'
        });

        // Send the CSV data
        res.end(output);


    });

}


exports.registerEndpoint = (server, basePath) => {

    server.addGetAuthAdmin('Get Insurer list', `${basePath}/insurer`, findAll, 'TalageAdminUser', 'all');
    server.addGetAuthAdmin('Get Insurer Object', `${basePath}/insurer/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post Insurer Object', `${basePath}/insurer`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put Insurer Object', `${basePath}/insurer/:id`, update, 'administration', 'all');
    server.addGetAuthAdmin('GET Insurer List for Selection', `${basePath}/insurer/selectionlist`, getSelectionList, 'administration', 'all');
    server.addGetAuthAdmin('GET Insurer Activity Report', `${basePath}/insurer/:id/activityreport`, activityReport, 'administration', 'all');

    // server.addGet('Get Insurer list', `${basePath}/insurer`, findAll, 'administration', 'all');
    // server.addGet('Get Insurer Object', `${basePath}/insurer/:id`, findOne, 'administration', 'all');
    // server.addPost('Post Insurer Object', `${basePath}/insurer`, add, 'administration', 'all');
    // server.addPut('Put Insurer Object', `${basePath}/insurer/:id`, update, 'administration', 'all');
    // server.addGet('GET Insurer List for Selection', `${basePath}/insurer/selectionlist`, getSelectionList);

};