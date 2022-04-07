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
        throw new Error(`Cannot find insurer industry code: ${insurerIndustryCode} @ ${insurerId} for territory: ${territory}`)
    }

    return insurerIndustryCodeObj.talageIndustryCodeIdList[0];
}

const convertInsurerActivityCodeToTalageActivityCode = async (insurerId, insurerActivityCode, territory) => {
    const insurerIndustryCodeObj = await InsurerActivityCode.findOne({
        insurerId,
        territoryList: territory,
        code: insurerActivityCode.toString()
    });
    if (!insurerIndustryCodeObj) {
        log.error(`Cannot find insurer activity code: ${insurerActivityCode} @ ${insurerId} for territory: ${territory}`)
        return '';
    }

    return insurerIndustryCodeObj.talageIndustryCodeIdList[0];
}


const cleanLimit = (limit) => limit.replace(',', '').replace('.', '');

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

                status = await axios.request({
                    method: 'GET',
                    url: `https://ck2c645j29.execute-api.us-west-1.amazonaws.com/develop2/ocr/status/${requestId}`
                });
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

    async saveOcrResult(requestId, ocrResult, agencyMetadata) {
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
        const insurerId = 12; //9;

        // -> Compwest Ins
        const applicationUploadObj = {
            appStatusId: 0, // Mark awspplication as incomplete by default
            agencyId: agencyMetadata.agencyId,
            agencyLocationId: agencyMetadata.agencyLocationId,
            agencyNetworkId: agencyMetadata.agencyNetworkId,

            email: data.Email,
            phone: data.Applicant_Office_Phone,
            mailingAddress: getAddressLine1(data.Applicant_Mailing_Address),
            mailingAddress2: getAddressLine2(data.Applicant_Mailing_Address),
            mailingCity: getCity(data.Applicant_Mailing_Address),
            mailingState: getState(data.Applicant_Mailing_Address),
            mailingZipcode: getZip(data.Applicant_Mailing_Address),
            website: data.Website,
            ein: data.FEIN,
            founded: data.Years_In_Business ? moment().subtract(parseInt(data.Years_In_Business, 10), 'years') : undefined,
            businessName: data.Applicant_Name,

            locations: await Promise.all(data.Location.map(async (l) => ({
                address: getAddressLine1(l.Address),
                address2: getAddressLine2(l.Address),
                city: getCity(l.Address),
                state: getState(l.Address),
                zipcode: getZip(l.Address),
                activityPayrollList: await Promise.all(data.Rating.map(async (r) => ({
                    ncciCode: parseInt(r.Class_Code, 10), // Convert to talage NCCI
                    payroll: parseInt(r.Annual_Remuneration.replace(',', ''), 10),
                    activityCodeId: await convertInsurerActivityCodeToTalageActivityCode(insurerId, parseInt(r.Class_Code, 10), getState(l.Address)), // Convert to talage NCCI
                })))
            }))),

            contacts: [{
                firstName: getFirstName(data.Contact_Accounting_Name),
                lastName: getLastName(data.Contact_Accounting_Name),
                email: data.Contact_Accounting_Email,
                phone: data.Contact_Accounting_Office_Phone,
                primary: true, // XXX: change me
            }, {
                firstName: getFirstName(data.Contact_Claims_Name),
                lastName: getLastName(data.Contact_Claims_Name),
                email: data.Contact_Claims_Email,
                phone: data.Contact_Claims_Office_Phone,
                primary: false, // XXX: change me
            }, {
                firstName: getFirstName(data.Contact_Inspection_Name),
                lastName: getLastName(data.Contact_Inspection_Name),
                email: data.Contact_Inspection_Email,
                phone: data.Contact_Inspection_Office_Phone,
                primary: false, // XXX: change me
            }],

            owners: data.Individual.map(i => ({
                fname: getFirstName(i.Name),
                lname: getLastName(i.Name),
                ownership: i.Ownership,
                officerTitle: i.Title.replace('\n', ' '),
                birthdate: i.DOB ? moment(i.DOB) : undefined,
                include: i.Inc_Exc === 'INC',
                activityCodeId: i.Class_Code
            })),

            policies: [{
                policyType: 'WC',
                effectiveDate: moment().format('MM/DD/YYYY'),
                expirationDate: moment(data.Proposed_Exp_Date, 'MM/DD/YYYY'),
                limits: cleanLimit(data.Liability_Disease_Employee) + cleanLimit(data.Liability_Disease_Limit) + cleanLimit(data.Liability_Each_Accident)
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
            await Application.create(applicationUploadObj);
        } catch (ex) {
            console.log(ex);
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

    async getList(query) {
        try {
            const result = await ApplicationUpload.find(query).lean();
            return result || [];
        }
        catch (error) {
            log.error(`Database Error getting OCR list  ${error.message} ${__location}`);
        }
    }
}
