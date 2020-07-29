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


var Message = require('mongoose').model('Message');


async function findAll(req, res, next) {
    let findCount = false;
    let options = {};
    let query = {};
    options.sort = {};
    if (req.query.sort) {
        var acs = 1;
        if (req.query.desc) {
            acs = -1;
            delete req.query.desc
        }
        options.sort[req.query.sort] = acs;
        delete req.query.sort
    }
    else {
        // default to DESC on sent
        options.sort.sent = -1;

    }
    if (req.query.limit) {
        var limitNum = parseInt(req.query.limit, 10);
        delete req.query.limit
        if (limitNum < 1000) {
            options.limit = limitNum;
        }
        else {
            options.limit = 1000;
        }
    }

    if (req.query.count) {
        if (req.query.count === "1") {
            findCount = true;
        }
        delete req.query.count;
    }
    if (req.query) {
        for (var key in req.query) {
            query[key] = req.query[key];
        }
    }
    if (findCount === false) {
        let docList = null;
        try {
            docList = await Message.find(query, '-__v', options);
        }
        catch (err) {
            log.error(err + __location);
            return serverHelper.sendError(res, next, 'Internal Error');
        }
        res.send(200, mongoUtils.objListCleanup(docList));
        return next();
    }
    else {
        Message.countDocuments(query).then(count => {
            res.send(200, {count: count});
            return next();
        })
            .catch(err => {
                log.error("Message.countDocuments error " + err + __location);
                return serverHelper.sendError(res, next, 'Internal Error');
            })
    }

}

async function findOne(req, res, next) {
    let query = {};
    if(isNaN(req.params.id)){
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
    //server.addGetAuth('Get Message list', `${basePath}/message`, findAll, 'administration', 'all');
    //server.addGetAuth('GET Message Object', `${basePath}/message/:id`, findOne, 'administration', 'all');

    server.addGet('Get Message list', `${basePath}/message`, findAll, 'administration', 'all');
    server.addGet('GET Message Object', `${basePath}/message/:id`, findOne, 'administration', 'all');

};