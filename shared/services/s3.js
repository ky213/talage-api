'use strict';

const AWS = require('aws-sdk');
const colors = require('colors');

exports.connect = async() => {
    // Setup S3
    // eslint-disable-next-line no-console
    log.info('Connecting to Amazon S3');
    if(global.settings.AWS_USE_KEYS === "YES"){
        AWS.config.update({
            'accessKeyId': global.settings.AWS_KEY,
            'secretAccessKey': global.settings.AWS_SECRET
        });
        global.s3 = new AWS.S3({
            'accessKeyId': global.settings.AWS_KEY,
            'secretAccessKey': global.settings.AWS_SECRET,
            'region': global.settings.AWS_REGION
        });
    }
    else {
        global.s3 = new AWS.S3({'region': global.settings.AWS_REGION});
    }
    try{
        await global.s3.listObjectsV2({
            'Bucket': global.settings.S3_BUCKET,
            'MaxKeys': 1
        }).promise();
    }
    catch(error){
        // eslint-disable-next-line no-console
        log.error(colors.red(`\tError connecting to S3: ${error}` + __location));
        return false;
    }

    // eslint-disable-next-line no-console
    log.info(colors.green('\tS3 Connected'));
    return true;
};