'use strict';

/**
 * Converts first letter of each word in a string to upper case
 *
 * @param {string} str - The string
 * @return {string} - The upper-cased string
 */
exports.ucwords = function(str){
	return String(str).replace(/^([a-z])|\s+([a-z])/g, function($1){
		return $1.toUpperCase();
	});
};

/**
 * Converts a string to all lower-case
 *
 * @param {string} str - The string
 * @return {string} The lower-case string
 */
exports.strtolower = function(str){
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
exports.number_format = function(number, decimals, dec_point, thousands_sep){
	// Strip all characters but numerical ones.
	number = String(number).replace(/[^0-9+\-Ee.]/g, '');
	const n = !isFinite(Number(number)) ? 0 : Number(number);
	const prec = !isFinite(Number(decimals)) ? 0 : Math.abs(decimals);
	const sep = typeof thousands_sep === 'undefined' ? ',' : thousands_sep;
	const dec = typeof dec_point === 'undefined' ? '.' : dec_point;
	let s = '';
	const toFixedFix = function(n2, prec2){
		const k = Math.pow(10, prec2);
		return String(Math.round(n2 * k) / k);
	};
	// Fix for IE parseFloat(0.55).toFixed(0) = 0;
	s = (prec ? toFixedFix(n, prec) : String(Math.round(n))).split('.');
	if (s[0].length > 3){
		s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
	}
	if ((s[1] || '').length < prec){
		s[1] = s[1] || '';
		s[1] += new Array(prec - s[1].length + 1).join('0');
	}
	return s.join(dec);
};