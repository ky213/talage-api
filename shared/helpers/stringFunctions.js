/* eslint-disable no-trailing-spaces */
/* eslint-disable no-extra-parens */
/* eslint-disable guard-for-in */
/* eslint-disable space-unary-ops */
/* eslint-disable yoda */
/* eslint-disable one-var */
'use strict';

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

// const {raw} = require('mysql');

var sanitizer = require('sanitize')();
var sanitizeFile = require("sanitize-filename");

/**
 * Converts first letter of each word in a string to upper case
 *
 * @param {string} str - The string
 * @return {string} - The upper-cased string
 */
exports.ucwords = function(str) {
    return String(str).replace(/^([a-z])|\s+([a-z])/g, function($1) {
        return $1.toUpperCase();
    });
};

/**
 * Converts a string to all lower-case
 *
 * @param {string} str - The string
 * @return {string} The lower-case string
 */
exports.strtolower = function(str) {
    return String(str).toLowerCase();
};

/**
 * Converts a underscore to space
 *
 * @param {string} str - The string
 * @return {string} The lower-case string
 */
exports.strUnderscoretoSpace = function(str) {
    return String(str).replace(/_/g, " ");
};


/**
 * Formats a number
 *
 * @param {Number} number - The number to format
 * @param {Number} decimals - Number of decimals to include
 * @param {Boolean} dec_point - Whether to include a decimal point
 * @param {string} thousands_sep - The character used to separate groups of thousands digits
 * @return {string} - The formatted number
 */
exports.number_format = function(number, decimals, dec_point, thousands_sep) {
    // Strip all characters but numerical ones.
    number = String(number).replace(/[^0-9+\-Ee.]/g, '');
    const n = !isFinite(Number(number)) ? 0 : Number(number);
    const prec = !isFinite(Number(decimals)) ? 0 : Math.abs(decimals);
    const sep = typeof thousands_sep === 'undefined' ? ',' : thousands_sep;
    const dec = typeof dec_point === 'undefined' ? '.' : dec_point;
    let s = '';
    const toFixedFix = function(n2, prec2) {
        const k = Math.pow(10, prec2);
        return String(Math.round(n2 * k) / k);
    };
    // Fix for IE parseFloat(0.55).toFixed(0) = 0;
    s = (prec ? toFixedFix(n, prec) : String(Math.round(n))).split('.');
    if (s[0].length > 3) {
        s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
    }
    if ((s[1] || '').length < prec) {
        s[1] = s[1] || '';
        s[1] += new Array(prec - s[1].length + 1).join('0');
    }
    return s.join(dec);
};

exports.remove_array_duplicates = function(arr) {
    const s = new Set(arr);
    const it = s.values();
    return Array.from(it);
};

exports.htmlspecialchars_decode = function(string, quote_style) {
    // Convert special HTML entities back to characters
    //
    // version: 901.714
    // discuss at: http://phpjs.org/functions/htmlspecialchars_decode
    // +   original by: Mirek Slugen
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: Mateusz "loonquawl" Zalega
    // +      input by: ReverseSyntax
    // +      input by: Slawomir Kaniecki
    // +      input by: Scott Cariss
    // +      input by: Francois
    // +   bugfixed by: Onno Marsman
    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // -    depends on: get_html_translation_table
    // *     example 1: htmlspecialchars_decode("<p>this -&gt; &quot;</p>", 'ENT_NOQUOTES');
    // *     returns 1: '<p>this -> &quot;</p>'
    var histogram = {},
        symbol = '',
        tmp_str = '',
        entity = '';
    tmp_str = string.toString();

    if (false === (histogram = this.get_html_translation_table('HTML_SPECIALCHARS', quote_style))) {
        return false;
    }

    // &amp; must be the last character when decoding!
    delete histogram['&'];
    histogram['&'] = '&amp;';

    for (symbol in histogram) {
        entity = histogram[symbol];
        tmp_str = tmp_str.split(entity).join(symbol);
    }

    return tmp_str;
};

