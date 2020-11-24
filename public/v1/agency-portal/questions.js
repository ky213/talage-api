'use strict';

const auth = require('./helpers/auth.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const QuestionBO = global.requireShared('models/Question-BO.js');

/**
 * A function to get the answer from a question
 * @param {object} appQuestion - The answer from a question in the form of a string
 * @return {string} - The answer
 */
function getAnswer(appQuestion) {
    //TODO check for answer list and get descriptions
    if(appQuestion){
        let answerValue = appQuestion.answerValue;
        if(appQuestion.answerList && appQuestion.answerList.length > 0){
            answerValue = "";
            for(let i = 0; i < appQuestion.answerList.length; i++){
                if(i > 0){
                    answerValue += ", ";
                }
                answerValue += appQuestion.answerList[i];
            }
        }
        return answerValue;
    }
    else {
        return "";
    }
}

/**
 * Responds to get requests for the Questions endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getQuestions(req, res, next) {
    let error = false;
    // Check for data
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: No data received');
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    // Make sure basic elements are present
    if (!req.query.application_id) {
        log.info('Bad Request: Missing Application ID');
        return next(serverHelper.requestError('Bad Request: You must supply an application ID'));
    }

    // // Validate the application ID
    // if (!await validator.is_valid_id(req.query.application_id)) {
    //     log.info('Bad Request: Invalid application id');
    //     return next(serverHelper.requestError('Invalid application id'));
    // }
    const id = req.query.application_id;

    // Get the agents that we are permitted to view
    const agents = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        log.error('Error get application getAgents ' + error + __location);
        return next(error);
    }


    let passedAgencyCheck = false;
    let applicationJSON = null;
    try{
        const applicationBO = new ApplicationBO();
        let applicationDBDoc = null;
        if(id > 0){
            applicationDBDoc = await applicationBO.loadfromMongoBymysqlId(id);
        }
        else {
            log.debug("Getting id from mongo")
            applicationDBDoc = await applicationBO.getfromMongoByAppId(id);
        }


        if(applicationDBDoc && agents.includes(applicationDBDoc.agencyId)){
            passedAgencyCheck = true;
        }

        if(applicationDBDoc){
            applicationJSON = JSON.parse(JSON.stringify(applicationDBDoc))
        }
    }
    catch(err){
        log.error("Error Getting application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(applicationJSON && applicationJSON.applicationId && passedAgencyCheck === false){
        log.info('Forbidden: User is not authorized for this application' + __location);
        //Return not found so do not expose that the application exists
        return next(serverHelper.notFoundError('Application Not Found'));
    }
    //Get list of questions to retreived to setup parent child relationships.
    // NOTE Question Text must be from Application in case questions have been edited.
    if(applicationJSON.questions && applicationJSON.questions.length > 0){
        // The object which will hold all the questions in the correct nesting
        const dependencyList = {};
        // The object to hold child ID: childId
        const childToParent = {};
        for(let i = 0; i < applicationJSON.questions.length; i++){
            const appQuestion = applicationJSON.questions[i];
            let error = null;
            const questionBO = new QuestionBO();
            // Load the request data into it
            const questionDBJson = await questionBO.getById(appQuestion.questionId).catch(function(err) {
                log.error("question load error " + err + __location);
                error = err;
            });

            if(questionDBJson){
                // Go through the data and build place the child questions under their parents
                // If this question is a parent then add its info
                if (questionDBJson.parent === null) {
                    dependencyList[appQuestion.questionId] = {
                        "answer": getAnswer(appQuestion),
                        "children": {},
                        "question": appQuestion.questionText
                    };
                // If this question is a child add to the children array
                }
                else {
                // Store the relationship between this question and its parent
                    childToParent[appQuestion.questionId] = questionDBJson.parent;

                    // The array of the IDs of all the parents for this question
                    const listOfParents = [questionDBJson.parent];
                    // Add all the parent IDs all the way to the top level
                    while (childToParent[listOfParents.slice(-1)[0]]) {
                        listOfParents.push(childToParent[listOfParents.slice(-1)[0]]);
                    }
                    // Save the original list of parents to a string for logging output
                    const listOfParentsString = listOfParents.toString();

                    let childId = listOfParents.pop();
                    // If parent of childId does not exist
                    if (!dependencyList.hasOwnProperty(childId)) {
                        log.warn(`Child question ${childId} Does Not Exist: questionDBJson.parent=${questionDBJson.parent} questionDBJson.id=${questionDBJson.id} listOfParents=${listOfParentsString} ApplicationId ${req.query.application_id}` + __location);
                    }
                    if(dependencyList[childId]){
                        let child = dependencyList[childId];
                        // Build objects for parents with children questions for dependencyList
                        do {
                            if (!child) {
                                log.warn(`Child question ${childId} Does Not Exist: questionDBJson.parent=${questionDBJson.parent} questionDBJson.id=${questionDBJson.id} listOfParents=${listOfParentsString} ApplicationId ${req.query.application_id}` + __location);
                                return;
                            }
                            childId = listOfParents.pop();
                            // If childId is undefined, listofParents is empty, build child object
                            if (childId) {
                                child = child.children[childId];
                            }
                            else {
                                childId = appQuestion.questionId;
                                child.children[childId] = {
                                    "question": appQuestion.questionText,
                                    "answer": getAnswer(appQuestion),
                                    "children": {}
                                };
                            }
                        } while (childId !== questionDBJson.id);
                    }
                }

            }
            else {
                //not question in DB anymore.
                dependencyList[appQuestion.questionId] = {
                    "answer": getAnswer(appQuestion),
                    "children": {},
                    "question": appQuestion.questionText
                };


            }
        }//questions loop


        res.send(200, {"questions": dependencyList});

    }
    else {
        //no questions
        const noQuestions = {}
        res.send(200, {"questions": noQuestions});
    }


    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get questions', `${basePath}/questions`, getQuestions, 'applications', 'view');
};