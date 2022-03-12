const axios = require("axios");

const ApplicationUploadBO = global.requireShared("./models/ApplicationUpload-BO");

class ApplicationUpload {
  constructor(agency, acordFile = {}) {
    this.agency = agency;
    this.acordFile = acordFile;
    this.applicationObject = {};
    this.ocrResult = [];
  }

  async init() {
    try {
      this.validateAcordFile();

      if (this.acordFile.valid) {
        await this.submitAcordToOCR();
        await this.saveApplication();
      }
    } catch (error) {
      log.error(`Error initializing  file ${this.acordFile.fileName} ${error.message} ${__location}`);
      this.acordFile.error = "Error initializing file";
    }

    return this.acordFile;
  }

  validateAcordFile() {
    //Check emptiness
    if (!this.acordFile.data) {
      this.acordFile.valid = false;
      this.acordFile.error = "empty file";
      return;
    }

    //Check data type
    if (typeof this.acordFile.data !== "string") {
      this.acordFile.valid = false;
      this.acordFile.error = "file data type should be of String type";
      return;
    }

    //Check file extension
    if (!this.acordFile.fileName.endsWith(".pdf") && this.acordFile.extension !== "pdf") {
      this.acordFile.valid = false;
      this.acordFile.error = "file extension is not supported. Only pdf is suported";
      return;
    }

    //Check file size
    const buffer = Buffer.from(this.acordFile.data, "base64");

    if (buffer.byteLength > 2_000_000) {
      //2 MBs max
      this.acordFile.valid = false;
      this.acordFile.error = "file size should not exceed 2 MBs";
      return;
    }

    this.acordFile.valid = true;
    this.acordFile.data = buffer;
  }

  async submitAcordToOCR() {
    try {
      const response = await axios.request({
        method: "POST",
        url: "https://ufg7wet2m3.execute-api.us-east-1.amazonaws.com/production/ocr/queue/pdf/acord130/201705",
        data: this.acordFile.data,
        headers: { "Content-Type": "application/pdf" },
      });
      this.acordFile.requestId = response.data?.requestId;
    } catch (error) {
      this.acordFile.error = "OCR Error submiting file";
      log.error(`OCR Error submiting file: ${this.acordFile.fileName} ${error.message} ${__location}`);
    }

    this.acordFile.data = null;
  }

  async saveApplication() {
    try {
      const applicationUploadBO = new ApplicationUploadBO();
      const applicationId = await applicationUploadBO.createOne(this.agency, this.acordFile.requestId);

      if (applicationId) {
        this.acordFile.applicationId = applicationId;
      } else {
        this.acordFile.error = "Error saving application";
      }
    } catch (error) {
      this.acordFile.error = "Error saving application";
      log.error(`Error saving application ${this.acordFile.fileName} ${error.message} ${__location}`);
    }
  }

  normalizeData() {
    for (const element of this.ocrResult) {
      if (!element) continue;

      if (element?.answer) {
        if (element.answer === "X") {
          this.data[element.question] = element.question;
        } else {
          this.data[element.question] = element.answer;
        }
      }
    }
  }

  async mapResultToApplicationObject() {
    //find agency
    const address = this.ocrRsult["Agency Name And Address"];
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
        const industryCode = await IndustryCode.findOne({ sic: this.ocrRsult["SIC"] }).exec();

        applicationObject.agencyId = agency.systemId;
        applicationObject.agencyNetworkId = agency.agencyNetworkId;
        applicationObject.agencyLocationId = agencyLocation?.systemId;
        applicationObject.industryCode = industryCode?.industryCodeId;
      } else {
        return { success: false, error: "agency not found" };
      }
    } catch (error) {
      log.error(`Error mapping OCR result :${error.message}`, __location);
      return { succes: false, message: "Error mapping OCR result" };
    }

    // entity type
    const entityTypeAnswer =
      this.ocrRsult["Sole Proprietor"] ||
      this.ocrRsult["Partnership"] ||
      this.ocrRsult["Corporation"] ||
      this.ocrRsult["S Corp"] ||
      this.ocrRsult["LLC"] ||
      this.ocrRsult["Joint Venture"] ||
      this.ocrRsult["Trust"] ||
      "Other";

    applicationObject.entityType = entityTypeAnswer;

    // business info
    applicationObject.businessName = this.ocrRsult["Applicant Name"];
    applicationObject.hasEin = Boolean(this.ocrRsult["FEIN"]);
    applicationObject.ein = Boolean(this.ocrRsult["FEIN"]);
    const [streetAddress, region] = this.ocrRsult["Applicant Mailing Address"]?.split("\n");
    const [businessCity, businessState, businessZipCode] = region?.split(" ");
    applicationObject.mailingAddress = streetAddress;
    applicationObject.mailingCity = businessCity;
    applicationObject.mailingState = businessState;
    applicationObject.mailingZipcode = businessZipCode;
    applicationObject.website = this.ocrRsult["Website"];

    // business owners
    const businessOwners = [];

    Object.entries(this.ocrRsult).forEach(([key, value]) => {
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

    applicationObject.numOwners = businessOwners.length;
    applicationObject.owners = businessOwners;

    // locations
    const locations = [];

    Object.entries(this.ocrRsult).forEach(([key, value]) => {
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

    const [contactFirstName, contactLastName] = this.ocrRsult["Contact Inspection Name"]?.split(" ");
    applicationObject.contacts = [
      {
        firstName: contactFirstName,
        lastName: contactLastName,
        email: this.ocrRsult["Contact Inspection Email"],
        phone: this.ocrRsult["Contact Inspection Phone"],
        primary: true,
      },
    ];

    // Policies
    applicationObject.policies = [
      {
        policyType: "WC",
        effectiveDate: new Date(this.ocrRsult["Policy Proposed Eff Date"]),
        expirationDate: new Date(this.ocrRsult["Proposed Exp Date"]),
        limits: (
          this.ocrRsult["Liability Each Accident"] +
          this.ocrRsult["Liability Disease Limit"] +
          this.ocrRsult["Liability Disease Employee"]
        ).replace(",", ""),
      },
    ];

    // Questions
    const rawQuestions = Object.entries(this.ocrRsult).filter(([question, answer]) => question.endsWith("?"));
    applicationObject.questions = [];

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

        applicationObject.questions.push(question);
      }
    }
  }
}

module.exports = ApplicationUpload;
