const axios = require("axios");
const Application = global.mongoose.Application;
const ApplicationUpload = global.mongoose.ApplicationUpload;
const ApplicationUploadStatus = global.mongoose.ApplicationUploadStatus;
const InsurerIndustryCode = global.mongoose.InsurerIndustryCode;
const InsurerActivityCode = global.mongoose.InsurerActivityCode;
const fs = require('fs');
const moment = require('moment');
const _ = require('lodash');

const getFirstName = (name) => {
    const nameSplit = name.split(' ');
    return nameSplit[0];
}

const getLastName = (name) => {
    const nameSplit = name.split(' ');
    if (nameSplit <= 1) {
        return '';
    }
    return nameSplit[nameSplit.length - 1];
}

/**
 * Extract address 1 from an address formatted as:
 * 7242 Sepulveda Boulevard\n2D\nLos Angeles CA 91405
 */
const getAddressLine1 = (addr) => {
    return addr.split('\n')[0];
}

/**
 * Extract address 2 from an address formatted as:
 * 7242 Sepulveda Boulevard\n2D\nLos Angeles CA 91405
 */
const getAddressLine2 = (addr) => {
    const addrSplit = addr.split('\n');
    if (addrSplit.length > 2) {
        return addrSplit[1];
    }
    return undefined;
}

/**
 * Extract the city from an address formatted as:
 * 7242 Sepulveda Boulevard\n2D\nLos Angeles CA 91405
 */
const getCity = (addr) => {
    const addrSplit = addr.split('\n');
    if (addrSplit.length > 1) {
        const lastLineSplit = addrSplit[addrSplit.length - 1].split(' ');
        if (lastLineSplit.length < 3) {
            return ''
        }
        let city = '';
        // City and state fields are the last 2 words, so ignore those.
        for (let i = 0; i < lastLineSplit.length - 2; i++) {
            city += ' ' + lastLineSplit[i];
        }
        return city.trim();

    }
    return undefined;
}

/**
 * Extract the state from an address formatted as:
 * 7242 Sepulveda Boulevard\n2D\nLos Angeles CA 91405
 */
const getState = (addr) => {
    const addrSplit = addr.split('\n');
    if (addrSplit.length > 1) {
        const lastLineSplit = addrSplit[addrSplit.length - 1].split(' ');
        if (lastLineSplit.length >= 3) {
            return lastLineSplit[lastLineSplit.length - 2].replace(',', '').toUpperCase();
        }
    }
    return undefined;
}

/**
 * Extract the zip from an address formatted as:
 * 7242 Sepulveda Boulevard\n2D\nLos Angeles CA 91405
 */
const getZip = (addr) => {
    const addrSplit = addr.split('\n');
    if (addrSplit.length > 1) {
        const lastLineSplit = addrSplit[addrSplit.length - 1].split(' ');
        if (lastLineSplit.length >= 3) {
            return lastLineSplit[lastLineSplit.length - 1];
        }
    }
    return undefined;
}

const convertInsurerIndustryCodeToTalageIndustryCode = async (insurerId, insurerIndustryCode, territory) => {
    const insurerIndustryCodeObj = await InsurerIndustryCode.findOne({
        insurerId,
        territoryList: territory,
        code: insurerIndustryCode.toString()
    });
    if (!insurerIndustryCodeObj) {
        log.error(`Cannot find insurer industry code: ${insurerIndustryCode} @ ${insurerId} for territory: ${territory}`)
        return undefined;
    }

    return insurerIndustryCodeObj.talageIndustryCodeIdList[0];
}

const convertInsurerActivityCodeToTalageActivityCode = async (insurerId, insurerActivityCode, territory) => {
    const insurerIndustryCodeObj = await InsurerActivityCode.findOne({
        insurerId: insurerId,
        territoryList: territory,
        code: insurerActivityCode.toString()
    });
    if (!insurerIndustryCodeObj) {
        log.error(`Cannot find insurer activity code: ${insurerActivityCode} @ ${insurerId} for territory: ${territory}`)
        return '';
    }

    // Just pick the first Talage Activity Code mapping.
    return _.get(insurerIndustryCodeObj, 'talageActivityCodeIdList[0]');
}

