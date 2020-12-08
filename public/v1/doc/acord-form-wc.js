'use strict';

const acord = global.requireShared('./services/acordsvc.js');
const serverHelper = global.requireRootPath('server.js');


/**
 * Responds to get requests for the accord endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetACORDFormWC(req, res, next){
    // Check data was received
    if(!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0){
        log.info('ACORD form generation failed. Bad Request: No data received' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    // Make sure basic elements are present
    if(!req.query.application_id){
        log.info('ACORD form generation failed. Bad Request: Missing Application ID' + __location);
        return next(serverHelper.requestError('Bad Request: You must supply an application ID'));
    }

    if(!req.query.insurer_id){
        log.info('ACORD form generation failed. Bad Request: Invalid insurer id' + __location);
        return next(serverHelper.requestError('Bad Request: You must supply an insurer ID'));
    }
    let policy_type = 'GL';
    if(req.query.policy_type){
        if(req.query.policy_type === "GL" || req.query.policy_type === "WC" || req.query.policy_type === "BOP"){
            policy_type = req.query.policy_type
        }
        else {
            log.info('ACORD form generation failed. Bad Request: policy type' + __location);
            return next(serverHelper.requestError('Bad Request: Bad policy type'));
        }
    }

    //Generic for policy_type regardless of old endpoint name.
    let form = null;
    let error = null;

    form = await acord.create(req.query.application_id, req.query.insurer_id, policy_type).catch(function(err){
        log.error(`ACORD form generation failed. appid ${req.query.application_id} insurerId ${req.query.insurer_id}  polcy type: ${policy_type} ` + err + __location);
        error = err;
    });
    if(error){
        return next(serverHelper.requestError('ACORD form generation failed.'));
    }
    // If there was an error while generating the form return it to the front end
    if(form && form.error){
        return next(serverHelper.requestError(form.error));
    }

    // Pull out the document and array containing details of missing data
    if(form && form.doc){
        if(Object.hasOwnProperty.call(req.query, 'response') && req.query.response === 'json'){
            const response = {'pdf': form.doc.toString('base64')};
            response.status = 'ok';
            res.send(200, response);

        }
        else{
            const doc = Buffer.from(await form.doc.save());
            res.writeHead(200, {
                'Content-Disposition': 'attachment; filename=acord-form.pdf',
                'Content-Length': doc.length,
                'Content-Type': 'application/pdf'
            });
            res.end(doc);
            log.info('Acord Sent in Response');
        }

        log.info('Acord Generated!');

        return next();
    }
    else {
        return next(serverHelper.requestError('ACORD form generation failed.'));
    }
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    // TODO JWT checking
    server.addGet('Get Acord', `${basePath}/acord-form-wc`, GetACORDFormWC);
};

