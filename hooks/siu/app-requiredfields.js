const Hook = require('../Hook.js');


module.exports = class SiuBopRules extends Hook {
    async _process_hook(){
        log.debug(`SiuBopRules running`)
        if(!this.appDoc){
            log.debug(`SiuBopRules missing appDoc`)
            return;
        }
        if(!this.dataPackageJSON.requiredFields){
            log.debug(`SiuBopRules missing requiredFields`)
            return;
        }

        // if hidden the property will not show
        const hidden = 0;

        // if optional the property will show, and be OPTIONAL
        const optional = 5;

        // if required the property will show, and be REQUIRED
        const required = 10;

        //Only BOP?
        if(this.appDoc.hasOwnProperty('policies')){
            const hasBOP = Boolean(this.appDoc.policies.filter(policy => policy.policyType === "BOP").length);
            const hasWC = Boolean(this.appDoc.policies.filter(policy => policy.policyType === "WC").length);
            if(hasBOP && hasWC === false){
                log.debug(`SiuBopRules BOP only`)
                this.dataPackageJSON.requiredFields.location.activityPayrollList.requirement = hidden;
                this.dataPackageJSON.requiredFields.location.activityPayrollList.requirement = hidden;
                this.dataPackageJSON.requiredFields.location.full_time_employees.requirement = optional;
                this.dataPackageJSON.requiredFields.location.part_time_employees.requirement = optional;
                this.dataPackageJSON.requiredFields.owner = {
                    requirement: required,
                    officerTitle: {requirement: hidden},
                    birthdate: {requirement: hidden},
                    ownership: {requirement: hidden},
                    payroll: {requirement: hidden}
                }
                log.debug(`SiuBopRules updated required fields`)
            }
            else {
                log.debug(`SiuBopRules more than BOP hasBOP ${hasBOP} hasWC ${hasWC} ${JSON.stringify(this.appDoc.policies)}`)
            }
        }
        else {
            log.debug(`SiuBopRules no policies`)
        }


    }
}