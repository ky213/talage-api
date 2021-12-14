const Hook = require('../Hook.js');


module.exports = class AmTrustAppEditHints extends Hook {
    async _process_hook(){
        if(!this.appDoc){
            return;
        }
        if(!this.dataPackageJSON.hintJson){
            return;
        }
        const hintJson = this.dataPackageJSON.hintJson
        if(hintJson.fein?.hint && this.dataPackageJSON.glBopPolicy){
            hintJson.fein.hint = `FEIN required for ${this.dataPackageJSON.glCarriers.join()} ${this.dataPackageJSON.glBopPolicy}. Check SIU policies about using phone number.`
        }

    }
}