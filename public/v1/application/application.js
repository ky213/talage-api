/* eslint-disable no-case-declarations */
/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
//Models
const ApplicationModel = global.requireShared('models/Application-model.js');
const contactStepParser = require('./parsers/contact-step-parser.js')
const coverageStepParser = require('./parsers/coverage-step-parser.js');
const locationStepParser = require('./parsers/location-step_parser.js')
const ownerStepParser = require('./parsers/owner-step-parser.js')
const detailStepParser = require('./parsers/detail-step-parser.js')

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

	//Validation passed, give requst application to model to process and save.
    if(!applicationRequestJson.id && applicationRequestJson.step !== "contact"){
        res.send(400, "missing application id");
        return next(serverHelper.requestError("missing application id"));
    }
    if(applicationRequestJson.id){
        //convert to int
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
			contactStepParser.process(applicationRequestJson);
			break;
		case 'locations':
            if(!applicationRequestJson.locations || !applicationRequestJson.mailing){
                res.send(400, "missing location information");
                return next(serverHelper.requestError("missing location information"));
            }
            // Get parser for locations page
            locationStepParser.process(applicationRequestJson);
			break;
		case 'coverage':
            //validate
            if(!applicationRequestJson.policy_types || !applicationRequestJson.questions){
                res.send(400, "missing coverage information");
                return next(serverHelper.requestError("missing coverage information"));
            }
			// Get parser for coverage
			coverageStepParser.process(applicationRequestJson);
			break;
		case 'owners':
            if(!applicationRequestJson.owners && !applicationRequestJson.owners_covered){
                res.send(400, "missing owners information");
                return next(serverHelper.requestError("missing owners information"));
            }
            ownerStepParser.process(applicationRequestJson);
			break;
		case 'details':
			detailStepParser.process(applicationRequestJson);
			break;
		case 'claims':
			// Get parser for claims page
			// require_once JPATH_COMPONENT_ADMINISTRATOR . '/lib/QuoteEngine/parsers/ClaimsParser.php';
			// $parser = new ClaimsParser();
			break;
		case 'questions':
			// Get parser for questions page
			// require_once JPATH_COMPONENT_ADMINISTRATOR . '/lib/QuoteEngine/parsers/QuestionsParser.php';
			// $parser = new QuestionsParser();
			break;
		case 'quotes':
			// Do nothing - we only save here to update the last step
			break;
		default:
            // not from old Web application application flow.
            knownWorkflowStep = false;
			break;
    }
    // eslint-disable-next-line prefer-const
    let responseObj = {};
    if(applicationRequestJson.demo === true){
        responseObj.demo = applicationRequestJson.demo;
        responseObj.id = -999;
        res.send(200, responseObj);
        return next();
    }

    if(knownWorkflowStep === true){
        const applicationModel = new ApplicationModel();
        await applicationModel.saveApplicationStep(applicationRequestJson, worflowStep).then(function(modelResponse){
            if(modelResponse === true){

                responseObj.demo = applicationRequestJson.demo;
                responseObj.id = applicationModel.id;
                responseObj.message = "saved";
                //TODO add business_id and contact_id
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
            res.send(500, err.message);
            return next(serverHelper.requestError('Unable to save. ' + err.message));
        });
    }
    else {
        res.send(400, "Unknown workflow step");
        return next(serverHelper.requestError("Unknown workflow step"));

    }
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Post Application Workflow', `${basePath}/applicationwf`, Save);
	server.addPost('Post Application Workflow(depr)', `${basePath}wf`, Save);
};