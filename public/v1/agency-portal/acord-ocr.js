"use strict";
const axios = require("axios");
const { endsWith, zip } = require("lodash");
const moment = require("moment");
const serverHelper = global.requireRootPath("server.js");

const ApplicationUpload = global.mongoose.ApplicationUpload;
const Agency = global.mongoose.Agency;
const AgencyLocation = global.mongoose.AgencyLocation;
const IndustryCode = global.mongoose.IndustryCode;
const Question = global.mongoose.Question;

/**
 * Validates data
 *
 * @param {object[]} files - arrary of acord files
 *
 * @returns {object[]}   arrary of acord files
 */
function validateFiles(files) {
  for (const file of files) {
    //Check emptiness
    if (!file.data) {
      file.valid = false;
      file.error = "empty file";

      continue;
    }

    //Check data type
    if (typeof file.data !== "string") {
      file.valid = false;
      file.error = "file data type should be of String type";

      continue;
    }

    //Check file extension
    if (!file.fileName.endsWith(".pdf") && file.extension !== "pdf") {
      file.valid = false;
      file.error = "file extension is not supported. Only pdf is suported";

      continue;
    }

    //Check file size
    const buffer = Buffer.from(file.data);

    if (buffer.byteLength > 2_000_000) {
      //2 MBs max
      file.valid = false;
      file.error = "file size should not exceed 2 MBs";

      continue;
    }
    // else {
    //     file.data = buffer.toString("binary");
    // }

    file.valid = true;
  }

  return files;
}

/**
 * Sends the valid acords list to aws OCR endpoint
 *
 * @param {object[]} files - arrary of acord files
 *
 * @returns {object[]} - arrary of acord files meta data with requestId
 */
async function submitacordsForRecognition(files) {
  for await (const file of files) {
    try {
      const response = await axios.request({
        method: "POST",
        url: "https://ufg7wet2m3.execute-api.us-east-1.amazonaws.com/production/ocr/queue/pdf/acord130/201705",
        data: Buffer.from(file.data, "base64"),
        headers: { "Content-Type": "application/pdf" },
      });
      file.requestId = response.data?.requestId;
    } catch (error) {
      file.error = error.message;
      log.error(`Error processing file: ${file.fileName}`, __location);
    }

    file.data = null;
  }

  return files;
}

/**
 * Maps OCR raw data to an internal appliction object
 *
 * @param {object} ocrResult -  OCR result object
 *
 * @returns {object} - application object
 */
