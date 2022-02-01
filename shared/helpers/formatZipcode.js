/**
 * Takes in a zipcode and formats it
 *
 * @param {string} zipcode - A zipcode to format
 * @return {string} - The formatted number
 */
module.exports = function(zipcode){
    if (zipcode.length === 9){
        const formattedZipcode = `${zipcode.slice(0, 5)}-${zipcode.slice(5)}`;
        return formattedZipcode;
    }
    return zipcode;
};