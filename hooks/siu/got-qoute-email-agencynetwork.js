const Hook = require('../Hook.js');

const siuPolicyEmailRouter = require('./siu-policy-email-router.js');

module.exports = class siuHook extends Hook {
    async _process_hook(){
        log.debug(`in siu-policy-email-router hook` + __location)
        if(!this.appDoc){
            log.error(`siu-policy-email-router hook no appDoc` + __location)
            return;
        }
        if(!this.dataPackageJSON.recipients){
            log.error(`siu-policy-email-router hook no recipients. ${JSON.stringify(this.dataPackageJSON)} ` + __location)
            return;
        }
        this.dataPackageJSON.recipients = await siuPolicyEmailRouter.GetRecipients(this.appDoc, this.dataPackageJSON.recipients, this.agencyNetworkJSON);

    }
}