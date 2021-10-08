/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
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
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const formatPhone = global.requireShared("./helpers/formatPhone.js");
const AgencyNetworkBO = global.requireShared("models/AgencyNetwork-BO.js");
const AgencyLocationBO = global.requireShared("./models/AgencyLocation-BO.js");
const AgencyBO = global.requireShared("./models/Agency-BO.js");
const AgencyLandingPageBO = global.requireShared("./models/AgencyLandingPage-BO.js");
const ColorSchemeBO = global.requireShared("./models/ColorScheme-BO.js");
const IndustryCodeCategoryBO = global.requireShared("./models/IndustryCodeCategory-BO.js");
const emailSvc = global.requireShared('./services/emailsvc.js');
const serverHelper = global.requireRootPath('server.js');

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

    const reservedPageSlugs = [
        "_am-congrats",
        "_congrats",
        "_reach-out",
        "_basic",
        "_am-basic",
        "_policies",
        "_business-questions",
        "_am-pricing",
        "_pricing",
        "_locations",
        "_am-locations",
        "_mailing-address",
        "_claims",
        "_officers",
        "_questions",
        "_quotes",
        "_load",
        "404"
    ];

    if(reservedPageSlugs.includes(pageSlug)){
        pageSlug = null;
    }

    return {
        agencySlug: agencySlug,
        pageSlug: pageSlug
    };
}

/**
 * Merges landing page content
 *
 * @param {object} agencyLandingPageContent - the landingPageContent to prioritize
 * @param {object} agencyNetworkLandingPageContent - the landingPageContent to default to if no value is provided in the primary
 *
 * @returns {object} a merged landing page content object
 */
function mergeLandingPageContent(agencyLandingPageContent, agencyNetworkLandingPageContent){
    // TODO: this might be easier in the future to make into a generalized function, but for now we know we're just looking for FAQ
    const landingPageContent = JSON.parse(JSON.stringify(agencyNetworkLandingPageContent));

    if(agencyLandingPageContent && agencyLandingPageContent.faq && agencyLandingPageContent.faq.length > 0){
        landingPageContent.faq = JSON.parse(JSON.stringify(agencyLandingPageContent.faq));
    }

    return landingPageContent;
}

/**
 * Merges wheelhouse defaults into landing page content
 *
 * @param {object} landingPageContent - the landingPageContent to merge the defaults into
 * @param {object} wheelhouseLandingPageContent - the Wheelhouse Landing Page Content
 *
 * @returns {object} a merged landing page content object
 */
function mergeWheelhouseLandingPageContent(landingPageContent, wheelhouseLandingPageContent){
    if(!landingPageContent && wheelhouseLandingPageContent){
        return JSON.parse(JSON.stringify(wheelhouseLandingPageContent));
    }

    const mergedLandingPageContent = JSON.parse(JSON.stringify(landingPageContent));

    if(!mergedLandingPageContent.faq || mergedLandingPageContent.faq.length === 0){
        mergedLandingPageContent.faq = JSON.parse(JSON.stringify(wheelhouseLandingPageContent.faq));
    }

    return mergedLandingPageContent;
}

/**
 * Checks landing page content to see if any additional defaults are needed
 *
 * @param {object} agencyWebInfo - the agencyWebInfo to check
 *
 * @returns {object} a merged landing page content object
 */
