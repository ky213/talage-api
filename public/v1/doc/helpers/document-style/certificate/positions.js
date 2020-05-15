'use strict';

const producer_insured_x = 47;
const limit_x_position = 525;
const limit_offset = 12;
const limit_y_base = 305;
const policy_number_x = 220;
const policy_eff_x = 335;
const policy_exp_x = 382;
const al_y = 410;
const gl_y = 335;
const umb_y = 458;
const wc_y = 501;
const insurer_x = 360;
const insr_ltr_x = 24;
const naic_x = 545;

module.exports = {
	'AL_effective_date': {
		'x': policy_eff_x,
		'y': al_y
	},
	'AL_expiration_date': {
		'x': policy_exp_x,
		'y': al_y
	},
	'AL_policy_number': {
		'x': policy_number_x,
		'y': al_y
	},
	'GL_commercial_GL_checkbox': {
		'x': 41,
		'y': 303
	},
	'GL_effective_date': {
		'x': policy_eff_x,
		'y': gl_y
	},
	'GL_expiration_date': {
		'x': policy_exp_x,
		'y': gl_y
	},
	'GL_insr_ltr': {
		'x': insr_ltr_x,
		'y': 330
	},
	'GL_limit_4': {
		'x': limit_x_position,
		'y': limit_y_base
	},
	'GL_limit_5': {
		'x': limit_x_position,
		'y': limit_y_base + limit_offset
	},
	'GL_limit_6': {
		'x': limit_x_position,
		'y': limit_y_base + 2 * limit_offset
	},
	'GL_limit_7': {
		'x': limit_x_position,
		'y': limit_y_base + 3 * limit_offset
	},
	'GL_limit_8': {
		'x': limit_x_position,
		'y': limit_y_base + 4 * limit_offset
	},
	'GL_limit_9': {
		'x': limit_x_position,
		'y': limit_y_base + 5 * limit_offset
	},
	'GL_occur_checkbox': {
		'x': 120,
		'y': 315
	},
	'GL_policy_checkbox': {
		'x': 41,
		'y': 363
	},
	'GL_policy_number': {
		'x': policy_number_x,
		'y': gl_y
	},
	'NY_agent_name': {
		'x': 190,
		'y': 595
	},
	'NY_agent_phone': {
		'x': 390,
		'y': 695
	},
	'NY_box_1a': {
		'x': producer_insured_x,
		'y': 100
	},
	'NY_box_1b': {
		'x': 340,
		'y': 100
	},
	'NY_box_1c': {
		'x': 340,
		'y': 140
	},
	'NY_box_1d': {
		'x': 340,
		'y': 185
	},
	'NY_box_2': {
		'x': producer_insured_x,
		'y': 240
	},
	'NY_box_3a': {
		'x': 340,
		'y': 220
	},
	'NY_box_3b': {
		'x': 340,
		'y': 255
	},
	'NY_box_3c_eff': {
		'x': 355,
		'y': 284
	},
	'NY_box_3c_exp': {
		'x': 465,
		'y': 284
	},
	'NY_box_3d_excluded': {
		'x': 331.5,
		'y': 325.5
	},
	'NY_box_3d_included': {
		'x': 331.5,
		'y': 313.5
	},
	'NY_cancelation_checkbox': {
		'x': 189,
		'y': 419.75
	},
	'NY_date': {
		'x': 378,
		'y': 631
	},
	'NY_signature': {
		'x': 190,
		'y': 615
	},
	'NY_title': {
		'x': 190,
		'y': 668
	},
	'UMB_ded_checkbox': {
		'x': 41,
		'y': 471
	},
	'UMB_effective_date': {
		'x': policy_eff_x,
		'y': umb_y
	},
	'UMB_expiration_date': {
		'x': policy_exp_x,
		'y': umb_y
	},
	'UMB_insr_ltr': {
		'x': insr_ltr_x,
		'y': 460
	},
	'UMB_limit_11': {
		'x': limit_x_position,
		'y': limit_y_base + 12 * limit_offset
	},
	'UMB_limit_4': {
		'x': limit_x_position,
		'y': limit_y_base + 13 * limit_offset
	},
	'UMB_occur_checkbox': {
		'x': 120,
		'y': 448
	},
	'UMB_policy_number': {
		'x': policy_number_x,
		'y': umb_y
	},
	'UMB_umbrella_liab_checkbox': {
		'x': 41,
		'y': 448
	},
	'WC_effective_date': {
		'x': policy_eff_x,
		'y': wc_y
	},
	'WC_exclusion_checkbox': {
		'x': 162,
		'y': 501
	},
	'WC_expiration_date': {
		'x': policy_exp_x,
		'y': wc_y
	},
	'WC_insr_ltr': {
		'x': insr_ltr_x,
		'y': 500
	},
	'WC_limit_1': {
		'x': limit_x_position,
		'y': limit_y_base + 16 * limit_offset
	},
	'WC_limit_2': {
		'x': limit_x_position,
		'y': limit_y_base + 17 * limit_offset
	},
	'WC_limit_3': {
		'x': limit_x_position,
		'y': limit_y_base + 18 * limit_offset
	},
	'WC_per_statute_checkbox': {
		'x': 430,
		'y': 483.5
	},
	'WC_policy_number': {
		'x': policy_number_x,
		'y': 501
	},
	'certificate_holder': {
		'x': 60,
		'y': 685
	},
	'contact_email': {
		'x': 360,
		'y': 148
	},
	'contact_name': {
		'x': 360,
		'y': 124
	},
	'contact_phone': {
		'x': 360,
		'y': 136
	},
	'date': {
		'x': 526,
		'y': 37
	},
	'description_of_operations': {
		'x': 120,
		'y': 600
	},
	'insured': {
		'x': producer_insured_x,
		'y': 192
	},
	'insurer_A': {
		'x': insurer_x,
		'y': 172
	},
	'insurer_B': {
		'x': insurer_x,
		'y': 184
	},
	'insurer_C': {
		'x': insurer_x,
		'y': 196
	},
	'insurer_D': {
		'x': insurer_x,
		'y': 208
	},
	'insurer_E': {
		'x': insurer_x,
		'y': 220
	},
	'naic_A': {
		'x': naic_x,
		'y': 172
	},
	'naic_B': {
		'x': naic_x,
		'y': 184
	},
	'naic_C': {
		'x': naic_x,
		'y': 196
	},
	'naic_D': {
		'x': naic_x,
		'y': 208
	},
	'naic_E': {
		'x': naic_x,
		'y': 220
	},
	'producer': {
		'x': producer_insured_x,
		'y': 135
	},
	'signature': {
		'x': 400,
		'y': 713
	}

};