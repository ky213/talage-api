/* eslint-disable no-confusing-arrow */
/* eslint-disable no-undefined */
const axios = require("axios");
const Application = global.mongoose.Application;
const ApplicationUpload = global.mongoose.ApplicationUpload;
const ApplicationUploadStatus = global.mongoose.ApplicationUploadStatus;
const InsurerActivityCode = global.mongoose.InsurerActivityCode;
const IndustryCode = global.mongoose.IndustryCode;
const fs = require('fs');
const moment = require('moment');
const _ = require('lodash');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const IndustryCodeBO = global.requireShared('./models/IndustryCode-BO.js');
const zipcodeHelper = global.requireShared('./helpers/formatZipcode.js');
const crypt = global.requireShared('./services/crypt.js');

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
 * @param {string} addr addr
 * @returns {string} data
 */
const getAddressLine1 = (addr) => addr.split('\n')[0];

/**
 * Extract address 2 from an address formatted as:
 * 7242 Sepulveda Boulevard\n2D\nLos Angeles CA 91405
 * @param {string} addr addr
 * @returns {string} data
 */
const getAddressLine2 = (addr) => {
    const addrSplit = addr.split('\n');
    if (addrSplit.length > 2) {
        return addrSplit[1];
    }
    return;
}

/**
 * Extract the city from an address formatted as:
 * 7242 Sepulveda Boulevard\n2D\nLos Angeles CA 91405
 * @param {string} addr addr
 * @returns {string} data
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
    return;
}

/**
 * Extract the state from an address formatted as:
 * 7242 Sepulveda Boulevard\n2D\nLos Angeles CA 91405
 * @param {string} addr addr
 * @returns {string} data
 */
const getState = (addr) => {
    const addrSplit = addr.split('\n');
    if (addrSplit.length > 1) {
        const lastLineSplit = addrSplit[addrSplit.length - 1].split(' ');
        if (lastLineSplit.length >= 3) {
            return lastLineSplit[lastLineSplit.length - 2].replace(',', '').toUpperCase();
        }
    }
    return;
}

/**
 * Extract the zip from an address formatted as:
 * 7242 Sepulveda Boulevard\n2D\nLos Angeles CA 91405
 * @param {string} addr addr
 * @returns {string} data
 */
const getZip = (addr) => {
    const addrSplit = addr.split('\n');
    if (addrSplit.length > 1) {
        const lastLineSplit = addrSplit[addrSplit.length - 1].split(' ');
        if (lastLineSplit.length >= 3) {
            return lastLineSplit[lastLineSplit.length - 1];
        }
    }
    return;
}

/**
 * Returns whether or not the checkbox has an appropriate parsed value from the OCR.
 * @param {*} value value
 * @returns {boolean} value
 */
const isCheckboxChecked = (value) => !_.isEmpty(value);

const convertNaicsToTalageIndustryCode = async(insurerIndustryCode) => {
    const industryCodeObj = await IndustryCode.findOne({naics: insurerIndustryCode.toString()});
    if (!industryCodeObj || !industryCodeObj?.activityCodeIdList?.[0]) {
        log.warn(`Cannot find insurer industry code: ${insurerIndustryCode}`)
        return;
    }

    return industryCodeObj?.activityCodeIdList?.[0];
}

const convertInsurerActivityCodeToTalageActivityCode = async(insurerId, insurerActivityCode, territory) => {
    const code = insurerActivityCode.split('-');
    const insurerIndustryCodeObj = await InsurerActivityCode.findOne(_.omitBy({
        insurerId: parseInt(insurerId, 10),
        territoryList: territory,
        code: code[0],
        sub: code?.[1],
        active: true
    }, _.isNil));
    if (!insurerIndustryCodeObj) {
        log.warn(`Cannot find insurer activity code: ${insurerActivityCode} @ ${insurerId} for territory: ${territory}`)
        return '';
    }

    // Just pick the first Talage Activity Code mapping.
    return insurerIndustryCodeObj?.talageActivityCodeIdList?.[0];
}