async function mapResultToApplicationObject(ocrResult) {
  // normalize data
  const data = {};
  for (const element of ocrResult) {
    if (element.answer) {
      if (element.answer === "X") {
        data[element.question] = element.question;
      } else {
        data[element.question] = element.answer;
      }
    }
  }

  //find agency
  const applicationUpload = new ApplicationUpload();
  const address = data["Agency Name And Address"];
  const [agencyName, addressLine1, addressLine2] = address?.split("\n");
  const [city, state, zipcode] = addressLine2.split(" ");

  try {
    const agency = await Agency.findOne({ name: agencyName }).exec();

    if (agency) {
      const agencyLocation = await AgencyLocation.findOne({
        agencyId: agency.systemId,
        city: city,
        state: state,
        zipcode: zipcode,
      }).exec();
      const industryCode = await IndustryCode.findOne({ sic: data["SIC"] }).exec();

      applicationUpload.agencyId = agency.systemId;
      applicationUpload.agencyNetworkId = agency.agencyNetworkId;
      applicationUpload.agencyLocationId = agencyLocation?.systemId;
      applicationUpload.industryCode = industryCode?.industryCodeId;
    } else {
      return { success: false, error: "agency not found" };
    }
  } catch (error) {
    log.error(`Error mapping OCR result :${error.message}`, __location);
    return { succes: false, message: "Error mapping OCR result" };
  }

  // entity type
  const entityTypeAnswer =
    data["Sole Proprietor"] ||
    data["Partnership"] ||
    data["Corporation"] ||
    data["S Corp"] ||
    data["LLC"] ||
    data["Joint Venture"] ||
    data["Trust"] ||
    "Other";

  applicationUpload.entityType = entityTypeAnswer;

  // business info
  applicationUpload.businessName = data["Applicant Name"];
  applicationUpload.hasEin = Boolean(data["FEIN"]);
  applicationUpload.ein = Boolean(data["FEIN"]);
  const [streetAddress, region] = data["Applicant Mailing Address"]?.split("\n");
  const [businessCity, businessState, businessZipCode] = region?.split(" ");
  applicationUpload.mailingAddress = streetAddress;
  applicationUpload.mailingCity = businessCity;
  applicationUpload.mailingState = businessState;
  applicationUpload.mailingZipcode = businessZipCode;
  applicationUpload.website = data["Website"];

  // business owners
  const businessOwners = [];

  Object.entries(data).forEach(([key, value]) => {
    if (key.startsWith("Individual")) {
      const [_, ownerIndex, field] = key.split(" ");
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

  applicationUpload.numOwners = businessOwners.length;
  applicationUpload.owners = businessOwners;

  // locations
  const locations = [];

  Object.entries(data).forEach(([key, value]) => {
    if (key.startsWith("Location") && key.endsWith("Address")) {
      const [streetAddress, region] = value?.split("\n");

      locations.push({
        address: streetAddress,
        city: region.match(/^\w{3,}\b/)?.pop(),
        state: region.match(/\b\w{2}\b/)?.pop(),
        zipcode: region.match(/\b\d+$/)?.pop(),
      });
    }
  });

  //contacts

  const [contactFirstName, contactLastName] = data["Contact Inspection Name"]?.split(" ");
  applicationUpload.contacts = [
    {
      firstName: contactFirstName,
      lastName: contactLastName,
      email: data["Contact Inspection Email"],
      phone: data["Contact Inspection Phone"],
      primary: true,
    },
  ];

  // Policies
  applicationUpload.policies = [
    {
      policyType: "WC",
      effectiveDate: new Date(data["Policy Proposed Eff Date"]),
      expirationDate: new Date(data["Proposed Exp Date"]),
      limits: (
        data["Liability Each Accident"] +
        data["Liability Disease Limit"] +
        data["Liability Disease Employee"]
      ).replace(",", ""),
    },
  ];

  // Questions
  const rawQuestions = Object.entries(data).filter(([question, answer]) => question.endsWith("?"));
  applicationUpload.questions = [];

  for (let [text, answer] of rawQuestions) {
    const question = {};

    text = text.replace("\n", " ");

    const dbQuestion = await Question.findOne({ text: text }).exec();

    if (dbQuestion) {
      question.questionId = dbQuestion.talageQuestionId;
      question.questionText = dbQuestion.text;
      question.hint = dbQuestion.hint;
      question.questionType = dbQuestion.typeDesc;
      question.answerValue = answer;
      question.answerId = dbQuestion.answers.find(
        (dbAnswer) => dbAnswer.answer.toLowerCase() === answer.toLowerCase()
      )?.answerId;

      applicationUpload.questions.push(question);
    }
  }

  return applicationUpload;
}

/**
 * Sends the valid acords list to aws OCR endpoint
 *
 * @param {object[]} resultObjects - arrary of OCR acord files objects
 *
 * @returns {void}
 */
async function saveApplications(resultObjects) {
  // map result to application object
  const applicationObjects = [];

  for (const object of resultObjects) {
    if (object.data?.status === "SUCCESS" && object.data?.ocrResponse?.length !== 0) {
      applicationObjects.push(mapResultToApplicationObject(object));
    }
  }
  // save application
}

/**
 * Get the acord status and data after OCR request submission
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getacordsStatuses(req, res, next) {
  const files = req.body.acords;
  // Check for data
  if (!files?.length) {
    log.info("Bad Request: No data received" + __location);
    return next(serverHelper.requestError("Bad Request: No data received"));
  }

  for (const file of files) {
    try {
      const response = await axios.request({
        method: "GET",
        url: `https://ufg7wet2m3.execute-api.us-east-1.amazonaws.com/production/ocr/status/${file.requestId}`,
      });

      file.data = response?.data;
    } catch (error) {
      file.data = null;
      file.error = error.message;
      log.error(`Error getting file status: ${file.fileName}`, __location);
    }
  }

  res.send(files);
  next();
}

/**
 * Receives a list of scanned acord files, parse them with an OCR api and then send back the json format version.
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getacordOCR(req, res, next) {
  // Check for data
  if (!req.body.files?.length) {
    log.info("Bad Request: No data received" + __location);
    return next(serverHelper.requestError("Bad Request: No data received"));
  }

  // Check for number of files
  if (req.body.files.length > 10) {
    log.info("Bad Request: exceeded number of files (10)" + __location);
    return next(serverHelper.requestError("Bad Request: Max number of files is 10"));
  }

  //validateFiles
  const acords = validateFiles(req.body.files);
  const validFiles = acords.filter(({ valid }) => valid);

  if (validFiles.length === 0) {
    log.info("Bad Request: No valid files received" + __location);
    return next(serverHelper.requestError("Bad Request: No valid files received"));
  }

  // submit acords for OCR recognition
  const result = await submitacordsForRecognition(validFiles);


  //save application
   saveApplications(result);

  res.send(result);

  next();
}

exports.registerEndpoint = (server, basePath) => {
  server.addPostAuth("POST acord files for OCR", `${basePath}/acord-ocr`, getacordOCR);
  server.addPostAuth("GET acord files statuses", `${basePath}/acord-ocr/status`, getacordsStatuses);
};
