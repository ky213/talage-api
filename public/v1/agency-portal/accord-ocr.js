"use strict";
const serverHelper = global.requireRootPath("server.js");
const axios = require("axios");

/**
 * Validates data
 *
 * @param {object[]} files - arrary of accord files
 *
 * @returns {object[]}
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
    } else {
      file.data = buffer.toString("binary");
    }

    file.valid = true;
  }

  return files;
}
/**
 * Sends the valid accords list to aws OCR endpoint
 *
 * @param {object[]} files - arrary of accord files
 *
 * @returns {object[]}
 */
async function submitAccordsForRecognition(files) {
  for await (const file of files) {
    try {
      const response = await axios.request({
        method: "POST",
        url: "https://ufg7wet2m3.execute-api.us-east-1.amazonaws.com/production/ocr/queue/pdf/accord130/201705",
        data: file.data,
        headers: {
          "Content-Type": "application/pdf",
        },
      });
      file.requestId = response.data?.requestId;
    } catch (error) {
      file.error = error.message;
    }
    
    file.data = null;
  }

  return files;
}

/**
 * Get the accord status and data after OCR request submission
 *
 * @param {object[]} files - arrary of accord files already submitted to the OCR endpoint
 *
 * @returns {object[]}
 */
async function getAccordsStatuses(req, res, next) {
  const files = req.body.accords;
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
    }
  }

  res.send(files);
  next();
}

/**
 * Receives a list of scanned accord files, parse them with an OCR api and then send back the json format version.
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAccordOCR(req, res, next) {
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
  const accords = validateFiles(req.body.files);
  const validFiles = accords.filter(({ valid }) => valid);

  if (validFiles.length === 0) {
    log.info("Bad Request: No valid files received" + __location);
    return next(serverHelper.requestError("Bad Request: No valid files received"));
  }

  // submit accords for OCR recognition
  const result = await submitAccordsForRecognition(validFiles);

  res.send(result);

  next();
}

exports.registerEndpoint = (server, basePath) => {
  server.addPostAuth("POST accord files for OCR", `${basePath}/accord-ocr`, getAccordOCR);
  server.addPostAuth("GET accord files statuses", `${basePath}/accord-ocr/status`, getAccordsStatuses);
};
