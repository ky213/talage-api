/* eslint-disable space-before-function-paren */
/* eslint-disable brace-style */
/* eslint-disable object-curly-spacing */
/* eslint-disable multiline-ternary */
/* eslint-disable array-element-newline */
/* eslint-disable prefer-const */
/**
 * Handles all tasks related to agency data
 */

"use strict";

// const crypt = global.requireShared('./services/crypt.js');
//const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const formatPhone = global.requireShared("./helpers/formatPhone.js");
const AgencyNetworkBO = global.requireShared("models/AgencyNetwork-BO.js");
const AgencyLocationBO = global.requireShared("./models/AgencyLocation-BO.js");
const AgencyBO = global.requireShared("./models/Agency-BO.js");
const AgencyLandingPageBO = global.requireShared("./models/AgencyLandingPage-BO.js");
const ColorSchemeBO = global.requireShared("./models/ColorScheme-BO.js");
const IndustryCodeCategoryBO = global.requireShared("./models/IndustryCodeCategory-BO.js");


// This should not be in API path - BP

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
    url = url.replace(/index\.[a-zA-Z0-9]*\/*/, "");
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
    path = path.replace(/\/*/, "/");
    // Split out the components
    path = path.split("/");

    if (quoteURL.searchParams.has("agency")) {
        // URL: http://domain/?agency=agencySlug&page=pageSlug
        agencySlug = quoteURL.searchParams.get("agency");
        if (quoteURL.searchParams.has("page")) {
            pageSlug = quoteURL.searchParams.get("page");
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

// This shoud not be in API path - BP

/**
 * Retrieves the agency information from a given agency/page slug.
 *
 * @param {string} agencySlug - agency slug
 * @param {object} pageSlug - page slug (optional)
 *
 * @returns {object} agency
 */
async function getAgencyFromSlugs(agencySlug, pageSlug) {
    if(!agencySlug){
        log.error(`No slug supplied getAgencyFromSlugsquote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${__location}`);
        return null;
    }

    let agencyWebInfo = null;
    //Get agency record.
    const agencyBO = new AgencyBO();
    //TODO .....
    //ag.slug = ${db.escape(agencySlug)}

    try {
        agencyWebInfo = await agencyBO.getbySlug(agencySlug);
    }
    catch (err) {
        log.error(`Error retrieving Agency in quote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${err} ${__location}`);
        return null;
    }
    if(!agencyWebInfo){
        log.warn(`Could not retrieve Agency quote engine agencySlug ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${__location}`);
        return null;
    }
    try{
        //map to old SQL return columns.
        const oldMap = {
            caLicenseNumber: "californiaLicense",
            name: "agencyName",
            agencyNetworkId: "agencyNetwork",
            enabelOptOut: "enable_optout",
            systemId: "agencyId"
        }
        for (const property in oldMap) {
            if(agencyWebInfo[property]){
                agencyWebInfo[oldMap[property]] = agencyWebInfo[property];
            }
        }
        //Quote App expect 1 or 0
        agencyWebInfo.enable_optout = agencyWebInfo.enabelOptOut ? 1 : 0;
    }
    catch (err) {
        log.error(`Error mapping to response properties quote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${err} ${__location}`);
    }

    //If get landing page
    let haveLandingPage = false;
    const agencyLandingPageBO = new AgencyLandingPageBO();
    try{
        let getPrimary = false;
        if(!pageSlug){
            getPrimary = true;
        }

        let landingPageJSON = await agencyLandingPageBO.getbySlug(agencyWebInfo.agencyId, pageSlug, getPrimary);
        const lpPropToAdd = {
            systemId: "landingPageID",
            agencyLocationId: "agency_location_id",
            industryCodeId: "industryCode",
            industryCodeCategoryId: "industryCodeCategory",
            colorSchemeId: "colorScheme",
            introHeading: "introHeading",
            introText: "introText",
            showIndustrySection: "showIndustrySection",
            showIntroText: "showIntroText",
            additionalInfo: "landingPageAdditionalInfo",
            meta: "meta",
            banner: "banner",
            heading: "heading",
            about: "about"
        }

        if(landingPageJSON){
            for (const property in lpPropToAdd) {
                if(landingPageJSON[property] || landingPageJSON[property] === false || landingPageJSON[property] === 0){
                    if(lpPropToAdd[property] !== property){
                        agencyWebInfo[lpPropToAdd[property]] = landingPageJSON[property];
                    }
                    //new style
                    agencyWebInfo[property] = landingPageJSON[property];
                }
            }

            haveLandingPage = true;
        }
    }
    catch(err){
        log.error(`Error retrieving Landing Page in quote engine agency ${agencySlug} id: ${agencyWebInfo.agencyId} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${err} ${__location}`);
        return null;
    }

    if(haveLandingPage === false){
        log.warn(`Could not retrieve Landing Page quote engine agency ${agencySlug} id: ${agencyWebInfo.agencyId} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${__location}`);
        return null;
    }

    try{
        if(agencyWebInfo.industryCodeCategoryId){
            const industryCodeCategoryBO = new IndustryCodeCategoryBO();
            const industryCodeCategoryJSON = await industryCodeCategoryBO.getById(agencyWebInfo.industryCodeCategoryId);
            agencyWebInfo.industryCodeCategory = industryCodeCategoryJSON.name;
        }
    }
    catch(err){
        log.error(`Error retrieving IndustryCodeCategory in quote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${err} ${__location}`);
    }
    try {
        //Get AgencyNetworkBO  If missing landing page content get AgnencyNetwork = 1 for it.
        const agencyNetworkBO = new AgencyNetworkBO();
        // eslint-disable-next-line no-unused-vars
        let error = null;
        const agencyNetworkJSON = await agencyNetworkBO.getById(agencyWebInfo.agencyNetwork).catch(function(err){
            error = err;
            log.error("Get AgencyNetwork Error " + err + __location);
        });
        //Check featurer - optout
        if(agencyNetworkJSON && agencyNetworkJSON.feature_json && agencyNetworkJSON.feature_json.applicationOptOut === false){
            agencyWebInfo.enable_optout = 0
            agencyWebInfo.enabelOptOut = false;
        }

        if(agencyNetworkJSON && agencyNetworkJSON.footer_logo){
            agencyWebInfo.footer_logo = agencyNetworkJSON.footer_logo
        }
        if(agencyNetworkJSON && agencyNetworkJSON.landing_page_content){
            agencyWebInfo.landingPageContent = agencyNetworkJSON.landing_page_content;
        }
        else {
            //get from default AgencyNetwork
            log.debug(`AgencyNetwork ${agencyWebInfo.agencyNetwork} using default landingpage`)
            const agencyNetworkJSONDefault = await agencyNetworkBO.getById(1).catch(function(err){
                error = err;
                log.error("Get AgencyNetwork 1 Error " + err + __location);
            });

            if(agencyNetworkJSONDefault && agencyNetworkJSONDefault.landing_page_content){
                agencyWebInfo.landingPageContent = agencyNetworkJSONDefault.landing_page_content;
                if(!agencyWebInfo.footer_logo){
                    agencyWebInfo.footer_logo = agencyNetworkJSONDefault.footer_logo;
                }
            }
        }
    }
    catch (err) {
        log.error(`Could not parse landingPageContent/meta in agency ${agencySlug}: ${err} ${__location}`);
        return null;
    }

    let locations = null;
    try{
        const query = {"agencyId": agencyWebInfo.agencyId}
        const getAgencyName = true;
        const getChildren = true;
        const addAgencyPrimaryLocation = true;
        const agencyLocationBO = new AgencyLocationBO();

        locations = await agencyLocationBO.getList(query, getAgencyName,getChildren, addAgencyPrimaryLocation);
        let insurerList = [];
        // eslint-disable-next-line array-element-newline
        let removeList = ["additionalInfo", "territories", "createdAt", "updatedAt", "agencyPortalModifiedUser","active"]
        if(locations){
            for(let j = 0; j < locations.length; j++) {
                let location = locations[j];
                location.id = location.systemId;
                location.fname = location.firstName;
                location.lname = location.lastName;
                location.territory = location.state;
                location.zip = location.zipcode;
                location.appointments = location.territories;
                if(location.insurers && location.insurers.length > 0){
                    for(let i = 0; i < location.insurers.length; i++) {
                        let insurer = location.insurers[i];
                        insurer.agencylocation = location.id;
                        //backward compatible for Quote App.  properties for WC, BOP, GL
                        if(insurer.policyTypeInfo){
                            insurer.policy_type_info = insurer.policyTypeInfo
                            const policyTypeCd = ['WC','BOP','GL']
                            for(const pt of policyTypeCd){
                                if(insurer.policy_type_info[pt] && insurer.policy_type_info[pt].enabled === true){
                                    insurer[pt.toLowerCase()] = 1;
                                }
                                else {
                                    insurer[pt.toLowerCase()] = 0;
                                }
                            }
                        }
                        insurerList.push(insurer);
                    }
                    //delete location.insurers;
                }
                else {
                    log.error(`No insurers for location ${location.systemId}` + __location)
                }
                for(let i = 0; i < removeList.length; i++) {
                    if(location[removeList[i]]){
                        delete location[removeList[i]]
                    }
                }
            }
        }
        else {
            log.error(`No locations for Agency ${agencyWebInfo.id}` + __location)
        }
        agencyWebInfo.locations = locations
        agencyWebInfo.insurers = insurerList;
    }
    catch(err){
        log.error("Error processing Agency locations " + err + __location);
    }

    try{
        await agencyLandingPageBO.addPageHit(agencyWebInfo.landingPageID)
    }
    catch(err){
        log.error(`Error update hits continue landingPageID ${agencyWebInfo.landingPageID}` + __location)
    }

    // log.debug("final agencyWebInfo " + JSON.stringify(agencyWebInfo) + __location);
    return agencyWebInfo;
}


// This should not be in API path - BP

/**
 * Responds to POST requests and returns policy quotes
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencyLandingPage(req, res, next) {
    if (!req.query.url) {
        res.send(400, {error: 'Missing URL'});
        return next();
    }
    const {
        // eslint-disable-next-line no-unused-vars
        agencySlug, pageSlug
    } = parseQuoteURL(req.query.url);

    const agency = await getAgencyFromSlugs(agencySlug, null);
    if(!agency){
        res.send(404, {error: 'Agency not found'});
        return next();
    }
    replaceAgencyValues(agency.landingPageContent, agency);
    let primaryLocation = agency.locations.find(loc => loc.primary);
    if(!primaryLocation && agency.locations.length > 0){
        primaryLocation = agency.locations[0];
    }

    const landingPage = {
        banner: agency.banner,
        name: agency.name,
        showIntroText: agency.showIntroText,
        about: agency.about,
        wholesale: agency.wholesale,
        email: primaryLocation ? primaryLocation.email : null,
        phone: primaryLocation ? primaryLocation.phone : null,
        address: primaryLocation ? primaryLocation.address : null,
        addressCityState: primaryLocation ? `${primaryLocation.city}, ${primaryLocation.territory} ${primaryLocation.zip}` : null,
        ...agency.landingPageContent
    };

    res.send(200, landingPage);
    return next();
}

/**
 * Replaces values in a string with agency values
 *
 * @param {object|string} toReplace - String to replace values on or an object containing those strings
 * @param {object} agency - The agency object
 * @param {string} - The string with replaced values
 *
 * @returns {void}
 */
function replaceAgencyValues(toReplace, agency) {
    if(!agency){
        return;
    }
    // TODO: fill in other required replacements
    if (typeof toReplace === "string") {
        return toReplace.replace(/{{Agency}}/g, agency.name).replace(/{{Agency Phone}}/g, formatPhone(agency.phone));
    }
    else {
        for (const [key, value] of Object.entries(toReplace)) {
            if (typeof toReplace[key] === "string") {
                toReplace[key] = replaceAgencyValues(value, agency);
            }
            else {
                replaceAgencyValues(value, agency);
            }
        }
    }
}

/**
 * Responds to GET requests and returns social media meta data
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencyMetadata(req, res, next) {
    if (!req.query.url) {
        res.send(400, {error: 'Missing URL'});
        return next();
    }
    let {
        // eslint-disable-next-line no-unused-vars
        agencySlug, pageSlug
    } = parseQuoteURL(req.query.url);

    if (!agencySlug) {
        agencySlug = 'talage';
    }

    let agencyJson = null;
    try {
        agencyJson = await getAgencyFromSlugs(agencySlug, null);
    }
    catch (err) {
        log.error(`Error retrieving Agency in quote engine agency ${agencySlug} url ${req.query.url}: ${err} ${__location}`);
    }

    if(!agencyJson){
        log.warn(`Could not retrieve Agency quote engine agencySlug ${agencySlug} url ${req.query.url}: ${__location}`);
        res.send(404, {error: 'Could not retrieve agency'});
        return next();
    }

    // load css
    let metaCss = null;
    if(agencyJson.colorSchemeId){
        const colorSchemeBO = new ColorSchemeBO();
        const colorSchemeJSON = await colorSchemeBO.getById(agencyJson.colorSchemeId);
        const cssPropToAdd = {
            primary: "primary",
            primary_accent: "primaryAccent",
            secondary: "secondary",
            secondary_accent: "secondaryAccent",
            tertiary: "tertiary",
            tertiary_accent: "tertiaryAccent"
        }
        metaCss = {};
        for (const property in cssPropToAdd) {
            if(colorSchemeJSON[property]){
                metaCss[property] = colorSchemeJSON[property];
            }
        }
    }

    try {
        if (agencyJson.additionalInfo && agencyJson.additionalInfo.socialMediaTags && agencyJson.additionalInfo.socialMediaTags.facebookPixel) {
            agencyJson.facebookPixel = agencyJson.additionalInfo.socialMediaTags.facebookPixel;
        }
    } catch (err) {
        log.error(`Getting Facebook Pixel ${err} ${__location}`);
    }
    try {
        const agencyNetworkBO = new AgencyNetworkBO();
        const agencyNetworkJSON = await agencyNetworkBO.getById(agencyJson.agencyNetworkId).catch(function (err) {
            log.error("Get AgencyNetwork Error " + err + __location);
        });
        if (agencyNetworkJSON && agencyNetworkJSON.landing_page_content) {
            agencyJson.landingPageContent = agencyNetworkJSON.landing_page_content;
        } else {
            //get from default AgencyNetwork
            log.debug(`AgencyNetwork ${agencyJson.agencyNetworkId} using default landingpage`);
            const agencyNetworkJSONDefault = await agencyNetworkBO.getById(1).catch(function (err) {
                log.error("Get AgencyNetwork 1 Error " + err + __location);
            });

            if (agencyNetworkJSONDefault && agencyNetworkJSONDefault.landing_page_content) {
                agencyJson.landingPageContent = agencyNetworkJSONDefault.landing_page_content;
            }
        }
    } catch (error) {
        log.error(`Could not parse landingPageContent in agency slug '${agencySlug}' for social metadata: ${error} ${__location}`);
        res.send(400, { error: "Could not process agency data" });
        return next();
    }

    let openTime = "";
    let closeTime = "";
    try{
        const primaryLocation = agencyJson.locations.find(location => location.primary);
        if(primaryLocation){
            openTime = primaryLocation.openTime;
            closeTime = primaryLocation.closeTime;
        }
    }catch (error) {
        log.error(`Could not find agency operation hours: ${error} ${__location}`);
    }

    // dont pass back data that isnt there
    const metaLogo = agencyJson.logo ? `${global.settings.IMAGE_URL}/public/agency-logos/${agencyJson.logo}` : null;
    const metaFooterLogo = agencyJson.footer_logo ? `${global.settings.IMAGE_URL}/public/agency-network-logos/${agencyJson.footer_logo}` : null;
    const metaFavicon = agencyJson.favicon ? `${global.settings.IMAGE_URL}/public/agency-logos/favicon/${agencyJson.favicon}` : null;
    const metaWebsite = agencyJson.website ? agencyJson.website : null;
    const metaFacebookPixel = agencyJson.facebookPixel ? agencyJson.facebookPixel : null;

    // only pass back operation hours if both open and close time are present
    const metaOperationHours = openTime && closeTime ? { open: openTime, close: closeTime } : null;

    // use wheelhouse defaults if its not present
    const metaDescription = agencyJson.landingPageContent.bannerHeadingDefault ? agencyJson.landingPageContent.bannerHeadingDefault : agencyJson.defaultLandingPageContent.bannerHeadingDefault;

    res.send(200, {
        wholesale: agencyJson.wholesale,
        metaName: agencyJson.name,
        metaPhone: agencyJson.phone,
        metaEmail: agencyJson.email,
        metaCALicence: agencyJson.caLicenseNumber,
        metaLogo: metaLogo,
        metaFooterLogo: metaFooterLogo,
        metaFavicon: metaFavicon,
        metaWebsite: metaWebsite,
        metaFacebookPixel: metaFacebookPixel,
        metaCss: metaCss,
        metaDescription: metaDescription,
        metaHasAbout: Boolean(agencyJson.about),
        metaOperationHours: metaOperationHours
    });
    return next();
}

/**
 * Responds to GET requests and returns agency id from slug
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgency(req, res, next) {
    if (!req.query.slug) {
        res.send(400, {error: 'Missing Slug'});
        return next();
    }

    let agency = null;
    const agencyBO = new AgencyBO();
    try {
        agency = await agencyBO.getbySlug(req.query.slug);
    }
    catch (err) {
        log.error(`Error retrieving Agency in quote engine agency ${req.query.slug}: ${err} ${__location}`);
        return null;
    }
    if(!agency){
        log.warn(`Could not retrieve Agency quote engine agencySlug ${req.query.slug}: ${__location}`);
        return null;
    }

    res.send(200, agency.id);
    return next();
}


/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthQuoteApp("Get Agency Metadata", `${basePath}/agency/metadata`, getAgencyMetadata);
    server.addGetAuthQuoteApp("Get Agency Landing Page", `${basePath}/agency/landing-page`, getAgencyLandingPage);
    server.addGetAuthQuoteApp("Get Quote App Agency Id", `${basePath}/agency`, getAgency);
};