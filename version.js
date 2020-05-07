'use strict';

const fs = require('fs');
const readFileAsync = require('util').promisify(fs.readFile);
const colors = require('colors');

exports.Load = async() => {
	try{
		console.log('Reading version from CHANGELOG.md');
		// Read in the changelog
		const changelog = await (await readFileAsync('CHANGELOG.md', {'encoding': 'utf8'})).trim();
		// Match the version in the first line
		const match = changelog.match(/<a name="(.+)">/);
		if(match == 0 || match.length < 2){
			console.log('Error reading version: unknown line format. Expected \'<a href="VERSION"></a>\'.');
			return false;
		}
		// Set the version globally
		global.version = match[1];
		console.log(colors.green(`\tCompleted (version=${global.version})`));
	}catch(error){
		console.log(`Error reading version: ${error}`);
		return false;
	}

	return true;
};