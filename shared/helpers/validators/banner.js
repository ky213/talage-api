'use strict';

const axios = require('axios');

/**
 * Checks whether a banner is valid (exists in S3)
 *
 * @param {string} name - The name of the banner
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = async function(name){
	let valid = false;

	// Get the banner images from the file service
	await axios.get(`http://localhost:${global.settings.PRIVATE_API_PORT}/v1/file/list?prefix=public/agency-banners`).
	then(function(response){

		// Remove the first element as it is just the folder
		response.data.shift();

		// Get rid of the front part of each of the file paths
		response.data = response.data.map(function(path){
			return path.substring(path.lastIndexOf('/') + 1)
		});

		// Check if the provided name is in the result set
		if(response.data.includes(name)){
			valid = true;
		}
	});

	return valid;
};