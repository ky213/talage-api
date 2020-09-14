/* eslint-disable */

var fs = require('fs');
//var check = require('syntax-error');
var dir = require('node-dir');
var jshint = require('jshint');



var options = {
  undef: true,
  laxcomma: true,
  laxbreak: true,
  strict: false,
  sub: true,       //Allow non . notation for JSON.
  esversion: 10,
  asi : true,
  node: true,
  globals: {
    "admin": true,
	"config": true,
	"db": true,
	"log": true,
	"log_auth": true,
	"restify": true,
	"server": true,
     "validator": true,
     "settings": true,
     "requireShared": true,
     "__location": true,
     "#dbTableORM": true,
     "dbTableORM": true,
     "requireRootPath": true
     
  }
};
var predef = {
  foo: false,
  require: false,
  __line: false,
  __file: false,
  __function: false,
  __stack: false,
  module: false,
  console: false,
  process: false,
  exports: false,
  global: false,
  setTimeout: false,
  Buffer: false
};
var __dirname;


dir.files(__dirname, function (err, files) {
     if (err)
          throw err;
     //console.log(files);
     for (var i = 0; i < files.length; i++) {
          var file = files[i];
          if (file.indexOf('node_modules') === -1
                  && file.indexOf('tests') === -1
                  && file.indexOf('test') === -1
                  && file.indexOf('coverage') === -1
                  && file.indexOf('.json') === -1
                  && file.indexOf('.js') > -1
                  && file.indexOf('BO.js') === -1
                  && file.indexOf('model.js') === -1
                  && file.indexOf('DatabaseObject.js') === -1
                  && file.indexOf('mochawesome-report') === -1) {
               //console.log('processing  - ' + file);
               var src = fs.readFileSync(file, 'utf8');
               //console.log(src);
               jshint.JSHINT(src, options, predef);
               if(jshint.JSHINT.errors.length >0){
                  console.log(file + ' ERRORS ' + jshint.JSHINT.errors.length);
                  //console.log(jshint.JSHINT.errors);
                  for(var j=0;j<jshint.JSHINT.errors.length;j++){
                       var error = jshint.JSHINT.errors[j];
                       console.log('error: ' + j+1 );
                       //console.log('\traw: ' + error.raw);
                       console.log('\tline: ' + error.line);
                       console.log('\treason: ' + error.reason);
                  }
               }
              else {
                   console.log(file + ' NO ERRORS');
              }



//            var err = check(src, file);
//            if (err) {
//                 console.log(file + ' has errors');
//                console.error('ERROR DETECTED' + Array(62).join('!'));
//                console.error(err);
//                console.error(Array(76).join('-'));
//            } else {
//                console.log(file + ' no errors');
//            }

          }
     }
});
//var file = __dirname + '/propositionsV2.js';
//var file = 'propositionsV2.js';
