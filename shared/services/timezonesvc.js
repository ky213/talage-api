const timezones = [{
    "id":1,
    "name":"Pacific Time",
    "tz":"America/Los_Angeles",
    "abbr":"PT"
},
{
    "id":2,
    "name":"Mountain Time",
    "tz":"America/Denver",
    "abbr":"MT"
},
{
    "id":3,
    "name":"Central Time",
    "tz":"America/Chicago",
    "abbr":"CT"
},
{
    "id":4,
    "name":"Eastern Time",
    "tz":"America/New_York",
    "abbr":"ET"
},
{
    "id":5,
    "name":"Hawaii Standard Time",
    "tz":"Pacific/Honolulu",
    "abbr":"HST"
},
{
    "id":6,
    "name":"Alaska Daylight Time",
    "tz":"America/Anchorage",
    "abbr":"AKDT"
},
{
    "id":8,
    "name":"Mountain Standard Time",
    "tz":"America/Phoenix",
    "abbr":"MST"
}];

module.exports.getList = function() {
    return timezones;
};

module.exports.getById = function(id) {
    if (!id || typeof id !== "number") {
        const error = `timezonesvc: Error: Invalid id supplied to getById(). ${__location}`;
        log.error(error);
        return null;
    }

    const timezone = timezones.find(tz => tz.id === id);

    if (!timezone) {
        const error = `timezonesvc: Error: Could not find timezone with matching id. ${__location}`;
        log.error(error);
        return null;
    }
    else {
        return timezone;
    }
}