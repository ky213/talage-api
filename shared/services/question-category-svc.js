const questionCategories = [
    {
        "categorySortNumber": 1,
        "categoryName":"Business"
    },
    {
        "categorySortNumber": 2,
        "categoryName":"Employee"
    },
    {
        "categorySortNumber": 3,
        "categoryName":"WorkCondidtions"
    },
    {
        "categorySortNumber": 10,
        "categoryName":"Operations"
    },
    {
        "categorySortNumber": 20,
        "categoryName":"CompanyPractices"
    },
    {
        "categorySortNumber": 25,
        "categoryName":"Drivers"
    },
    {
        "categorySortNumber": 30,
        "categoryName":"Services"
    },
    {
        "categorySortNumber": 40,
        "categoryName":"Alcohol"
    },
    {
        "categorySortNumber": 50,
        "categoryName":"InsurancePolicy"
    }
];

module.exports.getList = function() {
    return questionCategories;
};

// module.exports.getById = function(id) {
//     if (!id || typeof id !== "number") {
//         const error = `question-category: Error: Invalid id supplied to getById(). ${__location}`;
//         log.error(error);
//         return null;
//     }

//     const timezone = questionCategories.find(tz => tz.id === id);

//     if (!timezone) {
//         const error = `timezonesvc: Error: Could not find timezone with matching id. ${__location}`;
//         log.error(error);
//         return null;
//     }
//     else {
//         return timezone;
//     }
// }