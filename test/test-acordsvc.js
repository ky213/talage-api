/* eslint-disable array-element-newline */
/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable no-undef */
/* eslint-disable space-before-function-paren */
/* eslint-disable no-empty-function */
/* eslint-disable space-before-blocks */
/* eslint-disable strict */

//var assert = require('chai').assert;
//var expect = require("chai").expect;
//var should = require('chai').should();
var simple = require('simple-mock');
//var rewire = require('rewire');
var sinon = require('sinon');
// eslint-disable-next-line no-unused-vars
//var testGlobal = require('./test.js');

var taskAcordSvc = require('../shared/services/acordsvc.js');

describe("Acordsvc - generateWCACORD ", function (){

	beforeEach(function(done) {

		// Aw crap, I dont know how to mock things
		sinon.stub(db, "query");
		done();
	});

	afterEach(function(done) {

		// If I dont know how to mock I probably dont know how to reset either do I

		done();
	});

	// TODO: AAAALL the unit tests

});