exports.get_html_translation_table = function(table, quote_style) {
    // Returns the internal translation table used by htmlspecialchars and htmlentities
    //
    // version: 902.2516
    // discuss at: http://phpjs.org/functions/get_html_translation_table
    // +   original by: Philip Peterson
    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: noname
    // +   bugfixed by: Alex
    // +   bugfixed by: Marco
    // %          note: It has been decided that we're not going to add global
    // %          note: dependencies to php.js. Meaning the constants are not
    // %          note: real constants, but strings instead. integers are also supported if someone
    // %          note: chooses to create the constants themselves.
    // %          note: Table from http://www.the-art-of-web.com/html/character-codes/
    // *     example 1: get_html_translation_table('HTML_SPECIALCHARS');
    // *     returns 1: {'"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;'}

    var entities = {},
        histogram = {},
        decimal = 0,
        symbol = '';
    var constMappingTable = {},
        constMappingQuoteStyle = {};
    var useTable = {},
        useQuoteStyle = {};

    useTable = table ? table.toUpperCase() : 'HTML_SPECIALCHARS';
    useQuoteStyle = quote_style ? quote_style.toUpperCase() : 'ENT_COMPAT';

    // Translate arguments
    constMappingTable[0] = 'HTML_SPECIALCHARS';
    constMappingTable[1] = 'HTML_ENTITIES';
    constMappingQuoteStyle[0] = 'ENT_NOQUOTES';
    constMappingQuoteStyle[2] = 'ENT_COMPAT';
    constMappingQuoteStyle[3] = 'ENT_QUOTES';

    // Map numbers to strings for compatibilty with PHP constants
    if (!isNaN(useTable)) {
        useTable = constMappingTable[useTable];
    }
    if (!isNaN(useQuoteStyle)) {
        useQuoteStyle = constMappingQuoteStyle[useQuoteStyle];
    }

    if (useQuoteStyle !== 'ENT_NOQUOTES') {
        entities['34'] = '&quot;';
    }

    if (useQuoteStyle === 'ENT_QUOTES') {
        entities['39'] = '&#039;';
    }

    if (useTable === 'HTML_SPECIALCHARS') {
        // ascii decimals for better compatibility
        entities['38'] = '&amp;';
        entities['60'] = '&lt;';
        entities['62'] = '&gt;';
    }
    else if (useTable === 'HTML_ENTITIES') {
        // ascii decimals for better compatibility
        entities['38'] = '&amp;';
        entities['60'] = '&lt;';
        entities['62'] = '&gt;';
        entities['160'] = '&nbsp;';
        entities['161'] = '&iexcl;';
        entities['162'] = '&cent;';
        entities['163'] = '&pound;';
        entities['164'] = '&curren;';
        entities['165'] = '&yen;';
        entities['166'] = '&brvbar;';
        entities['167'] = '&sect;';
        entities['168'] = '&uml;';
        entities['169'] = '&copy;';
        entities['170'] = '&ordf;';
        entities['171'] = '&laquo;';
        entities['172'] = '&not;';
        entities['173'] = '&shy;';
        entities['174'] = '&reg;';
        entities['175'] = '&macr;';
        entities['176'] = '&deg;';
        entities['177'] = '&plusmn;';
        entities['178'] = '&sup2;';
        entities['179'] = '&sup3;';
        entities['180'] = '&acute;';
        entities['181'] = '&micro;';
        entities['182'] = '&para;';
        entities['183'] = '&middot;';
        entities['184'] = '&cedil;';
        entities['185'] = '&sup1;';
        entities['186'] = '&ordm;';
        entities['187'] = '&raquo;';
        entities['188'] = '&frac14;';
        entities['189'] = '&frac12;';
        entities['190'] = '&frac34;';
        entities['191'] = '&iquest;';
        entities['192'] = '&Agrave;';
        entities['193'] = '&Aacute;';
        entities['194'] = '&Acirc;';
        entities['195'] = '&Atilde;';
        entities['196'] = '&Auml;';
        entities['197'] = '&Aring;';
        entities['198'] = '&AElig;';
        entities['199'] = '&Ccedil;';
        entities['200'] = '&Egrave;';
        entities['201'] = '&Eacute;';
        entities['202'] = '&Ecirc;';
        entities['203'] = '&Euml;';
        entities['204'] = '&Igrave;';
        entities['205'] = '&Iacute;';
        entities['206'] = '&Icirc;';
        entities['207'] = '&Iuml;';
        entities['208'] = '&ETH;';
        entities['209'] = '&Ntilde;';
        entities['210'] = '&Ograve;';
        entities['211'] = '&Oacute;';
        entities['212'] = '&Ocirc;';
        entities['213'] = '&Otilde;';
        entities['214'] = '&Ouml;';
        entities['215'] = '&times;';
        entities['216'] = '&Oslash;';
        entities['217'] = '&Ugrave;';
        entities['218'] = '&Uacute;';
        entities['219'] = '&Ucirc;';
        entities['220'] = '&Uuml;';
        entities['221'] = '&Yacute;';
        entities['222'] = '&THORN;';
        entities['223'] = '&szlig;';
        entities['224'] = '&agrave;';
        entities['225'] = '&aacute;';
        entities['226'] = '&acirc;';
        entities['227'] = '&atilde;';
        entities['228'] = '&auml;';
        entities['229'] = '&aring;';
        entities['230'] = '&aelig;';
        entities['231'] = '&ccedil;';
        entities['232'] = '&egrave;';
        entities['233'] = '&eacute;';
        entities['234'] = '&ecirc;';
        entities['235'] = '&euml;';
        entities['236'] = '&igrave;';
        entities['237'] = '&iacute;';
        entities['238'] = '&icirc;';
        entities['239'] = '&iuml;';
        entities['240'] = '&eth;';
        entities['241'] = '&ntilde;';
        entities['242'] = '&ograve;';
        entities['243'] = '&oacute;';
        entities['244'] = '&ocirc;';
        entities['245'] = '&otilde;';
        entities['246'] = '&ouml;';
        entities['247'] = '&divide;';
        entities['248'] = '&oslash;';
        entities['249'] = '&ugrave;';
        entities['250'] = '&uacute;';
        entities['251'] = '&ucirc;';
        entities['252'] = '&uuml;';
        entities['253'] = '&yacute;';
        entities['254'] = '&thorn;';
        entities['255'] = '&yuml;';
    }
    else {
        throw Error('Table: ' + useTable + ' not supported');
        //return false;
    }

    // ascii decimals to real symbols
    for (decimal in entities) {
        symbol = String.fromCharCode(decimal);
        histogram[symbol] = entities[decimal];
    }

    return histogram;
};

