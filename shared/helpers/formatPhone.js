'use strict';

/**
 * Takes in a phone number and formats it
 *
 * @param {string} phoneNumber - A phone number to format
 * @return {string} - The formatted number
 */
module.exports = function(phoneNumber){
	const cleaned = `${phoneNumber}`.replace(/\D/g, '');
	const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
	if(match){
		const intlCode = match[1] ? '+1 ' : '';
		return [intlCode,
			'(',
			match[2],
			') ',
			match[3],
			'-',
			match[4]].join('');
	}
	return null;
};