'use strict';

const acord = global.requireShared('./services/acordsvc.js');
const serverHelper = require('../../../server.js');


/**
 * Responds to get requests for the certificate endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetACORDFormWC(req, res, next){

	if(!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0){
		log.info('ACORD form generation failed. Bad Request: No data received' + __location);
		return next(serverHelper.requestError('Bad Request: No data received'));
	}

	// Make sure basic elements are present
	if(!req.query.application_id){
		log.info('ACORD form generation failed. Bad Request: Missing Application ID' + __location);
		return next(serverHelper.requestError('Bad Request: You must supply an application ID'));
	}

	if(!req.query.insurer_id){
		log.info('ACORD form generation failed. Bad Request: Invalid insurer id' + __location);
		return next(serverHelper.requestError('Bad Request: You must supply an insurer ID'));
	}


	// TODO pass in app id and insurer id as req params so we dont have to do these dumb checks ^^^^^^^
	const form = await acord.generateWCACORD(req.query.application_id, req.query.insurer_id).catch(function(error){
		log.error('ACORD form generation failed. ' + error + __location);
		return next(serverHelper.requestError('ACORD form generation failed.'));
	});

	if(form.error){
		return next(serverHelper.requestError(form.error));
	}

	const doc = form.doc;
	const missing_data = form.missing_data;

	const chunks = [];

	doc.on('data', function(chunk){
		chunks.push(chunk);
	});

	if(Object.hasOwnProperty.call(req.query, 'response') && req.query.response === 'json'){
		doc.on('end', () => {
			const result = Buffer.concat(chunks);
			const response = {'pdf': result.toString('base64')};

			if(missing_data.length){
				response.status = 'warning';
				response.missing_data = missing_data;
			}
			else{
				response.status = 'ok';
			}
			res.send(200, response);
		});
	}
	else{
		let ending = '';
		doc.on('end', function(){
			ending = Buffer.concat(chunks);

			res.writeHead(200, {
				'Content-Disposition': 'attachment; filename=acord-130.pdf',
				'Content-Length': ending.length,
				'Content-Type': 'application/pdf'
			});
			res.end(ending);
			log.info('Certificate Sent in Response');
		});
	}

	doc.end();
	log.info('Certificate Generated!');

	return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addGet('Get Certificate', `${basePath}/acord-form-wc`, GetACORDFormWC);
};