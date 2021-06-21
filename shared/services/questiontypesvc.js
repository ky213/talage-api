/* eslint-disable require-jsdoc */
const questionTypes = [
    {
        "id": 1,
        "name": "Yes/No",
        "allow_children": 1
    },
    {
        "id": 2,
        "name": "Checkboxes",
        "allow_children": 1
    },
    {
        "id": 3,
        "name": "Select List",
        "allow_children": 1
    },
    {
        "id": 4,
        "name": "Text - Multiple Lines",
        "allow_children": 0
    },
    {
        "id": 5,
        "name": "Text - Single Line",
        "allow_children": 0
    }
];

function getList() {
    return questionTypes;
}

function getById(id) {
    if (!id || typeof id !== "number") {
        const error = `questiontypesvc: Error: Invalid id supplied to getById(). ${__location}`;
        log.error(error);
        return null;
    }

    const questionType = questionTypes.find(pp => pp.id === id);

    if (!questionType) {
        const error = `questiontypesvc: Error: Could not find question type with matching id. ${__location}`;
        log.error(error);
        return null;
    }
    else {
        return questionType;
    }
}


module.exports = {
    getList: getList,
    getById: getById
}