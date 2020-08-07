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
    log.debug("Message List req.query: " + JSON.stringify(req.query))
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
        options.sort.mysqlId = -1;

    }
    const queryLimit = 500;
    if (req.query.limit) {
        var limitNum = parseInt(req.query.limit, 10);
        delete req.query.limit
        if (limitNum < queryLimit) {
            options.limit = limitNum;
        }
        else {
            options.limit = queryLimit;
        }
    }
    else{
        options.limit = queryLimit;
    }
    if (req.query.count) {
        if (req.query.count === "1") {
            findCount = true;
        }
        delete req.query.count;
    }
    let flippedSort = false;
    if(req.query.maxid){
        query.mysqlId = {$lte: parseInt(req.query.maxid,10)};
        delete req.query.maxid;
    }
    if(req.query.minid){
        query.mysqlId = {$gte: parseInt(req.query.minid,10)};
        delete req.query.minid;
        //change sort
        options.sort.sent = 1;
        options.sort.mysqlId = 1;
        flippedSort = true;
    }


    if (req.query) {
        for (var key in req.query) {
            query[key] = req.query[key];
        }
    }
    if (findCount === false) {
        // Message.find(query, '-__v', options, function(err, docList){
        //     if(err){
        //         log.error(err + __location);
        //         return serverHelper.sendError(res, next, 'Internal Error');
        //     }
        //     else {
        //         res.send(200, mongoUtils.objListCleanup(docList));
        //         return next();
        //     }

        // });
        let docList = null;
        try {
            log.debug("MessageList query " + JSON.stringify(query))
            log.debug("MessageList options " + JSON.stringify(options))
            docList = await Message.find(query, '-__v', options);
        }
        catch (err) {
            log.error(err + __location);
            return serverHelper.sendError(res, next, 'Internal Error');
        }
        log.debug("docList.length: " + docList.length);
        if(flippedSort === true){
            docList.sort((a, b) => parseInt(b.mysqlId, 10) - parseInt(a.mysqlId, 10));
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
    // server.addGetAuthAdmin('Get Message list', `${basePath}/message`, findAll, 'administration', 'all');
    // server.addGetAuthAdmin('GET Message Object', `${basePath}/message/:id`, findOne, 'administration', 'all');

    server.addGet('Get Message list', `${basePath}/message`, findAll, 'administration', 'all');
    server.addGet('GET Message Object', `${basePath}/message/:id`, findOne, 'administration', 'all');

};