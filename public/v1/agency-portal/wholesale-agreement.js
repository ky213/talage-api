'use strict';

//const crypt = global.requireShared('./services/crypt.js');
const serverHelper = global.requireRootPath('server.js');
const docusign = global.requireShared('./services/docusign.js');

// DocuSign template IDs
const productionDocusignWholesaleAgreementTemplate = '7143efde-6013-4f4a-b514-f43bc8e97a63';
const stagingDocusignWholesaleAgreementTemplate = '5849d7ae-1ee1-4277-805a-248fd4bf71b7';
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');

/**
 * Mark the wholesale agreement as 'read' for an agent
 *
 * @param {Number} agencyID - Agency ID
 *
 * @returns {Boolean} true = success, false = error. Errors have already been logged.
 */
async function SetWholesaleAgreementAsSigned(agencyID) {
    try {
        const agencyBO = new AgencyBO();
        // Load the request data into it
        await agencyBO.setWholesaleAgreementAsSigned(agencyID);
    }
    catch (error) {
        log.error(`Could not set the wholesale agreement as read for agent ${agencyID}: ${error} ${__location}`);
        return false;
    }
    return true;
}

/**
 * Retrieves the link that will allow a single user to sign the wholesaleAgreement
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getWholesaleAgreementLink(req, res, next) {
    // Make sure this is not an agency network
    if (req.authentication.isAgencyNetworkUser !== false) {
        log.warn('Agency Networks cannot sign Wholesale Agreements');
        return next(serverHelper.forbiddenError('Agency Networks cannot sign Wholesale Agreements'));
    }

    const agencyID = req.authentication.agents[0];
    // Check if they have already signed
    const agencyBO = new AgencyBO();
    let agentInfo = null;
    try{
        agentInfo = await agencyBO.getById(agencyID);
    }
    catch (err) {
        log.error(`Could not get agency information: ${err} ${__location}`);
        return next(serverHelper.internalError('Could not get agency information'));
    }


    if (agentInfo.wholesale_agreement_signed !== null) {
        res.send(200, {
            status: 'success',
            signed: true,
            signingUrl: null
        });
        return next();
    }


    const user = req.authentication.userID;
    const name = `${agentInfo.firstName} ${agentInfo.lastName}`;
    const email = agentInfo.email;
    const template = global.settings.ENV === 'production' ? productionDocusignWholesaleAgreementTemplate : stagingDocusignWholesaleAgreementTemplate;
    //Get AgencyNetworkBO settings
    let error = null;
    const agencyNetworkBO = new AgencyNetworkBO();
    const agencyNetworkEnvSettings = await agencyNetworkBO.getEnvSettingbyId(agentInfo.agency_network).catch(function(err){
        log.error(`Unable to get env settings for New Agency Portal User. agency_network: ${agentInfo.agency_network}.  error: ${err}` + __location);
        error = true;
    });
    if(error){
        return false;
    }
    if(!agencyNetworkEnvSettings || !agencyNetworkEnvSettings.PORTAL_URL){
        log.error(`Unable to get env settings for New Agency Portal User. agency_network: ${agentInfo.agency_network}.  missing additionalInfo ` + __location);
        return false;
    }
    const returnUrl = `${agencyNetworkEnvSettings.PORTAL_URL}/wholesale-agreement`;

    // Check if the user has signed. If they have, then don't have them sign again.
    if (agentInfo.docusignEnvelopeId !== null && await docusign.userHasSigned(user, agentInfo.docusign_envelope_id)) {
        // If it isn't, mark it as signed. It is possible that they never called back into the updateWholesaleAgreementSigned endpoint.
        if (agentInfo.wholesale_agreement_signed === null) {
            if (!await SetWholesaleAgreementAsSigned(agencyID)) {
                return next(serverHelper.internalError('Could not mark wholesale agreement as already read'));
            }
        }
        // Return that they have already signed
        res.send(200, {
            status: 'success',
            signed: true,
            signingUrl: null
        });
        return next();
    }

    // Get the signing link from our DocuSign service
    const result = await docusign.createSigningRequestURL(user, name, email, agentInfo.docusign_envelope_id, template, returnUrl);
    if (result === null) {
        return next(serverHelper.internalError('Invalid DocuSign URL'));
    }
    // Save the envelope ID to the agency record
    try {
        // const agencyBO = new AgencyBO();
        // Load the request data into it
        await agencyBO.setDocusignEnvelopeId(agencyID, result.envelopeId);
    }
    catch (err) {
        log.error(`Could not set the docusign envelope id ${result.envelopeId} for agent ${req.authentication.agents[0]}: ${err} ${__location}`);
        return next(serverHelper.internalError('Could not save docusign envelope ID'));
    }


    // Successful response
    res.send(200, {
        status: 'success',
        signed: false,
        signingUrl: result.signingUrl
    });
    return next();
}

/**
 * Marks that the Wholesale Agreement has been signed
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function updateWholesaleAgreementSigned(req, res, next) {
    // Make sure this is not an agency network
    if (req.authentication.isAgencyNetworkUser !== false) {
        log.warn('Agency Networks cannot sign Wholesale Agreements');
        return next(serverHelper.forbiddenError('Agency Networks cannot sign Wholesale Agreements'));
    }

    // Set the wholesale agreement as signed
    if (!await SetWholesaleAgreementAsSigned(req.authentication.agents[0])) {
        return next(serverHelper.internalError('Could not mark wholesale agreement as read'));
    }

    // Send a success response
    res.send(200, {
        message: 'Signing recorded',
        status: 'success'
    });
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get Wholesale Agreement Link', `${basePath}/wholesale-agreement`, getWholesaleAgreementLink);
    server.addGetAuth('Get Wholesale Agreement Link (depr)', `${basePath}/wholesaleAgreement`, getWholesaleAgreementLink);
    server.addPutAuth('Record Signature of Wholesale Agreement Link', `${basePath}/wholesale-agreement`, updateWholesaleAgreementSigned);
    server.addPutAuth('Record Signature of Wholesale Agreement Link (depr)', `${basePath}/wholesaleAgreement`, updateWholesaleAgreementSigned);
};