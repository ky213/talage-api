'use strict';

const https = require('https');
const imgSize = require('image-size');
const url = require('url');

/**
 * Determines the size of an image based on its URL
 *
 * @param {string} address - The publicly accessible web address of the image
 * @returns {Promise.<object, Error>} - A promise that returns the result of the request as an object with height, width, and type parameters, width and then height if resolved, or an Error if rejected
 */
module.exports = function(address){
	// Send the request to the encryption service
	return new Promise(function(resolve, reject){
		try{
			// Parse out some of the information about this URL
			const options = url.parse(address);

			// Download the image
			https.get(options, function(response){
				const chunks = [];

				if(response.statusCode !== 200){
					log.info(`Image not found (code: ${response.statusCode})`);
					reject(new Error(`Image not found`));
					return;
				}

				response.on('data', function(chunk){
					chunks.push(chunk);
				}).on('end', function(){
					// Return the result
					resolve(imgSize(Buffer.concat(chunks)));
				});
			});
		}catch(e){
			reject(new Error(`Unable to determine image size (${address})`));
		}
	});
};