const moment = require('moment');
var csvjson = require('csvjson');

const serverHelper = global.requireRootPath('server.js');

const ApplicationMongooseModel = global.mongoose.Application;
const QuoteMongooseModel = global.mongoose.Quote;
//const Quote =global.mongoose.Quote;
const ActivityCode = global.mongoose.ActivityCode;
const IndustryCodeModel = global.mongoose.IndustryCode;

const InsurerIndustryCodeModel = global.mongoose.InsurerIndustryCode;

/**
 * Responds to get requests for winloss report
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function winloss(req, res, next) {

    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }
    //
    if (!req.query.policytype) {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No policytype'));
    }
    if(req.query.policytype === "WC"){
        await winlossWC(req, res, next)
    }
    else if(req.query.policytype === "GL" || req.query.policytype === "BOP"){
        await winlossBOP(req, res, next)
    }
    else {
        log.error(`Bad Request: Not supported policy type ${req.query.policytype} received ` + __location);
        return next(serverHelper.requestError('Bad Request: No policytype'));
    }
}

/**
 * Responds to get requests for winloss report WC
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function winlossWC(req, res, next) {
    const insurerId = req.authentication.insurerId;
    const policyType = 'WC';

    let startPeriod = moment().tz("America/Los_Angeles").subtract(3,'month').startOf('month');
    if(req.query.startDate){
        try{
            startPeriod = moment(req.query.startDate, 'YYYY/MM/DD').tz("America/Los_Angeles").startOf('day');
        }
        catch(err){
            log.error(`StartPeriod error ${err}` + __location)
        }
    }
    let endPeriod = moment();
    if(req.query.endDate){
        try{
            endPeriod = moment(req.query.endDate, 'YYYY/MM/DD').tz("America/Los_Angeles").endOf('day');
        }
        catch(err){
            log.error(`EndPeriod error ${err}` + __location)
        }
    }

    //const acQuery = {talageStandard: true};
    const activityCodeList = await ActivityCode.find();


    //const officeActivityCode = 2869;
    const query = {
        insurerId: insurerId,
        quoteStatusId: {$gt: 10},
        policyType: policyType,
        createdAt: {
            $gte: startPeriod,
            $lte: endPeriod
        }
    }
    log.debug(`query ${JSON.stringify(query)}` + __location)

    const metricsList = [];
    const quoteLlist = await QuoteMongooseModel.find(query);

    for(const quoteDoc of quoteLlist){
        try {
            const appDoc = await ApplicationMongooseModel.findOne({applicationId: quoteDoc.applicationId})
            if(appDoc.appStatusId < 35 || appDoc.appStatusId === 40 || !appDoc.metrics?.lowestQuoteAmount?.WC){
                continue;
            }
            const rateState = appDoc.primaryState ? appDoc.primaryState : appDoc.mailingState
            //get Activity code
            let classCodeDesc = ""
            let carrierClassCode = "-"
            if(quoteDoc.quoteStatusId === 15){
                const ac = await getTalageActivityCode(appDoc, activityCodeList)
                if(ac){
                    classCodeDesc = "Talage - " + ac.description
                }
                else {
                    continue
                }
            }
            else {
                const iac = await getAmtrustClassCode(appDoc, rateState, insurerId);
                if(!iac){
                    continue;
                }
                if(insurerId === 2 || !iac.sub){
                    carrierClassCode = iac.code
                }
                else{
                    carrierClassCode = iac.code + "-" + iac.sub
                }
                classCodeDesc = iac.description
                if(classCodeDesc === 'n/a'){
                    const ac = await getTalageActivityCode(appDoc, activityCodeList)
                    if(ac){
                        classCodeDesc = "Talage - " + ac.description
                    }
                }
            }

            let metricsitem = metricsList.find((mi) => mi.classCode === carrierClassCode && mi.primaryState === rateState && mi.quoteStatusId === quoteDoc.quoteStatusId)
            if(!metricsitem){
                metricsitem = {
                    primaryState: rateState,
                    classCode: carrierClassCode,
                    classCodeDesc: classCodeDesc,
                    quoteStatusId: quoteDoc.quoteStatusId,
                    quoteStatusDesc: "",
                    totalCount: 0,
                    quotedcount: 0,
                    winCount: 0,
                    lossCount: 0,
                    quotedtotalAmount:0,
                    avgQuoteAmount: 0,
                    premiumGapWin: 0,
                    premiumGapWinAvg: 0,
                    missedPremiumLost: 0,
                    avgPremiumLost: 0,
                    percentLost: 0,
                    avgPercentLost: 0,
                    OutOfAppetitePremium: 0
                }
                metricsList.push(metricsitem)
            }
            metricsitem.totalCount++;

            if(quoteDoc.quoteStatusId === 25 || quoteDoc.quoteStatusId >= 50){
                metricsitem.quotedcount++;
                metricsitem.quotedtotalAmount += quoteDoc.amount
            }

            let isWin = false
            if(quoteDoc.bound){
                isWin = true;
            }
            else if (quoteDoc.amount > appDoc.metrics?.lowestQuoteAmount?.WC){
                metricsitem.lossCount++;
                metricsitem.missedPremiumLost += quoteDoc.amount - appDoc.metrics?.lowestQuoteAmount?.WC
                metricsitem.percentLost += (quoteDoc.amount - appDoc.metrics?.lowestQuoteAmount?.WC) / quoteDoc.amount

            }
            else if(quoteDoc.quoteStatusId === 15){
                //auto decline
                metricsitem.lossCount++;
                if(appDoc.metrics?.lowestQuoteAmount?.WC){
                    metricsitem.OutOfAppetitePremium += appDoc.metrics?.lowestQuoteAmount?.WC
                }
            }
            else if(quoteDoc.amount > 0){
                isWin = true;
            }
            else {
                isWin = false;
            }
            if(isWin){
                metricsitem.winCount++;
                //look for other quotes.
                const queryQuotes = {
                    insurerId: {$ne: insurerId},
                    quoteStatusId: {$gt: 20},
                    applicationId: quoteDoc.applicationId

                }
                const quoteOtherList = await QuoteMongooseModel.find(queryQuotes);
                if(quoteOtherList?.length > 0){
                    let minQuote = 9999999
                    for(const otherQuote of quoteOtherList){
                        if(otherQuote.amount < minQuote){
                            minQuote = otherQuote.amount;
                        }
                    }
                    if(minQuote < 9999999 && minQuote > quoteDoc.amount){
                        metricsitem.premiumGapWin += minQuote - quoteDoc.amount
                    }
                }
            }
        }
        catch (err) {
            log.error(`Add error ` + err + __location);
        }
        // if ((i + 1) % 20 === 0) {
        //     utility.printStatus(`Processed ${i + 1} out of ${qqBoundPolicies}`);
        // }
    }
    log.debug(`Prepping report.`)


    for(const mi of metricsList){
        if(mi.lossCount > 0){
            mi.avgPremiumLost = mi.missedPremiumLost / mi.lossCount
            mi.avgPercentLost = mi.percentLost / mi.lossCount
        }
        if(mi.winCount > 0){
            mi.premiumGapWinAvg = mi.premiumGapWin / mi.winCount
        }
        if(mi.quotedcount > 0){
            mi.avgQuoteAmount = mi.quotedtotalAmount / mi.quotedcount
        }
        mi.quoteStatusDesc = QuoteStatusDesc(mi.quoteStatusId);

        //delete columns
        delete mi.quoteStatusId
        delete mi.premiumGapWin
        delete mi.missedPremiumLost
        delete mi.percentLost

    }

    if(req.query.cvsreturn){
        var options = {
            delimiter   : ",",
            wrap        : false,
            headers: "key"
        }
        const csvData = csvjson.toCSV(metricsList, options);
        res.writeHead(200, {
            'Content-Disposition': 'attachment; filename=winLossReport.csv',
            'Content-Length': csvData?.length,
            'Content-Type': 'text-csv'
        });

        // Send the CSV data
        res.end(csvData);
    }
    else {
        res.send(200, metricsList);
    }

    return next();
}

/**
 * Responds to get requests for winloss report GL or BOP
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function winlossBOP(req, res, next) {
    const insurerId = req.authentication.insurerId;
    const policyType = 'BOP';

    let startPeriod = moment().tz("America/Los_Angeles").subtract(3,'month').startOf('month');
    if(req.query.startDate){
        try{
            startPeriod = moment(req.query.startDate, 'YYYY/MM/DD').tz("America/Los_Angeles").startOf('day');
        }
        catch(err){
            log.error(`StartPeriod error ${err}` + __location)
        }
    }
    let endPeriod = moment();
    if(req.query.endDate){
        try{
            endPeriod = moment(req.query.endDate, 'YYYY/MM/DD').tz("America/Los_Angeles").endOf('day');
        }
        catch(err){
            log.error(`EndPeriod error ${err}` + __location)
        }
    }

    const query = {
        insurerId: insurerId,
        quoteStatusId: {$gt: 10},
        policyType: policyType,
        createdAt: {
            $gte: startPeriod,
            $lte: endPeriod
        }
    }
    //log.debug(`query ${JSON.stringify(query)}` + __location)
    const metricsList = [];
    const quoteLlist = await QuoteMongooseModel.find(query);

    log.debug(`Reading quotes... ${quoteLlist.length}`)
    for(const quoteDoc of quoteLlist){
        try {
            const appDoc = await ApplicationMongooseModel.findOne({applicationId: quoteDoc.applicationId})
            if(appDoc.appStatusId < 35 || appDoc.appStatusId === 40 || !appDoc.metrics?.lowestQuoteAmount || !appDoc.metrics?.lowestQuoteAmount[policyType]){
                continue;
            }
            const rateState = appDoc.primaryState ? appDoc.primaryState : appDoc.mailingState
            //get Activity code
            let talageIndustryCodeId = 0;
            let classCodeDesc = ""
            let carrierClassCode = "-"
            if(policyType === "BOP"){
                const bopPolicy = appDoc.policies.find((p) => p.policyType === "BOP")
                if(bopPolicy?.bopIndustryCodeId > 0){
                    talageIndustryCodeId = bopPolicy?.bopIndustryCodeId
                }
                else {
                    talageIndustryCodeId = parseInt(appDoc.industryCode,10);
                }

            }
            else{
                talageIndustryCodeId = parseInt(appDoc.industryCode,10);
            }

            if(quoteDoc.quoteStatusId === 15){
                const ic = await IndustryCodeModel.findOne({industryCodeId: talageIndustryCodeId})
                if(ic){
                    classCodeDesc = `Talage - ${ic.description} NAICS: ${ic.naics} `
                }
                else {
                    continue
                }
            }
            else {
                //Get Insurer code.
                const queryIIC = {
                    insurerId: insurerId,
                    policyTypeList: policyType,
                    talageIndustryCodeIdList: talageIndustryCodeId,
                    territoryList: rateState
                }

                const iicList = await InsurerIndustryCodeModel.find(queryIIC).lean()
                if(iicList.length > 0){
                    carrierClassCode = iicList[0].code
                    classCodeDesc = iicList[0].code
                }
                else {
                    continue;
                }
            }

            let metricsitem = metricsList.find((mi) => mi.classCode === carrierClassCode && mi.primaryState === rateState && mi.quoteStatusId === quoteDoc.quoteStatusId)
            if(!metricsitem){
                metricsitem = {
                    primaryState: rateState,
                    classCode: carrierClassCode,
                    classCodeDesc: classCodeDesc,
                    quoteStatusId: quoteDoc.quoteStatusId,
                    quoteStatusDesc: "",
                    totalCount: 0,
                    quotedcount: 0,
                    winCount: 0,
                    lossCount: 0,
                    quotedtotalAmount:0,
                    avgQuoteAmount: 0,
                    premiumGapWin: 0,
                    premiumGapWinAvg: 0,
                    missedPremiumLost: 0,
                    avgPremiumLost: 0,
                    percentLost: 0,
                    avgPercentLost: 0,
                    OutOfAppetitePremium: 0
                }
                metricsList.push(metricsitem)
            }
            metricsitem.totalCount++;

            if(quoteDoc.quoteStatusId === 25 || quoteDoc.quoteStatusId >= 50){
                metricsitem.quotedcount++;
                metricsitem.quotedtotalAmount += quoteDoc.amount
            }

            let isWin = false
            if(quoteDoc.bound){
                isWin = true;
            }
            else if (appDoc.metrics?.lowestQuoteAmount && quoteDoc.amount > appDoc.metrics?.lowestQuoteAmount[policyType]){
                metricsitem.lossCount++;
                metricsitem.missedPremiumLost += quoteDoc.amount - appDoc.metrics?.lowestQuoteAmount[policyType]
                metricsitem.percentLost += (quoteDoc.amount - appDoc.metrics?.lowestQuoteAmount[policyType]) / quoteDoc.amount

            }
            else if(quoteDoc.quoteStatusId === 15){
                //auto decline
                metricsitem.lossCount++;
                if(appDoc.metrics?.lowestQuoteAmount && appDoc.metrics?.lowestQuoteAmount[policyType]){
                    metricsitem.OutOfAppetitePremium += appDoc.metrics?.lowestQuoteAmount[policyType]
                }
            }
            else if(quoteDoc.amount > 0){
                isWin = true;
            }
            else {
                isWin = false;
            }
            if(isWin){
                metricsitem.winCount++;
                //look for other quotes.
                const queryQuotes = {
                    insurerId: {$ne: insurerId},
                    quoteStatusId: {$gt: 20},
                    applicationId: quoteDoc.applicationId

                }
                const quoteOtherList = await QuoteMongooseModel.find(queryQuotes);
                if(quoteOtherList?.length > 0){
                    let minQuote = 9999999
                    for(const otherQuote of quoteOtherList){
                        if(otherQuote.amount < minQuote){
                            minQuote = otherQuote.amount;
                        }
                    }
                    if(minQuote < 9999999 && minQuote > quoteDoc.amount){
                        metricsitem.premiumGapWin += minQuote - quoteDoc.amount
                    }
                }
            }
        }
        catch (err) {
            log.error(`Add error ` + err + __location);
        }
        // if ((i + 1) % 20 === 0) {
        //     utility.printStatus(`Processed ${i + 1} out of ${qqBoundPolicies}`);
        // }
    }
    log.debug(`Prepping report.`)


    for(const mi of metricsList){
        if(mi.lossCount > 0){
            mi.avgPremiumLost = mi.missedPremiumLost / mi.lossCount
            mi.avgPercentLost = mi.percentLost / mi.lossCount
        }
        if(mi.winCount > 0){
            mi.premiumGapWinAvg = mi.premiumGapWin / mi.winCount
        }
        if(mi.quotedcount > 0){
            mi.avgQuoteAmount = mi.quotedtotalAmount / mi.quotedcount
        }
        mi.quoteStatusDesc = QuoteStatusDesc(mi.quoteStatusId);

        //delete columns
        delete mi.quoteStatusId
        delete mi.premiumGapWin
        delete mi.missedPremiumLost
        delete mi.percentLost

    }

    if(req.query.cvsreturn){
        var options = {
            delimiter   : ",",
            wrap        : false,
            headers: "key"
        }
        const csvData = csvjson.toCSV(metricsList, options);
        res.writeHead(200, {
            'Content-Disposition': 'attachment; filename=winLossReport.csv',
            'Content-Length': csvData?.length,
            'Content-Type': 'text-csv'
        });

        // Send the CSV data
        res.end(csvData);
    }
    else {
        res.send(200, metricsList);
    }

    return next();
}

async function getAmtrustClassCode(appDoc, rateState, insurerId){
    const InsurerActivityCode = global.mongoose.InsurerActivityCode;
    const officeActivityCode = 2869;
    let activityCodeId = 0;
    let iac = null;
    if(appDoc.locations.length > 0){
        for(const location of appDoc.locations){
            if(location.activityPayrollList.length === 1){
                activityCodeId = location.activityPayrollList[0].activityCodeId
            }
            else {
                for(const ap of location.activityPayrollList){
                    if(ap.activityCodeId !== officeActivityCode){
                        activityCodeId = ap.activityCodeId
                    }
                }

            }
        }
    }

    if(activityCodeId > 0){
        const testInsurerId = insurerId;
        const querytIAC = {
            insurerId: testInsurerId,
            territoryList: rateState,
            talageActivityCodeIdList: activityCodeId
        }
        //travelers check//travelers check
        if(testInsurerId === 2) {
            querytIAC.insurerId = 14;
            const iacList = await InsurerActivityCode.find(querytIAC)
            if(iacList.length > 0){
                iac = iacList[0]
            }
            else {
                querytIAC.insurerId = 3;
                const iacList2 = await InsurerActivityCode.find(querytIAC)
                if(iacList2.length > 0){
                    iac = iacList2[0]
                }
                else {
                    querytIAC.insurerId = 19;
                    const iacList3 = await InsurerActivityCode.find(querytIAC)
                    if(iacList3.length > 0){
                        iac = iacList3[0]
                    }
                }
            }
        }
        else {
            const iacList = await InsurerActivityCode.find(querytIAC)
            if(iacList.length > 0){
                iac = iacList[0]
            }
        }

    }
    return iac;


}

async function getTalageActivityCode(appDoc, activityCodeList){
    const officeActivityCode = 2869;
    let activityCodeId = 0;
    if(appDoc.locations.length > 0){
        for(const location of appDoc.locations){
            if(location.activityPayrollList.length === 1){
                activityCodeId = location.activityPayrollList[0].activityCodeId
            }
            else {
                for(const ap of location.activityPayrollList){
                    if(ap.activityCodeId !== officeActivityCode){
                        activityCodeId = ap.activityCodeId
                        break;
                    }
                }

            }
        }
    }

    if(activityCodeId > 0){
        const ac = activityCodeList.find((acTest) => acTest.activityCodeId === activityCodeId)
        return ac;
    }
    return null;
}


function QuoteStatusDesc(quoteStatusId){
    // eslint-disable-next-line default-case
    switch(quoteStatusId){
        case 0:
            return "Initiated"
        case 5:
            return "PI Error"
        case 10:
            return "Error"
        case 15:
            return "Talage Stopped - Out of Appetite";
        case 17:
            return "Amtrust Out of Appetite";
        case 20:
            return "Declined";
        case 25:
            return "Price Indication";
        case 40:
            return "Referred"
        case 55:
            return "Referred with Price"
        case 50:
            return "Quoted"
        case 58:
            return "Quote - Marked as Dead"
        case 60:
            return "Bind Requested"
        case 65:
            return "Bind Requested from Refer with Price"
        case 100:
            return "Bound"
    }
    return ""

}


/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    //TODO add proper auth
    server.addGetInsurerPortalAuth('Get All Industry Codes', `${basePath}/winloss`, winloss, 'agencies', 'view');
};