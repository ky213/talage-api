
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

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const moment = require("moment")

async function findAll(req, res, next) {
    let error = null;
    const insurerOutageBO = new InsurerOutageBO();
    const rows = await insurerOutageBO.getListForAdmin(req.query).catch(function(err){
        error = err;
    })
    if(error){
        return next(error);
    }
    if (rows) {

        res.send(200, rows);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Agency Location not found'));
    }
}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerOutageBO = new InsurerOutageBO();
     // Load the request data into it
     const outageJSON = await insurerOutageBO.getById(id).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    if (outageJSON) {
        res.send(200, outageJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Agency Location not found'));
    }

}

/**
* Return Insurer List used for selecting a Insurer
*
* @param {object} req - HTTP request object
* @param {object} res - HTTP response object
* @param {function} next - The next function to execute
*
* @returns {void}
*/
async function getSelectionList(req, res, next) {
   //log.debug('getSelectionList: ' + JSON.stringify(req.body))
   let error = false;

   // Initialize an agency object
   const insurerBO = new InsurerBO();

   // Load the request data into it
   const insurerList = await insurerBO.getSelectionList().catch(function(err) {
       log.error("Location load error " + err + __location);
       error = err;
   });
   if (error) {
       return next(error);
   }
   // Send back a success response
   res.send(200, insurerList);
   return next();
}

exports.registerEndpoint = (server, basePath) => {

    //server.addGetAuth('GET Insurer List for Selection', `${basePath}/insurer/selectionlist`, getSelectionList);

    server.addGet('GET Insurer List for Selection', `${basePath}/insurer/selectionlist`, getSelectionList);
 
};