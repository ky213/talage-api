'use strict';

const colors = require('colors');

function TestLoadModule(moduleName) {
	process.stdout.write(`Trying to load ${moduleName.padEnd(30,' ')}: `);
	// try {
		requireShared(moduleName);
	// } catch (error) {
		// console.log(colors.red(`ERROR\n\t${error}`));
		// return;
	// }
	console.log(colors.green('SUCCESS'));
}

exports.TestSharedModules = function() {
	console.log(colors.cyan('Testing shared modules'));
	console.log(colors.cyan('--------------------------------------------------------------------------------'));

	TestLoadModule('helpers/auth.js');
	TestLoadModule('services/crypt.js');
	TestLoadModule('services/db.js');
	TestLoadModule('services/email.js');
	TestLoadModule('services/file.js');
	TestLoadModule('helpers/formatPhone.js');
	TestLoadModule('helpers/general.js');
	TestLoadModule('helpers/getQuestions.js');
	TestLoadModule('helpers/helper.js');
	TestLoadModule('services/logger.js');
	TestLoadModule('helpers/sanitize.js');
	TestLoadModule('services/slack.js');
	TestLoadModule('helpers/validator.js');
	TestLoadModule('helpers/version.js');
	TestLoadModule('helpers/wrap.js');
}