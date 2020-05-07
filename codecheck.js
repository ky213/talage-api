/* eslint-disable */

const fs = require('fs');
// Var check = require('syntax-error');
const dir = require('node-dir');
const jshint = require('jshint');


const options = {
	'undef': true,
	'laxcomma': true,
	'laxbreak': true,
	'strict': false,
	'sub': true, // Allow non . notation for JSON.
	'esversion': 9,
	'asi': true,
	'node': true,
	'globals': {
		'admin': true,
		'config': true,
		'db': true,
		'log': true,
		'log_auth': true,
		'restify': true,
		'server': true,
		'validator': true,
		'settings': true,
		'requireShared': true

	}
};
const predef = {
	'foo': false,
	'require': false,
	'__line': false,
	'__file': false,
	'__function': false,
	'__stack': false,
	'module': false,
	'console': false,
	'process': false,
	'exports': false,
	'global': false,
	'setTimeout': false,
	'Buffer': false
};
let __dirname;


dir.files(__dirname, function(err, files){
	if(err){
		throw err;
	}
	// Console.log(files);
	for(let i = 0; i < files.length; i++){
		const file = files[i];
		if(file.indexOf('node_modules') === -1 && file.indexOf('public') === -1 && file.indexOf('tests') === -1 && file.indexOf('test') === -1 && file.indexOf('coverage') === -1 && file.indexOf('.json') === -1 && file.indexOf('.js') > -1){
			// Console.log('processing  - ' + file);
			const src = fs.readFileSync(file, 'utf8');
			// Console.log(src);
			jshint.JSHINT(src, options, predef);
			if(jshint.JSHINT.errors.length > 0){
				console.log(`${file} ERRORS ${jshint.JSHINT.errors.length}`);
				// Console.log(jshint.JSHINT.errors);
				for(let j = 0; j < jshint.JSHINT.errors.length; j++){
					const error = jshint.JSHINT.errors[j];
					console.log(`error: ${j}${1}`);
					// Console.log('\traw: ' + error.raw);
					console.log(`\tline: ${error.line}`);
					console.log(`\treason: ${error.reason}`);
				}
			}else{
				console.log(`${file} NO ERRORS`);
			}


			/*
			 *            Var err = check(src, file);
			 *            If (err) {
			 *                 Console.log(file + ' has errors');
			 *                Console.error('ERROR DETECTED' + Array(62).join('!'));
			 *                Console.error(err);
			 *                Console.error(Array(76).join('-'));
			 *            } else {
			 *                Console.log(file + ' no errors');
			 *            }
			 */

		}
	}
});

/*
 * Var file = __dirname + '/propositionsV2.js';
 * var file = 'propositionsV2.js';
 */