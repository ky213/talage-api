'use strict';

const styles = require('../document-style/certificate/styles.js');
const positions = require('../document-style/certificate/positions.js');

exports.checkPolicyBoxes = function (policy, owners_covered) {

	// Check boxes for Commercial General Liability
	if (policy === 'GL') {
		return [{
			'absolutePosition': positions.GL_commercial_GL_checkbox,
			'style': styles.checkbox,
			'text': 'X'
		},
		{
			'absolutePosition': positions.GL_occur_checkbox,
			'style': styles.checkbox,
			'text': 'X'
		},
		{
			'absolutePosition': positions.GL_policy_checkbox,
			'style': styles.checkbox,
			'text': 'X'
		}];
		// eslint-disable-next-line brace-style
	}

	// Check boxes for Automobile Liability
	else if (policy === 'AL') {
		// TO DO: Check boxes for Automobile Liability
		return [];
		// eslint-disable-next-line brace-style
	}
	// Check boxes for Umbrella Liability
	else if (policy === 'UMB') {
		return [{
			'absolutePosition': positions.UMB_umbrella_liab_checkbox,
			'style': styles.checkbox,
			'text': 'X'
		},
		{
			'absolutePosition': positions.UMB_occur_checkbox,
			'style': styles.checkbox,
			'text': 'X'
		},
		{
			'absolutePosition': positions.UMB_ded_checkbox,
			'style': styles.checkbox,
			'text': 'X'
		}];
		// eslint-disable-next-line brace-style
	}
	// Check boxs for Workers Compensation
	else if (policy === 'WC') {
		if (!owners_covered) {
			// Exclusion = Y, Description of Operations - OWNER IS EXCLUDED
			return [{
				'absolutePosition': positions.WC_exclusion_checkbox,
				'style': styles.checkbox,
				'text': 'Y'
			}, {
				'absolutePosition': positions.WC_per_statute_checkbox,
				'style': styles.checkbox,
				'text': 'X'
			}];
		}
		// Exclusion = N
		return [{
			'absolutePosition': positions.WC_exclusion_checkbox,
			'style': styles.checkbox,
			'text': 'N'
		}, {
			'absolutePosition': positions.WC_per_statute_checkbox,
			'style': styles.checkbox,
			'text': 'X'
		}];


	}
};