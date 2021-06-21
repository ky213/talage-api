/* eslint-disable require-jsdoc */
const limits = [
    {
        "id": 1,
        "description": "Employers Liability Per Occurrence"
    },
    {
        "id": 2,
        "description": "Employers Liability Disease Per Employee"
    },
    {
        "id": 3,
        "description": "Employers Liability Disease Policy Limit"
    },
    {
        "id": 4,
        "description": "Each Occurrence"
    },
    {
        "id": 5,
        "description": "Damage to Rented Premises"
    },
    {
        "id": 6,
        "description": "Medical Expense"
    },
    {
        "id": 7,
        "description": "Personal & Advertising Injury"
    },
    {
        "id": 8,
        "description": "General Aggregate"
    },
    {
        "id": 9,
        "description": "Products & Completed Operations"
    },
    {
        "id": 10,
        "description": "Business Personal Property"
    },
    {
        "id": 11,
        "description": "Aggregate"
    },
    {
        "id": 12,
        "description": "Deductible"
    }
];

function getList() {
    return limits;
}

function getById(id) {
    if (!id || typeof id !== "number") {
        const error = `limitsvc: Error: Invalid id supplied to getById(). ${__location}`;
        log.error(error);
        return null;
    }

    const limit = limits.find(l => l.id === id);

    if (!limit) {
        const error = `limitsvc: Error: Could not find limit with matching id. ${__location}`;
        log.error(error);
        return null;
    }
    else {
        return limit;
    }
}


module.exports = {
    getList: getList,
    getById: getById
}