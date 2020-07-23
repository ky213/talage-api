/* eslint-disable dot-notation */
/* eslint-disable no-case-declarations */
/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
//Models
const ApplicationModel = global.requireShared('models/Application-BO.js');
const contactStepParser = require('./parsers/contact-step-parser.js')
const coverageStepParser = require('./parsers/coverage-step-parser.js');
const locationStepParser = require('./parsers/location-step_parser.js')
const ownerStepParser = require('./parsers/owner-step-parser.js')
const detailStepParser = require('./parsers/detail-step-parser.js')
const claimStepParser = require('./parsers/claim-step-parser.js')
const questionStepParser = require('./parsers/question-step-parser.js')
const bindStepParser = require('./parsers/bindrequest-step-parse.js')

const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');

const slackSvc = global.requireShared('./services/slacksvc.js');
const emailSvc = global.requireShared('./services/emailsvc.js');
//const crypt = global.requireShared('./services/crypt.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

/**
 * Responds to POST related ot new applications
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function Save(req, res, next){
	log.debug("Application Post: " + JSON.stringify(req.body));
	// Check for data
	if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
		log.warn('No data was received' + __location);
		return next(serverHelper.requestError('No data was received'));
	}

	// // Make sure basic elements are present
	// if(!req.body.business || !Object.prototype.hasOwnProperty.call(req.body, 'id') || !req.body.policies){
	// 	log.warn('Some required data is missing' + __location);
	// 	return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    // }
    const applicationRequestJson = req.body;

    if(applicationRequestJson.demo === "true" || applicationRequestJson.id === "-999"){
        const responseDemo = {};
        responseDemo.demo = applicationRequestJson.demo;
        responseDemo.id = -999;
        responseDemo.message = "saved";
        res.send(200, responseDemo);
        return next();
    }

	//Validation passed, give requst application to model to process and save.
    if(!applicationRequestJson.id && applicationRequestJson.step !== "contact" && applicationRequestJson.step !== "bindRequest"){
        res.send(400, "missing application id");
        return next(serverHelper.requestError("missing application id"));
    }
    if(applicationRequestJson.id){
        //convert to int and therefore santize
        try{
            applicationRequestJson.id = parseInt(applicationRequestJson.id,10)
        }
        catch(e){
            res.send(400, "bad application id");
            return next(serverHelper.requestError("missing application id"));
        }
    }
    // Prep request data for passing to App Model
    let knownWorkflowStep = true;
    const worflowStep = applicationRequestJson.step
	switch (applicationRequestJson.step) {
		case "contact":
            await contactStepParser.process(applicationRequestJson);
			break;
		case 'locations':
            if(!applicationRequestJson.locations || !applicationRequestJson.mailing){
                res.send(400, "missing location information");
                return next(serverHelper.requestError("missing location information"));
            }
            // Get parser for locations page
            await locationStepParser.process(applicationRequestJson);
			break;
		case 'coverage':
            //validate
            if(!applicationRequestJson.policy_types || !applicationRequestJson.questions){
                res.send(400, "missing coverage information");
                return next(serverHelper.requestError("missing coverage information"));
            }
			// Get parser for coverage
            await coverageStepParser.process(applicationRequestJson);
			break;
		case 'owners':
            if(!applicationRequestJson.owners && !applicationRequestJson.owners_covered){
                res.send(400, "missing owners information");
                return next(serverHelper.requestError("missing owners information"));
            }
            await ownerStepParser.process(applicationRequestJson);
			break;
		case 'details':
            await detailStepParser.process(applicationRequestJson);
			break;
		case 'claims':
			if(!applicationRequestJson.claims){
                res.send(400, "missing claim information");
                return next(serverHelper.requestError("missing claim information"));
            }
            await claimStepParser.process(applicationRequestJson);
			break;
		case 'questions':
            if(!applicationRequestJson.question_answers && !applicationRequestJson.question_defaults){
                res.send(400, "missing question information");
                return next(serverHelper.requestError("missing question information"));
            }
            applicationRequestJson.remoteAddress = req.connection.remoteAddress;
            await questionStepParser.process(applicationRequestJson);
			break;
		case 'quotes':
            // Do nothing - we only save here to update the last step
            break;
        case 'bindRequest':
            if(!applicationRequestJson.quotes){
                res.send(400, "missing bindRequest information");
                return next(serverHelper.requestError("missing bindRequest information"));
            }
            const resp = await bindStepParser.process(applicationRequestJson);
            if(resp === false){
                log.error("problems in bindStepParser " + __location)
            }
			break;
		default:
            // not from old Web application application flow.
            knownWorkflowStep = false;
			break;
    }
    // eslint-disable-next-line prefer-const
    let responseObj = {};

    if(knownWorkflowStep === true){
        const applicationModel = new ApplicationModel();
        await applicationModel.saveApplicationStep(applicationRequestJson, worflowStep).then(function(modelResponse){
            if(modelResponse === true){
                // const tokenPayload = {applicationID: applicationModel.id};
                // const token = jwt.sign(tokenPayload, global.settings.AUTH_SECRET_KEY, {expiresIn: '5m'});
               // responseObj.demo = applicationRequestJson.demo;
                responseObj.id = applicationModel.id;
                responseObj.message = "saved";
                //associations
                res.send(200, responseObj);
            }
            else {
                //modelReponse is list of validation errors.
                //validationErrors
                res.send(400, modelResponse);
            }
            return next();
        }).catch(function(err){
            //serverError
            if(err.message.startsWith('Data Error:')){
                const message = err.message.replace('Data Error:', '');
                res.send(400, message);
            }
            else {
                res.send(500, err.message);
            }
            return next(serverHelper.requestError('Unable to save. ' + err.message));
        });
    }
    else {
        res.send(400, "Unknown workflow step");
        return next(serverHelper.requestError("Unknown workflow step"));

    }
}

/**
 * GET returns resources Quote Engine needs
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetResources(req, res, next){
    const responseObj = {};
    let rejected = false;
    const sql = `select id, introtext from clw_content where id in (10,11)`
    const result = await db.query(sql).catch(function(error) {
        // Check if this was
        rejected = true;
        log.error(`clw_content error on select ` + error + __location);
    });
    if (!rejected) {
        const legalArticles = {};
        for(let i = 0; i < result.length; i++){
            const dbRec = result[0];
            legalArticles[dbRec.id] = dbRec
        }
        responseObj.legalArticles = legalArticles;
    }
    rejected = false;
    const sql2 = `select abbr as type,description,heading, name from clw_talage_policy_types where abbr in ('BOP', 'GL', 'WC')`
    const result2 = await db.query(sql2).catch(function(error) {
        // Check if this was
        rejected = true;
        log.error(`clw_talage_policy_types error on select ` + error + __location);
    });
    if (!rejected) {
        responseObj.policyTypes = result2;
    }

    rejected = false;
    const sql3 = `select abbr, name from clw_talage_territories`
    const result3 = await db.query(sql3).catch(function(error) {
        // Check if this was
        rejected = true;
        log.error(`clw_talage_territories error on select ` + error + __location);
    });
    if (!rejected) {
        responseObj.territories = result3;
    }

    res.send(200, responseObj);
    return next();


}


/**
 * GET returns resources Quote Engine needs
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function CheckZip(req, res, next){
    const responseObj = {};
    if(req.body && req.body.zip){
        let rejected = false;
        const sql = `select  z.territory, t.name, t.licensed 
            from clw_talage_zip_codes z
            inner join clw_talage_territories t  on z.territory = t.abbr
            where z.zip  = ${db.escape(req.body.zip)}`;
        const result = await db.query(sql).catch(function(error) {
            // Check if this was
            rejected = true;
            log.error(`clw_content error on select ` + error + __location);
        });
        if (!rejected) {
            if(result && result.length > 0){
                responseObj.territory = result[0].territory
                if(result[0].licensed === 1){
                    responseObj['error'] = false;
                    responseObj['message'] = '';
                }
                else {
                    responseObj['error'] = true;
                    responseObj['message'] = 'We do not currently provide coverage in ' + responseObj.territory;
                }
                res.send(200, responseObj);
                return next();

            }
            else {
                responseObj['error'] = true;
                responseObj['message'] = 'The zip code you entered is invalid.';
                res.send(404, responseObj);
            }
        }
        else {
            responseObj['error'] = true;
            responseObj['message'] = 'internal error.';
            res.send(500, responseObj);
            return next(serverHelper.requestError('internal error'));
        }
    }
    else {
        responseObj['error'] = true;
        responseObj['message'] = 'Invalid input received.';
        res.send(400, responseObj);
        return next(serverHelper.requestError('Bad request'));
    }

}

/**
 * GET returns associations Quote Engine needs
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetAssociations(req, res, next){
    const responseObj = {};
    if(req.query && req.query.territories){

        const territoryList = req.query.territories.split(',')
        var inList = new Array(territoryList.length).fill('?').join(',');
        let rejected = false;
        const sql = `select  a.id, a.name
            from clw_talage_associations a
            inner join clw_talage_association_territories at on at.association = a.id
            where a.state  = 1
            AND at.territory in (${inList})
            order by a.name ASC`;

        const result = await db.queryParam(sql,territoryList).catch(function(error) {
            // Check if this was
            rejected = true;
            log.error(`clw_content error on select ` + error + __location);
        });
        if (!rejected) {
            if(result && result.length > 0){
                responseObj['error'] = false;
                responseObj['message'] = '';
                responseObj['associations'] = result;
                res.send(200, responseObj);
                return next();

            }
            else {
                responseObj['error'] = true;
                responseObj['message'] = 'No associations returned.';
                res.send(404, responseObj);
            }
        }
        else {
            responseObj['error'] = true;
            responseObj['message'] = 'internal error.';
            res.send(500, responseObj);
            return next(serverHelper.requestError('internal error'));
        }
    }
    else {
        responseObj['error'] = true;
        responseObj['message'] = 'Invalid input received.';
        res.send(400, responseObj);
        return next(serverHelper.requestError('Bad request'));
    }

}

/**
 * POST  send slack error message
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function ReportError(req, res, next){
    //body examlple
    // attachment: {
    //     applicationID
    // },
    // channel: '#alerts',
    // message: `${businessName} from ${territory} completed an application for ${coverageList} but encountered the following errors: ${message}`,
    // messageType: 'error'

    const responseObj = {};
    if(req.body && req.body.message && req.body.message.length > 0){
        log.error("From client: " + req.body.message);
        await slackSvc.send2SlackJSON(req.body).catch(function(err){
            log.error(err + __location);
        });
       res.send(200, responseObj);
       return next();
    }
    else {
        res.send(200, responseObj);
        return next();
    }

}

/**
 * POST Send AgencyEmail base on options supplied
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function AgencyEmail(req, res, next){
    //body example
    // attachment: {
    //     applicationID
    // },
    // channel: '#alerts',
    // message: `${businessName} from ${territory} completed an application for ${coverageList} but encountered the following errors: ${message}`,
    // messageType: 'error'

    const responseObj = {};
    //only type =3 will be processed. - Contact us
    if(req.body
        && req.body.email && req.body.email
        && req.body.type && req.body.type === "3"
        && req.body.agency){

        const email = req.body.email;
        const messageText = req.body.message;
        const name = req.body.name;
        //DB for Agency
        const agencyLocationId = stringFunctions.santizeNumber(req.body.agency,true);
        const messageKeys = {agency_location: agencyLocationId};
        let error = null;
        const agencyLocationBO = new AgencyLocationBO();
        await agencyLocationBO.loadFromId(agencyLocationId).catch(function(err) {
            log.error(`Loading agency in AgencyEmail error:` + err + __location);
            error = err;
        });
        if(!error){
            if(agencyLocationBO.email){
                const agencyEmail = agencyLocationBO.email;
                // Build the email
                let message = '<p style="text-align:left;">You received the following message from ' + name + ' (' + email + '):</p>';
                message = message + '<p style="text-align:left;margin-top:10px;">"' + messageText + '"</p>';
                message += `<p style="text-align:right;">-Your Wheelhouse Team</p>`;
                //call email service
                const respSendEmail = await emailSvc.send(agencyEmail, 'A Wheelhouse user wants to get in touch with you', message, messageKeys, 'wheelhouse').catch(function(err){
                    log.error("Send email error: " + err + __location);
                    return res.send(serverHelper.internalError("SendEmail Error"));
                });
                if(respSendEmail === false){
                    log.error("Send email error response was false: " + __location);
                    return res.send(serverHelper.internalError("SendEmail Error"));
                }
                else {
                    res.send(200, responseObj);
                    return next();
                }
            }
            else{
                log.error(`No Agencylocation email ${agencyLocationId} ` + __location)
                res.send(200, responseObj);
                return next();
            }
        }
        else {
            res.send(200, responseObj);
            return next();
        }
    }
    else {
        log.error("AgencyEmail missing parameters " + __location)
        res.send(200, responseObj);
        return next();
    }

}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPostAuthAppWF('Post Application Workflow', `${basePath}/applicationwf`, Save);
    server.addPostAuthAppWF('Post Application Workflow(depr)', `${basePath}wf`, Save);
    server.addGet('Get Quote Engine Resources', `${basePath}/applicationwf/getresources`, GetResources)
    server.addGet('Get Quote Engine Resources', `${basePath}wf/getresources`, GetResources)
    server.addPost('Checkzip for Quote Engine', `${basePath}/applicationwf/checkzip`, CheckZip)
    server.addPost('Checkzip for Quote Engine', `${basePath}wf/checkzip`, CheckZip)
    server.addGet('GetAssociations for Quote Engine', `${basePath}/applicationwf/getassociations`, GetAssociations)
    server.addGet('GetAssociations for Quote Engine', `${basePath}wf/getassociations`, GetAssociations)
    server.addPostAuthAppWF('Post Application Error', `${basePath}/applicationwf/reporterror`, ReportError);
    server.addPostAuthAppWF('Post Application Error(depr)', `${basePath}wf/reporterror`, ReportError);
    server.addPostAuthAppWF('Post Application agencyemail', `${basePath}/applicationwf/agencyemail`, AgencyEmail);
    server.addPostAuthAppWF('Post Application agencyemail(depr)', `${basePath}wf/agencyemail`, AgencyEmail);
    // server.addPost('Post Application agencyemail', `${basePath}/applicationwf/agencyemail`, AgencyEmail);
    // server.addPost('Post Application agencyemail(depr)', `${basePath}wf/agencyemail`, AgencyEmail);
};


//agencyemail