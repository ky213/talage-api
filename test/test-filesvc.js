/* eslint-disable array-element-newline */
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
//var sinon = require('sinon');
// eslint-disable-next-line no-unused-vars
var testGlobal = require('./test.js');


var taskFileSvc = require('../shared/services/filesvc.js');

//test data
const fileContent = "datafileconnent";
const buff = Buffer.from(fileContent);
const fileContent64 = buff.toString('base64');

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

describe("Filesvc - GetFileList ", function (){
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
       simple.restore()
       done();
    });

    it('Filesvc.get - good', function(done){
        var s3RespObj = {};
        s3RespObj = {
            "IsTruncated": false,
            "Contents": [
              {
                "Key": "public/agency-banners/",
                "LastModified": "2020-01-01T02:28:42.000Z",
                "ETag": "\"d41d8cd98f00b204e9800998ecf8427e\"",
                "Size": 0,
                "StorageClass": "STANDARD"
              },
              {
                "Key": "public/agency-banners/barber.jpg",
                "LastModified": "2020-01-03T00:34:24.000Z",
                "ETag": "\"a480c8448a1446e588e1ebfb8dc3692d\"",
                "Size": 102232,
                "StorageClass": "STANDARD"
              }
            ]
        };
        simple.mock(global.s3, 'listObjectsV2').callbackWith(null, s3RespObj);
        let error = null;
        let resp = null;
        taskFileSvc.GetFileList("public/agency-banners/test.txt").then(function(data){
            resp = data;
            should.not.exist(error);
            should.exist(resp);
            assert.isAbove(resp.length, 0, "Array greater than 0");
            done();
        }).catch(function(err){
            error = err;
            should.not.exist(error);
            should.exist(resp);
            assert.isAbove(resp.length, 0, "Array greater than 0");
            done();
        });

    });

    it('Filesvc.get - S3 Error', function(done){

        simple.mock(global.s3, 'listObjectsV2').callbackWith(new Error("test Error"), null);
        let error = null;
        let resp = null;
        taskFileSvc.GetFileList("public/agency-banners/test.txt").then(function(data){
            resp = data;
            should.exist(error, "Error should be returned not not here");
            should.not.exist(resp, "resp should not exits");
            done();
        }).catch(function(err){
            error = err;
            should.exist(error, "Error should be returned");
            should.not.exist(resp, "resp should not exits");
            done();
        });

    });


});


describe("Filesvc - Putfile ", function (){
    //let sandbox = null;
    const successJSON = {'code': 'Success'};


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
       simple.restore()
       done();
    });

    it('Filesvc.PutFile - good', function(done){

        simple.mock(global.s3, 'putObject').callbackWith(null);
        let error = null;
        let resp = null;
        taskFileSvc.PutFile("test/test.txt", fileContent64).then(function(data){
            resp = data;
            should.not.exist(error);
            should.exist(resp);
            assert.deepEqual(resp, successJSON);
            done();
        }).catch(function(err){
            error = err;
            should.not.exist(error);
            should.exist(resp);
            done();
        });

    });

    it('Filesvc.PutFile - No S3 Key', function(done){

        simple.mock(global.s3, 'putObject').callbackWith(null);
        let error = null;
        let resp = null;
        taskFileSvc.PutFile("", fileContent64).then(function(data){
            resp = data;
            should.exist(error);
            should.not.exist(resp);
            assert.deepEqual(resp, successJSON);
            done();
        }).catch(function(err){
            error = err;
            should.exist(error);
            should.not.exist(resp);
            done();
        });

    });

    it('Filesvc.PutFile - No File content', function(done){

        simple.mock(global.s3, 'putObject').callbackWith(null);
        let error = null;
        let resp = null;
        taskFileSvc.PutFile("test/test.txt", null).then(function(data){
            resp = data;
            should.exist(error);
            should.not.exist(resp);
            assert.deepEqual(resp, successJSON);
            done();
        }).catch(function(err){
            error = err;
            should.exist(error);
            should.not.exist(resp);
            done();
        });

    });

    it('Filesvc.PutFile - File content not base64', function(done){

        simple.mock(global.s3, 'putObject').callbackWith(null);
        let error = null;
        let resp = null;
        taskFileSvc.PutFile("test/test.txt", fileContent).then(function(data){
            resp = data;
            should.exist(error);
            should.not.exist(resp);
            assert.deepEqual(resp, successJSON);
            done();
        }).catch(function(err){
            error = err;
            should.exist(error);
            should.not.exist(resp);
            done();
        });

    });

    it('Filesvc.PutFile - s3 error', function(done){

        simple.mock(global.s3, 'putObject').callbackWith(new Error("S3 Error"));
        let error = null;
        let resp = null;
        taskFileSvc.PutFile("test/test.txt", fileContent).then(function(data){
            resp = data;
            should.exist(error);
            should.not.exist(resp);
            assert.deepEqual(resp, successJSON);
            done();
        }).catch(function(err){
            error = err;
            should.exist(error);
            should.not.exist(resp);
            done();
        });

    });


});