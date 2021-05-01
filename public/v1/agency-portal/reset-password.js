const crypt = global.requireShared('./services/crypt.js');
const jwt = require('jsonwebtoken');
//const request = require('request');
const serverHelper = global.requireRootPath('server.js');
const emailsvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');

/**
 * Returns a limited life JWT for restting a user's password
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
async function PostResetPassword(req, res, next){
    let error = false;

    // Check for data
    if(!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0){
        log.info('Bad Request: Missing both email and password');
        return next(serverHelper.requestError('You must supply an email address and password'));
    }

    // Make sure an email was provided
    if(!req.body.email){
        log.info('Missing email');
        res.send(400, serverHelper.requestError('Email address is required'));
        return next();
    }

    // Authenticate the information provided by the user
    const emailHash = await crypt.hash(req.body.email);
    const sql = `
			SELECT
				id,
                agency_network,
                agency
			FROM clw_talage_agency_portal_users
			WHERE email_hash = ${db.escape(emailHash)} LIMIT 1;
		`;
    const result = await db.query(sql).catch(function(e){
        log.error(e.message);
        res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
        error = true;
    });
    if(error){
        return next(false);
    }

    // Make sure we found a result before doing more processing
    if(result && result.length){
        log.info('Email found');

        // Create a limited life JWT
        const token = jwt.sign({'userID': result[0].id}, global.settings.AUTH_SECRET_KEY, {'expiresIn': '15m'});
        let agencyNetworkId = result[0].agency_network
        //load agencyBO if we do not have
        if(!agencyNetworkId && result[0].agency){
            try{
            // Load the request data into it
                const agencyBO = new AgencyBO();
                const agency = await agencyBO.getById(result[0].agency);
                agencyNetworkId = agency.agency_network;
            }
            catch(err){
                log.error("agencyBO.getById load error " + err + __location);
            }
        }

        //load AgencyNetworkBO
        const agencyNetworkBO = new AgencyNetworkBO();
        //just so getEmailContent works.
        const agencyNetworkEnvSettings = await agencyNetworkBO.getEnvSettingbyId(agencyNetworkId).catch(function(err){
            log.error(`Unable to get email content for New Agency Portal User. agency_network: ${agencyNetworkId}.  error: ${err}` + __location);
            error = true;
        });
        if(error){
            return false;
        }
        let brand = agencyNetworkEnvSettings.emailBrand.toLowerCase();
        if(brand){
            brand = `${brand.charAt(0).toUpperCase() + brand.slice(1)}`;
        }
        else {
            log.error(`Email Brand missing for agencyNetworkId ${agencyNetworkId} ` + __location);
        }
        const portalurl = agencyNetworkEnvSettings.PORTAL_URL;


        const emailData = {
            'html': `<p style="text-align:center;">A request to reset your password has been recieved. To continue the reset process, please click the button below within 15 minutes.</p><br><p style="text-align: center;"><a href="${portalurl}/reset-password/${token}" style="background-color:#ED7D31;border-radius:0.25rem;color:#FFF;font-size:1.3rem;padding-bottom:0.75rem;padding-left:1.5rem;padding-top:0.75rem;padding-right:1.5rem;text-decoration:none;text-transform:uppercase;">Reset Password</a></p>`,
            'subject': `Reset Your ${brand} Password`,
            'to': req.body.email
        };

        const emailResp = await emailsvc.send(emailData.to, emailData.subject, emailData.html, {}, agencyNetworkId, "");
        if(emailResp === false){
            log.error(`Failed to send the password reset email to ${req.body.email}. Please contact the user.`);
            slack.send('#alerts', 'warning',`Failed to send the password reset email to ${req.body.email}. Please contact the user.`);
        }
        else {
            log.info('Reset Password Request Complete');
        }
    }
    // Always send a success response. This prevents leaking information about valid email addresses in our database.
    res.send(200, {
        'code': 'Success',
        'message': 'Password Reset Started'
    });
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addPost('Reset Password', `${basePath}/reset-password`, PostResetPassword);
    server.addPost('Reset Password (depr)', `${basePath}/resetPassword`, PostResetPassword);
};