exports.santizeString = function(rawString) {
    if (rawString && 'string' === typeof rawString) {
        let cleanString = '';
        try {
            cleanString = sanitizer.my.str(rawString);
        }
        catch (e) {
            log.error('Error sanitizing ' + rawString + ' error: ' + e + __location);
        }
        return cleanString;
    }
    else {
        return null;
    }
};
exports.santizeNumber = function(rawString, makeInt) {
    let returnInt = false;
    if (makeInt) {
        returnInt = makeInt;
    }

    if (rawString && 'string' === typeof rawString) {
        let cleanString = null;
        try {
            cleanString = rawString.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '').replace('/[^0-9]/', '');
            if (returnInt === true) {
                cleanString = parseInt(cleanString, 10);
            }
        }
        catch (e) {
            log.error('Error sanitizing ' + rawString + ' error: ' + e + __location);
        }
        return cleanString;
    }
    else if (rawString && 'number' === typeof rawString) {
        return rawString;
    }
    else {
        return null;
    }
};

exports.santizeFilename = function(rawString){
    let cleanFileName = "";
    try{
        cleanFileName = sanitizeFile(rawString);
    }
    catch(e){
        log.error('Error santizeFilename ' + rawString + ' error: ' + e + __location);
    }
    return cleanFileName;

}

/**
 * Converts a string to boolean
 * @param {string} rawString - The string
 * @param {string} defaultValue - boolean value used if error or null input
 * @return {boolean} boolean, if error or null input defaultValue
 */
exports.parseBool = function(rawString, defaultValue) {
    if (rawString && 'string' === typeof rawString) {
        let newBool = defaultValue;
        try {
            const lowerString = String(rawString).toLowerCase().trim();
            newBool = (lowerString === 'true' || lowerString === '1');
        }
        catch (e) {
            log.error('Error converting to Boolean ' + rawString + ' error: ' + e + __location);
        }
        return newBool;
    }
    else {
        return defaultValue;
    }
};