/**
 * Try to format the specifield fieldValue with the specified function formatter. If the
 * formatterFunc fails (i.e., throws an error or returned a rejected promise), then this method
 * will return undefined and log the issue.
 * @param {*} fieldValue fieldValue
 * @param {*} formatterFunc formatterFunc
 * @param {*} defaultValue Optional default value to return. Feel free to leave undefined
 * @returns {*} formatted attempt
 */
const tryToFormat = async(fieldValue, formatterFunc, defaultValue) => {
    try {
        return await formatterFunc(fieldValue);
    }
    catch (ex) {
        // Retrieve the name of the method and line number that called this function.
        const err = new Error();
        const stack = err.stack.split('\n');
        const prevMethod = stack[3].trim().replace('at ', '');

        // additionalInfo.push(`Bad validation for field: ${prevMethod} ${fieldValue}`);
        log.warn(`Bad validation for field: ${prevMethod} ${fieldValue}`);
        return defaultValue;
    }
}

const cleanLimit = (limit) => limit.replace(/,/g, '').replace(/\./g, '').replace(/\s/g, '');

module.exports = class ApplicationUploadBO {
    async submitFile(metadata, fileType, acordFile) {
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

        // Do not allow files greater than 4 MBs.
        if (fileData.byteLength > 4_000_000) {
            throw new Error(`${acordFile.name} / ${fileType}: file size should not exceed 4 MBs.`);
        }

        // Submit Acord file to OCR.
        let requestId = '';
        try {
            const response = await axios.request({
                method: "POST",
                url: `https://${global.settings.ENV}ocrapi.internal.talageins.com/ocr/queue/${fileType}`,
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
                agencyLocationId: metadata?.agencyLocationId,
                agencyNetworkId: metadata.agencyNetworkId,
                agencyId: metadata?.agencyId,
                insurerId: metadata?.insurerId,
                tag: metadata?.tag,
                markAsPending: metadata?.markAsPending,
                requestId: requestId,
                status: 'QUEUED',
                fileName: acordFile.name,
                type: fileType,
                agencyPortalUserId: metadata?.agencyPortalUserId,
                advanceDate: metadata?.advanceDate
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
     * @param {string} requestId OCR Request ID
     * @returns {string} OCR data status
     */
    async getOcrResult(requestId) {
        let status = {};
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
                        url: `https://${global.settings.ENV}ocrapi.internal.talageins.com/ocr/status/${requestId}`
                    });
                }
                catch (ex) {
                    //timeouts might be fluke
                    if (!_.get(ex, 'message', '').contains('TIMEOUT')) {
                        throw ex;
                    }
                }
            } while (status.data.status === 'QUEUED');
        }
        catch (error) {
            try {
                await ApplicationUploadStatus.updateOne({requestId: requestId}, {status: 'ERROR'});
            }
            catch (err) {
                log.error(`Error setting OCR status to ERROR. requestId: ${requestId}`);
            }
            log.error(`Error retrieving OCR result. File: ${error.message}, Error: ${error.message} @ ${__location}`);
        }
        return status.data;
    }

    /**
     *
     * @param {*} requestId requestId
     * @param {*} ocrResult ocrResult
     * @param {*} agencyMetadata agencyMetadata
     * @param {*} doCreateInApplicationUpload Whether or not to save this application in ApplicationUpload or Application collection.
     * @returns {void}
     */
    async saveOcrResult(requestId, ocrResult, agencyMetadata, doCreateInApplicationUpload = true) {
        const data = {};
        for (const k of ocrResult.ocrResponse) {
            _.set(data, k.question, k.answer);
        }

        await ApplicationUploadStatus.updateOne({requestId: requestId}, {status: 'SUCCESS'});

        // filter out blank entries that OCR might've given us.
        data.Individual = data.Individual.filter(t => t.Name !== '');
        data.Location = data.Location.filter(t => t.Address !== '');
        data.Rating = data.Rating.filter(r => r.Class_Code !== '' && r.Categories !== '');

        // XXX: Auto-generate this later.
        const insurerId = agencyMetadata.insurerId || 9;

        const additionalInfo = [];

        const checkIfRealOwner = (ownerInfo) => {
            const fname = ownerInfo.fname.replace(/[^a-z0-9]/gi, '').trim();
            const lname = ownerInfo.lname.replace(/[^a-z0-9]/gi, '').trim();
            if (fname !== '' && lname !== '') {
                return ownerInfo;
            }
            else {
                return undefined;
            }
        }

        // -> Compwest Ins
        let applicationUploadObj = {
            additionalInfo: {
                validationErrors: additionalInfo,
                ocrRequestId: requestId
            },
            active: true,
            agencyPortalCreated: true,
            appStatusId: 0, // Mark awspplication as incomplete by default
            agencyId: agencyMetadata.agencyId,
            agencyLocationId: agencyMetadata.agencyLocationId,
            agencyNetworkId: agencyMetadata.agencyNetworkId,
            tagString: agencyMetadata.tag,

            email: data.Email,
            phone: data.Applicant_Office_Phone,
            mailingAddress: await tryToFormat(data.Applicant_Mailing_Address, async(v) => getAddressLine1(v)),
            mailingAddress2: await tryToFormat(data.Applicant_Mailing_Address, async(v) => getAddressLine2(v)),
            mailingCity: await tryToFormat(data.Applicant_Mailing_Address, async(v) => getCity(v)),
            mailingState: await tryToFormat(data.Applicant_Mailing_Address, async(v) => getState(v)),
            mailingZipcode: await tryToFormat(data.Applicant_Mailing_Address, async(v) => getZip(v)),
            website: data.Website,
            ein: data.FEIN,
            founded: await tryToFormat(data.Years_In_Business, async(v) => v ? moment().subtract(parseInt(v, 10), 'years').month(11).date(31) : undefined),
            businessName: data.Applicant_Name,

            locations: await Promise.all(data.Location.map(async(l) => ({
                address: await tryToFormat(l.Address, async(v) => getAddressLine1(v)),
                address2: await tryToFormat(l.Address, async(v) => getAddressLine2(v)),
                city: await tryToFormat(l.Address, async(v) => getCity(v)),
                state: await tryToFormat(l.Address, async(v) => getState(v)),
                zipcode: await tryToFormat(l.Address, async(v) => getZip(v)),
                activityPayrollList: await Promise.all(data.Rating.map(async(r) => ({
                    // ncciCode: await tryToFormat(r.Class_Code, async(v) => parseInt(v, 10)), // Convert to talage NCCI
                    payroll: await tryToFormat(r.Annual_Remuneration, async(v) => {
                        const out = parseInt(v.replace(',', ''), 10);
                        if (isNaN(out)) {
                            return 0;
                        }
                        return out;
                    }, 0),
                    activityCodeId: await tryToFormat([r.Class_Code, l.Address], () => convertInsurerActivityCodeToTalageActivityCode(insurerId, r.Class_Code, getState(l.Address) || getState(data.Applicant_Mailing_Address))) // Convert to talage NCCI
                })))
            }))),

            contacts: [{
                firstName: await tryToFormat(data.Contact_Inspection_Name, async(v) => getFirstName(v)),
                lastName: await tryToFormat(data.Contact_Inspection_Name, async(v) => getLastName(v)),
                email: data.Contact_Inspection_Email,
                phone: data.Contact_Inspection_Office_Phone,
                primary: false
            },
            {
                firstName: await tryToFormat(data.Contact_Accounting_Name, async(v) => getFirstName(v)),
                lastName: await tryToFormat(data.Contact_Accounting_Name, async(v) => getLastName(v)),
                email: data.Contact_Accounting_Email,
                phone: data.Contact_Accounting_Office_Phone,
                primary: false
            },
            {
                firstName: await tryToFormat(data.Contact_Claims_Name, async(v) => getFirstName(v)),
                lastName: await tryToFormat(data.Contact_Claims_Name, async(v) => getLastName(v)),
                email: data.Contact_Claims_Email,
                phone: data.Contact_Claims_Office_Phone,
                primary: false
            }],

            owners: await Promise.all(data.Individual.map(async(i) => checkIfRealOwner({
                fname: getFirstName(i.Name),
                lname: getLastName(i.Name),
                ownership: await tryToFormat(i.Ownership, async(v) => parseInt(v, 10)),
                officerTitle: i.Title.replace('\n', ' '),
                // eslint-disable-next-line
                birthdate: await tryToFormat(i.DOB, async(v) => v ? moment(v) : ''),
                include: i.Inc_Exc === 'INC',
                activityCodeId: await tryToFormat(i.Class_Code, () => convertInsurerActivityCodeToTalageActivityCode(insurerId, parseInt(i.Class_Code, 10), getState(data.Applicant_Mailing_Address))) // Convert to talage NCCI
            }))),

            policies: [{
                policyType: 'WC',
                effectiveDate: await tryToFormat(data.Policy_Proposed_Eff_Date, async(v) => v ? moment(v, 'MM/DD/YYYY') : undefined),
                expirationDate: await tryToFormat(data.Proposed_Exp_Date, async(v) => v ? moment(v, 'MM/DD/YYYY') : undefined),
                limits: await tryToFormat(data.Liability_Disease_Employee, async(v) => cleanLimit(v)) +
                    await tryToFormat(data.Liability_Disease_Limit, async(v) => cleanLimit(v)) +
                    await tryToFormat(data.Liability_Each_Accident, async(v) => cleanLimit(v))
            }]

            // yearsOfExp: data['Years In Business'],
            // businessPersonalPropertyLimit: ,
            // // buildingLimit: ,
        };

        // remove blank contacts from the list.
        applicationUploadObj.contacts = applicationUploadObj.contacts.filter(t => !_.isEmpty(t.firstName) || !_.isEmpty(t.lastName));
        applicationUploadObj.owners = applicationUploadObj.owners.filter(t => !_.isNil(t));

        // If the user checked the advanceDate checkbox.
        if (agencyMetadata?.advanceDate) {
            applicationUploadObj.policies[0].effectiveDate = await tryToFormat(data.Policy_Proposed_Eff_Date, async(v) => v ? moment(v, 'MM/DD/YYYY').add(1, 'year') : undefined);
            applicationUploadObj.policies[0].expirationDate = await tryToFormat(data.Proposed_Exp_Date, async(v) => v ? moment(v, 'MM/DD/YYYY').add(1, 'year') : undefined);
        }

        if (applicationUploadObj?.contacts?.[0]) {
            applicationUploadObj.contacts[0].primary = true;
        }
        if (applicationUploadObj?.locations?.[0]) {
            applicationUploadObj.locations[0].primary = true;
        }

        if (applicationUploadObj.ein) {
            applicationUploadObj.hasEin = true;
            applicationUploadObj.einEncrypted = await crypt.encrypt(applicationUploadObj.ein);
            applicationUploadObj.einEncryptedT2 = await crypt.encrypt(applicationUploadObj.ein);
            applicationUploadObj.einHash = await crypt.hash(applicationUploadObj.ein);
        }

        if (data.NAICS) {
            applicationUploadObj.industryCode = await convertNaicsToTalageIndustryCode(parseInt(data.NAICS, 10));
        }
        if (isCheckboxChecked(data.Corporation)) {
            applicationUploadObj.entityType = 'Corporation';
        }
        try {
            // Remove keys with undefined value
            applicationUploadObj = JSON.parse(JSON.stringify(applicationUploadObj));
            if (doCreateInApplicationUpload) {
                await ApplicationUpload.create(applicationUploadObj);
            }
            else {
                await Application.create(applicationUploadObj);
            }
        }
        catch (ex) {
            log.error("Error  saveOcrResult " + ex.message + __location);
        }
    }

    async moveToApplication(pendingApplicationId) {
        try {
            const applicationUploadObj = await ApplicationUpload.findOne({applicationId: pendingApplicationId}).lean();
            if(applicationUploadObj){
                if(!applicationUploadObj.additionalInfo) {
                    applicationUploadObj.additionalInfo = {};
                }
                applicationUploadObj.additionalInfo.movedFromApplicationUploadId = applicationUploadObj._id;
                applicationUploadObj.createdAt = new Date();
                applicationUploadObj.updatedAt = new Date();
                await Application.create(applicationUploadObj);
                await ApplicationUpload.updateOne({applicationId: pendingApplicationId}, {
                    active: false,
                    updatedAt: new Date()
                });
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

    async updateOne(pendingApplicationId, data) {
        try {
            await ApplicationUpload.updateOne({applicationId: pendingApplicationId}, {
                ...data,
                updatedAt: new Date()
            });
        }
        catch (error) {
            log.error(`Database Error updating OCR app ${pendingApplicationId} ${error.message} ${__location}`);
        }
    }

    async deleteSoftById(pendingApplicationId) {
        try {
            await ApplicationUpload.updateOne({applicationId: pendingApplicationId}, {
                updatedAt: new Date(),
                active: false
            });
        }
        catch (error) {
            log.error(`Database Error deleting OCR app ${pendingApplicationId} ${error.message} ${__location}`);
        }
    }

    async getList(queryJSON, orParamList, requestParams, isGlobalViewMode = false) {
        try {
            const query = {...queryJSON};
            if(orParamList && orParamList?.length > 0){
                for (let i = 0; i < orParamList.length; i++){
                    const orItem = orParamList[i];
                    for (var key2 in orItem) {
                        if (typeof orItem[key2] === 'string' && orItem[key2].includes('%')) {
                            let clearString = orItem[key2].replace("%", "");
                            clearString = clearString.replace("%", "");
                            orItem[key2] = {
                                "$regex": clearString,
                                "$options": "i"
                            };
                        }
                    }
                }
                query.$or = orParamList
            }
            if(requestParams?.count){
                const result = await ApplicationUpload.countDocuments(query).lean();
                return result || 0;
            }
            else {
                const queryProjection = {
                    uuid: 1,
                    applicationId: 1,
                    mysqlId:1,
                    status: 1,
                    appStatusId:1,
                    agencyId:1,
                    agencyNetworkId:1,
                    createdAt: 1,
                    solepro: 1,
                    wholesale: 1,
                    businessName: 1,
                    industryCode: 1,
                    mailingAddress: 1,
                    mailingCity: 1,
                    mailingState: 1,
                    mailingZipcode: 1,
                    handledByTalage: 1,
                    policies: 1,
                    quotingStartedDate: 1,
                    renewal: 1,
                    metrics: 1
                };
                const queryOptions = {
                    sort: {},
                    limit: 100
                };
                queryOptions.sort = {};
                if (requestParams?.sort) {
                    if(requestParams.sort === 'date') {
                        requestParams.sort = 'createdAt';
                    }
                    queryOptions.sort[requestParams.sort] = requestParams.sortDescending ? -1 : 1;
                }
                else {
                    queryOptions.sort.createdAt = -1;
                }
                if(requestParams?.limit && !isNaN(requestParams.limit)) {
                    queryOptions.limit = Number.parseInt(`${requestParams.limit}`, 10);
                }
                if(requestParams?.page && !isNaN(requestParams.page)) {
                    queryOptions.skip = queryOptions.limit * Number.parseInt(`${requestParams.page}`, 10);
                }
                const docList = await ApplicationUpload.find(query, queryProjection, queryOptions).lean();
                let agencyNetworkList = false;
                if(isGlobalViewMode){
                    const agencyNetworkBO = new AgencyNetworkBO();
                    agencyNetworkList = await agencyNetworkBO.getList({});
                }
                if(docList?.length > 0){
                    //loop doclist adding agencyName
                    const agencyBO = new AgencyBO();
                    const agencyMap = {};
                    for (const application of docList) {
                        application.id = application.applicationId;
                        delete application._id;
                        if(application.mailingCity && application.mailingZipcode?.length > 4){
                            const zipcode = zipcodeHelper.formatZipcode(application.mailingZipcode);
                            application.location = `${application.mailingCity}, ${application.mailingState} ${zipcode} `
                        }
                        else if(application.mailingCity){
                            application.location = `${application.mailingCity}, ${application.mailingState} `
                        }
                        else {
                            application.location = "";
                        }
                        if(isGlobalViewMode){
                            const agencyNetworkDoc = agencyNetworkList.find((an) => an.agencyNetworkId === application.agencyNetworkId);
                            if(agencyNetworkDoc){
                                application.agencyNetworkName = agencyNetworkDoc.name;
                            }
                        }
                        // Load the request data into it
                        if(agencyMap[application.agencyId]){
                            // If Agency exists in agencyMap, get name and tierName
                            application.agencyName = agencyMap[application.agencyId].name;
                            application.agencyTierName = agencyMap[application.agencyId].tierName;
                            application.agencyCreatedAt = agencyMap[application.agencyId].createdAt;
                        }
                        else {
                            const returnReturnAgencyNetwork = false;
                            const returnDeleted = true
                            const agency = await agencyBO.getById(application.agencyId, returnReturnAgencyNetwork, returnDeleted).catch(function(err) {
                                log.error(`Agency load error appId ${application.applicationId} ` + err + __location);
                            });
                            if (agency) {
                                application.agencyName = agency.name;
                                application.agencyTierName = agency.tierName;
                                application.agencyCreatedAt = agency.createdAt;
                                // Store both the Name and the Tier Name of the Agency in agencyMap
                                agencyMap[application.agencyId] = {};
                                agencyMap[application.agencyId].name = agency.name;
                                agencyMap[application.agencyId].tierName = agency.tierName;
                                agencyMap[application.agencyId].createdAt = agency.createdAt;

                            }
                        }
                        const agencyLocationBO = new AgencyLocationBO();
                        if(application.agencyLocationId){
                            const agencyLoc = await agencyLocationBO.getById(application.agencyLocationId).catch(function(err) {
                                log.error(`Agency Location load error appId ${application.applicationId} ` + err + __location);
                            });
                            if (agencyLoc) {
                                application.agencyState = agencyLoc.state;
                            }
                        }

                        //industry desc
                        const industryCodeBO = new IndustryCodeBO();
                        // Load the request data into it
                        if(application.industryCode > 0){
                            const industryCodeJson = await industryCodeBO.getById(application.industryCode).catch(function(err) {
                                log.error(`Industry code load error appId ${application.applicationId} industryCode ${application.industryCode} ` + err + __location);
                            });
                            if(industryCodeJson){
                                application.industry = industryCodeJson.description;
                                application.naics = industryCodeJson.naics;
                            }
                        }
                        //bring policyType to property on top level.
                        if(application.policies?.length > 0){
                            let policyTypesString = "";
                            let effectiveDate = moment("2100-12-31")
                            application.policies.forEach((policy) => {
                                if(policyTypesString && policyTypesString.length > 0){
                                    policyTypesString += ","
                                }
                                policyTypesString += policy.policyType;
                                if(policy.effectiveDate < effectiveDate){
                                    effectiveDate = policy.effectiveDate
                                }
                            });
                            application.policyTypes = policyTypesString;
                            application.policyEffectiveDate = effectiveDate;
                        }
                    }
                }
                return docList || [];
            }
        }
        catch (error) {
            log.error(`Database Error getting OCR list  ${error.message} ${__location}`);
            return [];
        }
    }
}
