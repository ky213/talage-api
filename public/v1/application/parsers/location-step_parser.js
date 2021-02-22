/* eslint-disable prefer-const */
/* eslint-disable no-extra-parens */
/* eslint-disable dot-notation */
/* eslint-disable array-element-newline */
'use strict';

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

exports.process = async function(requestJSON) {

    // move to business and contact info
    // to businessInfo
    //Clean inputs

    if (requestJSON.locations) {
        const locationsJSON = JSON.parse(requestJSON.locations);
        let territories = [];
        let locationsList = [];
        let zip = null;
        let city = null;
        let state_abbr = null;
        const makeInt = true;
        for (var i = 0; i < locationsJSON.length; i++) {
            // eslint-disable-next-line prefer-const
            let locationJSON = locationsJSON[i];
            locationJSON.address = stringFunctions.santizeString(locationJSON.address);
            locationJSON.address2 = stringFunctions.santizeString(locationJSON.address2);
            locationJSON.billing = stringFunctions.santizeNumber(locationJSON.billing);
            if (locationJSON.billing && locationJSON.billing > 1) {
                delete locationJSON.billing
            }
            // locationJSON.full_time_employees = locationJSON.full_time_employees;
            // locationJSON.part_time_employees = stringFunctions.santizeNumber(locationJSON.part_time_employees, makeInt);
            //locationJSON.square_footage = stringFunctions.santizeNumber(locationJSON.square_footage);
            locationJSON.unemployment_num = stringFunctions.santizeNumber(locationJSON.unemployment_num);
            locationJSON.zip = stringFunctions.santizeString(locationJSON.zip);
            if(i === 0){
                zip = locationJSON.zip;
                city = locationJSON.city;
                state_abbr = locationJSON.territory;
            }
            locationJSON.zipcode = locationJSON.zip;
            locationJSON.state_abbr = locationJSON.territory;

            const territory = stringFunctions.santizeString(locationJSON.territory);
            territories.push(territory);
            const fullTimeEmployee = locationJSON.full_time_employees ? locationJSON.part_time_employees : 0;
            const partTimeEmployee = locationJSON.part_time_employees ? locationJSON.part_time_employees : 0;
            const totalEmployee = fullTimeEmployee + partTimeEmployee;

            if (locationJSON.questions) {
                let questionList = [];
                // eslint-disable-next-line guard-for-in
                const rawQuestionList = Object.values(locationJSON.questions);
                for (const rawQuestion of rawQuestionList) {
                    // console.log("rawQuestion", rawQuestion);
                    if (rawQuestion.answer) {
                        let question = {"id": rawQuestion.id};
                        if (typeof rawQuestion.answer === "object") {
                            question.answer = Object.values(rawQuestion.answer);
                        }
                        else {
                            question.answer = rawQuestion.answer;
                        }
                        if (Array.isArray(question.answer)) {
                            question.type = "array";
                        }
                        else if (typeof question.answer === "string") {
                            question.type = "text";
                        }
                        else {
                            question.type = "numeric";
                        }
                        questionList.push(question);
                    }
                }
                locationJSON.questions = questionList;
            }

            const check_payroll = totalEmployee > 0 && locationJSON.territory === "NV"
            let activity_codes = [];
            if (locationJSON.activity_codes) {
                // eslint-disable-next-line guard-for-in
                for (const activity in locationJSON.activity_codes) {
                    const activityJSON = locationJSON.activity_codes[activity]
                    const id = activityJSON.id;
                    let payroll = activityJSON.payroll;
                    let employeeTypeList = activityJSON.employee_type_list;
                    // 2020-12-29 New activity-based employee type handling -SF
                    if (employeeTypeList) {
                        // Convert the employeeTypeList from an object {"0":{id:XXXX, ...}} to an array
                        employeeTypeList = Object.values(employeeTypeList);
                        if (!payroll) {
                            // If the payroll isn't present in the submitted data, sum it from
                            // the employeeTypeList
                            payroll = 0;
                            for (const employeeType of employeeTypeList) {
                                payroll += employeeType.employee_type_payroll;
                            }
                        }
                    }
                    else {
                        employeeTypeList = [];
                    }
                    // Check payroll for Nevada WC compliance
                    if (check_payroll === true) {
                        if ((payroll / totalEmployee) > 36000) {
                            payroll = 36000 * totalEmployee;
                        }
                    }
                    const activity_code = {
                        "id": id,
                        "payroll": payroll,
                        "employeeTypeList": employeeTypeList
                    }
                    activity_codes.push(activity_code);
                } //for activity
            } // if activtiy_codes
            locationJSON.activity_codes = activity_codes;
            locationsList.push(locationJSON)
        } //for locations
        const mailing = JSON.parse(requestJSON.mailing);
        const mailing_address = stringFunctions.santizeString(mailing.mailing_address);
        const mailing_address2 = stringFunctions.santizeString(mailing.mailing_address2);
        const mailing_city = stringFunctions.santizeString(mailing.mailing_city);
        const mailing_state_abbr = stringFunctions.santizeString(mailing.mailing_territory);
        const mailing_zip = stringFunctions.santizeString(mailing.mailing_zip);

        const agency_location = stringFunctions.santizeNumber(requestJSON.agency_location, makeInt);

        requestJSON.businessInfo = {
            'mailing_address': mailing_address,
            'mailing_address2': mailing_address2,
            'mailing_city': mailing_city,
            'mailing_state_abbr': mailing_state_abbr,
            'mailing_zip': mailing_zip,
            'mailing_zipcode': mailing_zip,
            'zip': zip,
            'city': city,
            'state_abbr': state_abbr
        };
        requestJSON.businessInfo.locations = locationsList;
        //for mongoose model
        requestJSON.locations = locationsList;
        requestJSON.businessInfo.territories = territories;
        //application info

        //Only include it if exists. b/c of how the model works.
        if(agency_location > 0){
            log.debug("location parse setting agency location to " + agency_location);
            requestJSON.agency_location = agency_location
        }
        else if (requestJSON.agency_location || requestJSON.agency_location === null) {
            delete requestJSON.agency_location
            //ApplicationBO will lookup primary location on save if necessary.
        }
        requestJSON.territories = territories;
        requestJSON.city = city;
        requestJSON.state_abbr = state_abbr;
        requestJSON.zip = zip;
        requestJSON.zipcode = zip;

        delete requestJSON.mailing;
        // delete requestJSON.locations;
        // log.debug("Location Parser requestJSON: " + JSON.stringify(requestJSON));
    }
    else {
        log.error("No locations provided in location step" + __location)
    }

    return true;
}