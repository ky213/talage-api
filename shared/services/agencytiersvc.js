/* eslint-disable require-jsdoc */
const agencyTiers = [
    {
        "id": 10,
        "name": "New 1"
    },
    {
        "id": 20,
        "name": "New 2"
    },
    {
        "id": 30,
        "name": "Elite"
    },
    {
        "id": 40,
        "name": "Prime"
    },
    {
        "id": 50,
        "name": "Select"
    }
];

function getList() {
    return agencyTiers;
}

function getById(id) {
    if (!id || typeof id !== "number") {
        const error = `agencytiersvc: Error: Invalid id supplied to getById(). ${__location}`;
        log.error(error);
        return null;
    }

    const agencyTier = agencyTiers.find(pp => pp.id === id);

    if (!agencyTier) {
        const error = `agencytiersvc: Error: Could not find agency tier with matching id. ${__location}`;
        log.error(error);
        return null;
    }
    else {
        return agencyTier;
    }
}


module.exports = {
    getList: getList,
    getById: getById
}