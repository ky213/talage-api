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
    if (!req.query.page || !req.query.appId && req.query.page !== "_basic") {
        log.info('Bad Request: Parameters missing' + __location);
        return next(serverHelper.requestError('Parameters missing'));
    }
    // This endpoint recieves application Id, we should be able to utilize that to make this endpoint smart, i.e. agencyId for the application to determine policy limits
    const resources = {};

    switch(req.query.page) {
        case "_business-questions":
            membershipTypes(resources);
            break;
        case "_basic":
        case "_basic-created":
            entityTypes(resources);
            break;
        case "_business":
            break;
        case "_claims":
            policyTypes(resources);
            break;
        case "_locations":
            territories(resources);
            employeeTypes(resources);
            unemploymentNumberStates(resources);
            break;
        case "_mailing-address":
            territories(resources);
            break;
        case "_officers":
            officerTitles(resources);
            break;
        case "_policies":
            limitsSelectionAmounts(resources);
            deductibleAmounts(resources);
            policiesEnabled(resources);
            break;
    }

    res.send(200, resources);
}
const membershipTypes = resources => {
    resources.membershipTypes = ['Nevada Resturant Association'];
}
const policiesEnabled = resources => {
    resources.policiesEnabled = [
        "BOP",
        "GL",
        "WC"
    ];
}

const policyTypes = resources => {
    resources.policyTypes = [
        {
            value: "BOP",
            label: "Business Owners Policy (BOP)"
        },
        {
            value: "GL",
            label: "General Liability (GL)"
        },
        {
            value: "WC",
            label: "Workers' Compensation (WC)"
        }
    ];
};

const limitsSelectionAmounts = resources => {
    resources.limitsSelectionAmounts = {
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
            "$100,000 / $500,000 / $100,000",
            "$500,000 / $500,000 / $500,000",
            "$500,000 / $1,000,000 / $500,000",
            "$1,000,000 / $1,000,000 / $1,000,000"
        ]
    }
}

const deductibleAmounts = resources => {
    resources.deductibleAmounts = {
        bop: ["$1500",
            "$1000",
            "$500"],
        gl: ["$1500",
            "$1000",
            "$500"]
    };
}


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
        "Chief Executive Officer",
        "Chief Financial Officer",
        "Chief Operating Officer",
        "Director",
        "Vice President",
        "Executive Vice President",
        "Executive Secy-VP",
        "Executive Secretary",
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
        "VP-Treas",
        "VP-Secy-Treas",
        "VP-Secy"
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
        "Corporation (C-Corp)",
        "Corporation (S-Corp)",
        "Non Profit Corporation",
        "Limited Liability Company (Member Managed)",
        "Limited Liability Company (Manager Managed)",
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

async function getRemoteAddress(req, res, next){
    const remoteAdd = req.connection.remoteAddress;
    if(!remoteAdd){
        next(serverHelper.requestError(`Unable to detect the remote address.`))
    }
    res.send(200, {remoteAddress: req.connection.remoteAddress});
}
/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAppWF("Get Next Route", `${basePath}/resources`, getResources);
    server.addGetAuthAppWF("Get IP Info", `${basePath}/remote-address`, getRemoteAddress);
}