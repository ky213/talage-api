

/**
     * Constructor for each integration
     *
     * @param {wrkingString} hookName - hook name
     * @param {object} agencyNetworkJSON - agency network object the hook is running for
     * @param {object} dataPackageJSON - The data related to the hook
     * @returns {void}
     */
module.exports = class Hook {

    constructor(hookName, agencyNetworkJSON, dataPackageJSON) {
        this.hookName = hookName
        this.agencyNetworkJSON = agencyNetworkJSON
        this.dataPackageJSON = dataPackageJSON
        if(dataPackageJSON.appDoc){
            this.appDoc = dataPackageJSON.appDoc
        }

        if(dataPackageJSON.agencyJSON){
            this.agencyJSON = dataPackageJSON.agencyJSON
        }

        if(dataPackageJSON.agencyLocationJSON){
            this.agencyLocationJSON = dataPackageJSON.agencyLocationJSON
        }

        if(dataPackageJSON.agencyPortalUserJSON){
            this.agencyPortalUserJSON = dataPackageJSON.agencyPortalUserJSON
        }

    }

    async run_hook() {

        this._process_hook()
    }

}