// Load the environment
const environment = require('dotenv');
const fs = require('fs');

const requiredSettings = [
	// Public URLs
	'SITE_URL', 'PORTAL_URL', 'BRAND', 'DIGALENT_AGENTS_URL', 'TALAGE_AGENTS_URL',
	// Runtime profile
	'ENV',
	// Internal Credentials
	'AUTH_SECRET_KEY', 'ENCRYPTION_KEY', 'SALT', 'SECRET', 'TEST_API_TOKEN',
	// AWS
	'AWS_ELASTICSEARCH_ENDPOINT', 'AWS_ELASTICSEARCH_LOGLEVEL', 'AWS_KEY', 'AWS_LOG_TO_AWS_ELASTICSEARCH', 'AWS_REGION', 'AWS_SECRET',
	// Database
	'DATABASE_NAME', 'DATABASE_HOST', 'DATABASE_PASSWORD', 'DATABASE_PREFIX', 'DATABASE_USER',
	// API Server
	'PUBLIC_API_PORT', 'PRIVATE_API_PORT', 'UPTIME_PORT',
	// S3
	'S3_ACCESS_KEY_ID', 'S3_BUCKET', 'S3_SECRET_ACCESS_KEY',
	// Sendgrid
	'SENDGRID_API_KEY'
];

exports.Load = (envFile) => {
	// Load the variables from a .env file
	let variables = null;
	try {
		variables = environment.parse(fs.readFileSync(envFile, { encoding: 'utf8' }));
	} catch (error) {
		console.log(`Error parsing aws.env: ${error}`);
		return false;
	}

	// ensure required settings exist and inject them into the global 'settings' object
	global.settings = {};
	for (let i = 0; i < requiredSettings.length; i++) {
		if (!variables.hasOwnProperty(requiredSettings[i])) {
			console.log(`Error: missing variable '${requiredSettings[i]}'`);
			return false;
		}
		global.settings[requiredSettings[i]] = variables[requiredSettings[i]];
	};
	return true;
}
