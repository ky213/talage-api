'use strict';

const fs = require('fs');
const readFileAsync = require('util').promisify(fs.readFile);
const colors = require('colors');

exports.load = async() => {
	try {
		// CHANGELOG.md is not correct in development or awsdev
		if (global.settings.ENV === 'awsdev' || global.settings.ENV === 'test' || global.settings.ENV === 'development' || global.settings.ENV === 'local'){
			console.log('Setting hard-coded development version'); // eslint-disable-line no-console
			global.version = '1.5.7';
		}
 else {
			console.log('Reading version from CHANGELOG.md'); // eslint-disable-line no-console
			// Read in the changelog
			const changelog = await (await readFileAsync('CHANGELOG.md', {"encoding": 'utf8'})).trim();
			// Match the version in the first line
			const match = changelog.match(/<a name="(.+)">/);
			if (match === 0 || match.length < 2){
				console.log('Error reading version: unknown line format. Expected \'<a href="VERSION"></a>\'.'); // eslint-disable-line no-console
				return false;
			}
			// Set the version globally
			global.version = match[1];
		}
		console.log(colors.green(`\tCompleted (version=${global.version})`)); // eslint-disable-line no-console
	}
 catch (error){
		console.log(`Error reading version: ${error}`); // eslint-disable-line no-console
		return false;
	}

	return true;
};