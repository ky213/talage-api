/* eslint-disable require-jsdoc */
/* eslint-disable prefer-const */
/* eslint-disable no-process-exit */
/* eslint-disable no-console */
/**
 *  Markel Code Importer
 *
 * This importer relies on the spreadsheet having the following columns and format:
 *
 * Class Code: the 4 digit NCCI code
 * State: the two character state abbreviation
 * Quote Action: one of 'autoquote', 'decline', or 'refer'
 */
const moment = require("moment");
const amtrust = require('./amtrust-client.js');
const sha1 = require("sha1");
const emailSvc = global.requireShared('./services/emailsvc.js');

const ncciStates = ["RI",
    "IA",
    "SC",
    "NH",
    "NC",
    "SD",
    "NY",
    "TN",
    "KS",
    "UT",
    "VT",
    "NM",
    "MA",
    "MD",
    "TX",
    "ME",
    "LA",
    "KY",
    "OK",
    "GA",
    "DC",
    "ID",
    "FL",
    "AL",
    "VA",
    "CO",
    "HI",
    "IL",
    "CT",
    "AZ",
    "AR",
    "WV",
    "NE",
    "NV",
    "WI",
    "MS",
    "MO",
    "MT",
    "IN"];

const InsurerActivityCodeModel = require('mongoose').model('InsurerActivityCode');
const InsurerQuestion = require('mongoose').model('InsurerQuestion');
const Question = require('mongoose').model('Question');
const Insurer = require('mongoose').model('Insurer');


const logPrefix = "AmTrust Importing WC questions ";

async function QuestionImport(amtrustClassCodeMap) {

    const insurer = await Insurer.findOne({slug: 'amtrust'});
    if (!insurer) {
        log.error("Could not find insurer.");
    }

    log.info(logPrefix + `Importing WC questions for insurer ${insurer.name} (id=${insurer.insurerId})`);


    const updateDatabase = "Y";
    let amtrustQuestionsMap = {}

    // Authorize the client
    log.info(logPrefix + "Authorizing" + __location);
    await amtrust.authorize();

    for (const state of Object.keys(amtrustClassCodeMap)) {
        log.info(logPrefix + `Getting Question for  ${state}` + __location)
        const result = await amtrust.callAPI("GET", `/api/v2/questions/states?state=${state}`, null);
        if (result && result.StatusCode === 200) {
            amtrustQuestionsMap[state] = result.Data;
        }
        else {
            //log.info(JSON.stringify(result))
            log.warn(logPrefix + `Could not retrieving Questions for ${state} ` + __location);
        }
    }

    log.info(logPrefix + "Successfully loaded WC questions from the AmTrust API");

    // Am Trust has different question IDs for the same question depending on the selected state/class code.
    // This means the question "Do you plant trees?" may have question ID 1234 for class code 1023, and then
    // question ID 1235 for class code 9384, and so on.
    // We don't want to have 10 copies of the same question in the database; it would be a mapping nightmare.
    // Instead, we create an internal ID using the hash of the question text and create a
    // state / class code -> question ID mapping to resolve the question back to the intended question ID.
    let updatedIQLinks = 0;
    let newQuestionList = [];

    const queryProjection = {"__v": 0}
    const ncciCodeChecked = {};
    for (const state of Object.keys(amtrustQuestionsMap)) {
        log.info(logPrefix + `- processing ${state} `);
        const stateQuestionJSON = amtrustQuestionsMap[state];
        if(stateQuestionJSON.ClassCodeQuestions && stateQuestionJSON.ClassCodeQuestions.length > 0){
            for (const classCodeQuestion of stateQuestionJSON.ClassCodeQuestions) {
                //
                if(classCodeQuestion.ClassCode.trim() && classCodeQuestion.Questions && classCodeQuestion.Questions.length > 0){

                    let processCode = true;
                    if(ncciStates.indexOf(state) > -1 && ncciCodeChecked[classCodeQuestion.ClassCode]){
                        processCode = false;
                    }

                    if(processCode){
                        // find IAC
                        const query = {
                            insurerId: insurer.insurerId,
                            code: classCodeQuestion.ClassCode,
                            territoryList: state,
                            active: true
                        }
                        const insurerAcDocList = await InsurerActivityCodeModel.find(query, queryProjection).catch((err) => {
                            log.error(logPrefix + `Error fixing existing Insurer ActivityCodes ${JSON.stringify(query)} error: ${err}}` + __location);
                        });
                        if(insurerAcDocList && insurerAcDocList.length > 0){
                            //loop questions.
                            for(const iac of insurerAcDocList){
                                let saveDoc = false;
                                //amtrustquestions
                                for(const amTrustQuestion of classCodeQuestion.Questions){
                                    const questionQuery = {
                                        insurerId: insurer.insurerId,
                                        text:  amTrustQuestion.Question.trim(),
                                        active: true
                                    }
                                    const insurerQuestionList = await InsurerQuestion.find(questionQuery, queryProjection).catch((err) => {
                                        log.error(logPrefix + `Error fixing existing Insurer ActivityCodes ${JSON.stringify(query)} error: ${err}}` + __location);
                                    });
                                    let insurerQ = null

                                    if(insurerQuestionList && insurerQuestionList.length === 1){
                                        insurerQ = insurerQuestionList[0]
                                    }
                                    else if(insurerQuestionList && insurerQuestionList.length > 1){
                                        log.info(logPrefix + `- More than one question for AmTrust ${amTrustQuestion.Question}` + __location);
                                    }
                                    else {
                                        const alreadyAdded = newQuestionList.find(newQ => newQ.Question.trim() === amTrustQuestion.Question.trim());
                                        if(!alreadyAdded){
                                            newQuestionList.push(amTrustQuestion)
                                            if(updateDatabase === "Y"){
                                                insurerQ = await AddQuestion(amTrustQuestion)
                                            }
                                        }
                                        // addquestion and set new question to insurerQ.
                                    }
                                    if(insurerQ){
                                        //look at iac.insurerQuestionIdList
                                        if(iac.insurerQuestionIdList){
                                            if(iac.insurerQuestionIdList.indexOf(insurerQ.insurerQuestionId) === -1){
                                                updatedIQLinks++;
                                                iac.insurerQuestionIdList.push(insurerQ.insurerQuestionId)
                                                saveDoc = true
                                            }
                                        }
                                        if(iac.iacinsurerTerritoryQuestionList){
                                            const existingTQ = iac.iacinsurerTerritoryQuestionList.find(tq => tq.territory = state);
                                            if(existingTQ && existingTQ.insurerQuestionIdList.indexOf(insurerQ.insurerQuestionId) === -1){
                                                updatedIQLinks++;
                                                existingTQ.insurerQuestionIdList.push(insurerQ.insurerQuestionId)
                                                saveDoc = true
                                            }
                                        }

                                    }
                                }
                                if(updateDatabase === "Y" && saveDoc){
                                    await iac.save();
                                }
                            }


                        }
                        else {
                            log.info(logPrefix + `- No IAC  ${classCodeQuestion.ClassCode} in ${state} ` + __location);
                        }
                        ncciCodeChecked[classCodeQuestion.ClassCode] = true;


                    }

                }
            }
        }
    }

    log.info(logPrefix + `- ${newQuestionList.length} new AmTrust questions ` + __location);
    log.info(logPrefix + `- ${updatedIQLinks} updates to AmTrust question links ` + __location);

    //send email with the above stats to integrations@talageins.com
    if(newQuestionList.length > 0 || updatedIQLinks > 0){
        //trigger to send email since codes were addeded
        let messageTable = '';

        for (const codes in newQuestionList) {
            if({}.hasOwnProperty.call(newQuestionList, codes)){
                messageTable += `<tr>
                       <td>${newQuestionList[codes].QuestionId} - ${newQuestionList[codes].Question}</td>
                   </tr>`
            }
        }
        const sendMessage = `
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>${newQuestionList.length} new AmTrust questions / ${updatedIQLinks} updates to AmTrust codes</th>
                    </tr>
                </thead>
                <tbody>
                    ${messageTable}
                </tbody>
            </table>
        `
        try{
            const sendResult = await emailSvc.send('carlo+int@talageins.com','New Questions were added to AmTrust',sendMessage);
            if(!sendResult){
                console.log('An error occured when sending notification. Please contact us for details');
            }
        }
        catch(err) {
            console.log('error-sending email:', err);
        }
    }

    return true;
}