/**
 * Try to format the specifield fieldValue with the specified function formatter. If the
 * formatterFunc fails (i.e., throws an error or returned a rejected promise), then this method
 * will return undefined and log the issue.
 * @param {*} fieldValue 
 * @param {*} formatterFunc 
 * @returns 
 */
const tryToFormat = async (fieldValue, formatterFunc) => {
    try {
        return await formatterFunc(fieldValue);
    } catch (ex) {
        // Retrieve the name of the method and line number that called this function.
        const err = new Error();
        const stack = err.stack.split('\n');
        const prevMethod = stack[2].trim().replace('at ', '');

        // additionalInfo.push(`Bad validaion for field: ${prevMethod} ${fieldValue}`);
        log.warn(`Bad validaion for field: ${prevMethod} ${fieldValue}`);
        console.log(`Bad validaion for field: ${prevMethod} ${fieldValue}`);
        return undefined;
    }
}

const cleanLimit = (limit) => limit.replaceAll(',', '').replaceAll('.', '');

module.exports = class ApplicationUploadBO {
    async submitFile(agency, fileType, acordFile) {
        // Check emptiness
        // if (!acordFile.data) {
        //     throw new Error(`${acordFile.name}: is empty.`);
        // }

        // Check file extension
        if (!acordFile.name.endsWith(".pdf") && acordFile.extension !== "pdf") {
            throw new Error(`${acordFile.name}: must have PDF extension.`);
        }

        // Must only use certain file types.
        if (fileType !== 'pdf/acord130/201705') {
            throw new Error(`${acordFile.name} / ${fileType}: Invalid file type.`);
        }

        //Check file size
        const fileData = fs.readFileSync(acordFile.path);

        // XXX Roger: Why is this here?
        // if (buffer.byteLength > 2_000_000) {
        //     //2 MBs max
        //     throw new Error(`${acordFile.name} / ${fileType}: file size should not exceed 2 MBs.`);
        // }

        // Submit Accord file to OCR.
        let requestId = '';
        try {
            const url = `https://ck2c645j29.execute-api.us-west-1.amazonaws.com/develop2/ocr/queue/${fileType}`;
            const response = await axios.request({
                method: "POST",
                url: url,
                data: fileData,
                headers: {"Content-Type": "application/pdf"}
            });
            requestId = response.data?.requestId;
        }
        catch (error) {
            log.error(`OCR Error submiting file: ${acordFile.name} ${error.message} ${__location}`);
            throw new Error(`OCR Error submiting file: ${acordFile.name} ${error.message} ${__location}`);
        }

        try {
            await ApplicationUploadStatus.create({
                agencyId: agency?.agencyId,
                agencyNetworkId: agency.agencyNetworkId,
                requestId: requestId,
                status: 'QUEUED',
                fileName: acordFile.name,
                type: fileType
            });
        }
        catch (error) {
            log.error(`Error saving application ${acordFile.name} ${error.message} ${__location}`);
            throw new Error(`Error saving application ${acordFile.name} ${error.message} ${__location}`);
        }

        return requestId;
    }

    /**
     * Waits for OCR to finish and then returns the result. Throws an error if an error occurs
     * during the OCR process or if we timeout.
     */
    async getOcrResult(requestId) {
        let status;
        try {
            let i = 0;
            do {
                if (i++ > 200) {
                    throw new Error('timeout');
                }
                // Go to sleep for 5 seconds
                await new Promise(r => setTimeout(r, 5000));

                try {
                    status = await axios.request({
                        method: 'GET',
                        url: `https://ck2c645j29.execute-api.us-west-1.amazonaws.com/develop2/ocr/status/${requestId}`
                    });
                } catch (ex) {
                    //timeouts might be fluke
                    if (!ex.message.contains('TIMEOUT')) {
                        throw ex;
                    }
                }
                console.log('Still queued... waiting...');
            } while (status.data.status === 'QUEUED');
        } catch (error) {
            try {
                await ApplicationUploadStatus.updateOne({requestId: requestId}, {status: 'ERROR'});
            } catch (err) {
                log.error(`Error setting OCR status to ERROR. requestId: ${requestId}`);
            }
            log.error(`Error retrieving OCR result. File: ${error.message}, Error: ${error.message} @ ${__location}`);
            console.log(error);
        }
        return status.data;
    }

    /**
     * 
     * @param {*} requestId 
     * @param {*} ocrResult 
     * @param {*} agencyMetadata 
     * @param {*} doCreateInApplicationUpload Whether or not to save this application in ApplicationUpload or Application collection.
     */
    async saveOcrResult(requestId, ocrResult, agencyMetadata, doCreateInApplicationUpload = true) {
        await ApplicationUploadStatus.updateOne({ requestId: requestId }, { status: 'SUCCESS'});

        let data = {};
        for (const k of ocrResult.ocrResponse) {
            _.set(data, k.question, k.answer);
        }

        // filter out blank entries that OCR might've given us.
        data.Individual = data.Individual.filter(t => t.Name !== '');
        data.Location = data.Location.filter(t => t.Address !== '');
        data.Rating = data.Rating.filter(r => r.Class_Code !== '' && r.Categories !== '');

        // XXX: Auto-generate this later.
        const insurerId = agencyMetadata.insurerId || 9;

        const additionalInfo = [];

        // -> Compwest Ins
        let applicationUploadObj = {
            additionalInfo: {
                validationErrors: additionalInfo,
                ocrRequestId: requestId
            },
            appStatusId: 0, // Mark awspplication as incomplete by default
            agencyId: agencyMetadata.agencyId,
            agencyLocationId: agencyMetadata.agencyLocationId,
            agencyNetworkId: agencyMetadata.agencyNetworkId,

            email: data.Email,
            phone: data.Applicant_Office_Phone,
            mailingAddress: await tryToFormat(data.Applicant_Mailing_Address, async (v) => getAddressLine1(v)),
            mailingAddress2: await tryToFormat(data.Applicant_Mailing_Address, async (v) => getAddressLine2(v)),
            mailingCity: await tryToFormat(data.Applicant_Mailing_Address, async (v) => getCity(v)),
            mailingState: await tryToFormat(data.Applicant_Mailing_Address, async (v) => getState(v)),
            mailingZipcode: await tryToFormat(data.Applicant_Mailing_Address, async (v) => getZip(v)),
            website: data.Website,
            ein: data.FEIN,
            founded: await tryToFormat(data.Years_In_Business, async (v) => moment().subtract(parseInt(v, 10), 'years')),
            businessName: data.Applicant_Name,

            locations: await Promise.all(data.Location.map(async (l) => ({
                address: await tryToFormat(l.Address, async (v) => getAddressLine1(v)),
                address2: await tryToFormat(l.Address, async (v) => getAddressLine2(v)),
                city: await tryToFormat(l.Address, async (v) => getCity(v)),
                state: await tryToFormat(l.Address, async (v) => getState(v)),
                zipcode: await tryToFormat(l.Address, async (v) => getZip(v)),
                activityPayrollList: await Promise.all(data.Rating.map(async (r) => ({
                    ncciCode: await tryToFormat(r.Class_Code, async (v) => parseInt(v, 10)), // Convert to talage NCCI
                    payroll: await tryToFormat(r.Annual_Remuneration, async (v) => parseInt(v.replace(',', ''), 10)),
                    activityCodeId: await tryToFormat([r.Class_Code, l.Address], () => convertInsurerActivityCodeToTalageActivityCode(insurerId, parseInt(r.Class_Code, 10), getState(l.Address))), // Convert to talage NCCI
                })))
            }))),

            contacts: [{
                firstName: await tryToFormat(data.Contact_Accounting_Name, async (v) => getFirstName(v)),
                lastName: await tryToFormat(data.Contact_Accounting_Name, async (v) => getLastName(v)),
                email: data.Contact_Accounting_Email,
                phone: data.Contact_Accounting_Office_Phone,
                primary: true, // XXX: change me
            },
            {
                firstName: await tryToFormat(data.Contact_Claims_Name, async (v) => getFirstName(v)),
                lastName: await tryToFormat(data.Contact_Claims_Name, async (v) => getLastName(v)),
                email: data.Contact_Claims_Email,
                phone: data.Contact_Claims_Office_Phone,
                primary: false, // XXX: change me
            },
            {
                firstName: await tryToFormat(data.Contact_Inspection_Name, async (v) => getFirstName(v)),
                lastName: await tryToFormat(data.Contact_Inspection_Name, async (v) => getLastName(v)),
                email: data.Contact_Inspection_Email,
                phone: data.Contact_Inspection_Office_Phone,
                primary: false, // XXX: change me
            }],

            owners: await Promise.all(data.Individual.map(async (i) => ({
                fname: getFirstName(i.Name),
                lname: getLastName(i.Name),
                ownership: i.Ownership,
                officerTitle: i.Title.replace('\n', ' '),
                birthdate: await tryToFormat(i.DOB, async (v) => i.DOB ? moment(i.DOB) : ''),
                include: i.Inc_Exc === 'INC',
                activityCodeId: i.Class_Code
            }))),

            policies: [{
                policyType: 'WC',
                effectiveDate: moment().format('MM/DD/YYYY'),
                expirationDate: await tryToFormat(data.Proposed_Exp_Date, async (v) => moment(v, 'MM/DD/YYYY')),
                limits: await tryToFormat(data.Liability_Disease_Employee, async (v) => cleanLimit(v)) +
                    await tryToFormat(data.Liability_Disease_Limit, async (v) => cleanLimit(v)) +
                    await tryToFormat(data.Liability_Each_Accident, async (v) => cleanLimit(v))
            }],

            // yearsOfExp: data['Years In Business'],
            // businessPersonalPropertyLimit: ,
            // // buildingLimit: ,

            // requestId: requestId,
            // form: ocrResult.form,
            // questions: ocrResult.ocrResponse
        };

        if (data.NAICS) {
            applicationUploadObj.industryCode = await convertInsurerIndustryCodeToTalageIndustryCode(insurerId,
                parseInt(data.NAICS, 10),
                applicationUploadObj.mailingState
            );
        }
        if (data.Corporation === 'X') {
            applicationUploadObj.entityType = 'Corporation';
        }
        try {
            console.log('FINAL hitz', applicationUploadObj);
            // await ApplicationUpload.create(applicationUploadObj)
            if (doCreateInApplicationUpload) {
                applicationUploadObj.movedToApplication = false;
                await ApplicationUpload.create(applicationUploadObj);
            } else {
                await Application.create(applicationUploadObj);
            }
        } catch (ex) {
            console.log(ex);
        }
    }

    async moveToApplication(pendingApplicationId) {
        try {
            const applicationUploadObj = await ApplicationUpload.findOne({pendingApplicationId: pendingApplicationId}).lean;
            if(applicationUploadObj){
                if(!applicationUploadObj.additionalInfo) {
                    applicationUploadObj.additionalInfo = {};
                }
                applicationUploadObj.additionalInfo.movedFromApplicationUploadId = pendingApplicationId;
                if(applicationUploadObj.moveToApplication || applicationUploadObj.movedToApplication === false || applicationUploadObj.movedToApplication === null) {
                    delete applicationUploadObj.moveToApplication;
                }
                await Application.create(applicationUploadObj);
                await Application.updateOne({pendingApplicationId: pendingApplicationId}, {movedToApplication: true});
            }
            else {
                throw new Error('Pending Application not found');
            }
        }
        catch (error){
            log.error(`Database Error moving pending application  ${error.message} ${__location}`);
            throw error;
        }
    }

    async updateOne(applicationId, data) {
        try {
            await ApplicationUpload.updateOne({applicationId: applicationId}, {...data});
        }
        catch (error) {
            log.error(`Database Error updating OCR app ${applicationId} ${error.message} ${__location}`);
        }
    }

    async deleteOne(applicationId) {
        try {
            await ApplicationUpload.deleteOne({applicationId: applicationId});
        }
        catch (error) {
            log.error(`Database Error deleting OCR app ${applicationId} ${error.message} ${__location}`);
        }
    }

    async getList(query) {
        try {
            const result = await ApplicationUpload.find(query).lean();
            return result || [];
        }
        catch (error) {
            log.error(`Database Error getting OCR list  ${error.message} ${__location}`);
            return [];
        }
    }
}
