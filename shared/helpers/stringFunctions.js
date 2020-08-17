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
            newBool = lowerString === 'true';
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
    return s[0].toUpperCase() + s.toLowerCase().slice(1);
};