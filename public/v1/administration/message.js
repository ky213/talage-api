/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
const moment = require("moment");
const rowLimit = 100;
if(global.settings.USE_MONGO === "YES"){
    var Message = require('mongoose').model('Message');
}


async function findAll(req, res, next) {
    const options = {sort: {}};
    const query = {};

    if (req.query) {
        if (req.query.sort) {
            var asc = 1;
            if (req.query.desc) {
                asc = -1;
                delete req.query.desc;
            }
            options.sort[req.query.sort] = asc;
            delete req.query.sort;
        }
        else {
            // default to DESC on sent
            options.sort.sent = -1;
            options.sort.mysqlId = -1;
        }

        let fromDate = null;
        let toDate = null;
        if (req.query.searchbegindate) {
            fromDate = moment(req.query.searchbegindate);
            if (fromDate.isValid()) {
                query.sent = {};
                delete req.query.searchbegindate;
            }
            else {
                res.status(400).send({"error": "Date format"});
                return serverHelper.requestError('invalid Date format');
            }
        }
        if (req.query.searchenddate) {
            toDate = moment(req.query.searchenddate);
            if (toDate.isValid()) {
                query.sent = {};
                delete req.query.searchenddate;
            }
            else {
                res.status(400).send({"error": "Date format"});
                return serverHelper.requestError('invalid Date format');
            }
        }

        if(fromDate){
            query.sent.$gte = fromDate;
        }
        if(toDate){
            query.sent.$lte = toDate;
        }

        let limit = req.query.limit ? stringFunctions.santizeNumber(req.query.limit, true) : 20;
        // set a hard limit for the max number of rows
        limit = limit <= rowLimit ? limit : rowLimit;
        delete req.query.limit;

        const page = req.query.page ? stringFunctions.santizeNumber(req.query.page, true) : 1;
        delete req.query.page;
        if(limit && page) {
            options.limit = limit;
            options.skip = (page - 1) * limit;
        }

        for (var key in req.query) {
            if (req.query[key].includes('%')) {
                let clearString = req.query[key].replace("%", "");
                clearString = clearString.replace("%", "");
                query[key] = {
                    "$regex": clearString,
                    "$options": "i"
                };
            }
            else if(req.query[key]){
                query[key] = req.query[key];
            }
        }
    }

    let docList = null;
    let count = 0;
    try {
        log.debug("MessageList query " + JSON.stringify(query))
        log.debug("MessageList options " + JSON.stringify(options))
        docList = await Message.find(query, '-__v', options);
        log.debug("docList.length: " + docList.length);
        count = await Message.countDocuments(query);
    }
    catch (err) {
        log.error(err + __location);
        return serverHelper.sendError(res, next, 'Internal Error');
    }

    res.send(200, {data: {data: mongoUtils.objListCleanup(docList), count: count}});
    return next();
}

async function findOne(req, res, next) {
    let query = {};
    if (isNaN(req.params.id)) {
        query.messageId = req.params.id;
    }
    else {
        //mysqlID
        const id = stringFunctions.santizeNumber(req.params.id, true);
        query.mysqlId = id;
    }
    log.debug("query " + JSON.stringify(query));
    let doc = null;
    try {
        doc = await Message.findOne(query, '-__v');
    }
    catch (err) {
        log.error(err + __location);
        return serverHelper.sendError(res, next, 'Internal Error');
    }
    res.send(200, mongoUtils.objCleanup(doc));
    return next();

}

// async function add(req, res, next) {

// }

// async function update(req, res, next) {

// }


exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('Get Message list', `${basePath}/message`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Message Object', `${basePath}/message/:id`, findOne, 'administration', 'all');

    // server.addGet('Get Message list', `${basePath}/message`, findAll, 'administration', 'all');
    // server.addGet('GET Message Object', `${basePath}/message/:id`, findOne, 'administration', 'all');

};