async function AddQuestion(amTrustQuestion){
    //add Talage Question
    const newTalageQuestionId = await newQuestionId();
    let talageQuesionJSON = {
        talageQuestionId: newTalageQuestionId,
        "typeId" : 1,
        "hidden" : false,
        "acordQuestion" : false,
        "text" : amTrustQuestion.Question,
        "typeDesc" : "Yes/No",
        "answers" : [
            {
                "default" : true,
                "answerId" : 1,
                "answer" : "No"
            }, {
                "default" : false,
                "answerId" : 2,
                "answer" : "Yes"
            }
        ]
    }
    let talaqeQuestionDoc = new Question(talageQuesionJSON)
    await talaqeQuestionDoc.save();
    //add insurerQeusttion
    let newInsurerQuestionJSON = {
        "insurerId" : 19,
        talageQuestionId: newTalageQuestionId,
        "policyTypeList" : [
            "WC"
        ],
        "universal" : false,
        "questionSubjectArea" : "general",
        identifier: sha1(amTrustQuestion.Question),
        "allTerritories" : true,
        "text" : amTrustQuestion.Question,
        "effectiveDate": moment("1980-01-01T08:00:00.000Z"),
        "expirationDate": moment("2100-01-01T08:00:00.000Z")
    }
    let insurerQuestionDoc = new InsurerQuestion(newInsurerQuestionJSON)
    await insurerQuestionDoc.save();
    log.info(logPrefix + `- Added Insurer question  ${insurerQuestionDoc.insurerQuestionId} - ${insurerQuestionDoc.text} ` + __location);
    return insurerQuestionDoc;

}
async function newQuestionId(){
    let maxId = 0;
    try{

        //small collection - get the collection and loop through it.
        // TODO refactor to use mongo aggretation.
        const query = {}
        const queryProjection = {"talageQuestionId": 1}
        var queryOptions = {};
        queryOptions.sort = {};
        queryOptions.sort.talageQuestionId = -1;
        queryOptions.limit = 1;
        const docList = await Question.find(query, queryProjection, queryOptions)
        if(docList && docList.length > 0){
            for(let i = 0; i < docList.length; i++){
                if(docList[i].talageQuestionId > maxId){
                    maxId = docList[i].talageQuestionId + 1;
                }
            }
        }

    }
    catch(err){
        log.error(logPrefix + "Importing Get max system id " + err + __location)
        throw err;
    }
    //log.info("maxId: " + maxId + __location)
    return maxId;
}


module.exports = {QuestionImport: QuestionImport};