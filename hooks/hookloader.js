/* eslint-disable object-curly-newline */
/* eslint-disable object-shorthand */


const fs = require('fs');

/**
 * Load software hook based hookName and agency network
 * @param {string} hookName - Name of hook
 * @param {integer} agencyNetworkId - Agency NetworkId that the hook is to run for
 * @param {object} dataPackageJSON - Data elements needs by hook and can be changed by the hook
 * @returns {result} The result of return_result()
 */
async function loadhook(hookName, agencyNetworkId, dataPackageJSON){
    //
    try{
        const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO');
        const agencyNetworkBO = new AgencyNetworkBO();
        const agencyNetworkDoc = await agencyNetworkBO.getById(agencyNetworkId)
        if(agencyNetworkDoc){
            if(!agencyNetworkDoc.slug){
                agencyNetworkDoc.slug = agencyNetworkDoc.name.trim().
                    replace(/\s/g, '-').
                    replace(/[^a-zA-Z0-9-]/g, '').
                    toLowerCase().
                    substring(0, 50);
            }
            const hookFileName = `${__dirname}/${agencyNetworkDoc.slug}/${hookName}.js`;
            if (hookName.length > 0 && fs.existsSync(hookFileName)) {
                const hookClass = require(hookFileName);
                const hookObj = new hookClass(hookName, agencyNetworkId, dataPackageJSON);
                hookObj.run_hook();

            }

        }
    }
    catch(err){
        log.error(`Softare hook err ${hookName}, agencyNetworkId ${agencyNetworkId} data ${JSON.stringify(dataPackageJSON)} error: ${err}` + __location)
    }
    return;

}


module.exports = {
    loadhook
};