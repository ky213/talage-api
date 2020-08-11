/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * General Liability Policy Integration for Chubb
 */

'use strict';

const builder = require('xmlbuilder');
const moment = require('moment');
const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

module.exports = class ChubbGL extends Integration {
	/**
	 * Requests a quote from Chubb and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
	async _insurer_quote() {
		// These are the statuses returned by the insurer and how they map to our Talage statuses
		this.possible_api_responses.Decline = 'declined';
		this.possible_api_responses.Incomplete = 'error';
		this.possible_api_responses.Submitted = 'referred';
		this.possible_api_responses.Success = 'quoted';

		// Define how legal entities are mapped for Chubb
		const entity_matrix = {
			Association: 'ASLURO',
			Corporation: 'CP',
			'Joint Venture': 'JV',
			'Limited Liability Company': 'LLC',
			'Limited Liability Partnership': 'LL',
			'Limited Partnership': 'LP',
			Other: 'Other',
			Partnership: 'PT',
			'Sole Proprietorship': 'IN',
			'Trust - For Profit': 'TE',
			'Trust - Non-Profit': 'TE'
		};

		// Check Industry Code Support
		if (!this.industry_code.cgl) {
			log.error(`Chubb GL: CGL not set for Industry Code ${this.industry_code.id} ` + __location);
			this.reasons.push(`CGL not set for Industry Code ${this.industry_code.id}`);
			return this.return_result('error');
		}
		if (!this.industry_code.iso) {
			log.error(`Chubb GL:  ISO not set for Industry Code ${this.industry_code.id} ` + __location);
			this.reasons.push(`ISO not set for Industry Code ${this.industry_code.id}`);
			return this.return_result('error');
		}
		if (!this.industry_code.attributes) {
			log.error(`Chubb GL: Missing Attributes for Industry Code ${this.industry_code.id} ` + __location);
			this.reasons.push(`Missing Attributes for Industry Code ${this.industry_code.id}`);
			return this.return_result('error');
		}
		if (!Object.prototype.hasOwnProperty.call(this.industry_code.attributes, 'class_code_id')) {
			log.error(`Chubb GL: Missing required attribute 'class_code_id' for Industry Code ${this.industry_code.id} ` + __location);
			this.reasons.push(`Missing required attribute 'class_code_id' for Industry Code ${this.industry_code.id}`);
			return this.return_result('error');
		}
		if (!Object.prototype.hasOwnProperty.call(this.industry_code.attributes, 'segment')) {
			log.error(`Chubb GL: Missing required attribute 'segment' for Industry Code ${this.industry_code.id} ` + __location);
			this.reasons.push(`Missing required attribute 'segment' for Industry Code ${this.industry_code.id}`);
			return this.return_result('error');
		}
		if (!Object.prototype.hasOwnProperty.call(this.industry_code.attributes, 'exposure')) {
			log.error(`Chubb GL: Missing required attribute 'exposure' for Industry Code ${this.industry_code.id} ` + __location);
			this.reasons.push(`Missing required attribute 'exposure' for Industry Code ${this.industry_code.id}`);
			return this.return_result('error');
		}

		// Determine which API host to use
		let host = '';
		if (this.insurer.useSandbox) {
			host = 'nauat.chubbdigital.com';
		} else {
			host = 'na.chubbdigital.com';
		}

		// Get a token from their auth server
		const tokenResponse = null;
		try {
			tokenResponse = await this.send_json_request(host, '/api/v1/tokens', null, { App_ID: this.username, App_Key: this.password }, 'POST');
		} catch (error) {
			log.error(`Chubb GL: error sending the token request: ${error} ${__location}`);
			return this.return_error('error');
		}

		// Build the XML Request

		// <ACORD>
		const ACORD = builder.create('ACORD', { headless: true });
		ACORD.att('xmlns', 'http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/');
		ACORD.att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
		ACORD.att('xmlns:ace', 'urn:com.acegroup.acord-extensions');

		// <InsuranceSvcRq>
		const InsuranceSvcRq = ACORD.ele('InsuranceSvcRq');
		InsuranceSvcRq.ele('RqUID', this.generate_uuid());

		// <BOPPolicyQuoteInqRq>
		const BOPPolicyQuoteInqRq = InsuranceSvcRq.ele('BOPPolicyQuoteInqRq');

		// <MsgRqInfo>
		const MsgRqInfo = BOPPolicyQuoteInqRq.ele('MsgRqInfo');
		MsgRqInfo.ele('BroadLobCd', 'C');
		MsgRqInfo.ele('AcordStandardVersionCd', '1.28');
		MsgRqInfo.ele('TransactionEffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));
		MsgRqInfo.ele('BusinessPurposeTypeCd', 'NBQ');
		// </MsgRqInfo>

		// <Producer>
		const Producer = BOPPolicyQuoteInqRq.ele('Producer');
		Producer.att('Action', 'Create');
		Producer.att('id', this.generate_uuid());

		// <GeneralPartyInfo>
		let GeneralPartyInfo = Producer.ele('GeneralPartyInfo');

		// <CommercialName>
		GeneralPartyInfo.ele('NameInfo').ele('CommlName').ele('CommercialName', 'Talage, Inc.');

		// <Addr>
		let Addr = GeneralPartyInfo.ele('Addr');
		Addr.att('Action', 'Create');
		Addr.att('id', this.generate_uuid());
		Addr.ele('AddrTypeCd', 'MailingAddress');
		Addr.ele('Addr1', 'PO Box 12332');
		Addr.ele('Addr2');
		Addr.ele('City', 'Reno');
		Addr.ele('StateProvCd', 'NV');
		Addr.ele('PostalCode', '89510');
		// </Addr>

		// <Communications>
		let Communications = GeneralPartyInfo.ele('Communications');
		Communications.ele('PhoneInfo').ele('PhoneNumber', '8334725243');
		Communications.ele('EmailInfo').ele('EmailAddr', 'info@talageins.com');
		// </Communications>

		// </GeneralPartyInfo>

		Producer.ele('ProducerInfo').ele('ContractNumber', this.app.agencyLocation.insurers[this.insurer.id].agency_id);
		// </Producer>

		// <InsuredOrPrincipal>
		const InsuredOrPrincipal = BOPPolicyQuoteInqRq.ele('InsuredOrPrincipal');
		InsuredOrPrincipal.att('Action', 'Create');
		InsuredOrPrincipal.att('id', this.generate_uuid());

		// <GeneralPartyInfo>
		GeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');
		GeneralPartyInfo.att('Action', 'Create');

		// <NameInfo>
		const NameInfo = GeneralPartyInfo.ele('NameInfo');
		NameInfo.att('Action', 'Create');
		NameInfo.ele('CommlName').ele('CommercialName', this.app.business.name.replace(/&/g, 'and'));
		// </NameInfo>

		GeneralPartyInfo.ele('LegalEntityCd', this.app.business.entity_type in entity_matrix ? entity_matrix[this.app.business.entity_type] : 'Other');

		// Send in the mailing address
		// <Addr>
		Addr = GeneralPartyInfo.ele('Addr');
		Addr.att('Action', 'Create');
		Addr.att('id', this.generate_uuid());
		Addr.ele('AddrTypeCd', 'MailingAddress');
		Addr.ele('Addr1', this.app.business.mailing_address);
		Addr.ele('Addr2', this.app.business.mailing_address2);
		Addr.ele('City', this.app.business.mailing_city);
		Addr.ele('StateProvCd', this.app.business.mailing_territory);
		Addr.ele('PostalCode', this.app.business.mailing_zip);
		// </Addr>

		this.app.business.locations.forEach((loc) => {
			// <Addr>
			Addr = GeneralPartyInfo.ele('Addr');
			Addr.att('Action', 'Create');
			Addr.att('id', this.generate_uuid());
			Addr.ele('AddrTypeCd', 'PhysicalRisk');
			Addr.ele('Addr1', loc.address);
			Addr.ele('Addr2', loc.address2);
			Addr.ele('City', loc.city);
			Addr.ele('StateProvCd', loc.territory);
			Addr.ele('PostalCode', loc.zip);
			// </Addr>
		});
		// <Communications>
		Communications = GeneralPartyInfo.ele('Communications');
		const phone = this.app.business.phone.toString();
		Communications.ele('PhoneInfo').ele('PhoneNumber', `${phone.substring(0, 3)}-${phone.substring(3, 6)}-${phone.substring(phone.length - 4)}`);
		Communications.ele('EmailInfo').ele('EmailAddr', this.app.business.contacts[0].email);
		// </Communications>

		// </GeneralPartyInfo>

		// </InsuredOrPrincipal>

		// <CommlPolicy>
		const CommlPolicy = BOPPolicyQuoteInqRq.ele('CommlPolicy');
		CommlPolicy.att('Action', 'Create');
		CommlPolicy.att('id', this.generate_uuid());
		CommlPolicy.ele('PolicyVersion', '1');
		CommlPolicy.ele('BroadLobCd', 'C');
		CommlPolicy.ele('LobCd', 'SCAP');
		CommlPolicy.ele('LobSubCd', 'LIAB');
		CommlPolicy.ele('ControllingStateProvCd', this.app.business.primary_territory);

		// <ContractTerm>
		const ContractTerm = CommlPolicy.ele('ContractTerm');
		ContractTerm.ele('EffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));
		ContractTerm.ele('ExpirationDt', this.policy.expiration_date.format('YYYY-MM-DD'));
		ContractTerm.ele('StartTime');
		ContractTerm.ele('EndTime');
		ContractTerm.ele('LocalStandardTimeInd');

		// <DurationPeriod>
		const DurationPeriod = ContractTerm.ele('DurationPeriod');
		DurationPeriod.ele('NumUnits', '12');
		DurationPeriod.ele('UnitMeasurementCd', 'Month');
		// </DurationPeriod>

		CommlPolicy.ele('BillingMethodCd', 'DR');

		// <PaymentOption>
		const PaymentOption = CommlPolicy.ele('PaymentOption');
		PaymentOption.ele('PaymentPlanCd', 'AFL');
		PaymentOption.ele('NumPayments', '01');
		// </PaymentOption>

		CommlPolicy.ele('QuoteInfo').ele('InitialQuoteRequestDt', moment().format('YYYY-MM-DD'));

		// <CommlPolicySupplement>
		const CommlPolicySupplement = CommlPolicy.ele('CommlPolicySupplement');

		// <CommlParentOrSubsidiaryInfo>
		const CommlParentOrSubsidiaryInfo = CommlPolicySupplement.ele('CommlParentOrSubsidiaryInfo');
		CommlParentOrSubsidiaryInfo.ele('BusinessStartDt', this.app.business.founded.format('YYYY-MM-DD'));
		CommlParentOrSubsidiaryInfo.ele('NumEmployees', this.get_total_employees());
		CommlParentOrSubsidiaryInfo.ele('OperationsDesc', this.app.business.industry_code_description);
		// </CommlParentOrSubsidiaryInfo>

		// <AnnualSalesAmt>
		const AnnualSalesAmt = CommlPolicySupplement.ele('AnnualSalesAmt');
		AnnualSalesAmt.ele('Amt', this.policy.gross_sales);
		// </AnnualSalesAmt>

		// <TotalPayrollAmt>
		const TotalPayrollAmt = CommlPolicySupplement.ele('TotalPayrollAmt');
		TotalPayrollAmt.ele('Amt', this.get_total_payroll());
		// </TotalPayrollAmt>

		// <GrossSalesAmt>
		const GrossSalesAmt = CommlPolicySupplement.ele('GrossSalesAmt');
		GrossSalesAmt.ele('Amt', this.policy.gross_sales);
		// </GrossSalesAmt>

		// <SquareFootage>
		const SquareFootage = CommlPolicySupplement.ele('SquareFootage');
		SquareFootage.ele('Amt', this.get_total_square_footage());
		// </SquareFootage>

		// </CommlPolicySupplement>

		// </CommlPolicy>

		// <Location>
		const Location = BOPPolicyQuoteInqRq.ele('Location');
		Location.att('Action', 'Create');
		Location.att('id', 'L1');

		// <Addr>
		Addr = Location.ele('Addr');
		Addr.att('Action', 'Create');
		Addr.att('id', this.generate_uuid());
		Addr.ele('AddrTypeCd', 'MailingAddress');
		Addr.ele('Addr1', this.app.business.mailing_address);
		Addr.ele('Addr2', this.app.business.mailing_address2);
		Addr.ele('City', this.app.business.mailing_city);
		Addr.ele('StateProvCd', this.app.business.mailing_territory);
		Addr.ele('PostalCode', this.app.business.mailing_zip);
		// </Addr>

		Location.ele('CrimeIndexCd');
		Location.ele('LocationName', 'Primary Location');
		Location.ele('LocationDesc', '1');

		// Send all locations
		let count = 0;
		this.app.business.locations.forEach((loc) => {
			// <SubLocation>
			const SubLocation = Location.ele('SubLocation');
			SubLocation.att('Action', 'Create');
			SubLocation.att('id', `L1S${count + 1}`);

			// <Addr>
			Addr = SubLocation.ele('Addr');
			Addr.att('Action', 'Create');
			Addr.att('id', this.generate_uuid());
			Addr.ele('AddrTypeCd');
			Addr.ele('Addr1', loc.address);
			Addr.ele('Addr2', loc.address2);
			Addr.ele('City', loc.city);
			Addr.ele('StateProvCd', loc.territory);
			Addr.ele('PostalCode', loc.zip);
			// </Addr>

			// </SubLocation>

			count++;
		});
		// </Location>

		// <CommlSubLocation>
		const CommlSubLocation = BOPPolicyQuoteInqRq.ele('CommlSubLocation');
		CommlSubLocation.att('LocationRef', 'L1');

		// <QuestionAnswer>
		let QuestionAnswer = CommlSubLocation.ele('QuestionAnswer');
		QuestionAnswer.ele('QuestionCd', 'D27');
		QuestionAnswer.ele('QuestionText', 'Do you offer aerial photography or videography services?');
		QuestionAnswer.ele('YesNoCd', 'No');
		QuestionAnswer.ele('Num');
		QuestionAnswer.ele('Explanation');
		// </QuestionAnswer>

		// <QuestionAnswer>
		QuestionAnswer = CommlSubLocation.ele('QuestionAnswer');
		QuestionAnswer.ele('QuestionCd', 'D28');
		QuestionAnswer.ele('QuestionText', 'Do you perform any film shoots or production services?');
		QuestionAnswer.ele('YesNoCd', 'No');
		QuestionAnswer.ele('Num');
		QuestionAnswer.ele('Explanation');
		// </QuestionAnswer>

		// </CommlSubLocation>

		// <BOPLineBusiness>
		const BOPLineBusiness = BOPPolicyQuoteInqRq.ele('BOPLineBusiness');
		BOPLineBusiness.att('Action', 'Create');
		BOPLineBusiness.att('id', this.generate_uuid());
		BOPLineBusiness.ele('LobCd', 'SCAP');
		BOPLineBusiness.ele('LobSubCd', 'LIAB');
		BOPLineBusiness.ele('IncludeGL', '1');
		BOPLineBusiness.ele('IncludeProperty', '0');
		BOPLineBusiness.ele('PackageType', 'Silver');
		BOPLineBusiness.ele('QuoteType', 'Quote');

		// Do you want terrorism coverage?
		if (this.questions[1064].get_answer_as_boolean()) {
			// <CommlCoverage>
			const terrorism_CommlCoverage = BOPLineBusiness.ele('CommlCoverage');
			terrorism_CommlCoverage.att('Action', 'Create');
			terrorism_CommlCoverage.att('id', this.generate_uuid());
			terrorism_CommlCoverage.ele('CoverageCd', 'TRIA');
			terrorism_CommlCoverage.ele('CoverageTypeCd', 'Coverage');
			terrorism_CommlCoverage.ele('IterationNumber', '1');
			terrorism_CommlCoverage.ele('CoverageDesc', 'Terrorism Coverage');

			// <Limit>
			const terrorism_Limit = terrorism_CommlCoverage.ele('Limit');
			terrorism_Limit.att('id', this.generate_uuid());
			terrorism_Limit.ele('FormatInteger');
			terrorism_Limit.ele('FormatCurrencyAmt').ele('Amt');
			terrorism_Limit.ele('ValuationCd');
			terrorism_Limit.ele('LimitAppliesToCd');
			// </Limit>

			// <Deductible>
			const terrorism_Deductible = terrorism_CommlCoverage.ele('Deductible');
			terrorism_Deductible.att('id', this.generate_uuid());
			terrorism_Deductible.ele('FormatInteger');
			terrorism_Deductible.ele('FormatCurrencyAmt').ele('Amt');
			terrorism_Deductible.ele('FormatModFactor');
			terrorism_Deductible.ele('DeductibleTypeCd');
			terrorism_Deductible.ele('DeductibleAppliesToCd');
			// </Deductible>

			terrorism_CommlCoverage.ele('EffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));
			terrorism_CommlCoverage.ele('ExpirationDt', this.policy.expiration_date.format('YYYY-MM-DD'));
			terrorism_CommlCoverage.ele('CategoryCd', 'LP');
			terrorism_CommlCoverage.ele('RatingClassificationCd', this.industry_code.cgl);
			// </CommlCoverage>
		}

		// <LiabilityInfo>
		const LiabilityInfo = BOPLineBusiness.ele('LiabilityInfo');
		LiabilityInfo.att('Action', 'Create');
		LiabilityInfo.att('id', this.generate_uuid());

		// <GeneralLiabilityClassification>
		const GeneralLiabilityClassification = LiabilityInfo.ele('GeneralLiabilityClassification');
		GeneralLiabilityClassification.att('id', this.generate_uuid());
		GeneralLiabilityClassification.att('LocationRef', 'L1');
		GeneralLiabilityClassification.ele('ClassCd', this.industry_code.iso);
		GeneralLiabilityClassification.ele('ClassCdDesc', this.app.business.industry_code_description);
		GeneralLiabilityClassification.ele('ClassIdentifier', this.industry_code.attributes.class_code_id);
		GeneralLiabilityClassification.ele('Segment', this.industry_code.attributes.segment);
		GeneralLiabilityClassification.ele('StateProvCd', this.app.business.primary_territory);
		GeneralLiabilityClassification.ele('InterestIdNumber', '1');
		// </GeneralLiabilityClassification>

		// <CommlCoverage>
		let CommlCoverage = GeneralLiabilityClassification.ele('CommlCoverage');
		CommlCoverage.att('Action', 'Create');
		CommlCoverage.att('id', this.generate_uuid());
		CommlCoverage.ele('CoverageCd', 'GENAG');
		CommlCoverage.ele('CoverageTypeCd', 'Coverage');
		CommlCoverage.ele('IterationNumber', '1');
		CommlCoverage.ele('CoverageDesc', 'General Aggregate');

		// <Limit>
		let Limit = CommlCoverage.ele('Limit');
		Limit.att('id', this.generate_uuid());
		Limit.ele('FormatInteger', '1000000');
		Limit.ele('FormatCurrencyAmt').ele('Amt', '1000000');
		Limit.ele('ValuationCd');
		Limit.ele('LimitAppliesToCd', 'Coverage');
		// </Limit>

		// <Deductible>
		let Deductible = CommlCoverage.ele('Deductible');
		Deductible.att('id', this.generate_uuid());
		Deductible.ele('FormatInteger');
		Deductible.ele('FormatCurrencyAmt');
		Deductible.ele('DeductibleTypeCd');
		// </Deductible>

		// <CommlCoverageSupplement>
		let CommlCoverageSupplement = CommlCoverage.ele('CommlCoverageSupplement');

		// <Rating>
		let Rating = CommlCoverageSupplement.ele('Rating');
		Rating.ele('PremiumBasisCd', this.industry_code.attributes.exposure);
		switch (this.industry_code.attributes.exposure) {
			case 'Area':
				Rating.ele('Exposure', this.get_total_square_footage());
				break;
			case 'GrSales':
				Rating.ele('Exposure', this.policy.gross_sales);
				break;
			case 'PAYRL':
				Rating.ele('Exposure', this.get_total_payroll());
				break;

			/*
			 * Retail
			 * Unit
			 * Office
			 * Member
			 * Show
			 */
			default:
				// Unsupported Exposure
				log.error(`Chubb GL: Unsupported exposure of '${this.industry_code.attributes.exposure}'} ` + __location);
				this.reasons.push(`Unsupported exposure of '${this.industry_code.attributes.exposure}'`);
				return this.return_result('error');
		}

		// </Rating>

		// </CommlCoverageSupplement>

		CommlCoverage.ele('EffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));
		CommlCoverage.ele('ExpirationDt', this.policy.expiration_date.format('YYYY-MM-DD'));
		CommlCoverage.ele('CategoryCd', 'L');
		CommlCoverage.ele('RatingClassificationCd', this.industry_code.cgl);
		// </CommlCoverage>

		// <CommlCoverage>
		CommlCoverage = GeneralLiabilityClassification.ele('CommlCoverage');
		CommlCoverage.att('Action', 'Create');
		CommlCoverage.att('id', this.generate_uuid());
		CommlCoverage.ele('CoverageCd', 'GO');
		CommlCoverage.ele('CoverageTypeCd', 'Coverage');
		CommlCoverage.ele('IterationNumber', '1');
		CommlCoverage.ele('CoverageDesc', 'Occurrence Limit');

		// <Limit>
		Limit = CommlCoverage.ele('Limit');
		Limit.att('id', this.generate_uuid());
		Limit.ele('FormatInteger', '1000000');
		Limit.ele('FormatCurrencyAmt').ele('Amt', '1000000');
		Limit.ele('ValuationCd');
		Limit.ele('LimitAppliesToCd', 'Coverage');
		// </Limit>

		// <Deductible>
		Deductible = CommlCoverage.ele('Deductible');
		Deductible.att('id', this.generate_uuid());
		Deductible.ele('FormatInteger');
		Deductible.ele('FormatCurrencyAmt');
		Deductible.ele('DeductibleTypeCd');
		// </Deductible>

		// <CommlCoverageSupplement>
		CommlCoverageSupplement = CommlCoverage.ele('CommlCoverageSupplement');

		// <Rating>
		Rating = CommlCoverageSupplement.ele('Rating');
		Rating.ele('PremiumBasisCd', this.industry_code.attributes.exposure);
		switch (this.industry_code.attributes.exposure) {
			case 'Area':
				Rating.ele('Exposure', this.get_total_square_footage());
				break;
			case 'GrSales':
				Rating.ele('Exposure', this.policy.gross_sales);
				break;
			case 'PAYRL':
				Rating.ele('Exposure', this.get_total_payroll());
				break;
			default:
				// Unsupported Exposure
				log.error(`Chubb GL: Unsupported exposure of '${this.industry_code.attributes.exposure}'} ` + __location);
				this.reasons.push(`Unsupported exposure of '${this.industry_code.attributes.exposure}'`);
				return this.return_result('error');
		}

		// </Rating>

		// </CommlCoverageSupplement>

		CommlCoverage.ele('EffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));
		CommlCoverage.ele('ExpirationDt', this.policy.expiration_date.format('YYYY-MM-DD'));
		CommlCoverage.ele('CategoryCd', 'L');
		CommlCoverage.ele('RatingClassificationCd', this.industry_code.cgl);

		// </CommlCoverage>
		// </GeneralLiabilityClassification>
		// </LiabilityInfo>

		let question_identifiers = null;
		try {
			question_identifiers = await this.get_question_identifiers();
		} catch (err) {
			log.error(`Chubb GL: get_question_identifiers error ${err}` + __location);
			this.reasons.push('Unable to get question identifiers');
			return this.return_result('error');
		}

		// Loop through each question
		for (const question_id in this.questions) {
			if (Object.prototype.hasOwnProperty.call(this.questions, question_id)) {
				const question = this.questions[question_id];
				const QuestionCd = question_identifiers[question.id];

				// Don't process questions without a code (not for this insurer)
				if (!QuestionCd) {
					continue;
				}

				// Build out the question structure (Chubb only has Boolean, so don't worry about others)
				QuestionAnswer = BOPLineBusiness.ele('QuestionAnswer');
				QuestionAnswer.ele('QuestionCd', QuestionCd);
				QuestionAnswer.ele('QuestionText', question.text); // TO DO: How do we know the correct question text?
				QuestionAnswer.ele('YesNoCd', question.get_answer_as_boolean() ? 'Yes' : 'No');
				QuestionAnswer.ele('Num');
				QuestionAnswer.ele('Explanation');
			}
		}

		// <QuestionAnswer>
		QuestionAnswer = BOPLineBusiness.ele('QuestionAnswer');
		QuestionAnswer.ele('QuestionCd', 'D04');
		QuestionAnswer.ele('QuestionText', 'Has your insurance coverage been cancelled or non-renewed in the past three years for reasons other than nonpayment of premium?');
		QuestionAnswer.ele('YesNoCd', this.policy.coverage_lapse && !this.policy.coverage_lapse_non_payment ? 'Yes' : 'No');
		QuestionAnswer.ele('Num');
		QuestionAnswer.ele('Explanation');
		// </QuestionAnswer>

		// <QuestionAnswer>
		QuestionAnswer = BOPLineBusiness.ele('QuestionAnswer');
		QuestionAnswer.ele('QuestionCd', 'R02');
		QuestionAnswer.ele('QuestionText', 'Have you filed any insurance claims for this business in the past five years?');
		QuestionAnswer.ele('YesNoCd', this.policy.claims.length ? 'Yes' : 'No');
		QuestionAnswer.ele('Num');
		QuestionAnswer.ele('Explanation');
		// </QuestionAnswer>

		// </BOPLineBusiness>

		// </BOPPolicyQuoteInqRq>

		// </InsuranceSvcRq>

		// </ACORD>

		// Get the XML structure as a string
		const xml = ACORD.end({ pretty: true });

		// Build the authorization header
		const headers = { Authorization: `${tokenResponse.token_type} ${tokenResponse.access_token}` };

		// Send the XML to the insurer
		let result = null;
		try {
			result = await this.send_xml_request(host, '/api/v1/quotes', xml, headers);
		} catch (error) {
			log.error(`${this.insurer.name} ${this.policy.type} Integration Error: ${error} ${__location}`);
			return this.return_result('error');
		}
		// Parse the various status codes and take the appropriate action
		let res = result.ACORD.InsuranceSvcRs[0];
		let status = null;

		// Determine what happened
		switch (res.Status[0].StatusCd[0]) {
			case 'DC-100':
				log.error(`Chubb GL: Error DC-100: The data we sent was invalid ` + __location);
				this.reasons.push('Error DC-100: The data we sent was invalid');
				return this.return_result('error');
			case '400':
				log.error(`Chubb GL: Error 400: ${res.Status[0].StatusDesc[0]} ` + __location);
				this.reasons.push(`Error 400: ${res.Status[0].StatusDesc[0]}`);
				return this.return_result('error');
			case '0':
				// Furthher refine
				res = res.BOPPolicyQuoteInqRs[0];

				// Determine the response
				status = res.MsgRsInfo[0].MsgStatus[0].MsgStatusCd[0];

				// If the quote was not successful, try to figure out why
				if (status !== 'Success') {
					try {
						const error_message = res.MsgRsInfo[0].MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0];
						log.warn(`Error Returned by Carrier: ${error_message}` + __location);
						this.log += `Error Returned by Carrier: ${error_message}`;
					} catch (e) {
						log.warn(`${this.insurer.name} ${this.policy.type} Error Returned by Carrier: Quote structure changed. Unable to find error message.` + __location);
						return this.return_result('error');
					}
				}

				// Attempt to get the quote number
				try {
					this.request_id = res.CommlPolicy[0].QuoteInfo[0].CompanysQuoteNumber[0];
				} catch (e) {
					log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find quote number.`);
				}

				// Get the amount of the quote (from the Silver package only, per Adam)
				try {
					this.amount = parseInt(res.CommlPolicy[0].SilverTotalPremium[0], 10);
				} catch (e) {
					// This is handled in return_result()
				}

				// Grab the writing company
				try {
					this.writer = res.CommlPolicy[0].WritingCompany[0];
				} catch (e) {
					log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find writing company.` + __location);
				}

				// Grab the limits info
				try {
					res.BOPLineBusiness[0].LiabilityInfo[0].GeneralLiabilityClassification[0].CommlCoverage.forEach((coverage) => {
						switch (coverage.CoverageCd[0]) {
							case 'GENAG':
								this.limits[8] = coverage.Limit[0].FormatInteger[0];
								break;
							case 'GO':
								this.limits[4] = coverage.Limit[0].FormatInteger[0];
								break;
							default:
								log.warn(`${this.insurer.name} GL Integration Error: Unexpected limit found in response`);
								break;
						}

						// Limits that Chubb doesn't reutrn in the API but we need anyway
						this.limits[5] = 100000;
						this.limits[6] = 5000;
						this.limits[7] = 1000000;
						this.limits[9] = 2000000;
					});
				} catch (e) {
					// This is handled in return_result()
				}
				// Send the result of the request
				return this.return_result(status);

			default:
				log.error(`${this.insurer.name} ${this.policy.type} API returned unknown status code of ${res.Status[0].StatusCd[0]} ${__location}`);
				this.reasons.push(`API returned unknown status code of ${res.Status[0].StatusCd[0]}`);
				return this.return_result('error');
		}
	}
};
