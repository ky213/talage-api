/* eslint-disable default-case */
/* eslint-disable object-curly-newline */
/* eslint-disable require-jsdoc */

"use strict";
const serverHelper = require("../../../server.js");
// const validator = global.requireShared("./helpers/validator.js");
// const ApplicationBO = global.requireShared("models/Application-BO.js");
// const AgencyBO = global.requireShared('models/Agency-BO.js');
// const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
// const ApplicationQuoting = global.requireRootPath('public/v1/quote/helpers/models/Application.js');
// const ActivityCodeBO = global.requireShared('models/ActivityCode-BO.js');

// dummy endpoint to stimulate resources
async function getResources(req, res, next){
    // Let basic through with no app id
    if (!req.query.page || !req.query.appId && req.query.page !== "basic") {
        log.info('Bad Request: Parameters missing' + __location);
        return next(serverHelper.requestError('Parameters missing'));
    }

    const resources = {};

    switch(req.query.page) {
        case "additionalQuestions":
            break;
        case "basic":
            entityTypes(resources);
            break;
        case "business":
            break;
        case "claims":
            break;
        case "locations":
            territories(resources);
            employeeTypes(resources);
            unemploymentNumberStates(resources);
            break;
        case "mailingAddress":
            territories(resources);
            break;
        case "owners":
            officerTitles(resources);
            break;
        case "policies":
            coverageAmounts(resources);
            deductibleAmounts(resources);
            carriersList(resources);
            policiesEnabled(resources);
            break;
    }

    res.send(200, resources);
}
const policiesEnabled = resources => {
    resources.policiesEnabled = ["BOP","GL", "WC"]
}
const coverageAmounts = resources => {
   resources.coverageAmounts = {
       bop: 
       [
           "$1,000,000 / $1,000,000 / $1,000,000", 
           "$1,000,000 / $2,000,000 / $1,000,000",  
           "$1,000,000 / $2,000,000 / $2,000,000"
        ],
       gl: [
           "$1,000,000 / $1,000,000 / $1,000,000",
           "$1,000,000 / $2,000,000 / $1,000,000", 
           "$1,000,000 / $2,000,000 / $2,000,000"
        ],
       wc: [
           "$100,000 / $100,000 / $100,000",
           "$500,000 / $500,000 / $500,000",
           "$500,000 / $1,000,000 / $500,000",
           "$1,000,000 / $1,000,000 / $1,000,000"
        ]
   }
}
const deductibleAmounts = resources => {
    resources.deductibleAmounts ={
        bop: ["$1500, $1000,$500"],
        gl: ["$1500, $1000,$500"],
    }
};
const carriersList = resources => {
    resources.carriersList = {
        bop: 
        [
            "The Hartford",
            "American Family Insurance",
            "Farmers",
            "Progressive"
        ],
        gl: 
        [
            "The Hartford",
            "American Family Insurance",
            "Farmers",
            "Progressive"
        ]
    }
};
const unemploymentNumberStates = resources => {
    resources.unemploymentNumberStates = [
        "CO",
        "HI",
        "ME",
        "MI",
        "MN",
        "NJ",
        "RI",
        "UT"
    ];
}

const officerTitles = resources => {
    // TODO: pull from officer_titles table (sql db)
    resources.officerTitles =
    [
        "VP-Treas",
        "VP-Secy-Treas",
        "VP-Secy",
        "Vice President",
        "Treasurer",
        "Secy-Treas",
        "Secretary",
        "President",
        "Pres-VP-Secy-Treas",
        "Pres-VP-Secy",
        "Pres-VP",
        "Pres-Treas",
        "Pres-Secy-Treas",
        "Pres-Secy",
        "Executive Vice President",
        "Executive Secy-VP",
        "Executive Secretary",
        "Director",
        "Chief Operating Officer",
        "Chief Financial Officer",
        "Chief Executive Officer"
    ];
}

const employeeTypes = resources => {
    resources.employeeTypes =
    [
        "Full Time",
        "Part Time",
        "Owners",
        "Contractors (1099)"
    ];
}

const entityTypes = resources => {
    resources.entityTypes =
    [
        "Association",
        "Corporation",
        "Limited Liability Company",
        "Limited Partnership",
        "Partnership",
        "Sole Proprietorship",
        "Other"
    ];
}

const territories = resources => {
    resources.territories =
    [
        "AK",
        "AL",
        "AR",
        "AZ",
        "CA",
        "CO",
        "CT",
        "DC",
        "DE",
        "FL",
        "GA",
        "HI",
        "IA",
        "ID",
        "IL",
        "IN",
        "KS",
        "KY",
        "LA",
        "MA",
        "MD",
        "ME",
        "MI",
        "MN",
        "MO",
        "MS",
        "MT",
        "NC",
        "ND",
        "NE",
        "NH",
        "NJ",
        "NM",
        "NV",
        "NY",
        "OH",
        "OK",
        "OR",
        "PA",
        "PR",
        "RI",
        "SC",
        "SD",
        "TN",
        "TX",
        "UT",
        "VA",
        "VT",
        "WA",
        "WI",
        "WV",
        "WY"
    ];
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAppWF("Get Next Route", `${basePath}/resources`, getResources);
}