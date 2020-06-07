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
//const moment = require('moment');
// eslint-disable-next-line no-unused-vars
var testGlobal = require('./test.js');


var taskSlackSvc = require('../shared/services/slacksvc.js');


describe("Slacksvc Send, ", function (){
    //let sandbox = null;

    beforeEach(function(done) {
        simple.mock(log, 'error').callFn(function () {});
        simple.mock(log, 'warn').callFn(function () {});
        simple.mock(log, 'info').callFn(function () {});
        simple.mock(log, 'debug').callFn(function () {});
        simple.mock(log, 'silly').callFn(function () {});
        simple.mock(log, 'verbose').callFn(function () {});
        sinon.stub(db, "query");

        global.settings.SLACK_DO_NOT_SEND = "YES";

        done();
    });

    afterEach(function(done) {
        simple.restore();
        db.query.restore();
        done();
    });

    it('SlackSvc.send - good', async function(){

        let error = null;
        const resp = await taskSlackSvc.send("debug", "ok", "test message").catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, true);
    });

    it('SlackSvc.send - no input', async function(){

        let error = null;
        const resp = await taskSlackSvc.send().catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, false);
    });

    it('SlackSvc.send - no channel', async function(){

        let error = null;
        const resp = await taskSlackSvc.send(null,"ok", "test message").catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, true);
    });

    it('SlackSvc.send - bad channel test characters', async function(){

        let error = null;
        const resp = await taskSlackSvc.send("BadChannelBadChannelqewewq","ok", "test message").catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, false);
    });

    it('SlackSvc.send - invalid channel not in leist', async function(){

        let error = null;
        const resp = await taskSlackSvc.send("badchannel","ok", "test message").catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, true);
    });

    it('SlackSvc.send - no message type', async function(){

        let error = null;
        const resp = await taskSlackSvc.send("debug", null, "test message").catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, true);
    });

    it('SlackSvc.send - invalid message type bad characters', async function(){

        let error = null;
        const resp = await taskSlackSvc.send("debug", "BadMessageType", "test message").catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, false);
    });

    it('SlackSvc.send - bad message type not a string', async function(){

        let error = null;
        const resp = await taskSlackSvc.send("debug", {}, "test message").catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, false);
    });

    it('SlackSvc.send - invalid message type not in list', async function(){

        let error = null;
        const resp = await taskSlackSvc.send("debug", "okzz", "test message").catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, true);
    });

    it('SlackSvc.send - no message', async function(){

        let error = null;
        const resp = await taskSlackSvc.send("debug","ok").catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, false);
    });

    it('SlackSvc.send - message not a string', async function(){

        let error = null;
        const resp = await taskSlackSvc.send("debug","ok", {}).catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, false);
    });

    it('SlackSvc.send - good, Not Production and Not debug', async function(){

        let error = null;
        const resp = await taskSlackSvc.send("#alerts", "ok", "test message").catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, true);
    });

});