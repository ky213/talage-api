/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

/**
 * Parses the quote app request URL and extracts the agency and page slugs
 *
 * @param {string} url - quote app request URL
 *
 * @returns {object} agencySlug, pageSlug
 */
function parseQuoteURL(url) {
    // Parse the agency slug
    let agencySlug = null;
    let pageSlug = null;

    url = url.replace(/index\.[a-zA-Z]*\/*/, '');
    let quoteURL = null;
    try {
        quoteURL = new URL(url);
    }
    catch (error) {
        log.error(`Could not parse quote application url '${url}': ${error} ${__location}`);
        return {
            agencySlug: agencySlug,
            pageSlug: pageSlug
        };
    }

    // Split the path so we can extract the agency and page slug if needed
    const path = quoteURL.pathname.split('/');
    if (quoteURL.searchParams.has('agency')) {
        // URL: http://domain/?agency=agencySlug&page=pageSlug
        agencySlug = quoteURL.searchParams.get('agency');
        if (quoteURL.searchParams.has('page')) {
            pageSlug = quoteURL.searchParams.get('page');
        }
    }
    else if (path.length > 1 && path[1].length > 0) {
        // URL: http://domain/agencySlug/pageSlug
        agencySlug = path[1];
        if (path.length > 2 && path[2].length > 0) {
            pageSlug = path[2];
        }
    }
    else if (global.settings.DEFAULT_QUOTE_AGENCY_SLUG) {
        agencySlug = global.settings.DEFAULT_QUOTE_AGENCY_SLUG;
    }
    return {
        agencySlug: agencySlug,
        pageSlug: pageSlug
    };
}

/**
 * Retrieves the agency information from a given agency/page slug.
 *
 * @param {string} agencySlug - agency slug
 * @param {object} pageSlug - page slug (optional)
 *
 * @returns {object} agency
 */
async function getAgencyFromSlugs(agencySlug, pageSlug) {
    let agency = null;
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
    }
    catch (error) {
        log.warn(`Could not retrieve quote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${error} ${__location}`);
        return null;
    }
    if (!agency) {
        log.warn(`Could not retrieve quote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}) ${__location}`);
        return null;
    }
    try {
        if (agency.landingPageContent) {
            agency.landingPageContent = JSON.parse(agency.landingPageContent);
        }
        if (agency.defaultLandingPageContent) {
            agency.defaultLandingPageContent = JSON.parse(agency.defaultLandingPageContent);
        }
        if (agency.meta) {
            agency.meta = JSON.parse(agency.meta);
        }
        if (agency.californiaLicense) {
            agency.californiaLicense = await crypt.decrypt(agency.californiaLicense);
        }
        if (agency.website) {
            agency.website = await crypt.decrypt(agency.website);
        }
    }
    catch (error) {
        log.error(`Could not parse landingPageContent/defaultLandingPageContent/meta in agency ${agencySlug}: ${error} ${__location}`);
        return null;
    }

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
        if (agency.locations) {
            for (let i = 0; i < agency.locations.length; i++) {
                const l = agency.locations[i];
                if (l) {
                    if (l.address) {
                        l.address = await crypt.decrypt(l.address);
                    }
                    if (l.address2) {
                        l.address2 = await crypt.decrypt(l.address2);
                    }
                    if (l.email) {
                        l.email = await crypt.decrypt(l.email);
                    }
                    if (l.phone) {
                        l.phone = await crypt.decrypt(l.phone);
                    }
                    if (l.city) {
                        l.city = stringFunctions.ucFirstLetter(l.city);
                    }
                    if (l.appointments) {
                        l.appointments = l.appointments.split(',');
                    }
                }
            }
        }
    }
    catch (error) {
        log.error(`Could not retrieve quote engine locations ${agencySlug} Agency: ${agency.id} (${pageSlug ? 'page ' + pageSlug : 'no page'}):  ${error} ${__location}`);
        return null;
    }

    // Get the agency insurers
    // TODO need to look at policy_type_info JSON.
    // bop, gl,wc are being decommissioned.
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
    }
    catch (error) {
        log.error(`Could not retrieve quote engine insurers ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${error} ${__location}`);
        return null;
    }

    // Update the landing page hit counter
    sql = `
			UPDATE clw_talage_agency_landing_pages
			SET hits = hits + 1
			WHERE id = ${agency.landingPageID}
		`;
    try {
        await db.query(sql);
    }
    catch (error) {
        log.error(`Could not update landing page hit for ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${error} ${__location}`);
        // continue (non-fatal)
    }
    return agency;
}

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
        res.send(400, {error: 'Missing URL'});
        return next();
    }
    const {
        agencySlug, pageSlug
    } = parseQuoteURL(req.query.url);

    let agency = null;
    if (agencySlug) {
        // Try to get the agency as request using both the agencySlug and the pageSlug
        agency = await getAgencyFromSlugs(agencySlug, pageSlug);

        // If that fails and it tried a valid pageSlug, fall back to just the agencySlug. If pageSlug is null, then this call was already made above.
        if (agency === null && pageSlug) {
            // Thought about adding log.warn, but that could get horrible with crawlers
            agency = await getAgencyFromSlugs(agencySlug, null);
        }

        // If that fails and there is a default agency slug, fall back to the default agencySlug
        if (agency === null && global.settings.DEFAULT_QUOTE_AGENCY_SLUG) {
            agency = await getAgencyFromSlugs(global.settings.DEFAULT_QUOTE_AGENCY_SLUG, null);
        }
    }
    res.send(200, {agency: agency});
    return next();
}

