'use strict';

const styles = require('./document-style/acord-form-wc/styles.js');
const positions = require('./document-style/acord-form-wc/positions.js');

exports.state_rating_sheets = function(data, ncci_codes){

	let rating_sheets = [];
	const activity_code_offset = 24;

	let current_rating_sheet = 1;

	// For all the territories
	for(const[territory, locations]of Object.entries(data)){

		let num_activity_code_entry = 0;

		// Start a new page
		rating_sheets.push({
			'absolutePosition': positions.rating_sheet_territory,
			'pageBreak': 'before',
			'style': styles.rating_sheet_territory,
			'text': territory
		},
		{
			'absolutePosition': positions.rating_sheet_page,
			'style': styles.rating_sheet_page,
			// eslint-disable-next-line no-undefined
			'text': current_rating_sheet.toLocaleString(undefined, {'minimumIntegerDigits': 2})
		},
		{
			'absolutePosition': positions.rating_sheet_total_pages,
			'style': styles.rating_sheet_page,
			// eslint-disable-next-line no-undefined
			'text': Object.keys(data).length.toLocaleString(undefined, {'minimumIntegerDigits': 2})
		});
		// For all the addresses
		for(const info of Object.values(locations)){

			// For all the activity codes
			for(const[activity_code, payroll]of Object.entries(info.activity_codes)){

				const ncci_data = ncci_codes.filter(function(code){
					return code.activity_codes.includes(activity_code) && code.territory === territory;
				});

				// If the insurer does not support the activity code for that territory, return an error
				if(ncci_data.length === 0){
					return -1;
				}

				// Write a new row
				rating_sheets = rating_sheets.concat([
					{
						'absolutePosition': {
							'x': positions.rating_sheet_loc.x,
							'y': positions.rating_sheet_loc.y + num_activity_code_entry * activity_code_offset
						},
						// eslint-disable-next-line no-undefined
						'text': info.loc_num.toLocaleString(undefined, {'minimumIntegerDigits': 2})
					},
					{
						'absolutePosition': {
							'x': positions.rating_sheet_class_code.x,
							'y': positions.rating_sheet_class_code.y + num_activity_code_entry * activity_code_offset
						},
						'text': ncci_data[0].code
					},
					{
						'absolutePosition': {
							'x': positions.rating_sheet_sub_code.x,
							'y': positions.rating_sheet_sub_code.y + num_activity_code_entry * activity_code_offset
						},
						'text': ncci_data[0].sub
					},
					{
						'absolutePosition': {
							'x': positions.rating_sheet_description.x,
							'y': positions.rating_sheet_description.y + num_activity_code_entry * activity_code_offset
						},
						'style': styles.description,
						'text': ncci_data[0].description.length > 40 ? `${ncci_data[0].description.substr(0, 40)}...` : ncci_data[0].description
					},
					{
						'absolutePosition': {
							'x': positions.rating_sheet_full_time.x,
							'y': positions.rating_sheet_full_time.y + num_activity_code_entry * activity_code_offset
						},
						'text': Math.round(payroll / info.total_payroll * info.full_time_employees)
					},
					{
						'absolutePosition': {
							'x': positions.rating_sheet_part_time.x,
							'y': positions.rating_sheet_part_time.y + num_activity_code_entry * activity_code_offset
						},
						'text': Math.round(payroll / info.total_payroll * info.part_time_employees)
					},
					{
						'absolutePosition': {
							'x': positions.rating_sheet_sic.x,
							'y': positions.rating_sheet_sic.y + num_activity_code_entry * activity_code_offset
						},
						'style': styles.sic,
						'text': ncci_codes.sic
					},
					{
						'absolutePosition': {
							'x': positions.rating_sheet_naics.x,
							'y': positions.rating_sheet_naics.y + num_activity_code_entry * activity_code_offset
						},
						'style': styles.naics,
						'text': ncci_codes.naics
					},
					{
						'absolutePosition': {
							'x': positions.rating_sheet_payroll.x,
							'y': positions.rating_sheet_payroll.y + num_activity_code_entry * activity_code_offset
						},
						'text': payroll.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')
					}
				]);

				num_activity_code_entry++;

			}

		}

		// Increase the rating sheet page number
		current_rating_sheet++;


	}


	return rating_sheets;
};