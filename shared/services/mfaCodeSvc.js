
/**
 * Generat a random numeric code to use with MFA.
 *
 *   }
 * @param {*} numOfDigit see above
 * @returns {string} - mfacode.
 */
function generateRandomMFACode(numOfDigit = 6){
    const a = "1234567890".split("");
    const b = []
    for (let i = 0; i < numOfDigit; i++) {
        var j = (Math.random() * (a.length - 1)).toFixed(0);
        b[i] = a[j];
    }
    return b.join("");

}

module.exports = {generateRandomMFACode: generateRandomMFACode};