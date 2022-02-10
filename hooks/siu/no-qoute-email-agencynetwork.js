const Hook = require('../Hook.js');

const siuPolicyEmailRouter = require('./siu-policy-email-router.js');

module.exports = class siuHook extends Hook {
    async _process_hook(){
        if(!this.appDoc){
            return;
        }
        if(!this.dataPackageJSON.recipients){
            return;
        }
        this.dataPackageJSON.recipients = await siuPolicyEmailRouter.GetRecipients(this.appDoc, this.dataPackageJSON.recipients, this.agencyNetworkJSON);

    }
}