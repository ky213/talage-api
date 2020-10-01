/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');

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
    url = url.replace(/index\.[a-zA-Z0-9]*\/*/, '');
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
    let path = quoteURL.pathname;
    // Replace multiple slashes with a single one
    path = path.replace(/\/*/, '/');
    // Split out the components
    path = path.split('/');

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
    else {
        // Default to "talage"
        agencySlug = "talage";
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
                alp.additionalInfo as landingPageAdditionalInfo,
				icc.name as industryCodeCategory,
				alp.meta,
				ag.id,
				ag.ca_license_number as californiaLicense,
				ag.name as agencyName,
				ag.agency_network as agencyNetwork,
				ag.logo,
				ag.enable_optout,
				ag.website,
				ag.wholesale
			FROM clw_talage_agency_landing_pages as alp
			LEFT JOIN clw_talage_agencies AS ag ON alp.agency = ag.id
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
        //Get AgencyNetworkBO  If missing landing page content get AgnencyNetwork = 1 for it.
        const agencyNetworkBO = new AgencyNetworkBO();
        // eslint-disable-next-line no-unused-vars
        let error = null;
        const agencyNetworkJSON = await agencyNetworkBO.getById(agency.agencyNetwork).catch(function(err){
            error = err;
            log.error("Get AgencyNetwork Error " + err + __location);
        })
        //Check featurer - optout
        if(agencyNetworkJSON && agencyNetworkJSON.feature_json
            && agencyNetworkJSON.feature_json.applicationOptOut === false
        ){
            agency.enable_optout = 0
        }

        if(agencyNetworkJSON && agencyNetworkJSON.footer_logo){
            agency.footer_logo = agencyNetworkJSON.footer_logo
        }
        if(agencyNetworkJSON && agencyNetworkJSON.landing_page_content){
            agency.landingPageContent = agencyNetworkJSON.landing_page_content;
        }
        else {
            //get from default AgencyNetwork
            log.debug(`AgencyNetwork ${agency.agencyNetwork} using default landingpage`)
            const agencyNetworkJSONDefault = await agencyNetworkBO.getById(1).catch(function(err){
                error = err;
                log.error("Get AgencyNetwork 1 Error " + err + __location);
            });

            if(agencyNetworkJSONDefault && agencyNetworkJSONDefault.landing_page_content){
                agency.landingPageContent = agencyNetworkJSONDefault.landing_page_content;
                if(!agency.footer_logo){
                    agency.footer_logo = agencyNetworkJSONDefault.footer_logo;
                }
            }
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
        agency.showIntroText = false;
        if(agency.landingPageAdditionalInfo){
            agency.landingPageAdditionalInfo = JSON.parse(agency.landingPageAdditionalInfo);
            if(agency.landingPageAdditionalInfo.showIntroText){
                agency.showIntroText = agency.landingPageAdditionalInfo.showIntroText;
            }
        }
    }
    catch (error) {
        log.error(`Could not parse landingPageContent/meta in agency ${agencySlug}: ${error} ${__location}`);
        return null;
    }
    
    let locations = null;
    try{
        const query = {"agency": agency.id}
        const getChildren = true;
        const agencyLocationBO = new AgencyLocationBO();
        locations = await  agencyLocationBO.getList(query, getChildren);
        let insurerList = [];
        let removeList = ["doNotSnakeCase", "territories", "created", "modified", "modified_by","checked_out", "checked_out_time"]
        if(locations){
            for(let j=0; j < locations.length ; j++) {
                let location = locations[j];
                location.openTime = location.open_time;
                location.closeTime = location.close_time;
                location.territory = location.state_abbr;
                location.zip = location.zipcode;
                location.appointments = location.territories;
                if(location.insurers){
                    for(let i=0; i < location.insurers.length ; i++) {
                        let insurer = location.insurers[i];
                        insurer.agencylocation = location.id;
                        insurerList.push(insurer);
                    };
                    delete location.insurers;    
                }
                else {
                    log.error("No insurers for location " + __location)
                }
                for(let i =0;i< removeList.length ; i++) {
                    if(location[removeList[i]]){
                        delete location[removeList[i]]
                    }
                }                
            }
        }
        else {
            log.error(`No locations for Agency ${agency.id}` + __location)
        }
        agency.locations = locations
        agency.insurers = insurerList;
    }
    catch(err){
        log.error(err.message + __location);
        return null; 
    }
	// Retrieve Officer Titles
	const officerTitlesSql = `SELECT officerTitle from \`officer_titles\``;

	// Including an require statements.
	const officerTitlesResult = await db.query(officerTitlesSql).catch(function(err){
		log.error('officer_titles ' + err + __location);
	});
	const officerTitleArr = [];
	officerTitlesResult.forEach(officerTitleObj => officerTitleArr.push(officerTitleObj.officerTitle));
	if(officerTitleArr.length > 0){
		agency.officerTitles = officerTitleArr;
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

        // If that fails, return the talage agency
        if (agency === null) {
            agency = await getAgencyFromSlugs('talage', null);
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
            ag.agency_network as agencyNetwork,
            ag.name as agencyName,
			ag.logo,
			ag.website
		FROM clw_talage_agency_landing_pages as alp
		LEFT JOIN clw_talage_agencies AS ag ON alp.agency = ag.id
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
        const agencyNetworkBO = new AgencyNetworkBO();
        // eslint-disable-next-line no-unused-vars
        let error = null;
        // TODO refactor into BO function with list of default fields to use.
        const agencyNetworkJSON = await agencyNetworkBO.getById(agency.agencyNetwork).catch(function(err){
            error = err;
            log.error("Get AgencyNetwork Error " + err + __location);
        })
        if(agencyNetworkJSON && agencyNetworkJSON.footer_logo){
            agency.footer_logo = agencyNetworkJSON.footer_logo
        }
        if(agencyNetworkJSON && agencyNetworkJSON.landing_page_content){
            agency.landingPageContent = agencyNetworkJSON.landing_page_content;
        }
        else {
            //get from default AgencyNetwork
            log.debug(`AgencyNetwork ${agency.agencyNetwork} using default landingpage`)
            const agencyNetworkJSONDefault = await agencyNetworkBO.getById(1).catch(function(err){
                error = err;
                log.error("Get AgencyNetwork 1 Error " + err + __location);
            });

            if(agencyNetworkJSONDefault && agencyNetworkJSONDefault.landing_page_content){
                agency.landingPageContent = agencyNetworkJSONDefault.landing_page_content;
                if(!agency.footer_logo){
                    agency.footer_logo = agencyNetworkJSONDefault.footer_logo;
                }
            }
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
        metaTitle: agency.agencyName,
        metaDescription: agency.landingPageContent.bannerHeadingDefault ? agency.landingPageContent.bannerHeadingDefault : agency.defaultLandingPageContent.bannerHeadingDefault,
		metaImage: `${global.settings.IMAGE_URL}/public/agency-logos/${agency.logo}`,
		metaURL: agency.website
    });
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAppWF('Get Quote Agency', `${basePath}/agency`, getAgency);
    server.addGet('Get Quote Agency Metadata', `${basePath}/agency/social-metadata`, getAgencySocialMetadata);
};