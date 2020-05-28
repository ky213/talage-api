'use strict';
const name = /^[a-zA-Z' -]*$/;

module.exports = function(val){
	return Boolean(name.test(val));
};

// Docusign-api
// Const regex = /^[a-zA-Z'-]* [a-zA-Z'-]*$/;
// Module.exports = function(name){
// If(name){
// // Check formatting
// If(!regex.test(name)){
// Return 'Invalid name';
// }
// // Check length
// If(name.length > 100){
// Return 'Name exceeds maximum length of 100 characters';
// }
// }else{
// Return 'Missing required field: name';
// }
// Return true;
// };