/**
 * Responds to POST requests and returns social media meta data
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencySocialMetadata(req, res, next) {
    if (!req.query.url) {
        res.send(400, {error: 'Missing URL'});
        return next();
    }

    const slugs = parseQuoteURL(req.query.url);
    let agencySlug = slugs.agencySlug;
    const pageSlug = slugs.pageSlug;

    if (!agencySlug) {
        agencySlug = 'talage';
    }
    // Retrieve the information needed to create the social media sharing metadata
    const sql = `
		SELECT
			ag.name,
			an.landing_page_content as landingPageContent,
			ag.logo,
			(SELECT landing_page_content FROM clw_talage_agency_networks WHERE id = 1) AS defaultLandingPageContent
		FROM clw_talage_agency_landing_pages as alp
		LEFT JOIN clw_talage_agencies AS ag ON alp.agency = ag.id
		LEFT JOIN clw_talage_agency_networks AS an ON ag.agency_network = an.id
		WHERE
			ag.slug = ${db.escape(agencySlug)}
			AND ag.state = 1
			AND alp.state = 1
			AND ${pageSlug ? 'alp.slug = ' + db.escape(pageSlug) : 'alp.primary = 1'}
	`;
    let agency = null;
    try {
        const result = await db.query(sql);
        if (result.length === 0) {
            throw new Error('zero-length query result');
        }
        agency = result[0];
    }
    catch (error) {
        log.warn(`Could not retrieve quote engine agency slug '${agencySlug}' (${pageSlug ? 'page ' + pageSlug : 'no page'}) for social metadata: ${error} ${__location}`);
        res.send(400, {error: 'Could not retrieve agency'});
        return next();
    }
    if (!agency) {
        res.send(400, {error: 'Could not retrieve agency'});
        return next();
    }
    try {
        if (agency.landingPageContent) {
            agency.landingPageContent = JSON.parse(agency.landingPageContent);
        }
        if (agency.defaultLandingPageContent) {
            agency.defaultLandingPageContent = JSON.parse(agency.defaultLandingPageContent);
        }
        if (agency.website) {
            agency.website = await crypt.decrypt(agency.website);
        }
    }
    catch (error) {
        log.error(`Could not parse landingPageContent/defaultLandingPageContent in agency slug '${agencySlug}' for social metadata: ${error} ${__location}`);
        res.send(400, {error: 'Could not process agency data'});
        return next();
    }
    res.send(200, {
        metaTitle: agency.name,
        metaDescription: agency.landingPageContent.bannerHeadingDefault ? agency.landingPageContent.bannerHeadingDefault : agency.defaultLandingPageContent.bannerHeadingDefault,
        metaImage: `https://${global.settings.S3_BUCKET}.s3-us-west-1.amazonaws.com/public/agency-logos/${agency.logo}`
    });
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAppWF('Get Quote Agency', `${basePath}/agency`, getAgency);
    server.addGet('Get Quote Agency Metadata', `${basePath}/agency/social-metadata`, getAgencySocialMetadata);
};