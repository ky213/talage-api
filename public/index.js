'use strict';

// Register global function to load shared modules
global.sharedPath = require('path').join(__dirname, '..', 'shared');
global.requireShared = (moduleName) => require(`${sharedPath}/${moduleName}`);

function TestLoadModule(moduleName) {
	process.stdout.write(`Trying to load ${moduleName}: `);
	try {
		requireShared(moduleName);
	} catch (error) {
		console.log(`ERROR\n\t${error}`);
		return;
	}
	console.log("SUCCESS");
}

// TestLoadModule('helpers/auth.js');
// TestLoadModule('services/crypt.js');
// TestLoadModule('services/db.js');
// TestLoadModule('services/email.js');
// TestLoadModule('services/file.js');
// TestLoadModule('helpers/formatPhone.js');
// TestLoadModule('helpers/general.js');
// TestLoadModule('helpers/getQuestions.js');
// TestLoadModule('helpers/helper.js');
TestLoadModule('services/logger.js');
// TestLoadModule('sanitize.js');
// TestLoadModule('sendOnboardingEmail.js');
// TestLoadModule('signature.js');
// TestLoadModule('slack.js');
// TestLoadModule('validator.js');
// TestLoadModule('version.js');
// TestLoadModule('wrap.js');
