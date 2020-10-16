/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable no-lonely-if */
'use strict';
var aws2 = require('aws-sdk');
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');

//TODO Global settings to override.
var PoolRegion = "us-east-1";
var userPoolId = "us-east-1_AjlY3nFty";
var ClientId = "e3u8q2o32aifc30amel081e91";

const poolData = {
    UserPoolId: userPoolId,
    ClientId: ClientId
};


let cognitoidentityserviceprovider = null;

exports.connect = async() => {
    // should be set
    if(global.settings.AWS_USE_KEYS === "YES"){
        aws2.config.update({
            'accessKeyId': global.settings.AWS_KEY,
            'secretAccessKey': global.settings.AWS_SECRET
        });
    }
    const CognitoIdentityServiceProvider = aws2.CognitoIdentityServiceProvider;


    cognitoidentityserviceprovider = new CognitoIdentityServiceProvider({region: PoolRegion});

    if (cognitoidentityserviceprovider) {
        log.debug('have cognitoidentityserviceprovider')
    }

    //check.... Will need if we add users.
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    if (userPool) {
        log.debug("have userPool object")
    }
    return true;
}
var internalGetUserGroups = function(userInfo, callback) {
    var params = {
        UserPoolId: poolData.UserPoolId, /* required */
        Username: userInfo.username /* required */
    };
    cognitoidentityserviceprovider.adminListGroupsForUser(params, function(err, data) {
        if (err) {
            log.debug(err, err.stack); // an error occurred
            return callback(err);
        }
        else {
            //log.debug(data);           // successful response
            //call get user groups
            return callback(null, data);
        }
    });

};
exports.getUserByToken = function(accessToken,callback) {
    var params = {AccessToken: accessToken};
    cognitoidentityserviceprovider.getUser(params, function(err, data) {
        if (err) {
            if (err.message !== 'NotAuthorizedException: Invalid Access Token') {
                log.debug(err, err.stack); // an error occurred
                return callback(err);
            }
            else {
                return callback({NotAuthorizedException: "Invalid Access Token"});
            }
        }
        else {
            // log.debug("Cognito response: " + JSON.stringify(data));           // successful response
            if (data) {
                var userInfo = {username: data.Username};
                internalGetUserGroups(userInfo, function(err2, groupData) {
                    if (err2) {
                        log.error("Error getting user's groups " + err2);
                    }
                    else {
                        //logger.debug('groupData: ' + JSON.stringify(groupData));
                        data.Groups = groupData.Groups;
                    }
                    return callback(null, data);
                })
            }
            else {
                return callback(null, data);
            }
        }
    });
};