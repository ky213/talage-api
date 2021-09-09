/* eslint-disable */

var metadata = require('node-ec2-metadata');
var Q = require('q');
var fs = require('fs');
var inputFile = 'pm2.json'
var outputFile = 'pm2deployed.json'
var outputFile2 = 'pm2deployedtask.json'
var outputFile3 = 'pm2deployedquote.json'
//load pm2.json
let pm2json = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

let appJSON = pm2json.apps[0];
if(process.env.NODE_ENV){
    appJSON.env.NODE_ENV = process.env.NODE_ENV;
}
if (process.env.USER === "ec2-user") {
    metadata.isEC2()
        .then(function (onEC2) {
            console.log("Running on EC2? " + onEC2);
            if (onEC2 === true) {
                Q.all([
                    metadata.getMetadataForInstance('ami-id'),
                    metadata.getMetadataForInstance('hostname'),
                    metadata.getMetadataForInstance('public-hostname'),
                    metadata.getMetadataForInstance('public-ipv4'),
                    metadata.getMetadataForInstance('instance-id'),
                ])
                    .spread(function (amiID, hostname, publicHostname, publicIPv4, instanceid) {
                        appJSON.env.INSTANCE_ID = instanceid
                        appJSON.env.HOSTNAME = hostname
                        appJSON.env.PUBLIC_HOSTNAME = publicHostname
                        appJSON.env.PUBLIC_IPV4 = publicIPv4

                        //update pm2 json..                        
                        savepm2deployed(pm2json);
                    })
                    .fail(function (error) {
                        console.log("Error: " + error);
                        process.exit(1);
                    });
            }
        });
}
else {
    //local dev or not EC2 AWS Linux  
    appJSON.env.INSTANCE_ID = "Not EC2 - localdev"
    appJSON.env.HOSTNAME = "local"
    appJSON.env.PUBLIC_HOSTNAME = "localhost"
    appJSON.env.PUBLIC_IPV4 = "localhost"
    savepm2deployed(pm2json);

}



function savepm2deployed(pm2json) {
    fs.writeFileSync(outputFile, JSON.stringify(pm2json, null, 2));

    pm2json.apps[0].name ="Task Processor"
    pm2json.apps[0].script ="taskindex.js"

    fs.writeFileSync(outputFile2, JSON.stringify(pm2json, null, 2));

    pm2json.apps[0].name ="Quote System"
    pm2json.apps[0].script ="index-quote.js"

    fs.writeFileSync(outputFile3, JSON.stringify(pm2json, null, 2));

    process.exit(0);

}