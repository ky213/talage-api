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
const moment = require('moment');


var taskCheckinrecords = require('../tasksystem/task-checkinrecords.js')

describe("Task-Checkinrecords, ", function (){
    //let sandbox = null;

    beforeEach(function(done) {
        simple.mock(log, 'error').callFn(function () {});
        simple.mock(log, 'warn').callFn(function () {});
        simple.mock(log, 'info').callFn(function () {});
        simple.mock(log, 'debug').callFn(function () {});
        simple.mock(log, 'silly').callFn(function () {});
        sinon.stub(db, "query");
        sinon.stub(queueHandler, "deleteTaskQueueItem");
        done();
    });

    afterEach(function(done) {
        simple.restore();
        db.query.restore();
        queueHandler.deleteTaskQueueItem.restore();

        done();
    });

    it('checkinRecordsTask - no db errors', async function(){

        db.query.resolves();
        let error = null;
        const resp = await taskCheckinrecords.taskProcessorExternal().catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, true);
    });

    it('checkinRecordsTask - with db errors', async function(){

        // Simulate async error
        db.query.returns(Promise.reject('db error'))
       // db.query.throws('db error')
        let error = null;
        const resp = await taskCheckinrecords.taskProcessorExternal().catch(err => error = err);
        log.debug('resp: ' + resp)
        should.not.exist(error);
        assert.equal(resp, true);
    });

    it('processtask - no errors', async function(){

         // eslint-disable-next-line prefer-const
        let queueMessage = {};
        queueMessage.Attributes = {};
        queueMessage.Attributes.SentTimestamp = moment().utc().unix() * 1000;
        queueMessage.ReceiptHandle = "123412";

        db.query.resolves();
        global.queueHandler.deleteTaskQueueItem.resolves();
        let error = null;
        const resp = await taskCheckinrecords.processtask(queueMessage).catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, null);
    });

    it('processtask - old message', async function(){

        const yesterday = moment().subtract(1,'d');

        // eslint-disable-next-line prefer-const
        let queueMessage = {};
        queueMessage.Attributes = {};
        queueMessage.Attributes.SentTimestamp = yesterday.utc().unix() * 1000;
        queueMessage.ReceiptHandle = "123412";

        db.query.resolves();
        global.queueHandler.deleteTaskQueueItem.resolves();
        let error = null;
        const resp = await taskCheckinrecords.processtask(queueMessage).catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, null);

    });

    it('processtask - no queueMessage', async function(){
         // eslint-disable-next-line prefer-const
        let queueMessage = {};
        queueMessage.Attributes = {};
        queueMessage.Attributes.SentTimestamp = moment().utc().unix() * 1000;
        queueMessage.ReceiptHandle = "123412";

        db.query.resolves();
        global.queueHandler.deleteTaskQueueItem.resolves();
        let error = null;
        const resp = await taskCheckinrecords.processtask().catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, null);
    });


    it('processtask - queueHandler Delete Message', async function(){

         // eslint-disable-next-line prefer-const
        let queueMessage = {};
        queueMessage.Attributes = {};
        queueMessage.Attributes.SentTimestamp = moment().utc().unix() * 1000;
        queueMessage.ReceiptHandle = "123412";

        db.query.resolves();
        //global.queueHandler.deleteTaskQueueItem.resolves();
        global.queueHandler.deleteTaskQueueItem.returns(Promise.reject('SQS Error'))
        let error = null;
        const resp = await taskCheckinrecords.processtask(queueMessage).catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, null);
    });


    it('processtask - queueHandler Delete Old Message', async function(){

        const yesterday = moment().subtract(1,'d');
         // eslint-disable-next-line prefer-const
        let queueMessage = {};
        queueMessage.Attributes = {};
        queueMessage.Attributes.SentTimestamp = yesterday.utc().unix() * 1000;
        queueMessage.ReceiptHandle = "123412";

        db.query.resolves();
        //global.queueHandler.deleteTaskQueueItem.resolves();
        global.queueHandler.deleteTaskQueueItem.returns(Promise.reject('SQS Error'))
        let error = null;
        const resp = await taskCheckinrecords.processtask(queueMessage).catch(err => error = err);
        should.not.exist(error);
        assert.equal(resp, null);
    });


});