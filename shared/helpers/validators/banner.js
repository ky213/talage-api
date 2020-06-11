'use strict';

//const axios = require('axios');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const fileSvc = global.requireShared('./services/filesvc.js');

/**
 * Checks whether a banner is valid (exists in S3)
 *
 * @param {string} name - The name of the banner
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = async function(name){
	let valid = false;

	await fileSvc.GetFileList('public/agency-banners').then(function(fileList){
		if(fileList){
			// Remove the first element as it is just the folder
			fileList.shift();

			// Get rid of the front part of each of the file paths
			fileList = fileList.map(function(path){
				return path.substring(path.lastIndexOf('/') + 1)
			});

			// Check if the provided name is in the result set
			if(fileList.includes(name)){
				valid = true;
			}
		}
		else {
			log.warn("banner empty list from S3 " + __location);
		}
	}).catch(function(err){
		log.error('Failed to get a list of banner files from the S3. error: ' + err + __location);
	});

	return valid;

};