exports.ucFirstLetter = function(s) {
    if(s){
        return s[0].toUpperCase() + s.toLowerCase().slice(1);
    }
    else {
        return null;
    }
};

exports.trimString = function(str, toTrim, trimOptions = {
    trimStart: true,
    trimEnd: false
}) {
    let returnStr = str;
    if(trimOptions.trimStart && str.startsWith(toTrim)) {
        returnStr = returnStr.substring(toTrim.length);
    }
    if(trimOptions.trimEnd && str.endsWith(toTrim)) {
        returnStr = returnStr.substring(0, returnStr.length - toTrim.length);
    }
    return returnStr;
}

/**
 * Converts a passed in string to a dollar amount representation, extended to 2 decimal places. 
 * 
 * @param {String} str - [Required] The string to convert into a dollar amount (f.e. 1000.56 -> $1,000.56) 
 * @param {Boolean} trimDecimal - [Optional (Default: false)] Whether or not to trim off the decimal (f.e. $1,000.56 -> $1,000)
 * @returns {String} - A string representation of the dollar amount of the string passed in, or the passed-in value if validation fails
 */
exports.convertToDollarFormat = (str, trimDecimal = false) => {
    str = str.replace('$', '').replace(',', '');

    if (typeof str === "number") {
        str = str.toString();
    }
    
    if (typeof str !== "string") {
        log.error(`convertToDollarFormat: Parameter str is not type string.` + __location);
        return str;
    }

    if (!str || !str.length > 0) {
        log.error(`convertToDollarFormat: No string provided, cannot convert.` + __location);
        return str;
    }
    
    if (isNaN(parseFloat(str, 10))) {
        log.error(`convertToDollarFormat: Provided string cannot be converted to a number. string ${str}` + __location);
        return str;
    }

    // clip the decimal to 2 digits, if it exists
    str = `${parseFloat(str, 10).toFixed(2)}`;

    const strArray = str.split("");

    let negative = ``;
    if (strArray[0] === "-") {
        negative = strArray.splice(0, 1)[0];
    }

    let decimal = ``;
    if (strArray.indexOf(".")) {
        decimal = strArray.splice(strArray.indexOf("."), strArray.length).splice(0, 3).join("");
    }

    if (strArray.length === 0) {
        return `${negative}$0${decimal}`;
    }

    let number = ``;
    if (strArray.length > 3) {
        const frontDigitsRemainder = strArray.length % 3;
        let frontDigits = ``;
        if (frontDigitsRemainder !== 0) {
            frontDigits = `${strArray.splice(0, frontDigitsRemainder).join("")},`;
        }

        // - 1 because we don't want to add a comma at the end
        let iterations = (strArray.length / 3) - 1;
        let index = 0;
        while (iterations > 0) {
            // move forward to the next (or first) comma and splice it in
            index += 3;
            strArray.splice(index, 0, ",");

            // increment index since we spliced in a ",", then decrement iterations
            index++;
            iterations--;
        }

        number = `${frontDigits}${strArray.join("")}`;
    }
    else {
        number = strArray.join("");
    }


    return `${negative}$${number}${trimDecimal ? '' : decimal}`;
}

/**
 * Modifies the String prototype and adds a new capability, 'toSnakeCase' which will convert
 * the string to snake_case. Usage: string.toSnakeCase()
 */
// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'toSnakeCase', {'value': function(){
    return this.split(/(?=[A-Z])/).join('_').toLowerCase();
}});

// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'isSnakeCase', {'value': function(){
    if (this.includes("_")){
        return true;
    }
    else {
        return false;
    }
}});

/**
 * Modifies the String prototype and adds a new capability, 'toCamelCase' which will convert
 * the string to camelCase. Usage: string.toCamelCase()
 */
// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'toCamelCase', {'value': function(){
    return this.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
}});

exports.dbTimeFormat = function(){
    return 'YYYY-MM-DD HH:mm:ss';
};

