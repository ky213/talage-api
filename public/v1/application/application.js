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
const contactStepParser = require('./parsers/contact-step-parse.js')


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
	//Validation passed, give requst application to model to process and save.


	// TODO Prep request data for passing to App Model
	const applicationRequestJson = req.body;
	applicationRequestJson.referrer = req.headers;
	switch (applicationRequestJson.step) {
		case "contact":
			const resp = contactStepParser.process(applicationRequestJson);
			log.debug(resp);
			log.debug(JSON.stringify(applicationRequestJson))
			break;
		case 'locations':
			// Get parser for locations page
			// require_once JPATH_COMPONENT_ADMINISTRATOR . '/lib/QuoteEngine/parsers/LocationsParser.php';
			// $parser = new LocationsParser();
			break;
		case 'coverage':
			// Get parser for coverage page
			// require_once JPATH_COMPONENT_ADMINISTRATOR . '/lib/QuoteEngine/parsers/CoverageParser.php';
			// $parser = new CoverageParser();
			break;
		case 'owners':
			// Get parser for owners page
			// require_once JPATH_COMPONENT_ADMINISTRATOR . '/lib/QuoteEngine/parsers/OwnersParser.php';
			// $parser = new OwnersParser();
			break;
		case 'details':
			// Get parser for details page
			// require_once JPATH_COMPONENT_ADMINISTRATOR . '/lib/QuoteEngine/parsers/DetailsParser.php';
			// $parser = new DetailsParser();
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
			break;
	}
	const applicationModel = new ApplicationModel();


    applicationModel.newApplication(applicationRequestJson, true).then(function(modelResponse){
		if(modelResponse === true){
			res.send(200, applicationModel);
		}
		else {
			res.send(400, modelResponse);
		}
		return next();
    }).catch(function(err){
        res.send(500, err.message);
		next(serverHelper.requestError('Unable to save. ' + err.message));

    });
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Post Application Workflow', `${basePath}/applicationwf`, Save);
	server.addPost('Post Application Workflow(depr)', `${basePath}wf`, Save);
};