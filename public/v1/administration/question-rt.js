/* eslint-disable object-shorthand */
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const QuestionTypeSvc = global.requireShared('./services/questiontypesvc.js');
const QuestionBO = global.requireShared('./models/Question-BO.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const questionBO = new QuestionBO();

    if(req.query.question){
        req.query.text = req.query.question;
        delete req.query.question;
    }
    if(req.query.id){
        req.query.talageQuestionId = req.query.id;
        delete req.query.id;
    }

    const questionDocList = await questionBO.getList(req.query).catch(function(err) {
        log.error("admin agencynetwork error: " + err + __location);
        error = err;
    })
    if (error) {
        return next(error);
    }

    const countQuery = {...req.query, count: true};
    const count = await questionBO.getList(countQuery).catch(function(err) {
        error = err;
    });
    if (error) {
        return next(error);
    }

    if (questionDocList) {
        questionDocList.forEach((questionDoc) => {
            prepReturnQuestion(questionDoc)
        });

        res.send(200, {rows: questionDocList, ...count});
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('question not found'));
    }
}

async function findOne(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    let error = null;
    const questionBO = new QuestionBO();
    // Load the request data into it
    const questionJSON = await questionBO.getById(id).catch(function(err) {
        log.error("question load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (questionJSON) {
        prepReturnQuestion(questionJSON)
        res.send(200, questionJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('question not found'));
    }
}

async function add(req, res, next) {

    log.debug("question post " + JSON.stringify(req.body));
    //TODO Validate
    if(!req.body.question && !req.body.text){
        return next(serverHelper.requestError("bad missing question text"));
    }
    // // allow hint to be empty string
    // if(!req.body.hint && req.body.hint !== ""){
    //     return next(serverHelper.requestError("bad missing hint"));
    // }
    if(!req.body.text && req.body.question){
        req.body.text = req.body.question
    }

    if(!req.body.typeId && !req.body.type){
        req.body.typeId = 1
    }
    else if (!req.body.typeId){
        req.body.typeId = req.body.type
    }
    const questionTypeJSON = QuestionTypeSvc.getById(req.body.typeId);
    req.body.typeDesc = questionTypeJSON.name
    if(!req.body.answers && req.body.typeId === 1){
        //create yes  && no
        req.body.answers = [];
        const noAnswer = {
            answerId: 1,
            answer: "No",
            default: true
        }
        req.body.answers.push(noAnswer)
        const yesAnswer = {
            answerId: 2,
            answer: "Yes",
            default: false
        }
        req.body.answers.push(yesAnswer)
    }


    const questionBO = new QuestionBO();
    let error = null;
    const newRecord = true;
    //prepRequestQuestion(req.body)
    log.debug("question post to save " + JSON.stringify(req.body));
    await questionBO.saveModel(req.body,newRecord).catch(function(err) {
        log.error("question save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    prepReturnQuestion(questionBO.mongoDoc)

    res.send(200, questionBO.mongoDoc);
    return next();
}

async function update(req, res, next) {
    log.debug(`question put ${JSON.stringify(req.body)}`)
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    if(!req.body){
        return next(serverHelper.requestError("bad put"));
    }
    if(!req.body.id){
        req.body.id = req.body.talageQuestionId
    }
    let error = null;
    const updateRecord = false;
    const questionBO = new QuestionBO();
    const newDoc = JSON.parse(JSON.stringify(req.body))
    prepRequestQuestion(newDoc)
    log.debug(`question put prepped ${JSON.stringify(newDoc)}`)
    await questionBO.saveModel(newDoc, updateRecord).catch(function(err) {
        log.error("question load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    prepReturnQuestion(questionBO.mongoDoc)
    res.send(200, questionBO.mongoDoc);
    //update cache
    // const questionSvc = global.requireShared('./services/questionsvc.js');
    // try{
    //     //do not await not need to wait for response
    //     questionSvc.UpdateRedisIndustryQuestionByQuestionId(questionBO.id);
    // }
    // catch(err){
    //     log.error(`Error update question cache for ${questionBO.id}`)
    // }

    return next();
}
function prepReturnQuestion(questionDoc){
    if(!questionDoc){
        return;
    }
    questionDoc.id = questionDoc.talageQuestionId
    questionDoc.type = questionDoc.typeId
    questionDoc.question = questionDoc.text
    questionDoc.state = questionDoc.active ? 1 : 0;
    questionDoc.stateDesc = questionDoc.active ? "Published" : "Unpublished";
    if(questionDoc.answers){
        questionDoc.answers.forEach((answer) => {
            answer.question = questionDoc.talageQuestionId
            answer.id = answer.answerId;
            if(answer._id){
                delete answer._id;
            }
        })
    }


}

function prepRequestQuestion(questionDoc){
    if(!questionDoc){
        return;
    }
    if(questionDoc.id && !questionDoc.talageQuestionId){
        questionDoc.talageQuestionId = questionDoc.id;
        delete questionDoc.id;
    }
    if(questionDoc.type){
        questionDoc.typeId = questionDoc.type
    }
    if(questionDoc.question){
        questionDoc.text = questionDoc.question
    }
    if(questionDoc.hasOwnProperty("state")){
        questionDoc.active = questionDoc.state === 1;
    }
    if(questionDoc.typeId){
        const questionTypeJSON = QuestionTypeSvc.getById(questionDoc.typeId);
        questionDoc.typeDesc = questionTypeJSON.name
    }
    if(questionDoc.answers){
        let needAnswerId = false;
        let maxAnswerId = 0;
        questionDoc.answers.forEach((answer) => {
            if(!answer.answerId && answer.id){
                answer.answerId = answer.id
            }
            if(answer.default !== true){
                answer.default = answer.default === 1;
            }
            if(answer.answerId > maxAnswerId){
                maxAnswerId = answer.answerId
            }
            if(!answer.answerId){
                needAnswerId = true;
            }
        })
        if(needAnswerId){
            questionDoc.answers.forEach((answer) => {
                if(!answer.answerId){
                    maxAnswerId++;
                    answer.answerId = maxAnswerId;
                }
            });
        }

    }
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Question list', `${basePath}/question`, findAll, 'TalageMapper', 'all');
    server.addGetAuthAdmin('GET Question Object', `${basePath}/question/:id`, findOne, 'TalageMapper', 'all');
    server.addPostAuthAdmin('POST Question Object', `${basePath}/question`, add, 'TalageMapper', 'all');
    server.addPutAuthAdmin('PUT Question Object', `${basePath}/question/:id`, update, 'TalageMapper', 'all');
};