const replacementList = [
    {
        base: ' ',
        chars: "\u00A0"
    },
    {
        base: '0',
        chars: "\u07C0"
    },
    {
        base: 'A',
        chars: "\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F"
    },
    {
        base: 'AA',
        chars: "\uA732"
    },
    {
        base: 'AE',
        chars: "\u00C6\u01FC\u01E2"
    },
    {
        base: 'AO',
        chars: "\uA734"
    },
    {
        base: 'AU',
        chars: "\uA736"
    },
    {
        base: 'AV',
        chars: "\uA738\uA73A"
    },
    {
        base: 'AY',
        chars: "\uA73C"
    },
    {
        base: 'B',
        chars: "\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0181"
    },
    {
        base: 'C',
        chars: "\u24b8\uff23\uA73E\u1E08\u0106\u0043\u0108\u010A\u010C\u00C7\u0187\u023B"
    },
    {
        base: 'D',
        chars: "\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018A\u0189\u1D05\uA779"
    },
    {
        base: 'Dh',
        chars: "\u00D0"
    },
    {
        base: 'DZ',
        chars: "\u01F1\u01C4"
    },
    {
        base: 'Dz',
        chars: "\u01F2\u01C5"
    },
    {
        base: 'E',
        chars: "\u025B\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E\u1D07"
    },
    {
        base: 'F',
        chars: "\uA77C\u24BB\uFF26\u1E1E\u0191\uA77B"
    },
    {
        base: 'G',
        chars: "\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E\u0262"
    },
    {
        base: 'H',
        chars: "\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D"
    },
    {
        base: 'I',
        chars: "\u24BE\uFF29\xCC\xCD\xCE\u0128\u012A\u012C\u0130\xCF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197"
    },
    {
        base: 'J',
        chars: "\u24BF\uFF2A\u0134\u0248\u0237"
    },
    {
        base: 'K',
        chars: "\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2"
    },
    {
        base: 'L',
        chars: "\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780"
    },
    {
        base: 'LJ',
        chars: "\u01C7"
    },
    {
        base: 'Lj',
        chars: "\u01C8"
    },
    {
        base: 'M',
        chars: "\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C\u03FB"
    },
    {
        base: 'N',
        chars: "\uA7A4\u0220\u24C3\uFF2E\u01F8\u0143\xD1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u019D\uA790\u1D0E"
    },
    {
        base: 'NJ',
        chars: "\u01CA"
    },
    {
        base: 'Nj',
        chars: "\u01CB"
    },
    {
        base: 'O',
        chars: "\u24C4\uFF2F\xD2\xD3\xD4\u1ED2\u1ED0\u1ED6\u1ED4\xD5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\xD6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\xD8\u01FE\u0186\u019F\uA74A\uA74C"
    },
    {
        base: 'OE',
        chars: "\u0152"
    },
    {
        base: 'OI',
        chars: "\u01A2"
    },
    {
        base: 'OO',
        chars: "\uA74E"
    },
    {
        base: 'OU',
        chars: "\u0222"
    },
    {
        base: 'P',
        chars: "\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754"
    },
    {
        base: 'Q',
        chars: "\u24C6\uFF31\uA756\uA758\u024A"
    },
    {
        base: 'R',
        chars: "\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782"
    },
    {
        base: 'S',
        chars: "\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784"
    },
    {
        base: 'T',
        chars: "\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786"
    },
    {
        base: 'Th',
        chars: "\u00DE"
    },
    {
        base: 'TZ',
        chars: "\uA728"
    },
    {
        base: 'U',
        chars: "\u24CA\uFF35\xD9\xDA\xDB\u0168\u1E78\u016A\u1E7A\u016C\xDC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244"
    },
    {
        base: 'V',
        chars: "\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245"
    },
    {
        base: 'VY',
        chars: "\uA760"
    },
    {
        base: 'W',
        chars: "\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72"
    },
    {
        base: 'X',
        chars: "\u24CD\uFF38\u1E8A\u1E8C"
    },
    {
        base: 'Y',
        chars: "\u24CE\uFF39\u1EF2\xDD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE"
    },
    {
        base: 'Z',
        chars: "\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762"
    },
    {
        base: 'a',
        chars: "\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250\u0251"
    },
    {
        base: 'aa',
        chars: "\uA733"
    },
    {
        base: 'ae',
        chars: "\u00E6\u01FD\u01E3"
    },
    {
        base: 'ao',
        chars: "\uA735"
    },
    {
        base: 'au',
        chars: "\uA737"
    },
    {
        base: 'av',
        chars: "\uA739\uA73B"
    },
    {
        base: 'ay',
        chars: "\uA73D"
    },
    {
        base: 'b',
        chars: "\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253\u0182"
    },
    {
        base: 'c',
        chars: "\uFF43\u24D2\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184"
    },
    {
        base: 'd',
        chars: "\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\u018B\u13E7\u0501\uA7AA"
    },
    {
        base: 'dh',
        chars: "\u00F0"
    },
    {
        base: 'dz',
        chars: "\u01F3\u01C6"
    },
    {
        base: 'e',
        chars: "\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u01DD"
    },
    {
        base: 'f',
        chars: "\u24D5\uFF46\u1E1F\u0192"
    },
    {
        base: 'ff',
        chars: "\uFB00"
    },
    {
        base: 'fi',
        chars: "\uFB01"
    },
    {
        base: 'fl',
        chars: "\uFB02"
    },
    {
        base: 'ffi',
        chars: "\uFB03"
    },
    {
        base: 'ffl',
        chars: "\uFB04"
    },
    {
        base: 'g',
        chars: "\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\uA77F\u1D79"
    },
    {
        base: 'h',
        chars: "\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265"
    },
    {
        base: 'hv',
        chars: "\u0195"
    },
    {
        base: 'i',
        chars: "\u24D8\uFF49\xEC\xED\xEE\u0129\u012B\u012D\xEF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131"
    },
    {
        base: 'j',
        chars: "\u24D9\uFF4A\u0135\u01F0\u0249"
    },
    {
        base: 'k',
        chars: "\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3"
    },
    {
        base: 'l',
        chars: "\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747\u026D"
    },
    {
        base: 'lj',
        chars: "\u01C9"
    },
    {
        base: 'm',
        chars: "\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F"
    },
    {
        base: 'n',
        chars: "\u24DD\uFF4E\u01F9\u0144\xF1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5\u043B\u0509"
    },
    {
        base: 'nj',
        chars: "\u01CC"
    },
    {
        base: 'o',
        chars: "\u24DE\uFF4F\xF2\xF3\xF4\u1ED3\u1ED1\u1ED7\u1ED5\xF5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\xF6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\xF8\u01FF\uA74B\uA74D\u0275\u0254\u1D11"
    },
    {
        base: 'oe',
        chars: "\u0153"
    },
    {
        base: 'oi',
        chars: "\u01A3"
    },
    {
        base: 'oo',
        chars: "\uA74F"
    },
    {
        base: 'ou',
        chars: "\u0223"
    },
    {
        base: 'p',
        chars: "\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755\u03C1"
    },
    {
        base: 'q',
        chars: "\u24E0\uFF51\u024B\uA757\uA759"
    },
    {
        base: 'r',
        chars: "\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783"
    },
    {
        base: 's',
        chars: "\u24E2\uFF53\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B\u0282"
    },
    {
        base: 'ss',
        chars: "\xDF"
    },
    {
        base: 't',
        chars: "\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787"
    },
    {
        base: 'th',
        chars: "\u00FE"
    },
    {
        base: 'tz',
        chars: "\uA729"
    },
    {
        base: 'u',
        chars: "\u24E4\uFF55\xF9\xFA\xFB\u0169\u1E79\u016B\u1E7B\u016D\xFC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289"
    },
    {
        base: 'v',
        chars: "\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C"
    },
    {
        base: 'vy',
        chars: "\uA761"
    },
    {
        base: 'w',
        chars: "\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73"
    },
    {
        base: 'x',
        chars: "\u24E7\uFF58\u1E8B\u1E8D"
    },
    {
        base: 'y',
        chars: "\u24E8\uFF59\u1EF3\xFD\u0177\u1EF9\u0233\u1E8F\xFF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF"
    },
    {
        base: 'z',
        chars: "\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763"
    }
];
  
const diacriticsMap = {};
for (let i = 0; i < replacementList.length; i += 1) {
    const chars = replacementList[i].chars;
    for (var j = 0; j < chars.length; j += 1) {
        diacriticsMap[chars[j]] = replacementList[i].base;
    }
}

// SOURCE: This solution is derived from the npm package at https://www.npmjs.com/package/diacritics
exports.removeDiacritics = function(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/[^\u0000-\u007e]/g, function(c) {
        return diacriticsMap[c] || c;
    });
}