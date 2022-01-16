
/* eslint-disable require-jsdoc */

function GetAssociationList(territoryList){
    const returnList = [];
    const associationList = [{
        "id":"10",
        "name":"Anthem Blue Cross",
        "territory":"CA"
    },
    {
        "id":"10",
        "name":"Anthem Blue Cross",
        "territory":"CO"
    },
    {
        "id":"1",
        "name":"Apartment Association of Greater Los Angeles",
        "territory":"CA"
    },
    {
        "id":"2",
        "name":"Arizona Restaurant Association",
        "territory":"AZ"
    },
    {
        "id":"3",
        "name":"California Restaurant Association",
        "territory":"CA"
    },
    {
        "id":"4",
        "name":"Colorado Chamber of Commerce",
        "territory":"CO"
    },
    {
        "id":"5",
        "name":"Eat Denver Restaurant Association",
        "territory":"CO"
    },
    {
        "id":"6",
        "name":"Nevada Restaurant Association",
        "territory":"NV"
    },
    {
        "id":"9",
        "name":"Tennessee Hospitality and Tourism Association",
        "territory":"TN"
    },
    {
        "id":"7",
        "name":"Utah Auto Dealers Association",
        "territory":"UT"
    },
    {
        "id":"8",
        "name":"Utah Restaurant Association",
        "territory":"UT"
    }]

    for(let i = 0; i < associationList.length; i++){
        if(territoryList.indexOf(associationList[i].territory) > -1){
            returnList.push(associationList[i])
        }

    }
    return returnList;
}


module.exports = {GetAssociationList: GetAssociationList}