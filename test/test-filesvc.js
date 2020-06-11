/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable no-undef */
/* eslint-disable space-before-function-paren */
/* eslint-disable no-empty-function */
/* eslint-disable space-before-blocks */
/* eslint-disable strict */

var assert = require('chai').assert;
//var expect = require("chai").expect;
var should = require('chai').should();
var simple = require('simple-mock');
//var rewire = require('rewire');
var sinon = require('sinon');
// eslint-disable-next-line no-unused-vars
var testGlobal = require('./test.js');


var taskFileSvc = require('../shared/services/filesvc.js');

//test data
const fileContent = "datafileconnent";
const fileContent64 = fileContent.toString('base64')
        // const fileBuffer = Buffer.from(fileContent64, 'base64');

describe("Filesvc - Get ", function (){
    //let sandbox = null;

    beforeEach(function(done) {
        simple.mock(log, 'error').callFn(function () {});
        simple.mock(log, 'warn').callFn(function () {});
        simple.mock(log, 'info').callFn(function () {});
        simple.mock(log, 'debug').callFn(function () {});
        simple.mock(log, 'silly').callFn(function () {});
        simple.mock(log, 'verbose').callFn(function () {});
        //sinon.stub(s3, "getObject");

        global.settings.SLACK_DO_NOT_SEND = "YES";

        done();
    });

    afterEach(function(done) {
        //simple.restore();
      simple.restore()
       done();
    });

    it('Filesvc.get - good', function(done){
        var respObj = {};
        respObj.Body = fileContent64;
        simple.mock(global.s3, 'getObject').callbackWith(null, respObj);
        let error = null;
        let resp = null;
        taskFileSvc.get("public/agency-banners/test.txt").then(function(data){
            resp = data;
            should.not.exist(error);
            should.exist(resp);
            should.exist(resp.Body);
            assert.equal(resp.Body, fileContent64);
            done();
        }).catch(function(err){
            error = err;
            should.not.exist(error);
            should.exist(resp);
            should.exist(resp.Body);
            assert.equal(resp.Body, fileContent64);
            done();
        });

    });

    it('Filesvc.get - S3 error', function(done){
        var respObj = {};
        respObj.Body = fileContent64;
        simple.mock(global.s3, 'getObject').callbackWith(new Error("test Error"), null);
        let error = null;
        let resp = null;
        taskFileSvc.get("public/agency-banners/test.txt").then(function(data){
            resp = data;
            should.exist(error);
            should.not.exist(resp);
            done();
        }).catch(function(err){
            error = err;
            should.exist(error);
            should.not.exist(resp);
            done();
        });

    });
    it('Filesvc.get - No Path error', function(done){
        var respObj = {};
        respObj.Body = fileContent64;
        simple.mock(global.s3, 'getObject').callbackWith(null, respObj);
        let error = null;
        let resp = null;
        taskFileSvc.get().then(function(data){
            resp = data;
            should.exist(error);
            should.not.exist(resp);
            done();
        }).catch(function(err){
            error = err;
            should.exist(error);
            should.not.exist(resp);
            done();
        });

    });


});