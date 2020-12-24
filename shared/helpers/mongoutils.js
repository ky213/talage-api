'use strict';
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

exports.objCleanup = function(dbObj) {
    var dbJsonClean = internalObjCleanup(dbObj);

    return dbJsonClean;
};

exports.objListCleanup = function(mongoObjList, extraFields) {
    //var objListJson = JSON.parse(JSON.stringify(mongoObjList.toJSON()));
    var newList = [];
    mongoObjList.forEach(function(item) {
        newList.push(internalObjCleanup(item, extraFields));
    });
    return newList;
};


var internalObjCleanup = function(dbJson, extraFields) {
    if(!dbJson){
        return null;
    }
    var dbJsonClean = JSON.parse(JSON.stringify(dbJson));
    var propertiesToBeCleanedOut = ['_id',
        '__v',
        '_v',
        'timestamp'];

    if (extraFields) {
        propertiesToBeCleanedOut.push.apply(propertiesToBeCleanedOut, extraFields);
    }

    if (dbJson) {
        for (var i = 0, len = propertiesToBeCleanedOut.length; i < len; i++) {
            if (dbJson[propertiesToBeCleanedOut[i]] || dbJson.hasOwnProperty(propertiesToBeCleanedOut[i])) {
                delete dbJsonClean[propertiesToBeCleanedOut[i]];
            }
        }

    }
    else {
        log.error("Unable clean up response line: " + __location);
    }
    return dbJsonClean;


};