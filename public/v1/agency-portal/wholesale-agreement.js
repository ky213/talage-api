'use strict';

const axios = require('axios');
const crypt = global.requireShared('./services/crypt.js');
const serverHelper = require('../../../server.js');

/**
 * Retrieves the link that will allow a single user to sign the wholesaleAgreement
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getWholesaleAgreementLink(req, res, next){
	let error = false;

	// Make sure this is not an agency network
	if (req.authentication.agencyNetwork !== false){
		log.warn('Agency Networks cannot sign Wholesale Agreements');
		return next(serverHelper.forbiddenError('Agency Networks cannot sign Wholesale Agreements'));
	}

	// Get the information about this agent
	const agentSql = `
			SELECT
				\`agency_network\`,
				\`email\`,
				\`fname\`,
				\`lname\`
			FROM \`#__agencies\`
			WHERE \`id\` = ${req.authentication.agents[0]} LIMIT 1;
		`;
	const agentInfo = await db.query(agentSql).catch(function(e){
		log.error(e.message);
		error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
	});
	if (error){
		return next(error);
	}

	// Decrypt the agent's information
	const email = await crypt.decrypt(agentInfo[0].email);
	const firstName = await crypt.decrypt(agentInfo[0].fname);
	const lastName = await crypt.decrypt(agentInfo[0].lname);

	// Get the signing link from our DocuSign service

	// TO DO: Pass the auth token in here
	const signingReq = await axios.
		post(`http://localhost:${global.settings.PRIVATE_API_PORT}/v1/docusign/embedded`, {
			"email": email,
			"name": `${firstName} ${lastName}`,
			"returnUrl": `${agentInfo[0].agency_network === 2 ? global.settings.DIGALENT_AGENTS_URL : global.settings.PORTAL_URL}/wholesale-agreement`,
			"template": global.settings.ENV === 'production' ? '7143efde-6013-4f4a-b514-f43bc8e97a63' : '5849d7ae-1ee1-4277-805a-248fd4bf71b7', // This is the template ID defined in our DocuSign account. It corresponds to the Talage Wholesale Agreement
			"user": req.authentication.userID
		}).
		catch(function(e){
			if (e){
				log.error('Failed to get docusign document for signing. This user will need to be sent the document manually.');
				log.verbose(e);
				error = serverHelper.internalError(e);
			}
		});
	if (error){
		return next(error);
	}

	res.send(200, {
		"signingUrl": signingReq.data.signingUrl,
		"status": 'success'
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
async function updateWholesaleAgreementSigned(req, res, next){
	const error = false;

	// Make sure this is not an agency network
	if (req.authentication.agencyNetwork !== false){
		log.warn('Agency Networks cannot sign Wholesale Agreements');
		return next(serverHelper.forbiddenError('Agency Networks cannot sign Wholesale Agreements'));
	}

	// Construct the query
	const updateSql = `
			UPDATE \`#__agencies\`
			SET \`wholesale_agreement_signed\` = CURRENT_TIMESTAMP()
			WHERE \`id\` = ${db.escape(req.authentication.agents[0])};
		`;

	// Run the update query
	await db.query(updateSql).catch(function(e){
		log.error(e.message);
		e = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
	});
	if (error){
		return next(error);
	}

	// Send a success response
	res.send(200, {
		"message": 'Signing recorded',
		"status": 'success'
	});
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get Wholesale Agreement Link', `${basePath}/wholesale-agreement`, getWholesaleAgreementLink);
	server.addGetAuth('Get Wholesale Agreement Link (depr)', `${basePath}/wholesaleAgreement`, getWholesaleAgreementLink);
	server.addPutAuth('Record Signature of Wholesale Agreement Link', `${basePath}/wholesale-agreement`, updateWholesaleAgreementSigned);
	server.addPutAuth('Record Signature of Wholesale Agreement Link (depr)', `${basePath}/wholesaleAgreement`, updateWholesaleAgreementSigned);
};