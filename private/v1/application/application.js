/**
 * Sends an email
 */

'use strict';

const status = global.requireShared('./helpers/status.js');
const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const ApplicationModel = global.requireShared('models/Application-BO.js');
const BusinessModel = global.requireShared('models/Business-model.js');
const BusinessContactModel = global.requireShared('models/BusinessContact-model.js');
const jsonFunctions = global.requireShared('./helpers/jsonFunctions.js');

/**
 * Updates an application status
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function updateApplicationStatus(req, res, next) {
	// Update the application status
	status.updateApplicationStatus(req.params.id);

	// Return success
	res.send(200);
	return next();
}

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
    // Turn Request into JSON Application-BO expects.

    // eslint-disable-next-line prefer-const
    let applicationRequestJson = req.body;
    await parseApplicationRequest(applicationRequestJson).catch(function(err){
        log.error("failed to parse request application " + err + __location)
    });

    //const applicationModel = new ApplicationModel();
    // await applicationModel.saveApplicationFullObject(applicationRequestJson).then(function(modelResponse){
    //     if(modelResponse === true){
    //         responseObj.demo = applicationRequestJson.demo;
    //         responseObj.id = applicationModel.id;
    //         responseObj.message = "saved";
    //         res.send(200, responseObj);
    //     }
    //     else {
    //         //modelReponse is list of validation errors.
    //         //validationErrors
    //         res.send(400, modelResponse);
    //     }
    //     return next();
    // }).catch(function(err){
    //     //serverError
    //     res.send(500, err.message);
    //     return next(serverHelper.requestError('Unable to save. ' + err.message));
    // });


    // const responseObj = {};
    // responseObj.id = "123";
    // responseObj.message = "saved";
    res.send(200, applicationRequestJson);
    return next();
}

/**
 * Transform request ApplicationJSON into applicatoinJSON expect by Application-BO
 *
 * @param {object} applicationRequestJson -  request ApplicationJSON object
 *
 * @returns {boolean}  - true if processed correctly;
 */
async function parseApplicationRequest(applicationRequestJson){
    const noNulls = true;
    //mimic PHP logic...
    // Map to Business load ORM and get clean model back.
    const businessModel = new BusinessModel();
    
    await businessModel.loadORM(applicationRequestJson)

    await businessModel.updateProperty(noNulls)
    businessModel.id = applicationRequestJson.business;
    applicationRequestJson.businessInfo = jsonFunctions.jsonCopy(businessModel);
   // Map contacts
    const businessContactModel = new BusinessContactModel();
    await businessContactModel.loadORM(applicationRequestJson)
    await businessContactModel.updateProperty(noNulls)
    businessContactModel.id = applicationRequestJson.contact;
    applicationRequestJson.businessInfo.contacts = []
    applicationRequestJson.businessInfo.contacts.push(jsonFunctions.jsonCopy(businessContactModel));
    // flip to array - PHP data not an array.
    applicationRequestJson.businessInfo.locations = []
    for (var prop in applicationRequestJson.locations) {
        if (Object.prototype.hasOwnProperty.call(applicationRequestJson.locations, prop)) {
            // add location to businessInfo.locations array
            const requestLocation = applicationRequestJson.locations[prop];
            applicationRequestJson.businessInfo.locations.push(requestLocation);
        }
    }
    // eslint-disable-next-line no-unused-vars
    jsonFunctions.deleteProp(applicationRequestJson, "owners");
    jsonFunctions.deleteProp(applicationRequestJson, "locations");

    log.debug("mapped applicationRequestJson\n " + JSON.stringify(applicationRequestJson));
    return true;
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addPut('Update an application status', `${basePath}/:id/status`, updateApplicationStatus);
    server.addPost('Post Application ', `${basePath}/application`, Save);
	server.addPost('Post Application (depr)', `${basePath}`, Save);
};