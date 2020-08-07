/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

/**
 * Responds to POST requests and returns policy quotes
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgency(req, res, next) {
	if (!req.query.url) {
		res.send(400, { error: 'Missing URL' });
		return next();
	}
	let quoteURL = null;
	try {
		quoteURL = new URL(req.query.url);
	} catch (error) {
		log.error(`Could not parse url '${req.query.url}': ${error} ${__location}`);
		res.send(400, { error: 'Invalid URL' });
		return next();
	}

	// Split the path so we can extract the agency and page slug if needed
	const path = quoteURL.pathname.split('/');

	// Parse the agency slug
	let agencySlug = null;
	let pageSlug = null;

	if (quoteURL.searchParams.has('agency')) {
		// URL: http://domain/?agency=agencySlug&page=pageSlug
		agencySlug = quoteURL.searchParams.get('agency');
		if (quoteURL.searchParams.has('page')) {
			pageSlug = quoteURL.searchParams.get('page');
		}
	} else if (path.length > 1) {
		// URL: http://domain/agencySlug/pageSlug
		agencySlug = path[1];
		if (path.length > 2) {
			pageSlug = path[2];
		}
	}
	let agency = null;
	if (agencySlug) {
		let sql = `
			SELECT
				alp.about,
				alp.banner,
				alp.color_scheme as colorScheme,
				cs.primary, 
				cs.primary_accent as primaryAccent, 
				cs.secondary, 
				cs.secondary_accent as secondaryAccent,
				cs.tertiary, 
				cs.tertiary_accent as tertiaryAccent,
				alp.heading,
				alp.id as landingPageID,
				alp.agency_location_id,
				alp.industry_code as industryCode,
				alp.intro_heading as introHeading,
				alp.intro_text as introText,
				alp.show_industry_section as showIndustrySection,
				icc.name as industryCodeCategory,
				alp.meta,
				ag.id,
				ag.ca_license_number as californiaLicense,
				ag.name as agencyName,
				ag.agency_network as agencyNetwork,
				an.landing_page_content as landingPageContent,
				an.footer_logo,
				ag.logo,
				ag.enable_optout,
				ag.website,
				ag.wholesale,
				(SELECT landing_page_content FROM clw_talage_agency_networks WHERE id = 1) AS defaultLandingPageContent
			FROM clw_talage_agency_landing_pages as alp
			LEFT JOIN clw_talage_agencies AS ag ON alp.agency = ag.id
			LEFT JOIN clw_talage_agency_networks AS an ON ag.agency_network = an.id
			LEFT JOIN clw_talage_industry_code_categories AS icc ON alp.industry_code_category = icc.id
			LEFT JOIN clw_talage_color_schemes AS cs ON cs.id = alp.color_scheme
			WHERE
				ag.slug = ${db.escape(agencySlug)}
				AND ag.state = 1
				AND alp.state = 1
				AND ${pageSlug ? 'alp.slug = ' + db.escape(pageSlug) : 'alp.primary = 1'}
		`;
		try {
			const result = await db.query(sql);
			agency = result[0];
		} catch (error) {
			log.warn(`Could not retrieve quote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${error} ${__location}`);
			res.send(400, { error: 'Could not retrieve agency' });
			return next();
		}
		if (!agency) {
			log.warn(`Could not retrieve quote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}) ${__location}`);
			res.send(400, { error: 'Could not retrieve agency' });
			return next();
		}
		try {
			agency.landingPageContent = JSON.parse(agency.landingPageContent);
			agency.defaultLandingPageContent = JSON.parse(agency.defaultLandingPageContent);
			agency.meta = JSON.parse(agency.meta);
		} catch (error) {
			log.error(`Could not parse landingPageContent/defaultLandingPageContent/meta in agency ${agencySlug}: ${error} ${__location}`);
			res.send(400, { error: 'Could not proces agency data' });
			return next();
		}
		agency.californiaLicense = await crypt.decrypt(agency.californiaLicense);
		agency.website = await crypt.decrypt(agency.website);

		// Get the locations
		sql = `
			SELECT
				al.id,
				al.address,
				al.address2,
				al.close_time as closeTime,
				al.email,
				al.open_time as openTime,
				al.phone,
				al.primary,
				al.zip,
				z.city,
				z.territory,
				GROUP_CONCAT(alt.territory) AS appointments
			FROM clw_talage_agency_locations AS al
			LEFT JOIN clw_talage_agency_location_territories AS alt ON al.id = alt.agency_location
			LEFT JOIN clw_talage_zip_codes AS z ON al.zip = z.zip
			WHERE
				agency = ${agency.id}
				AND state = 1
			GROUP BY al.id
		`;
		try {
			agency.locations = await db.query(sql);
			for (let i = 0; i < agency.locations.length; i++) {
				const l = agency.locations[i];
				l.address = await crypt.decrypt(l.address);
				if (l.address2) {
					l.address2 = await crypt.decrypt(l.address2);
				}
				l.email = await crypt.decrypt(l.email);
				l.phone = await crypt.decrypt(l.phone);
				l.city = stringFunctions.ucFirstLetter(l.city);
				l.appointments = l.appointments.split(',');
			}
		} catch (error) {
			log.error(`Could not retrieve quote engine locations ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${error} ${__location}`);
			res.send(400, { error: 'Could not retrieve locations' });
			return next();
		}

		// Get the agency insurers
		const locationIDs = [];
		agency.locations.forEach((l) => {
			locationIDs.push(l.id);
		});
		sql = `
			SELECT
				insurer,
				bop,
				gl,
				wc,
				agency_location as agencyLocation
			FROM clw_talage_agency_location_insurers
			WHERE agency_location IN(${locationIDs.join(',')})
		`;
		try {
			agency.insurers = await db.query(sql);
		} catch (error) {
			log.error(`Could not retrieve quote engine insurers ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${error} ${__location}`);
			res.send(400, { error: 'Could not retrieve insurers' });
			return next();
		}

		// Update the landing page hit counter
		sql = `
			UPDATE clw_talage_agency_landing_pages
			SET hits = hits + 1
			WHERE id = ${agency.landingPageID}
		`;
		try {
			await db.query(sql);
		} catch (error) {
			log.error(`Could not update landing page hit for ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${error} ${__location}`);
			// continue (non-fatal)
		}
	}

	res.send(200, { agency });
	return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addGetAuthAppWF('Get Quote Agency', `${basePath}/agency`, getAgency);
};
