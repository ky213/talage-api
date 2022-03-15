'use-strict'
const axios = require("axios");
const colors = require("colors");
const ApplicationUploadBO = global.requireShared("./models/ApplicationUpload-BO");


/**
 * Poll OCR API for applications statuses
 * @returns {void}
 */
exports.processtask = async function () {

    const appBO = new ApplicationUploadBO();

    //find QUEUED or unknown status apps
    const apps = await appBO.getList({
        "ocr.requestId": {$ne: null},
        "ocr.status": {$nin: ["SUCCESS", "ERROR"]}
    });

    //check for apps statuses in the OCR service
    for (const app of apps) {
        try {
            const response = await axios.request({
                method: "GET",
                url: `https://ufg7wet2m3.execute-api.us-east-1.amazonaws.com/production/ocr/status/${app.ocr?.requestId}`
            });
            app.ocr.status = response?.data.status;

            if (response?.data?.ocrResponse?.length > 0) {
                const applicationObject = await mapResultToApplicationObject(response.data.ocrResponse, app);
                await appBO.updateOne(app.applicationId, applicationObject);
            }
        }
        catch (error) {
            log.error(`Task Error checking app OCR status: ${app.applicationId} ${error.message} ${__location}`);
        }
    }
    log.info(colors.green("Done"));
}

/**
 * Transforms the OCR data array to an object
 * @param {object} ocrResult // the ocr response array
 * @returns {void}
 */
function normalizeData(ocrResult) {
    const data = {};
    for (const element of ocrResult) {
        if (!element) {
            continue;
        }

        if (element?.answer) {
            if (element.answer === "X") {
                data[element.question] = element.question;
            }
            else {
                data[element.question] = element.answer;
            }
        }
    }

    return data;
}

/**
 * Maps OCR result to an ApplicationUpload object
 * @param {object} ocrResult // normalized ocr result
 * @param {object} applicationObject // ApplicationUpload instance
 * @returns {void}
 */
async function mapResultToApplicationObject(ocrResult, applicationObject) {
    const Agency = global.mongoose.Agency;
    const AgencyLocation = global.mongoose.AgencyLocation;
    const IndustryCode = global.mongoose.IndustryCode;
    const Question = global.mongoose.Question;

    //normalize data
    ocrResult = normalizeData(ocrResult);

    //find agency
    const address = ocrResult["Agency Name And Address"];
    const [agencyName,,addressLine2] = address?.split("\n");
    const [city,
        state,
        zipcode] = addressLine2.split(" ");

    try {
        const agency = await Agency.findOne({name: agencyName}).exec();

        if (agency) {
            const agencyLocation = await AgencyLocation.findOne({
                agencyId: agency.systemId,
                city: city,
                state: state,
                zipcode: zipcode
            }).exec();
            const industryCode = await IndustryCode.findOne({sic: ocrResult.SIC}).exec();

            applicationObject.agencyId = agency.systemId;
            applicationObject.agencyNetworkId = agency.agencyNetworkId;
            applicationObject.agencyLocationId = agencyLocation?.systemId;
            applicationObject.industryCode = industryCode?.industryCodeId;
        }
        else {
            return {
                success: false,
                error: "agency not found"
            };
        }
    }
    catch (error) {
        log.error(`Error mapping OCR result: ${error.message}`, __location);
        return {
            succes: false,
            message: "Error mapping OCR result"
        };
    }

    // entity type
    const entityTypeAnswer =
    ocrResult["Sole Proprietor"] ||
    ocrResult.Partnership ||
    ocrResult.Corporation ||
    ocrResult["S Corp"] ||
    ocrResult.LLC ||
    ocrResult["Joint Venture"] ||
    ocrResult.Trust ||
    "Other";

    applicationObject.entityType = entityTypeAnswer;

    // business info
    applicationObject.businessName = ocrResult["Applicant Name"];
    applicationObject.hasEin = Boolean(ocrResult.FEIN);
    applicationObject.ein = Boolean(ocrResult.FEIN);
    const [streetAddress, region] = ocrResult["Applicant Mailing Address"]?.split("\n");
    const [businessCity,
        businessState,
        businessZipCode] = region?.split(" ");
    applicationObject.mailingAddress = streetAddress;
    applicationObject.mailingCity = businessCity;
    applicationObject.mailingState = businessState;
    applicationObject.mailingZipcode = businessZipCode;
    applicationObject.website = ocrResult.Website;

    // business owners
    const businessOwners = [];

    Object.entries(ocrResult).forEach(([key, value]) => {
        if (key.startsWith("Individual")) {
            const [,ownerIndex,
                field] = key.split(" ");
            let owner = businessOwners[ownerIndex - 1];

            if (!owner) {
                owner = {};
                businessOwners[ownerIndex - 1] = owner;
            }

            switch (field) {
                case "Name":
                    const [fname, lname] = value.split(" ");
                    owner.fname = fname;
                    owner.lname = lname;
                    break;
                case "DOB":
                    owner.birthdate = new Date(value);
                    break;
                case "Ownership":
                    owner.ownership = Number(value);
                    break;
                case "Inc":
                    owner.include = value === "INC";
                    break;
                default:
                    break;
            }
        }
    });

    applicationObject.numOwners = businessOwners.length;
    applicationObject.owners = businessOwners;

    // locations
    const locations = [];

    Object.entries(ocrResult).forEach(([key, value]) => {
        if (key.startsWith("Location") && key.endsWith("Address")) {
            const [locationAddress, locationRegion] = value?.split("\n");

            locations.push({
                address: locationAddress,
                city: locationRegion.match(/^\w{3,}\b/)?.pop(),
                state: locationRegion.match(/\b\w{2}\b/)?.pop(),
                zipcode: locationRegion.match(/\b\d+$/)?.pop()
            });
        }
    });

    //contacts

    const [contactFirstName, contactLastName] = ocrResult["Contact Inspection Name"]?.split(" ");
    applicationObject.contacts = [
        {
            firstName: contactFirstName,
            lastName: contactLastName,
            email: ocrResult["Contact Inspection Email"],
            phone: ocrResult["Contact Inspection Phone"],
            primary: true
        }
    ];

    // Policies
    const policy = {
        policyType: "WC",
        effectiveDate: new Date(ocrResult["Policy Proposed Eff Date"]),
        expirationDate: new Date(ocrResult["Proposed Exp Date"]),
        limits:
        ocrResult["Liability Each Accident"] +
        ocrResult["Liability Disease Limit"] +
        ocrResult["Liability Disease Employee"]
    };

    policy.limits = policy.limits?.split(',').join('')

    applicationObject.policies.push(policy)

    // Questions
    const rawQuestions = Object.entries(ocrResult).filter(([question]) => question.endsWith("?"));
    applicationObject.questions = [];

    //eslint-disable-next-line prefer-const
    for (let [text, answer] of rawQuestions) {
        const question = {};

        text = text.replace("\n", " ");

        const dbQuestion = await Question.findOne({text: text}).exec();

        if (dbQuestion) {
            question.questionId = dbQuestion.talageQuestionId;
            question.questionText = dbQuestion.text;
            question.hint = dbQuestion.hint;
            question.questionType = dbQuestion.typeDesc;
            question.answerValue = answer;
            question.answerId = dbQuestion.answers.find((dbAnswer) => dbAnswer.answer.toLowerCase() === answer.toLowerCase())?.answerId;

            applicationObject.questions.push(question);
        }
    }

    return applicationObject;
}