function shouldMergeWheelhouse(agencyWebInfo){
    return !agencyWebInfo ||
        !agencyWebInfo.landingPageContent ||
        !agencyWebInfo.landingPageContent.faq ||
        agencyWebInfo.landingPageContent.faq.length === 0 ||
        !agencyWebInfo.footer_logo;
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
    if(!agencySlug){
        log.error(`No slug supplied getAgencyFromSlugsquote engine agency ${agencySlug} (${pageSlug ? 'page ' + pageSlug : 'no page'}): ${__location}`);
        return null;
    }

    let agencyWebInfo = null;
    //Get agency record.
    const agencyBO = new AgencyBO();

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
            lockDefaults: "lockDefaults",
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
            if(landingPageJSON.agencyLocationId){
                agencyWebInfo.lockAgencyLocationId = true;
                agencyWebInfo.agencyLocationId = landingPageJSON.agencyLocationId;
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
            // set the landing page content to what we want from agencySiteContent and the agency networks landing page content
            agencyWebInfo.landingPageContent = mergeLandingPageContent(agencyWebInfo.agencySiteContent, agencyNetworkJSON.landing_page_content);
        }
        else{
            agencyWebInfo.landingPageContent = agencyWebInfo.agencySiteContent;
        }
        if(shouldMergeWheelhouse(agencyWebInfo)){
            //get from default AgencyNetwork
            log.debug(`AgencyNetwork ${agencyWebInfo.agencyNetwork} using default landingpage`)
            const agencyNetworkJSONDefault = await agencyNetworkBO.getById(1).catch(function(err){
                error = err;
                log.error("Get AgencyNetwork 1 Error " + err + __location);
            });
            if(agencyNetworkJSONDefault && agencyNetworkJSONDefault.landing_page_content){
                agencyWebInfo.landingPageContent = mergeWheelhouseLandingPageContent(agencyWebInfo.landingPageContent, agencyNetworkJSONDefault.landing_page_content);
            }
            if(agencyNetworkJSONDefault && !agencyWebInfo.footer_logo){
                agencyWebInfo.footer_logo = agencyNetworkJSONDefault.footer_logo;
            }
        }
        // grab the first page for agency network if custom flow exists
        let customFlowObj = null;
        customFlowObj =  agencyNetworkJSON.quoteAppCustomRouting;
            // set the first page so landing page knows where to send user
        const listOfPossibleFirstPages = ['_basic', '_am-basic']
        let firstPage = null;
        if(customFlowObj && typeof customFlowObj === 'object'){
            // const keys = Object.keys(customFlowObj);
            const keys = Object.keys(customFlowObj);
            log.debug(`keys: ${keys}`);
            // const keys = [];
            if(keys.length > 0){
                // const firstRoute = customFlowObj[keys[0]];
                const firstRoute = keys[0];
                log.debug(firstRoute);
                log.debug(listOfPossibleFirstPages);
                if(listOfPossibleFirstPages.indexOf(firstRoute) !== -1){
                        firstPage = firstRoute;
                }
            }
        }
        agencyWebInfo.landingPageFirstRoute = firstPage;
        log.debug(JSON.stringify(agencyWebInfo)); 
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
    if (!req.query.agencySlug) {
        res.send(400, {error: 'Missing agencySlug'});
        log.error("Error retrieving Agency Landing Page no agencySlug provided");
        return next();
    }

    const agency = await getAgencyFromSlugs(req.query.agencySlug, req.query.pageSlug);
    if(!agency){
        res.send(404, {error: 'Agency not found'});
        return next();
    }
    replaceAgencyValues(agency.landingPageContent, agency);
    let primaryLocation = agency.locations.find(loc => loc.primary);
    if(!primaryLocation && agency.locations.length > 0){
        primaryLocation = agency.locations[0];
    }

    // agencyLocationId is the agency location to show on this page, if it is overridden
    let overrideLocation = null;
    if(agency.agencyLocationId){
        overrideLocation = agency.locations.find(loc => loc.mysqlId === agency.agencyLocationId);
    }

    const landingPageLocation = overrideLocation ? overrideLocation : primaryLocation;
    let agencyAddress = landingPageLocation ? landingPageLocation.address : null;
    const agencyAddress2 = landingPageLocation ? landingPageLocation.address2 : null;
    if(agencyAddress2){
        agencyAddress += `, ${agencyAddress2}`
    }
    const landingPage = {
        agencyId: agency.agencyId,
        banner: agency.banner,
        name: agency.name,
        heading: agency.heading,
        showIndustrySection: agency.showIndustrySection,
        showIntroText: agency.showIntroText,
        introHeading: agency.showIntroText ? agency.introHeading : null,
        introText: agency.showIntroText ? agency.introText : null,
        about: agency.about,
        wholesale: agency.wholesale,
        industryCodeId: agency.industryCodeId,
        industryCodeCategoryId: agency.industryCodeCategoryId,
        lockDefaults: agency.lockDefaults,
        locationId: landingPageLocation.mysqlId,
        email: landingPageLocation ? landingPageLocation.email : null,
        phone: landingPageLocation ? landingPageLocation.phone : null,
        address: agencyAddress,
        addressCityState: landingPageLocation ? `${landingPageLocation.city}, ${landingPageLocation.territory} ${landingPageLocation.zip}` : null,
        ...agency.landingPageContent,
        landingPageFirstRoute: agency.landingPageFirstRoute
    };
    if(agency.agencyLocationId){
        landingPage.agencyLocationId = agency.agencyLocationId;
    }

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
    let agencySlug = req.query.agencySlug;
    let pageSlug = req.query.pageSlug;

    if (req.query.url) {
        const slugs = parseQuoteURL(req.query.url);
        agencySlug = slugs.agencySlug;
        pageSlug = slugs.pageSlug;
    }

    if (!agencySlug) {
        log.warn("Missing agencySlug: using talage");
        agencySlug = "talage";
    }

    let agencyJson = null;
    try {
        agencyJson = await getAgencyFromSlugs(agencySlug, pageSlug);
    }
    catch (err) {
        log.error(`Error retrieving Agency in quote engine agencySlug ${agencySlug} pageSlug ${pageSlug} url ${req.query.url}: ${err} ${__location}`);
    }

    if(!agencyJson){
        log.warn(`Could not retrieve Agency quote engine agencySlug ${agencySlug} pageSlug ${pageSlug} url ${req.query.url}: ${__location}`);
        res.send(404, {
            error: 'Could not retrieve agency',
            // pass back the slugs used to lookup
            agencySlug: agencySlug,
            pageSlug: pageSlug
        });
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
        log.error(`Could not parse landingPageContent in agency slug '${agencySlug}' pageSlug '${pageSlug}' for social metadata: ${error} ${__location}`);
        res.send(400, { error: "Could not process agency data" });
        return next();
    }

    let landingPageLocation = null;
    if(agencyJson.locations){
        let primaryLocation = agencyJson.locations.find(loc => loc.primary);
        if(!primaryLocation && agencyJson.locations.length > 0){
            primaryLocation = agencyJson.locations[0];
        }

        // agencyLocationId is the agency location to show on this page, if it is overridden
        let overrideLocation = null;
        if(agencyJson.agencyLocationId){
            overrideLocation = agencyJson.locations.find(loc => loc.mysqlId === agencyJson.agencyLocationId);
        }

        landingPageLocation = overrideLocation ? overrideLocation : primaryLocation;
    }

    let openTime = landingPageLocation.openTime ? landingPageLocation.openTime : "";
    let closeTime = landingPageLocation.closeTime ? landingPageLocation.closeTime : "";

    if(!openTime || !closeTime){
        log.error(`Agency operation hours not set: ${__location}`);
    }


    const metaObject = {
        wholesale: agencyJson.wholesale,
        metaAgencyId: agencyJson.agencyId,
        metaName: agencyJson.name,
        metaPhone: landingPageLocation.phone,
        metaEmail: landingPageLocation.email,
        metaCALicence: agencyJson.caLicenseNumber,
        metaHasAbout: Boolean(agencyJson.about),
        metaAgencyNetworkId: agencyJson.agencyNetworkId
    };

    // dont pass back data that isnt there
    metaObject.metaLogo = agencyJson.logo ? `${global.settings.IMAGE_URL}/public/agency-logos/${agencyJson.logo}` : null;
    metaObject.metaFooterLogo = agencyJson.footer_logo ? `${global.settings.IMAGE_URL}/public/agency-network-logos/${agencyJson.footer_logo}` : null;
    metaObject.metaFavicon = agencyJson.favicon ? `${global.settings.IMAGE_URL}/public/agency-logos/favicon/${agencyJson.favicon}` : null;
    metaObject.metaWebsite = agencyJson.website ? agencyJson.website : null;
    metaObject.metaSocialMedia = agencyJson.hasOwnProperty('socialMediaTags') ? agencyJson.socialMediaTags : null;
    metaObject.metaOptOut = agencyJson.hasOwnProperty('enableOptOut') ? agencyJson.enabelOptOut : null;
    // only pass back operation hours if both open and close time are present
    metaObject.metaOperationHours = openTime && closeTime ? { open: openTime, close: closeTime } : null;
    metaObject.metaCss = metaCss;

    // use wheelhouse defaults if its not present
    let metaDescription = null;
    if(agencyJson.landingPageContent && agencyJson.landingPageContent.bannerHeadingDefault){
        metaDescription = agencyJson.landingPageContent.bannerHeadingDefault;
    }
    else if(agencyJson.defaultLandingPageContent) {
        metaDescription = agencyJson.defaultLandingPageContent.bannerHeadingDefault;
    }
    metaObject.metaDescription = metaDescription;

    //So the client App know agencyLocation should not be changed.
    if(agencyJson.lockAgencyLocationId){
        metaObject.agencyLocationId = agencyJson.agencyLocationId;
        metaObject.lockAgencyLocationId = agencyJson.lockAgencyLocationId;
    }

    res.send(200, metaObject);
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

/**
 * Receives POST requests and sends agencies emails
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function sendEmail(req, res, next) {
    const responseObj = {};
    //only type =3 will be processed. - Contact us
    if(req.body
        && req.body.email
        && req.body.type && (req.body.type === "3" || req.body.type === 3)
        && req.body.agency){

        const email = req.body.email;
        const messageText = req.body.message;
        const name = req.body.name;
        const agencyLocationId = stringFunctions.santizeNumber(req.body.agency, true);
        const messageKeys = {agencyLocationId: agencyLocationId};

        let error = null;
        const agencyLocationBO = new AgencyLocationBO();
        const agencyLocationJSON = await agencyLocationBO.getById(agencyLocationId).catch(function(err) {
            log.error(`Loading agency in AgencyEmail error:` + err + __location);
            error = err;
        });
        if(!error){
            if(agencyLocationJSON.email){
                const agencyEmail = agencyLocationJSON.email;
                // Build the email
                let message = '<p style="text-align:left;">You received the following message from ' + name + ' (' + email + '):</p>';
                message = message + '<p style="text-align:left;margin-top:10px;">"' + messageText + '"</p>';
                message += `<p style="text-align:right;">-Your Wheelhouse Team</p>`;
                //call email service
                const respSendEmail = await emailSvc.send(agencyEmail, 'A Wheelhouse user wants to get in touch with you', message, messageKeys, global.WHEELHOUSE_AGENCYNETWORK_ID, 'wheelhouse', 0).catch(function(err){
                    log.error("Send email error: " + err + __location);
                    return res.send(serverHelper.internalError("sendEmail Error"));
                });
                if(respSendEmail === false){
                    log.error("Send email error response was false: " + __location);
                    return res.send(serverHelper.internalError("sendEmail Error"));
                }
                else {
                    res.send(200, responseObj);
                    return next();
                }
            }
            else{
                log.error(`No Agency location email ${agencyLocationId} ` + __location)
                res.send(400, responseObj);
                return next();
            }
        }
        else {
            res.send(500, responseObj);
            return next();
        }
    }
    else {
        log.error("Agency sendEmail missing parameters " + __location)
        res.send(400, responseObj);
        return next();
    }
}


/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGet("Get Agency Metadata", `${basePath}/agency/metadata`, getAgencyMetadata);
    server.addGet("Get Agency Landing Page", `${basePath}/agency/landing-page`, getAgencyLandingPage);
    server.addGet("Get Quote App Agency Id", `${basePath}/agency`, getAgency);
    server.addPostAuthQuoteApp("Post Agency Email", `${basePath}/agency/email`, sendEmail);
};