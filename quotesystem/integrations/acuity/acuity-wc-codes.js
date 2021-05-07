"use strict";

// Acuity uses a standard NCCI code for the major code, but uses a custom sub code.
// This resolvees a standard NCCI code to a Acuity-specific activity code with sub

exports.getAcuityNCCICode = function(ncciCode, territory) {
    // First make sure we have an Acuity code for the given NCCI Code / territory
    for (const wcCode of wcCodeList) {
        if (wcCode.ncciCode === ncciCode && wcCode.territory === territory) {
            return wcCode.acuityCode;
        }
    }
    return `${ncciCode}00`;
};

// Direct copy and paste from their v3 spreadsheet, duplicates and all to preserve original data.
const wcCodeList = [
    {
        ncciCode: "0042",
        territory: "AZ",
        acuityCode: "004200"
    },
    {
        ncciCode: "2003",
        territory: "AZ",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "AZ",
        acuityCode: "258501"
    },
    {
        ncciCode: "3076",
        territory: "AZ",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "AZ",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "AZ",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "AZ",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "AZ",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "AZ",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "AZ",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "AZ",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "AZ",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "AZ",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "AZ",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "AZ",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "AZ",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "AZ",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "AZ",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "AZ",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "AZ",
        acuityCode: "518316"
    },
    {
        ncciCode: "5183",
        territory: "AZ",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "AZ",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "AZ",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "AZ",
        acuityCode: "519002"
    },
    {
        ncciCode: "5191",
        territory: "AZ",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "AZ",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "AZ",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "AZ",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "AZ",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "AZ",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "AZ",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "AZ",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "AZ",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "AZ",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "AZ",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "AZ",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "AZ",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "AZ",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "AZ",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "AZ",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "AZ",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "AZ",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "AZ",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "AZ",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "AZ",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "AZ",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "AZ",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "AZ",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "AZ",
        acuityCode: "547803"
    },
    {
        ncciCode: "5491",
        territory: "AZ",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "AZ",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "AZ",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "AZ",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "AZ",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "AZ",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "AZ",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "AZ",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "AZ",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "AZ",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "AZ",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "AZ",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "AZ",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "AZ",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "AZ",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "AZ",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "AZ",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "AZ",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "AZ",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "AZ",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "AZ",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "AZ",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "AZ",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "AZ",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "AZ",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "AZ",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "AZ",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "AZ",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "AZ",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "AZ",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "AZ",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "AZ",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "AZ",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "AZ",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "AZ",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "AZ",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "AZ",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "AZ",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "AZ",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "AZ",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "CO",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "CO",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "CO",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "CO",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "CO",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "CO",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "CO",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "CO",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "CO",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "CO",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "CO",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "CO",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "CO",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "CO",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "CO",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "CO",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "CO",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "CO",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "CO",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "CO",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "CO",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "CO",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "CO",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "CO",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "CO",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "CO",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "CO",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "CO",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "CO",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "CO",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "CO",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "CO",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "CO",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "CO",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "CO",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "CO",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "CO",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "CO",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "CO",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "CO",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "CO",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "CO",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "CO",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "CO",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "CO",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "CO",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "CO",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "CO",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "CO",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "CO",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "CO",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "CO",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "CO",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "CO",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "CO",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "CO",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "CO",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "CO",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "CO",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "CO",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "CO",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "CO",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "CO",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "CO",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "CO",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "CO",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "CO",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "CO",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "CO",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "CO",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "CO",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "CO",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "CO",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "CO",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "CO",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "CO",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "CO",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "CO",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "CO",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "CO",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "CO",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "CO",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "CO",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "CO",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "CO",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "CO",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "CO",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "CO",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "CO",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "IA",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "IA",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "IA",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "IA",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "IA",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "IA",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "IA",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "IA",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "IA",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "IA",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "IA",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "IA",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "IA",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "IA",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "IA",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "IA",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "IA",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "IA",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "IA",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "IA",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "IA",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "IA",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "IA",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "IA",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "IA",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "IA",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "IA",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "IA",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "IA",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "IA",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "IA",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "IA",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "IA",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "IA",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "IA",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "IA",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "IA",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "IA",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "IA",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "IA",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "IA",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "IA",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "IA",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "IA",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "IA",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "IA",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "IA",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "IA",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "IA",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "IA",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "IA",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "IA",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "IA",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "IA",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "IA",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "IA",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "IA",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "IA",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "IA",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "IA",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "IA",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "IA",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "IA",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "IA",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "IA",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "IA",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "IA",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "IA",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "IA",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "IA",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "IA",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "IA",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "IA",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "IA",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "IA",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "IA",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "IA",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "IA",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "IA",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "IA",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "IA",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "IA",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "IA",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "IA",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "IA",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "IA",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "IA",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "IA",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "IA",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "ID",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "ID",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "ID",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "ID",
        acuityCode: "258501"
    },
    {
        ncciCode: "2585",
        territory: "ID",
        acuityCode: "258505"
    },
    {
        ncciCode: "3365",
        territory: "ID",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "ID",
        acuityCode: "372407"
    },
    {
        ncciCode: "4130",
        territory: "ID",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "ID",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "ID",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "ID",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "ID",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "ID",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "ID",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "ID",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "ID",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "ID",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "ID",
        acuityCode: "518300"
    },
    {
        ncciCode: "5190",
        territory: "ID",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "ID",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "ID",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "ID",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "ID",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "ID",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "ID",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "ID",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "ID",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "ID",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "ID",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "ID",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "ID",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "ID",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "ID",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "ID",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "ID",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "ID",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "ID",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "ID",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "ID",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "ID",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "ID",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "ID",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "ID",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "ID",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "ID",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "ID",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "ID",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "ID",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "ID",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "ID",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "ID",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "ID",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "ID",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "ID",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "ID",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "ID",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "ID",
        acuityCode: "621700"
    },
    {
        ncciCode: "6217",
        territory: "ID",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "ID",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "ID",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "ID",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "ID",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "ID",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "ID",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "ID",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "ID",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "ID",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "ID",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "ID",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "ID",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "ID",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "ID",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "ID",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "ID",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "ID",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "ID",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "ID",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "ID",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "ID",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "ID",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "ID",
        acuityCode: "951900"
    },
    {
        ncciCode: "9521",
        territory: "ID",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "ID",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "IL",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "IL",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "IL",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "IL",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "IL",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "IL",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "IL",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "IL",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "IL",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "IL",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "IL",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "IL",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "IL",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "IL",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "IL",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "IL",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "IL",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "IL",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "IL",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "IL",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "IL",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "IL",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "IL",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "IL",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "IL",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "IL",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "IL",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "IL",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "IL",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "IL",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "IL",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "IL",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "IL",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "IL",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "IL",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "IL",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "IL",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "IL",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "IL",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "IL",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "IL",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "IL",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "IL",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "IL",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "IL",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "IL",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "IL",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "IL",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "IL",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "IL",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "IL",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "IL",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "IL",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "IL",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "IL",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "IL",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "IL",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "IL",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "IL",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "IL",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "IL",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "IL",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "IL",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "IL",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "IL",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "IL",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "IL",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "IL",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "IL",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "IL",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "IL",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "IL",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "IL",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "IL",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "IL",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "IL",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "IL",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "IL",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "IL",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "IL",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "IL",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "IL",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "IL",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "IL",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "IL",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "IL",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "IL",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "IL",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "IL",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "IN",
        acuityCode: "004200"
    },
    {
        ncciCode: "2003",
        territory: "IN",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "IN",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "IN",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "IN",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "IN",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "IN",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "IN",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "IN",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "IN",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "IN",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "IN",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "IN",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "IN",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "IN",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "IN",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "IN",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "IN",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "IN",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "IN",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "IN",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "IN",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "IN",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "IN",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "IN",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "IN",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "IN",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "IN",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "IN",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "IN",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "IN",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "IN",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "IN",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "IN",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "IN",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "IN",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "IN",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "IN",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "IN",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "IN",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "IN",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "IN",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "IN",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "IN",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "IN",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "IN",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "IN",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "IN",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "IN",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "IN",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "IN",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "IN",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "IN",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "IN",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "IN",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "IN",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "IN",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "IN",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "IN",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "IN",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "IN",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "IN",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "IN",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "IN",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "IN",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "IN",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "IN",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "IN",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "IN",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "IN",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "IN",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "IN",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "IN",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "IN",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "IN",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "IN",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "IN",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "IN",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "IN",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "IN",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "IN",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "IN",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "IN",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "IN",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "IN",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "IN",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "IN",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "IN",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "KS",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "KS",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "KS",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "KS",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "KS",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "KS",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "KS",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "KS",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "KS",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "KS",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "KS",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "KS",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "KS",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "KS",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "KS",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "KS",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "KS",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "KS",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "KS",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "KS",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "KS",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "KS",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "KS",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "KS",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "KS",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "KS",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "KS",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "KS",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "KS",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "KS",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "KS",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "KS",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "KS",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "KS",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "KS",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "KS",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "KS",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "KS",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "KS",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "KS",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "KS",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "KS",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "KS",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "KS",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "KS",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "KS",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "KS",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "KS",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "KS",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "KS",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "KS",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "KS",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "KS",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "KS",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "KS",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "KS",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "KS",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "KS",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "KS",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "KS",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "KS",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "KS",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "KS",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "KS",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "KS",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "KS",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "KS",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "KS",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "KS",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "KS",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "KS",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "KS",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "KS",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "KS",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "KS",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "KS",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "KS",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "KS",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "KS",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "KS",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "KS",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "KS",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "KS",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "KS",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "KS",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "KS",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "KS",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "KS",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "KS",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "KY",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "KY",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "KY",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "KY",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "KY",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "KY",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "KY",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "KY",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "KY",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "KY",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "KY",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "KY",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "KY",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "KY",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "KY",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "KY",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "KY",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "KY",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "KY",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "KY",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "KY",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "KY",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "KY",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "KY",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "KY",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "KY",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "KY",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "KY",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "KY",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "KY",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "KY",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "KY",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "KY",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "KY",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "KY",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "KY",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "KY",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "KY",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "KY",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "KY",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "KY",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "KY",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "KY",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "KY",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "KY",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "KY",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "KY",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "KY",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "KY",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "KY",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "KY",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "KY",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "KY",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "KY",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "KY",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "KY",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "KY",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "KY",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "KY",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "KY",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "KY",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "KY",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "KY",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "KY",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "KY",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "KY",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "KY",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "KY",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "KY",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "KY",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "KY",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "KY",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "KY",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "KY",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "KY",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "KY",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "KY",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "KY",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "KY",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "KY",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "KY",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "KY",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "KY",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "KY",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "KY",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "KY",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "KY",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "KY",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "KY",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "ME",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "ME",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "ME",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "ME",
        acuityCode: "258501"
    },
    {
        ncciCode: "3076",
        territory: "ME",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "ME",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "ME",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "ME",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "ME",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "ME",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "ME",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "ME",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "ME",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "ME",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "ME",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "ME",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "ME",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "ME",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "ME",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "ME",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "ME",
        acuityCode: "518316"
    },
    {
        ncciCode: "5183",
        territory: "ME",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "ME",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "ME",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "ME",
        acuityCode: "519002"
    },
    {
        ncciCode: "5191",
        territory: "ME",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "ME",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "ME",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "ME",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "ME",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "ME",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "ME",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "ME",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "ME",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "ME",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "ME",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "ME",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "ME",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "ME",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "ME",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "ME",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "ME",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "ME",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "ME",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "ME",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "ME",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "ME",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "ME",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "ME",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "ME",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "ME",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "ME",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "ME",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "ME",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "ME",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "ME",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "ME",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "ME",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "ME",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "ME",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "ME",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "ME",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "ME",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "ME",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "ME",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "ME",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "ME",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "ME",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "ME",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "ME",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "ME",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "ME",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "ME",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "ME",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "ME",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "ME",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "ME",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "ME",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "ME",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "ME",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "ME",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "ME",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "ME",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "ME",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "ME",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "ME",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "ME",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "ME",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "ME",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "ME",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "MI",
        acuityCode: "004200"
    },
    {
        ncciCode: "2003",
        territory: "MI",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "MI",
        acuityCode: "258500"
    },
    {
        ncciCode: "3076",
        territory: "MI",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "MI",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "MI",
        acuityCode: "336500"
    },
    {
        ncciCode: "3724",
        territory: "MI",
        acuityCode: "372407"
    },
    {
        ncciCode: "4130",
        territory: "MI",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "MI",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "MI",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "MI",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "MI",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "MI",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "MI",
        acuityCode: "510200"
    },
    {
        ncciCode: "5146",
        territory: "MI",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "MI",
        acuityCode: "518303"
    },
    {
        ncciCode: "5183",
        territory: "MI",
        acuityCode: "518303"
    },
    {
        ncciCode: "5183",
        territory: "MI",
        acuityCode: "518303"
    },
    {
        ncciCode: "5183",
        territory: "MI",
        acuityCode: "518316"
    },
    {
        ncciCode: "5183",
        territory: "MI",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "MI",
        acuityCode: "519001"
    },
    {
        ncciCode: "5190",
        territory: "MI",
        acuityCode: "519001"
    },
    {
        ncciCode: "5190",
        territory: "MI",
        acuityCode: "519002"
    },
    {
        ncciCode: "5191",
        territory: "MI",
        acuityCode: "519100"
    },
    {
        ncciCode: "5191",
        territory: "MI",
        acuityCode: "519102"
    },
    {
        ncciCode: "5213",
        territory: "MI",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "MI",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "MI",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "MI",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "MI",
        acuityCode: "522101"
    },
    {
        ncciCode: "5348",
        territory: "MI",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "MI",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "MI",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "MI",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "MI",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "MI",
        acuityCode: "540301"
    },
    {
        ncciCode: "5437",
        territory: "MI",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "MI",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "MI",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "MI",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "MI",
        acuityCode: "546200"
    },
    {
        ncciCode: "5476",
        territory: "MI",
        acuityCode: "547600"
    },
    {
        ncciCode: "5476",
        territory: "MI",
        acuityCode: "547600"
    },
    {
        ncciCode: "5476",
        territory: "MI",
        acuityCode: "547601"
    },
    {
        ncciCode: "5480",
        territory: "MI",
        acuityCode: "548000"
    },
    {
        ncciCode: "5538",
        territory: "MI",
        acuityCode: "553800"
    },
    {
        ncciCode: "5538",
        territory: "MI",
        acuityCode: "553803"
    },
    {
        ncciCode: "5550",
        territory: "MI",
        acuityCode: "555000"
    },
    {
        ncciCode: "5550",
        territory: "MI",
        acuityCode: "555000"
    },
    {
        ncciCode: "5550",
        territory: "MI",
        acuityCode: "555000"
    },
    {
        ncciCode: "5550",
        territory: "MI",
        acuityCode: "555000"
    },
    {
        ncciCode: "5551",
        territory: "MI",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "MI",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "MI",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "MI",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "MI",
        acuityCode: "621703"
    },
    {
        ncciCode: "6217",
        territory: "MI",
        acuityCode: "621704"
    },
    {
        ncciCode: "6229",
        territory: "MI",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "MI",
        acuityCode: "640000"
    },
    {
        ncciCode: "6400",
        territory: "MI",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "MI",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "MI",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "MI",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "MI",
        acuityCode: "803100"
    },
    {
        ncciCode: "8387",
        territory: "MI",
        acuityCode: "838701"
    },
    {
        ncciCode: "8387",
        territory: "MI",
        acuityCode: "838701"
    },
    {
        ncciCode: "8387",
        territory: "MI",
        acuityCode: "838703"
    },
    {
        ncciCode: "8601",
        territory: "MI",
        acuityCode: "860104"
    },
    {
        ncciCode: "9015",
        territory: "MI",
        acuityCode: "901500"
    },
    {
        ncciCode: "9015",
        territory: "MI",
        acuityCode: "901500"
    },
    {
        ncciCode: "9015",
        territory: "MI",
        acuityCode: "901503"
    },
    {
        ncciCode: "9015",
        territory: "MI",
        acuityCode: "901509"
    },
    {
        ncciCode: "9015",
        territory: "MI",
        acuityCode: "901511"
    },
    {
        ncciCode: "9015",
        territory: "MI",
        acuityCode: "901514"
    },
    {
        ncciCode: "9102",
        territory: "MI",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "MI",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "MI",
        acuityCode: "950109"
    },
    {
        ncciCode: "9519",
        territory: "MI",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "MI",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "MI",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "MI",
        acuityCode: "951901"
    },
    {
        ncciCode: "9519",
        territory: "MI",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "MI",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "MI",
        acuityCode: "952100"
    },
    {
        ncciCode: "9521",
        territory: "MI",
        acuityCode: "952100"
    },
    {
        ncciCode: "9521",
        territory: "MI",
        acuityCode: "952102"
    },
    {
        ncciCode: "9586",
        territory: "MI",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "MN",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "MN",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "MN",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "MN",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "MN",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "MN",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "MN",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "MN",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "MN",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "MN",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "MN",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "MN",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "MN",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "MN",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "MN",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "MN",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "MN",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "MN",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "MN",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "MN",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "MN",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "MN",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "MN",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "MN",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "MN",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "MN",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "MN",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "MN",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "MN",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "MN",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "MN",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "MN",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "MN",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "MN",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "MN",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "MN",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "MN",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "MN",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "MN",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "MN",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "MN",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "MN",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "MN",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "MN",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "MN",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "MN",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "MN",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "MN",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "MN",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "MN",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "MN",
        acuityCode: "549100"
    },
    {
        ncciCode: "5537",
        territory: "MN",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "MN",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "MN",
        acuityCode: "553700"
    },
    {
        ncciCode: "5538",
        territory: "MN",
        acuityCode: "553800"
    },
    {
        ncciCode: "5538",
        territory: "MN",
        acuityCode: "553801"
    },
    {
        ncciCode: "5538",
        territory: "MN",
        acuityCode: "553808"
    },
    {
        ncciCode: "5551",
        territory: "MN",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "MN",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "MN",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "MN",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "MN",
        acuityCode: "564501"
    },
    {
        ncciCode: "5645",
        territory: "MN",
        acuityCode: "564503"
    },
    {
        ncciCode: "5645",
        territory: "MN",
        acuityCode: "564504"
    },
    {
        ncciCode: "6217",
        territory: "MN",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "MN",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "MN",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "MN",
        acuityCode: "640000"
    },
    {
        ncciCode: "6400",
        territory: "MN",
        acuityCode: "640000"
    },
    {
        ncciCode: "7605",
        territory: "MN",
        acuityCode: "760502"
    },
    {
        ncciCode: "8006",
        territory: "MN",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "MN",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "MN",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "MN",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "MN",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "MN",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "MN",
        acuityCode: "838004"
    },
    {
        ncciCode: "8601",
        territory: "MN",
        acuityCode: "860104"
    },
    {
        ncciCode: "9012",
        territory: "MN",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "MN",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "MN",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "MN",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "MN",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "MN",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "MN",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "MN",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "MN",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "MN",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "MN",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "MN",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "MN",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "MN",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "MN",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "MN",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "MN",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "MO",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "MO",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "MO",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "MO",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "MO",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "MO",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "MO",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "MO",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "MO",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "MO",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "MO",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "MO",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "MO",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "MO",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "MO",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "MO",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "MO",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "MO",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "MO",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "MO",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "MO",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "MO",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "MO",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "MO",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "MO",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "MO",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "MO",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "MO",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "MO",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "MO",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "MO",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "MO",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "MO",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "MO",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "MO",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "MO",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "MO",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "MO",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "MO",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "MO",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "MO",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "MO",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "MO",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "MO",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "MO",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "MO",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "MO",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "MO",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "MO",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "MO",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "MO",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "MO",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "MO",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "MO",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "MO",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "MO",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "MO",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "MO",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "MO",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "MO",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "MO",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "MO",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "MO",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "MO",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "MO",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "MO",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "MO",
        acuityCode: "803100"
    },
    {
        ncciCode: "8387",
        territory: "MO",
        acuityCode: "838700"
    },
    {
        ncciCode: "8387",
        territory: "MO",
        acuityCode: "838700"
    },
    {
        ncciCode: "8387",
        territory: "MO",
        acuityCode: "838703"
    },
    {
        ncciCode: "8391",
        territory: "MO",
        acuityCode: "839105"
    },
    {
        ncciCode: "8602",
        territory: "MO",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "MO",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "MO",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "MO",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "MO",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "MO",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "MO",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "MO",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "MO",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "MO",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "MO",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "MO",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "MO",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "MO",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "MO",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "MO",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "MO",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "MO",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "MO",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "MT",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "MT",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "MT",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "MT",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "MT",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "MT",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "MT",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "MT",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "MT",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "MT",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "MT",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "MT",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "MT",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "MT",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "MT",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "MT",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "MT",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "MT",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "MT",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "MT",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "MT",
        acuityCode: "518316"
    },
    {
        ncciCode: "5183",
        territory: "MT",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "MT",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "MT",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "MT",
        acuityCode: "519002"
    },
    {
        ncciCode: "5191",
        territory: "MT",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "MT",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "MT",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "MT",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "MT",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "MT",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "MT",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "MT",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "MT",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "MT",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "MT",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "MT",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "MT",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "MT",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "MT",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "MT",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "MT",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "MT",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "MT",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "MT",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "MT",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "MT",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "MT",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "MT",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "MT",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "MT",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "MT",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "MT",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "MT",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "MT",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "MT",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "MT",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "MT",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "MT",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "MT",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "MT",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "MT",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "MT",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "MT",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "MT",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "MT",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "MT",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "MT",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "MT",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "MT",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "MT",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "MT",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "MT",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "MT",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "MT",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "MT",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "MT",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "MT",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "MT",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "MT",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "MT",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "MT",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "MT",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "MT",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "MT",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "MT",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "MT",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "MT",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "MT",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "MT",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "MT",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "ND",
        acuityCode: "004202"
    },
    {
        ncciCode: "2003",
        territory: "ND",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "ND",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "ND",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "ND",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "ND",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "ND",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "ND",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "ND",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "ND",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "ND",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "ND",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "ND",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "ND",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "ND",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "ND",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "ND",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "ND",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "ND",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "ND",
        acuityCode: "518316"
    },
    {
        ncciCode: "5183",
        territory: "ND",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "ND",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "ND",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "ND",
        acuityCode: "519002"
    },
    {
        ncciCode: "5191",
        territory: "ND",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "ND",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "ND",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "ND",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "ND",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "ND",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "ND",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "ND",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "ND",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "ND",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "ND",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "ND",
        acuityCode: "540300"
    },
    {
        ncciCode: "5437",
        territory: "ND",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "ND",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "ND",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "ND",
        acuityCode: "544500"
    },
    {
        ncciCode: "5445",
        territory: "ND",
        acuityCode: "544501"
    },
    {
        ncciCode: "5462",
        territory: "ND",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "ND",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "ND",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "ND",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "ND",
        acuityCode: "547403"
    },
    {
        ncciCode: "5480",
        territory: "ND",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "ND",
        acuityCode: "549100"
    },
    {
        ncciCode: "5537",
        territory: "ND",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "ND",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "ND",
        acuityCode: "553700"
    },
    {
        ncciCode: "5538",
        territory: "ND",
        acuityCode: "553800"
    },
    {
        ncciCode: "5538",
        territory: "ND",
        acuityCode: "553801"
    },
    {
        ncciCode: "5551",
        territory: "ND",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "ND",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "ND",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "ND",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "ND",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "ND",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "ND",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "ND",
        acuityCode: "640000"
    },
    {
        ncciCode: "7605",
        territory: "ND",
        acuityCode: "760502"
    },
    {
        ncciCode: "8006",
        territory: "ND",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "ND",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "ND",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "ND",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "ND",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "ND",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "ND",
        acuityCode: "838004"
    },
    {
        ncciCode: "8601",
        territory: "ND",
        acuityCode: "860104"
    },
    {
        ncciCode: "9014",
        territory: "ND",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "ND",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "ND",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "ND",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "ND",
        acuityCode: "901500"
    },
    {
        ncciCode: "9015",
        territory: "ND",
        acuityCode: "901509"
    },
    {
        ncciCode: "9015",
        territory: "ND",
        acuityCode: "901511"
    },
    {
        ncciCode: "9015",
        territory: "ND",
        acuityCode: "901514"
    },
    {
        ncciCode: "9102",
        territory: "ND",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "ND",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "ND",
        acuityCode: "950101"
    },
    {
        ncciCode: "9519",
        territory: "ND",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "ND",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "ND",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "ND",
        acuityCode: "951904"
    },
    {
        ncciCode: "9519",
        territory: "ND",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "ND",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "ND",
        acuityCode: "952100"
    },
    {
        ncciCode: "9521",
        territory: "ND",
        acuityCode: "952100"
    },
    {
        ncciCode: "9521",
        territory: "ND",
        acuityCode: "952102"
    },
    {
        ncciCode: "9586",
        territory: "ND",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "NE",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "NE",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "NE",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "NE",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "NE",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "NE",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "NE",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "NE",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "NE",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "NE",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "NE",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "NE",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "NE",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "NE",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "NE",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "NE",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "NE",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "NE",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "NE",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "NE",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "NE",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "NE",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "NE",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "NE",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "NE",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "NE",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "NE",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "NE",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "NE",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "NE",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "NE",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "NE",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "NE",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "NE",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "NE",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "NE",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "NE",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "NE",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "NE",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "NE",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "NE",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "NE",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "NE",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "NE",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "NE",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "NE",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "NE",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "NE",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "NE",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "NE",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "NE",
        acuityCode: "553505"
    },
    {
        ncciCode: "5535",
        territory: "NE",
        acuityCode: "553506"
    },
    {
        ncciCode: "5537",
        territory: "NE",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "NE",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "NE",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "NE",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "NE",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "NE",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "NE",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "NE",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "NE",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "NE",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "NE",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "NE",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "NE",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "NE",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "NE",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "NE",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "NE",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "NE",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "NE",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "NE",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "NE",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "NE",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "NE",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "NE",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "NE",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "NE",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "NE",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "NE",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "NE",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "NE",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "NE",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "NE",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "NE",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "NE",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "NE",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "NE",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "NE",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "NH",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "NH",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "NH",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "NH",
        acuityCode: "258501"
    },
    {
        ncciCode: "3365",
        territory: "NH",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "NH",
        acuityCode: "372407"
    },
    {
        ncciCode: "4130",
        territory: "NH",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "NH",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "NH",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "NH",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "NH",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "NH",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "NH",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "NH",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "NH",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "NH",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "NH",
        acuityCode: "518300"
    },
    {
        ncciCode: "5190",
        territory: "NH",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "NH",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "NH",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "NH",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "NH",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "NH",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "NH",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "NH",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "NH",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "NH",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "NH",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "NH",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "NH",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "NH",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "NH",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "NH",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "NH",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "NH",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "NH",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "NH",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "NH",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "NH",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "NH",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "NH",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "NH",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "NH",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "NH",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "NH",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "NH",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "NH",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "NH",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "NH",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "NH",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "NH",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "NH",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "NH",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "NH",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "NH",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "NH",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "NH",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "NH",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "NH",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "NH",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "NH",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "NH",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "NH",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "NH",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "NH",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "NH",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "NH",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "NH",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "NH",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "NH",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "NH",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "NH",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "NH",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "NH",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "NH",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "NH",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "NH",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "NH",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "NH",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "NH",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "NH",
        acuityCode: "951904"
    },
    {
        ncciCode: "9521",
        territory: "NH",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "NH",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "NM",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "NM",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "NM",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "NM",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "NM",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "NM",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "NM",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "NM",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "NM",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "NM",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "NM",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "NM",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "NM",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "NM",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "NM",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "NM",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "NM",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "NM",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "NM",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "NM",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "NM",
        acuityCode: "518316"
    },
    {
        ncciCode: "5183",
        territory: "NM",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "NM",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "NM",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "NM",
        acuityCode: "519002"
    },
    {
        ncciCode: "5191",
        territory: "NM",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "NM",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "NM",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "NM",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "NM",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "NM",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "NM",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "NM",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "NM",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "NM",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "NM",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "NM",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "NM",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "NM",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "NM",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "NM",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "NM",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "NM",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "NM",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "NM",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "NM",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "NM",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "NM",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "NM",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "NM",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "NM",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "NM",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "NM",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "NM",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "NM",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "NM",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "NM",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "NM",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "NM",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "NM",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "NM",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "NM",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "NM",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "NM",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "NM",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "NM",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "NM",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "NM",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "NM",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "NM",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "NM",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "NM",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "NM",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "NM",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "NM",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "NM",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "NM",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "NM",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "NM",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "NM",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "NM",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "NM",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "NM",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "NM",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "NM",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "NM",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "NM",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "NM",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "NM",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "NM",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "NM",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "NV",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "NV",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "NV",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "NV",
        acuityCode: "258501"
    },
    {
        ncciCode: "3076",
        territory: "NV",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "NV",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "NV",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "NV",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "NV",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "NV",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "NV",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "NV",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "NV",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "NV",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "NV",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "NV",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "NV",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "NV",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "NV",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "NV",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "NV",
        acuityCode: "518316"
    },
    {
        ncciCode: "5183",
        territory: "NV",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "NV",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "NV",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "NV",
        acuityCode: "519002"
    },
    {
        ncciCode: "5191",
        territory: "NV",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "NV",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "NV",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "NV",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "NV",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "NV",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "NV",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "NV",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "NV",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "NV",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "NV",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "NV",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "NV",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "NV",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "NV",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "NV",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "NV",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "NV",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "NV",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "NV",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "NV",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "NV",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "NV",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "NV",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "NV",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "NV",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "NV",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "NV",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "NV",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "NV",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "NV",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "NV",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "NV",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "NV",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "NV",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "NV",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "NV",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "NV",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "NV",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "NV",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "NV",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "NV",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "NV",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "NV",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "NV",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "NV",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "NV",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "NV",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "NV",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "NV",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "NV",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "NV",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "NV",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "NV",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "NV",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "NV",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "NV",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "NV",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "NV",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "NV",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "NV",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "NV",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "NV",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "NV",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "NV",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "OH",
        acuityCode: "004202"
    },
    {
        ncciCode: "0917",
        territory: "OH",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "OH",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "OH",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "OH",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "OH",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "OH",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "OH",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "OH",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "OH",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "OH",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "OH",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "OH",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "OH",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "OH",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "OH",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "OH",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "OH",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "OH",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "OH",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "OH",
        acuityCode: "518316"
    },
    {
        ncciCode: "5183",
        territory: "OH",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "OH",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "OH",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "OH",
        acuityCode: "519002"
    },
    {
        ncciCode: "5191",
        territory: "OH",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "OH",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "OH",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "OH",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "OH",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "OH",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "OH",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "OH",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "OH",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "OH",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "OH",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "OH",
        acuityCode: "540300"
    },
    {
        ncciCode: "5437",
        territory: "OH",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "OH",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "OH",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "OH",
        acuityCode: "544500"
    },
    {
        ncciCode: "5445",
        territory: "OH",
        acuityCode: "544501"
    },
    {
        ncciCode: "5462",
        territory: "OH",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "OH",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "OH",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "OH",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "OH",
        acuityCode: "547403"
    },
    {
        ncciCode: "5480",
        territory: "OH",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "OH",
        acuityCode: "549100"
    },
    {
        ncciCode: "5537",
        territory: "OH",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "OH",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "OH",
        acuityCode: "553700"
    },
    {
        ncciCode: "5538",
        territory: "OH",
        acuityCode: "553800"
    },
    {
        ncciCode: "5538",
        territory: "OH",
        acuityCode: "553801"
    },
    {
        ncciCode: "5551",
        territory: "OH",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "OH",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "OH",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "OH",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "OH",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "OH",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "OH",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "OH",
        acuityCode: "640000"
    },
    {
        ncciCode: "7605",
        territory: "OH",
        acuityCode: "760502"
    },
    {
        ncciCode: "8006",
        territory: "OH",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "OH",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "OH",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "OH",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "OH",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "OH",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "OH",
        acuityCode: "838004"
    },
    {
        ncciCode: "8601",
        territory: "OH",
        acuityCode: "860104"
    },
    {
        ncciCode: "9014",
        territory: "OH",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "OH",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "OH",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "OH",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "OH",
        acuityCode: "901500"
    },
    {
        ncciCode: "9015",
        territory: "OH",
        acuityCode: "901509"
    },
    {
        ncciCode: "9015",
        territory: "OH",
        acuityCode: "901511"
    },
    {
        ncciCode: "9015",
        territory: "OH",
        acuityCode: "901514"
    },
    {
        ncciCode: "9102",
        territory: "OH",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "OH",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "OH",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "OH",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "OH",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "OH",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "OH",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "OH",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "OH",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "OH",
        acuityCode: "952100"
    },
    {
        ncciCode: "9521",
        territory: "OH",
        acuityCode: "952100"
    },
    {
        ncciCode: "9521",
        territory: "OH",
        acuityCode: "952102"
    },
    {
        ncciCode: "9586",
        territory: "OH",
        acuityCode: "958602"
    },
    {
        ncciCode: "9102",
        territory: "PA",
        acuityCode: "001200"
    },
    {
        ncciCode: "9102",
        territory: "PA",
        acuityCode: "001206"
    },
    {
        ncciCode: "9102",
        territory: "PA",
        acuityCode: "010500"
    },
    {
        ncciCode: "2585",
        territory: "PA",
        acuityCode: "014101"
    },
    {
        ncciCode: "5102",
        territory: "PA",
        acuityCode: "041300"
    },
    {
        ncciCode: "4130",
        territory: "PA",
        acuityCode: "053601"
    },
    {
        ncciCode: "5221",
        territory: "PA",
        acuityCode: "060800"
    },
    {
        ncciCode: "5221",
        territory: "PA",
        acuityCode: "060804"
    },
    {
        ncciCode: "6217",
        territory: "PA",
        acuityCode: "060900"
    },
    {
        ncciCode: "6217",
        territory: "PA",
        acuityCode: "060910"
    },
    {
        ncciCode: "6229",
        territory: "PA",
        acuityCode: "060922"
    },
    {
        ncciCode: "5445",
        territory: "PA",
        acuityCode: "064500"
    },
    {
        ncciCode: "5146",
        territory: "PA",
        acuityCode: "064600"
    },
    {
        ncciCode: "5437",
        territory: "PA",
        acuityCode: "064800"
    },
    {
        ncciCode: "5437",
        territory: "PA",
        acuityCode: "064803"
    },
    {
        ncciCode: "5403",
        territory: "PA",
        acuityCode: "065107"
    },
    {
        ncciCode: "5403",
        territory: "PA",
        acuityCode: "065107"
    },
    {
        ncciCode: "6400",
        territory: "PA",
        acuityCode: "065109"
    },
    {
        ncciCode: "5645",
        territory: "PA",
        acuityCode: "065119"
    },
    {
        ncciCode: "6400",
        territory: "PA",
        acuityCode: "065123"
    },
    {
        ncciCode: "5102",
        territory: "PA",
        acuityCode: "065127"
    },
    {
        ncciCode: "6400",
        territory: "PA",
        acuityCode: "065129"
    },
    {
        ncciCode: "6400",
        territory: "PA",
        acuityCode: "065130"
    },
    {
        ncciCode: "5645",
        territory: "PA",
        acuityCode: "065200"
    },
    {
        ncciCode: "5645",
        territory: "PA",
        acuityCode: "065200"
    },
    {
        ncciCode: "5403",
        territory: "PA",
        acuityCode: "065204"
    },
    {
        ncciCode: "5403",
        territory: "PA",
        acuityCode: "065212"
    },
    {
        ncciCode: "5102",
        territory: "PA",
        acuityCode: "065214"
    },
    {
        ncciCode: "5022",
        territory: "PA",
        acuityCode: "065300"
    },
    {
        ncciCode: "5022",
        territory: "PA",
        acuityCode: "065316"
    },
    {
        ncciCode: "5022",
        territory: "PA",
        acuityCode: "065323"
    },
    {
        ncciCode: "5213",
        territory: "PA",
        acuityCode: "065400"
    },
    {
        ncciCode: "3365",
        territory: "PA",
        acuityCode: "065523"
    },
    {
        ncciCode: "5551",
        territory: "PA",
        acuityCode: "065904"
    },
    {
        ncciCode: "0660",
        territory: "PA",
        acuityCode: "066008"
    },
    {
        ncciCode: "5190",
        territory: "PA",
        acuityCode: "066104"
    },
    {
        ncciCode: "5190",
        territory: "PA",
        acuityCode: "066111"
    },
    {
        ncciCode: "9519",
        territory: "PA",
        acuityCode: "066202"
    },
    {
        ncciCode: "9519",
        territory: "PA",
        acuityCode: "066202"
    },
    {
        ncciCode: "9519",
        territory: "PA",
        acuityCode: "066202"
    },
    {
        ncciCode: "5183",
        territory: "PA",
        acuityCode: "066318"
    },
    {
        ncciCode: "5183",
        territory: "PA",
        acuityCode: "066318"
    },
    {
        ncciCode: "5183",
        territory: "PA",
        acuityCode: "066318"
    },
    {
        ncciCode: "5537",
        territory: "PA",
        acuityCode: "066400"
    },
    {
        ncciCode: "5537",
        territory: "PA",
        acuityCode: "066400"
    },
    {
        ncciCode: "9519",
        territory: "PA",
        acuityCode: "066409"
    },
    {
        ncciCode: "5474",
        territory: "PA",
        acuityCode: "066500"
    },
    {
        ncciCode: "5474",
        territory: "PA",
        acuityCode: "066500"
    },
    {
        ncciCode: "5474",
        territory: "PA",
        acuityCode: "066500"
    },
    {
        ncciCode: "5491",
        territory: "PA",
        acuityCode: "066700"
    },
    {
        ncciCode: "5491",
        territory: "PA",
        acuityCode: "066700"
    },
    {
        ncciCode: "5348",
        territory: "PA",
        acuityCode: "066802"
    },
    {
        ncciCode: "5480",
        territory: "PA",
        acuityCode: "066901"
    },
    {
        ncciCode: "9521",
        territory: "PA",
        acuityCode: "067000"
    },
    {
        ncciCode: "5478",
        territory: "PA",
        acuityCode: "067001"
    },
    {
        ncciCode: "5478",
        territory: "PA",
        acuityCode: "067004"
    },
    {
        ncciCode: "3724",
        territory: "PA",
        acuityCode: "067507"
    },
    {
        ncciCode: "5535",
        territory: "PA",
        acuityCode: "067600"
    },
    {
        ncciCode: "5535",
        territory: "PA",
        acuityCode: "067603"
    },
    {
        ncciCode: "9501",
        territory: "PA",
        acuityCode: "067903"
    },
    {
        ncciCode: "8380",
        territory: "PA",
        acuityCode: "081500"
    },
    {
        ncciCode: "8380",
        territory: "PA",
        acuityCode: "081500"
    },
    {
        ncciCode: "8380",
        territory: "PA",
        acuityCode: "081517"
    },
    {
        ncciCode: "0898",
        territory: "PA",
        acuityCode: "089803"
    },
    {
        ncciCode: "8031",
        territory: "PA",
        acuityCode: "091500"
    },
    {
        ncciCode: "8006",
        territory: "PA",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "PA",
        acuityCode: "091800"
    },
    {
        ncciCode: "8013",
        territory: "PA",
        acuityCode: "092000"
    },
    {
        ncciCode: "8017",
        territory: "PA",
        acuityCode: "092800"
    },
    {
        ncciCode: "4361",
        territory: "PA",
        acuityCode: "092842"
    },
    {
        ncciCode: "5191",
        territory: "PA",
        acuityCode: "095200"
    },
    {
        ncciCode: "8601",
        territory: "PA",
        acuityCode: "095517"
    },
    {
        ncciCode: "0966",
        territory: "PA",
        acuityCode: "096600"
    },
    {
        ncciCode: "0971",
        territory: "PA",
        acuityCode: "097100"
    },
    {
        ncciCode: "5537",
        territory: "PA",
        acuityCode: "097105"
    },
    {
        ncciCode: "9014",
        territory: "PA",
        acuityCode: "097114"
    },
    {
        ncciCode: "9014",
        territory: "PA",
        acuityCode: "097120"
    },
    {
        ncciCode: "9014",
        territory: "PA",
        acuityCode: "097125"
    },
    {
        ncciCode: "9586",
        territory: "PA",
        acuityCode: "097700"
    },
    {
        ncciCode: "0042",
        territory: "SD",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "SD",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "SD",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "SD",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "SD",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "SD",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "SD",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "SD",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "SD",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "SD",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "SD",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "SD",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "SD",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "SD",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "SD",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "SD",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "SD",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "SD",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "SD",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "SD",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "SD",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "SD",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "SD",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "SD",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "SD",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "SD",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "SD",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "SD",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "SD",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "SD",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "SD",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "SD",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "SD",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "SD",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "SD",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "SD",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "SD",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "SD",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "SD",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "SD",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "SD",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "SD",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "SD",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "SD",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "SD",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "SD",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "SD",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "SD",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "SD",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "SD",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "SD",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "SD",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "SD",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "SD",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "SD",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "SD",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "SD",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "SD",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "SD",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "SD",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "SD",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "SD",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "SD",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "SD",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "SD",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "SD",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "SD",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "SD",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "SD",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "SD",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "SD",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "SD",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "SD",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "SD",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "SD",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "SD",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "SD",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "SD",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "SD",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "SD",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "SD",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "SD",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "SD",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "SD",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "SD",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "SD",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "SD",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "SD",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "SD",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "TN",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "TN",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "TN",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "TN",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "TN",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "TN",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "TN",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "TN",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "TN",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "TN",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "TN",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "TN",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "TN",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "TN",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "TN",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "TN",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "TN",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "TN",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "TN",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "TN",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "TN",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "TN",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "TN",
        acuityCode: "519000"
    },
    {
        ncciCode: "5191",
        territory: "TN",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "TN",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "TN",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "TN",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "TN",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "TN",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "TN",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "TN",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "TN",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "TN",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "TN",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "TN",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "TN",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "TN",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "TN",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "TN",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "TN",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "TN",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "TN",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "TN",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "TN",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "TN",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "TN",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "TN",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "TN",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "TN",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "TN",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "TN",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "TN",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "TN",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "TN",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "TN",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "TN",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "TN",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "TN",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "TN",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "TN",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "TN",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "TN",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "TN",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "TN",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "TN",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "TN",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "TN",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "TN",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "TN",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "TN",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "TN",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "TN",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "TN",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "TN",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "TN",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "TN",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "TN",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "TN",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "TN",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "TN",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "TN",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "TN",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "TN",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "TN",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "TN",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "TN",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "TN",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "TN",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "TN",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "TX",
        acuityCode: "004201"
    },
    {
        ncciCode: "0042",
        territory: "TX",
        acuityCode: "004201"
    },
    {
        ncciCode: "2003",
        territory: "TX",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "TX",
        acuityCode: "258100"
    },
    {
        ncciCode: "3365",
        territory: "TX",
        acuityCode: "336505"
    },
    {
        ncciCode: "9519",
        territory: "TX",
        acuityCode: "372409"
    },
    {
        ncciCode: "4130",
        territory: "TX",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "TX",
        acuityCode: "436104"
    },
    {
        ncciCode: "5022",
        territory: "TX",
        acuityCode: "502206"
    },
    {
        ncciCode: "5022",
        territory: "TX",
        acuityCode: "502210"
    },
    {
        ncciCode: "5022",
        territory: "TX",
        acuityCode: "502211"
    },
    {
        ncciCode: "5102",
        territory: "TX",
        acuityCode: "510205"
    },
    {
        ncciCode: "5102",
        territory: "TX",
        acuityCode: "510206"
    },
    {
        ncciCode: "5478",
        territory: "TX",
        acuityCode: "510210"
    },
    {
        ncciCode: "5146",
        territory: "TX",
        acuityCode: "510212"
    },
    {
        ncciCode: "9521",
        territory: "TX",
        acuityCode: "510213"
    },
    {
        ncciCode: "5102",
        territory: "TX",
        acuityCode: "510215"
    },
    {
        ncciCode: "5183",
        territory: "TX",
        acuityCode: "518314"
    },
    {
        ncciCode: "5183",
        territory: "TX",
        acuityCode: "518314"
    },
    {
        ncciCode: "5183",
        territory: "TX",
        acuityCode: "518314"
    },
    {
        ncciCode: "5190",
        territory: "TX",
        acuityCode: "519005"
    },
    {
        ncciCode: "5190",
        territory: "TX",
        acuityCode: "519005"
    },
    {
        ncciCode: "5190",
        territory: "TX",
        acuityCode: "519005"
    },
    {
        ncciCode: "5190",
        territory: "TX",
        acuityCode: "519005"
    },
    {
        ncciCode: "5190",
        territory: "TX",
        acuityCode: "519005"
    },
    {
        ncciCode: "5190",
        territory: "TX",
        acuityCode: "519005"
    },
    {
        ncciCode: "5191",
        territory: "TX",
        acuityCode: "519108"
    },
    {
        ncciCode: "5221",
        territory: "TX",
        acuityCode: "520001"
    },
    {
        ncciCode: "5213",
        territory: "TX",
        acuityCode: "521304"
    },
    {
        ncciCode: "5213",
        territory: "TX",
        acuityCode: "521307"
    },
    {
        ncciCode: "5220",
        territory: "TX",
        acuityCode: "522001"
    },
    {
        ncciCode: "5348",
        territory: "TX",
        acuityCode: "534804"
    },
    {
        ncciCode: "5348",
        territory: "TX",
        acuityCode: "534808"
    },
    {
        ncciCode: "5437",
        territory: "TX",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "TX",
        acuityCode: "540304"
    },
    {
        ncciCode: "5403",
        territory: "TX",
        acuityCode: "540305"
    },
    {
        ncciCode: "5403",
        territory: "TX",
        acuityCode: "540305"
    },
    {
        ncciCode: "5403",
        territory: "TX",
        acuityCode: "540308"
    },
    {
        ncciCode: "5437",
        territory: "TX",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "TX",
        acuityCode: "543701"
    },
    {
        ncciCode: "5445",
        territory: "TX",
        acuityCode: "543703"
    },
    {
        ncciCode: "5437",
        territory: "TX",
        acuityCode: "543705"
    },
    {
        ncciCode: "5437",
        territory: "TX",
        acuityCode: "543709"
    },
    {
        ncciCode: "5462",
        territory: "TX",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "TX",
        acuityCode: "547402"
    },
    {
        ncciCode: "5474",
        territory: "TX",
        acuityCode: "547402"
    },
    {
        ncciCode: "5474",
        territory: "TX",
        acuityCode: "547402"
    },
    {
        ncciCode: "5474",
        territory: "TX",
        acuityCode: "547406"
    },
    {
        ncciCode: "5491",
        territory: "TX",
        acuityCode: "549102"
    },
    {
        ncciCode: "5537",
        territory: "TX",
        acuityCode: "553600"
    },
    {
        ncciCode: "5537",
        territory: "TX",
        acuityCode: "553600"
    },
    {
        ncciCode: "5537",
        territory: "TX",
        acuityCode: "553600"
    },
    {
        ncciCode: "5535",
        territory: "TX",
        acuityCode: "553805"
    },
    {
        ncciCode: "5538",
        territory: "TX",
        acuityCode: "553808"
    },
    {
        ncciCode: "5551",
        territory: "TX",
        acuityCode: "555100"
    },
    {
        ncciCode: "6217",
        territory: "TX",
        acuityCode: "621920"
    },
    {
        ncciCode: "6217",
        territory: "TX",
        acuityCode: "621923"
    },
    {
        ncciCode: "6219",
        territory: "TX",
        acuityCode: "621936"
    },
    {
        ncciCode: "6400",
        territory: "TX",
        acuityCode: "640001"
    },
    {
        ncciCode: "7600",
        territory: "TX",
        acuityCode: "760005"
    },
    {
        ncciCode: "7600",
        territory: "TX",
        acuityCode: "760007"
    },
    {
        ncciCode: "7600",
        territory: "TX",
        acuityCode: "760007"
    },
    {
        ncciCode: "7600",
        territory: "TX",
        acuityCode: "760008"
    },
    {
        ncciCode: "8006",
        territory: "TX",
        acuityCode: "800606"
    },
    {
        ncciCode: "8013",
        territory: "TX",
        acuityCode: "801300"
    },
    {
        ncciCode: "9519",
        territory: "TX",
        acuityCode: "801744"
    },
    {
        ncciCode: "8017",
        territory: "TX",
        acuityCode: "8017D2"
    },
    {
        ncciCode: "8031",
        territory: "TX",
        acuityCode: "803303"
    },
    {
        ncciCode: "8017",
        territory: "TX",
        acuityCode: "838701"
    },
    {
        ncciCode: "8380",
        territory: "TX",
        acuityCode: "839113"
    },
    {
        ncciCode: "8380",
        territory: "TX",
        acuityCode: "839113"
    },
    {
        ncciCode: "8380",
        territory: "TX",
        acuityCode: "839131"
    },
    {
        ncciCode: "8601",
        territory: "TX",
        acuityCode: "860108"
    },
    {
        ncciCode: "9014",
        territory: "TX",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "TX",
        acuityCode: "901414"
    },
    {
        ncciCode: "9102",
        territory: "TX",
        acuityCode: "901416"
    },
    {
        ncciCode: "9014",
        territory: "TX",
        acuityCode: "901426"
    },
    {
        ncciCode: "9015",
        territory: "TX",
        acuityCode: "901507"
    },
    {
        ncciCode: "9015",
        territory: "TX",
        acuityCode: "901523"
    },
    {
        ncciCode: "9501",
        territory: "TX",
        acuityCode: "950105"
    },
    {
        ncciCode: "9586",
        territory: "TX",
        acuityCode: "958600"
    },
    {
        ncciCode: "0042",
        territory: "UT",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "UT",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "UT",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "UT",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "UT",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "UT",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "UT",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "UT",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "UT",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "UT",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "UT",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "UT",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "UT",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "UT",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "UT",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "UT",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "UT",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "UT",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "UT",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "UT",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "UT",
        acuityCode: "518316"
    },
    {
        ncciCode: "5183",
        territory: "UT",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "UT",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "UT",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "UT",
        acuityCode: "519002"
    },
    {
        ncciCode: "5191",
        territory: "UT",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "UT",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "UT",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "UT",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "UT",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "UT",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "UT",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "UT",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "UT",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "UT",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "UT",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "UT",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "UT",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "UT",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "UT",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "UT",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "UT",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "UT",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "UT",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "UT",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "UT",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "UT",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "UT",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "UT",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "UT",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "UT",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "UT",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "UT",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "UT",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "UT",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "UT",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "UT",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "UT",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "UT",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "UT",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "UT",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "UT",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "UT",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "UT",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "UT",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "UT",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "UT",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "UT",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "UT",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "UT",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "UT",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "UT",
        acuityCode: "838004"
    },
    {
        ncciCode: "8601",
        territory: "UT",
        acuityCode: "860104"
    },
    {
        ncciCode: "8602",
        territory: "UT",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "UT",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "UT",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "UT",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "UT",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "UT",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "UT",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "UT",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "UT",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "UT",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "UT",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "UT",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "UT",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "UT",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "UT",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "UT",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "UT",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "UT",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "UT",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "VA",
        acuityCode: "004201"
    },
    {
        ncciCode: "0917",
        territory: "VA",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "VA",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "VA",
        acuityCode: "258500"
    },
    {
        ncciCode: "3076",
        territory: "VA",
        acuityCode: "307624"
    },
    {
        ncciCode: "3179",
        territory: "VA",
        acuityCode: "317916"
    },
    {
        ncciCode: "3365",
        territory: "VA",
        acuityCode: "336501"
    },
    {
        ncciCode: "3724",
        territory: "VA",
        acuityCode: "372403"
    },
    {
        ncciCode: "3724",
        territory: "VA",
        acuityCode: "372416"
    },
    {
        ncciCode: "4130",
        territory: "VA",
        acuityCode: "413001"
    },
    {
        ncciCode: "4361",
        territory: "VA",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "VA",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "VA",
        acuityCode: "502203"
    },
    {
        ncciCode: "5102",
        territory: "VA",
        acuityCode: "510203"
    },
    {
        ncciCode: "5102",
        territory: "VA",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "VA",
        acuityCode: "514606"
    },
    {
        ncciCode: "5183",
        territory: "VA",
        acuityCode: "518313"
    },
    {
        ncciCode: "5183",
        territory: "VA",
        acuityCode: "518313"
    },
    {
        ncciCode: "5183",
        territory: "VA",
        acuityCode: "518313"
    },
    {
        ncciCode: "5183",
        territory: "VA",
        acuityCode: "518316"
    },
    {
        ncciCode: "5190",
        territory: "VA",
        acuityCode: "519003"
    },
    {
        ncciCode: "5190",
        territory: "VA",
        acuityCode: "519003"
    },
    {
        ncciCode: "5191",
        territory: "VA",
        acuityCode: "519106"
    },
    {
        ncciCode: "5213",
        territory: "VA",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "VA",
        acuityCode: "521301"
    },
    {
        ncciCode: "5213",
        territory: "VA",
        acuityCode: "521302"
    },
    {
        ncciCode: "5215",
        territory: "VA",
        acuityCode: "521502"
    },
    {
        ncciCode: "5221",
        territory: "VA",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "VA",
        acuityCode: "522105"
    },
    {
        ncciCode: "5348",
        territory: "VA",
        acuityCode: "534804"
    },
    {
        ncciCode: "5348",
        territory: "VA",
        acuityCode: "534805"
    },
    {
        ncciCode: "5403",
        territory: "VA",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "VA",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "VA",
        acuityCode: "540305"
    },
    {
        ncciCode: "5437",
        territory: "VA",
        acuityCode: "543702"
    },
    {
        ncciCode: "5437",
        territory: "VA",
        acuityCode: "543703"
    },
    {
        ncciCode: "5445",
        territory: "VA",
        acuityCode: "544502"
    },
    {
        ncciCode: "5462",
        territory: "VA",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "VA",
        acuityCode: "547404"
    },
    {
        ncciCode: "5474",
        territory: "VA",
        acuityCode: "547404"
    },
    {
        ncciCode: "5474",
        territory: "VA",
        acuityCode: "547404"
    },
    {
        ncciCode: "5478",
        territory: "VA",
        acuityCode: "547800"
    },
    {
        ncciCode: "5480",
        territory: "VA",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "VA",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "VA",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "VA",
        acuityCode: "553504"
    },
    {
        ncciCode: "5537",
        territory: "VA",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "VA",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "VA",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "VA",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "VA",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "VA",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "VA",
        acuityCode: "564501"
    },
    {
        ncciCode: "6217",
        territory: "VA",
        acuityCode: "621703"
    },
    {
        ncciCode: "6217",
        territory: "VA",
        acuityCode: "621704"
    },
    {
        ncciCode: "6229",
        territory: "VA",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "VA",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "VA",
        acuityCode: "800610"
    },
    {
        ncciCode: "8013",
        territory: "VA",
        acuityCode: "801309"
    },
    {
        ncciCode: "8017",
        territory: "VA",
        acuityCode: "801734"
    },
    {
        ncciCode: "8031",
        territory: "VA",
        acuityCode: "803101"
    },
    {
        ncciCode: "8380",
        territory: "VA",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "VA",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "VA",
        acuityCode: "838007"
    },
    {
        ncciCode: "8602",
        territory: "VA",
        acuityCode: "860203"
    },
    {
        ncciCode: "9012",
        territory: "VA",
        acuityCode: "901201"
    },
    {
        ncciCode: "9014",
        territory: "VA",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "VA",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "VA",
        acuityCode: "901410"
    },
    {
        ncciCode: "9015",
        territory: "VA",
        acuityCode: "901504"
    },
    {
        ncciCode: "9102",
        territory: "VA",
        acuityCode: "910200"
    },
    {
        ncciCode: "9501",
        territory: "VA",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "VA",
        acuityCode: "951601"
    },
    {
        ncciCode: "9516",
        territory: "VA",
        acuityCode: "951601"
    },
    {
        ncciCode: "9516",
        territory: "VA",
        acuityCode: "951603"
    },
    {
        ncciCode: "9516",
        territory: "VA",
        acuityCode: "951604"
    },
    {
        ncciCode: "9519",
        territory: "VA",
        acuityCode: "951905"
    },
    {
        ncciCode: "9519",
        territory: "VA",
        acuityCode: "951905"
    },
    {
        ncciCode: "9519",
        territory: "VA",
        acuityCode: "951905"
    },
    {
        ncciCode: "9519",
        territory: "VA",
        acuityCode: "951906"
    },
    {
        ncciCode: "9519",
        territory: "VA",
        acuityCode: "951907"
    },
    {
        ncciCode: "9521",
        territory: "VA",
        acuityCode: "952104"
    },
    {
        ncciCode: "9586",
        territory: "VA",
        acuityCode: "958600"
    },
    {
        ncciCode: "0042",
        territory: "VT",
        acuityCode: "004200"
    },
    {
        ncciCode: "0917",
        territory: "VT",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "VT",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "VT",
        acuityCode: "258501"
    },
    {
        ncciCode: "3076",
        territory: "VT",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "VT",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "VT",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "VT",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "VT",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "VT",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "VT",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "VT",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "VT",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "VT",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "VT",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "VT",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "VT",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "VT",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "VT",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "VT",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "VT",
        acuityCode: "518316"
    },
    {
        ncciCode: "5183",
        territory: "VT",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "VT",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "VT",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "VT",
        acuityCode: "519002"
    },
    {
        ncciCode: "5191",
        territory: "VT",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "VT",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "VT",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "VT",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "VT",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "VT",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "VT",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "VT",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "VT",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "VT",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "VT",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "VT",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "VT",
        acuityCode: "540304"
    },
    {
        ncciCode: "5437",
        territory: "VT",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "VT",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "VT",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "VT",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "VT",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "VT",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "VT",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "VT",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "VT",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "VT",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "VT",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "VT",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "VT",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "VT",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "VT",
        acuityCode: "553501"
    },
    {
        ncciCode: "5535",
        territory: "VT",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "VT",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "VT",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "VT",
        acuityCode: "553700"
    },
    {
        ncciCode: "5551",
        territory: "VT",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "VT",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "VT",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "VT",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "VT",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "VT",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "VT",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "VT",
        acuityCode: "640000"
    },
    {
        ncciCode: "8006",
        territory: "VT",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "VT",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "VT",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "VT",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "VT",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "VT",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "VT",
        acuityCode: "838004"
    },
    {
        ncciCode: "8602",
        territory: "VT",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "VT",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "VT",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "VT",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "VT",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "VT",
        acuityCode: "901500"
    },
    {
        ncciCode: "9102",
        territory: "VT",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "VT",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "VT",
        acuityCode: "950101"
    },
    {
        ncciCode: "9516",
        territory: "VT",
        acuityCode: "951600"
    },
    {
        ncciCode: "9516",
        territory: "VT",
        acuityCode: "951600"
    },
    {
        ncciCode: "9519",
        territory: "VT",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "VT",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "VT",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "VT",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "VT",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "VT",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "VT",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "WI",
        acuityCode: "004200"
    },
    {
        ncciCode: "0042",
        territory: "WI",
        acuityCode: "004202"
    },
    {
        ncciCode: "0917",
        territory: "WI",
        acuityCode: "091700"
    },
    {
        ncciCode: "2003",
        territory: "WI",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "WI",
        acuityCode: "258505"
    },
    {
        ncciCode: "3365",
        territory: "WI",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "WI",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "WI",
        acuityCode: "372410"
    },
    {
        ncciCode: "4130",
        territory: "WI",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "WI",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "WI",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "WI",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "WI",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "WI",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "WI",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "WI",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "WI",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "WI",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "WI",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "WI",
        acuityCode: "518316"
    },
    {
        ncciCode: "5183",
        territory: "WI",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "WI",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "WI",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "WI",
        acuityCode: "519002"
    },
    {
        ncciCode: "5191",
        territory: "WI",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "WI",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "WI",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "WI",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "WI",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "WI",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "WI",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "WI",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "WI",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "WI",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "WI",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "WI",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "WI",
        acuityCode: "540301"
    },
    {
        ncciCode: "5437",
        territory: "WI",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "WI",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "WI",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "WI",
        acuityCode: "544500"
    },
    {
        ncciCode: "5462",
        territory: "WI",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "WI",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "WI",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "WI",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "WI",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "WI",
        acuityCode: "547403"
    },
    {
        ncciCode: "5478",
        territory: "WI",
        acuityCode: "547800"
    },
    {
        ncciCode: "5478",
        territory: "WI",
        acuityCode: "547801"
    },
    {
        ncciCode: "5478",
        territory: "WI",
        acuityCode: "547803"
    },
    {
        ncciCode: "5480",
        territory: "WI",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "WI",
        acuityCode: "549100"
    },
    {
        ncciCode: "5535",
        territory: "WI",
        acuityCode: "553500"
    },
    {
        ncciCode: "5535",
        territory: "WI",
        acuityCode: "553502"
    },
    {
        ncciCode: "5537",
        territory: "WI",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "WI",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "WI",
        acuityCode: "553700"
    },
    {
        ncciCode: "5538",
        territory: "WI",
        acuityCode: "553801"
    },
    {
        ncciCode: "5551",
        territory: "WI",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "WI",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "WI",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "WI",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "WI",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "WI",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "WI",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "WI",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "WI",
        acuityCode: "640000"
    },
    {
        ncciCode: "7605",
        territory: "WI",
        acuityCode: "760502"
    },
    {
        ncciCode: "8006",
        territory: "WI",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "WI",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "WI",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "WI",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "WI",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "WI",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "WI",
        acuityCode: "838004"
    },
    {
        ncciCode: "8380",
        territory: "WI",
        acuityCode: "838006"
    },
    {
        ncciCode: "8602",
        territory: "WI",
        acuityCode: "860200"
    },
    {
        ncciCode: "9012",
        territory: "WI",
        acuityCode: "901200"
    },
    {
        ncciCode: "9014",
        territory: "WI",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "WI",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "WI",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "WI",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "WI",
        acuityCode: "901500"
    },
    {
        ncciCode: "9501",
        territory: "WI",
        acuityCode: "950101"
    },
    {
        ncciCode: "9519",
        territory: "WI",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "WI",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "WI",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "WI",
        acuityCode: "951904"
    },
    {
        ncciCode: "9521",
        territory: "WI",
        acuityCode: "952100"
    },
    {
        ncciCode: "9586",
        territory: "WI",
        acuityCode: "958602"
    },
    {
        ncciCode: "0042",
        territory: "WY",
        acuityCode: "004202"
    },
    {
        ncciCode: "2003",
        territory: "WY",
        acuityCode: "200300"
    },
    {
        ncciCode: "2585",
        territory: "WY",
        acuityCode: "258505"
    },
    {
        ncciCode: "3076",
        territory: "WY",
        acuityCode: "307618"
    },
    {
        ncciCode: "3179",
        territory: "WY",
        acuityCode: "317903"
    },
    {
        ncciCode: "3365",
        territory: "WY",
        acuityCode: "336502"
    },
    {
        ncciCode: "3724",
        territory: "WY",
        acuityCode: "372407"
    },
    {
        ncciCode: "3724",
        territory: "WY",
        acuityCode: "372415"
    },
    {
        ncciCode: "4130",
        territory: "WY",
        acuityCode: "413000"
    },
    {
        ncciCode: "4361",
        territory: "WY",
        acuityCode: "436100"
    },
    {
        ncciCode: "5022",
        territory: "WY",
        acuityCode: "502200"
    },
    {
        ncciCode: "5022",
        territory: "WY",
        acuityCode: "502201"
    },
    {
        ncciCode: "5022",
        territory: "WY",
        acuityCode: "502202"
    },
    {
        ncciCode: "5102",
        territory: "WY",
        acuityCode: "510200"
    },
    {
        ncciCode: "5102",
        territory: "WY",
        acuityCode: "510206"
    },
    {
        ncciCode: "5146",
        territory: "WY",
        acuityCode: "514600"
    },
    {
        ncciCode: "5183",
        territory: "WY",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "WY",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "WY",
        acuityCode: "518300"
    },
    {
        ncciCode: "5183",
        territory: "WY",
        acuityCode: "518316"
    },
    {
        ncciCode: "5183",
        territory: "WY",
        acuityCode: "518323"
    },
    {
        ncciCode: "5190",
        territory: "WY",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "WY",
        acuityCode: "519000"
    },
    {
        ncciCode: "5190",
        territory: "WY",
        acuityCode: "519002"
    },
    {
        ncciCode: "5191",
        territory: "WY",
        acuityCode: "519100"
    },
    {
        ncciCode: "5213",
        territory: "WY",
        acuityCode: "521300"
    },
    {
        ncciCode: "5213",
        territory: "WY",
        acuityCode: "521301"
    },
    {
        ncciCode: "5215",
        territory: "WY",
        acuityCode: "521500"
    },
    {
        ncciCode: "5221",
        territory: "WY",
        acuityCode: "522100"
    },
    {
        ncciCode: "5221",
        territory: "WY",
        acuityCode: "522101"
    },
    {
        ncciCode: "5221",
        territory: "WY",
        acuityCode: "522103"
    },
    {
        ncciCode: "5348",
        territory: "WY",
        acuityCode: "534800"
    },
    {
        ncciCode: "5348",
        territory: "WY",
        acuityCode: "534807"
    },
    {
        ncciCode: "5348",
        territory: "WY",
        acuityCode: "534810"
    },
    {
        ncciCode: "5403",
        territory: "WY",
        acuityCode: "540300"
    },
    {
        ncciCode: "5403",
        territory: "WY",
        acuityCode: "540300"
    },
    {
        ncciCode: "5437",
        territory: "WY",
        acuityCode: "543700"
    },
    {
        ncciCode: "5437",
        territory: "WY",
        acuityCode: "543701"
    },
    {
        ncciCode: "5437",
        territory: "WY",
        acuityCode: "543704"
    },
    {
        ncciCode: "5445",
        territory: "WY",
        acuityCode: "544500"
    },
    {
        ncciCode: "5445",
        territory: "WY",
        acuityCode: "544501"
    },
    {
        ncciCode: "5462",
        territory: "WY",
        acuityCode: "546200"
    },
    {
        ncciCode: "5474",
        territory: "WY",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "WY",
        acuityCode: "547400"
    },
    {
        ncciCode: "5474",
        territory: "WY",
        acuityCode: "547403"
    },
    {
        ncciCode: "5474",
        territory: "WY",
        acuityCode: "547403"
    },
    {
        ncciCode: "5480",
        territory: "WY",
        acuityCode: "548000"
    },
    {
        ncciCode: "5491",
        territory: "WY",
        acuityCode: "549100"
    },
    {
        ncciCode: "5537",
        territory: "WY",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "WY",
        acuityCode: "553700"
    },
    {
        ncciCode: "5537",
        territory: "WY",
        acuityCode: "553700"
    },
    {
        ncciCode: "5538",
        territory: "WY",
        acuityCode: "553800"
    },
    {
        ncciCode: "5538",
        territory: "WY",
        acuityCode: "553801"
    },
    {
        ncciCode: "5551",
        territory: "WY",
        acuityCode: "555100"
    },
    {
        ncciCode: "5645",
        territory: "WY",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "WY",
        acuityCode: "564500"
    },
    {
        ncciCode: "5645",
        territory: "WY",
        acuityCode: "564502"
    },
    {
        ncciCode: "6217",
        territory: "WY",
        acuityCode: "621701"
    },
    {
        ncciCode: "6217",
        territory: "WY",
        acuityCode: "621703"
    },
    {
        ncciCode: "6229",
        territory: "WY",
        acuityCode: "622902"
    },
    {
        ncciCode: "6400",
        territory: "WY",
        acuityCode: "640000"
    },
    {
        ncciCode: "7605",
        territory: "WY",
        acuityCode: "760502"
    },
    {
        ncciCode: "8006",
        territory: "WY",
        acuityCode: "800600"
    },
    {
        ncciCode: "8013",
        territory: "WY",
        acuityCode: "801300"
    },
    {
        ncciCode: "8017",
        territory: "WY",
        acuityCode: "801700"
    },
    {
        ncciCode: "8031",
        territory: "WY",
        acuityCode: "803100"
    },
    {
        ncciCode: "8380",
        territory: "WY",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "WY",
        acuityCode: "838000"
    },
    {
        ncciCode: "8380",
        territory: "WY",
        acuityCode: "838004"
    },
    {
        ncciCode: "8601",
        territory: "WY",
        acuityCode: "860104"
    },
    {
        ncciCode: "9014",
        territory: "WY",
        acuityCode: "901400"
    },
    {
        ncciCode: "9014",
        territory: "WY",
        acuityCode: "901402"
    },
    {
        ncciCode: "9014",
        territory: "WY",
        acuityCode: "901406"
    },
    {
        ncciCode: "9014",
        territory: "WY",
        acuityCode: "901407"
    },
    {
        ncciCode: "9015",
        territory: "WY",
        acuityCode: "901500"
    },
    {
        ncciCode: "9015",
        territory: "WY",
        acuityCode: "901509"
    },
    {
        ncciCode: "9015",
        territory: "WY",
        acuityCode: "901511"
    },
    {
        ncciCode: "9015",
        territory: "WY",
        acuityCode: "901514"
    },
    {
        ncciCode: "9102",
        territory: "WY",
        acuityCode: "910201"
    },
    {
        ncciCode: "9102",
        territory: "WY",
        acuityCode: "910202"
    },
    {
        ncciCode: "9501",
        territory: "WY",
        acuityCode: "950101"
    },
    {
        ncciCode: "9519",
        territory: "WY",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "WY",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "WY",
        acuityCode: "951900"
    },
    {
        ncciCode: "9519",
        territory: "WY",
        acuityCode: "951904"
    },
    {
        ncciCode: "9519",
        territory: "WY",
        acuityCode: "951908"
    },
    {
        ncciCode: "9519",
        territory: "WY",
        acuityCode: "951909"
    },
    {
        ncciCode: "9521",
        territory: "WY",
        acuityCode: "952100"
    },
    {
        ncciCode: "9521",
        territory: "WY",
        acuityCode: "952100"
    },
    {
        ncciCode: "9521",
        territory: "WY",
        acuityCode: "952102"
    },
    {
        ncciCode: "9586",
        territory: "WY",
        acuityCode: "958602"
    }
];