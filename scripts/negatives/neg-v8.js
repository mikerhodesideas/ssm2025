// v8 - Negative Keyword Script - works with single & MCC accounts.

// Step 1 - Just run the script once to get YOUR url.
// Step 2 - Check the logs for your sheet URL. Open the sheet
// Step 3 - Add the accounts you want to the ‘settings’ sheet (copy them from the 'all' tab)
// Step 4 - Add a 'runAt' time for each account in the 'settings' sheet
// Step 5 - Add YOUR sheet URL to the MY_SHEET variable below.
// Step 6 - Run the script again



// don't change this until step 5
const MY_SHEET = ''; // Add YOUR sheet URL here between the single quotes

const TURN_OFF_REDUNDANT_NEGS = true; // set to false to see all redundant negs (leave as true for large accounts)


// Please don't change any code below this line, thanks! ---------------------------------



const CONFIG = {
    scriptVersion: 'v8',
    spendThreshold: 500, // only adds accounts with spend over this amount in the last 30 days to the 'all' tab
    limits: {
        impressions: 10,
        lowCtrImpressions: 50,
        lowCost: 10,
        veryLowConv: 0.1,
        lowCTR: 0.25,
        highCPAMultiple: 1.5,
        highCPCMultiple: 1.5,
        lowROASMultiple: 0.5,
        aiMax: 200,
        topPercent: 80,
        keywordsPerCampaign: 30,
    },
    bucket: {
        highBucketCost: 100,
        lowBucketCost: 20,
        zeroConv: 0.1,
        profitableRoas: 2.5,
        profitableCPA: 10,
    },
    numberOfDays: 7,
    runAI: false,
    useCPA: false,
    useAllConv: false,
    aiDataSheet: 'aiData',
    ngramLength: 1,
    campFilter: '',
    excludeFilter: '',
    showOutput: 5,
    showNgramOutput: 10,
    timezone: AdsApp.currentAccount().getTimeZone(),
    errorCol: 6,
    urls: {
        master: (typeof MY_SHEET !== 'undefined' && MY_SHEET !== '') ? MY_SHEET : '',
        mccTemplate: 'https://docs.google.com/spreadsheets/d/12D4mPc4IU6rW9lqQJMK-ZDpmtlowtNkE71UVCJ92uZY/',
        singleAccountTemplate: 'https://docs.google.com/spreadsheets/d/1ckwXY1eLasJxAKOyuE7IIZ7NFKiDqoseXz9YA52UT8E/',
    },
    tabs: {
        all: 'all',
        settings: 'settings',
        total: 'total',
        summary: 'summary',
    }
};

function main() {
    let accountType = typeof MccApp !== 'undefined' ? 'MCC' : 'Single';
    Logger.log(`Account type: ${accountType}`);

    let spreadsheet = getOrCreateSpreadsheet(accountType);

    if (accountType === 'MCC') {
        executeMccLogic(spreadsheet);
    } else {
        executeSingleAccountLogic(spreadsheet);
    }
}

function getOrCreateSpreadsheet(accountType) {
    const createSheet = () => {
        const templateUrl = accountType === 'MCC' ? CONFIG.urls.mccTemplate : CONFIG.urls.singleAccountTemplate;
        const newSheet = SpreadsheetApp.openByUrl(templateUrl).copy(`Negative Keyword Analysis - For ${accountType} - (c) MikeRhodes.com.au`);
        if (accountType === 'Single') {
            console.log(`New sheet created: ${newSheet.getUrl()}\nUpdate MY_SHEET constant with this URL.`);
        } else {
            console.log(`\n####\nNew MCC sheet created: ${newSheet.getUrl()}\n####
            \nCopy desired account CIDs & names to the 'settings' tab, add 'Run At' time for each, 
            \nupdate MY_SHEET constant with this URL, then run script again.`);
        }
        return newSheet;
    };

    const getSheetType = (sheet) => {
        try {
            const versionRange = sheet.getRangeByName('sheetVersion');
            let sheetType = versionRange.getValue().charAt(0).toLowerCase() === 'n' ? 'Single' : 'MCC';

            if (sheetType === 'MCC') {
                try {
                    let mccApiKeyRange = sheet.getRangeByName('mcc_apikey');
                    let mccAnthApiKeyRange = sheet.getRangeByName('mcc_anth_apikey');
                    CONFIG.mccApiKey = mccApiKeyRange.getValue() || '';
                    CONFIG.mccAnthApiKey = mccAnthApiKeyRange.getValue() || '';
                } catch (apiKeyError) {
                    console.error(`Error retrieving MCC API keys: ${apiKeyError.message}`);
                }
            }

            return sheetType;
        } catch (error) {
            console.error(`Error getting sheet type: ${error.message}`);
            return 'Unknown';
        }
    };

    if (!CONFIG.urls.master || CONFIG.urls.master.trim() === '') {
        console.log("MY_SHEET is not defined or empty. Creating new sheet.");
        return createSheet();
    }

    try {
        const sheet = SpreadsheetApp.openByUrl(CONFIG.urls.master);
        const sheetType = getSheetType(sheet);

        if (sheetType === 'Unknown') {
            console.error("Unable to determine sheet type. Creating new sheet.");
            return createSheet();
        }

        if (accountType !== sheetType) {
            console.error(`Mismatch: ${accountType} account using ${sheetType} sheet. Creating new sheet.`);
            return createSheet();
        }

        console.log("Existing sheet matches account type. Using existing sheet.");
        return sheet;
    } catch (error) {
        console.error(`Error opening spreadsheet: ${error.message}. Creating new sheet.`);
        return createSheet();
    }
}

function executeMccLogic(spreadsheet) {
    let mcc = CONFIG;
    mcc.accountType = 'MCC';
    let mccDate = new Date(Utilities.formatDate(new Date(), mcc.timezone, "yyyy-MM-dd HH:mm:ss"));
    mcc.mccHour = mccDate.getHours();

    let allSheet = spreadsheet.getSheetByName(mcc.tabs.all);
    let settingSheet = spreadsheet.getSheetByName(mcc.tabs.settings);

    if (!allSheet || allSheet.getLastRow() <= 1) {
        populateAllTab(allSheet || spreadsheet.insertSheet(mcc.tabs.all), mcc);
        console.log("List of accounts in MCC collected. Please copy accounts from 'all' tab to the 'settings' tab, add a 'runAt' time for each and run the script again.");
        return;
    }

    if (!settingSheet) {
        console.error(`Settings tab '${mcc.tabs.settings}' not found in the spreadsheet.`);
        return;
    }
    let settingSheetData = settingSheet.getDataRange().getValues();
    if (!settingSheetData || settingSheetData.length <= 1) {
        console.error(`Add account CIDs, names, and runAt times to the 'settings' tab and run the script again`);
        return;
    }
    processAccounts(mcc, settingSheetData);
}

function executeSingleAccountLogic(spreadsheet) {
    Logger.log('Executing Single Account logic');
    let start = new Date(),
        settings = {},
        accountData = {};
    settings = configSheet(spreadsheet, settings, start);
    settings = calculateDateRange(settings.numberOfDays, settings);
    accountData = collectAccountData(settings.dateRange, settings);
    settings = createSheets(spreadsheet, accountData, settings);
    setCampAndDate(spreadsheet, accountData, settings);
    settings.data = aiData(spreadsheet, settings.aiDataSheet, settings);
    if (settings.runAI) {
        settings = mainAI(spreadsheet, settings);
    }
    log(spreadsheet, settings);
}

//#region process account data ----------------------------------------------------------
function processAccounts(mcc, settingsData) {
    Logger.log('Processing accounts:');
    let masterSs = safeOpenAndShareSpreadsheet(mcc.urls.master);
    let settingSheet = masterSs.getSheetByName(mcc.tabs.settings);
    let summarySheet = masterSs.getSheetByName(mcc.tabs.summary);

    // Get existing summary data
    let summaryData = summarySheet.getDataRange().getValues();
    let headers = summaryData.shift(); // Remove and store headers

    // Create a map of existing summary data
    let summaryMap = new Map(summaryData.map(row => [row[0], row]));

    // Get all client names from settings
    let allClientNames = settingsData.slice(1).map(row => row[1]);
    let processedAccounts = 0;

    for (let i = 1; i < settingsData.length; i++) {
        try {
            let clientName = settingsData[i][1];
            let accountData = processAccountRow(settingsData[i], i, mcc, settingSheet);

            if (accountData && accountData.accountSummary && Array.isArray(accountData.accountSummary)) {
                let newSummaryRow = createSummaryRow(clientName, accountData.accountSummary[1], accountData);
                summaryMap.set(clientName, newSummaryRow);
                processedAccounts++;
            } else if (!summaryMap.has(clientName)) {
                Logger.log(`No data available for account: ${clientName}`);
            }
        } catch (e) {
            Logger.log(`Error processing account in row ${i + 1}: ${e.message}`);
            settingSheet.getRange(i + 1, mcc.errorCol).setValue(e.message);
        }
    }

    // Remove any accounts from summary that are not in settings
    for (let [clientName, _] of summaryMap) {
        if (!allClientNames.includes(clientName)) {
            summaryMap.delete(clientName);
        }
    }

    let updatedSummaryData = Array.from(summaryMap.values());
    updateSummarySheet(summarySheet, headers, updatedSummaryData);

    Logger.log(`MCC processing complete. Processed ${processedAccounts} accounts out of ${settingsData.length - 1} total accounts.`);
}

function updateSummarySheet(sheet, headers, data) {
    // Sort the data by Cost (11th column, index 10) in descending order
    data.sort((a, b) => b[10] - a[10]);
    sheet.clearContents();
    let allData = [headers, ...data];
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
}

function createSummaryRow(clientName, accountSummary, accountData) {
    return [
        clientName,
        ...accountSummary.slice(1),
        accountData.summary.campaignsWithImpressions,
        accountData.summary.totalCampaignNegatives,
        accountData.summary.totalAdGroupNegatives,
        accountData.summary.searchTermsCount,
        accountData.summary.poorPerformersCount,
        accountData.summary.conflictingNegsCount,
        accountData.summary.redundantNegsCount,
        accountData.summary.mostExpensiveCPC.cpc.toFixed(2),
        accountData.summary.mostExpensiveCPC.term,
        accountData.summary.newWordsCount,
        accountData.summary.singleWordBroadMatchCount
    ];
}

function calculateMostExpensiveCPC(searchTerms) {
    if (!searchTerms || searchTerms.length === 0) return { cpc: 0, term: 'N/A' };

    let mostExpensiveCPC = 0;
    let mostExpensiveTerm = null;

    searchTerms.forEach(st => {
        if (st.metrics.clicks > 0) {
            let cpc = st.metrics.cost / st.metrics.clicks;
            if (cpc > mostExpensiveCPC) {
                mostExpensiveCPC = cpc;
                mostExpensiveTerm = st.term;
            }
        }
    });

    return {
        cpc: mostExpensiveCPC,
        term: mostExpensiveTerm
    };
}

function countSingleWordBroadMatchKeywords(campaigns) {
    return Object.values(campaigns).reduce((count, campaign) => {
        return count + Object.values(campaign.adGroups).reduce((agCount, adGroup) => {
            return agCount + adGroup.keywords.filter(kw =>
                kw.matchType === 'BROAD' && kw.text.split(/\s+/).length === 1
            ).length;
        }, 0);
    }, 0);
}

function processAccountRow(row, rowIndex, mcc, settingSheet) {
    let accountData = {};

    let cid = row[0];
    let client = row[1];
    let runAt = row[2];
    let clientSheet = row[3];
    let lastRun = row[4];

    if (!isValidAccountId(cid)) {
        throw new Error(`${cid} is not a valid Account ID - please check row ${rowIndex + 1} in the settings tab.`);
    }

    let account = selectAccount(cid);
    let shouldProcess = shouldProcessAccount(mcc, rowIndex, runAt, clientSheet, lastRun, client);
    if (shouldProcess) {
        accountData = processAccountTasks(mcc, cid, client, clientSheet, settingSheet, rowIndex);
        return accountData;
    }
    return null;
}

function selectAccount(accountId) {
    let accountIterator = AdsManagerApp.accounts().withIds([accountId]).get();

    if (!accountIterator.hasNext()) {
        throw new Error('No access to the account or account does not exist.');
    }

    let account = accountIterator.next();
    AdsManagerApp.select(account);

    return account;
}

function shouldProcessAccount(mcc, rowIndex, runAt, clientSheet, lastRun, client) {
    // Ensure 'Run At' is a number and not empty. If empty, add current mcc time!
    if (typeof runAt !== 'number' || runAt === '') {
        // Get current MCC hour which is already calculated at the start of the script
        let currentHour = mcc.mccHour;

        Logger.log('--------' + '\n' + `No 'Run At' time specified for ${client}. Setting to current hour (${currentHour}).`);

        // Set the current hour value in the settings sheet
        let settingSheet = SpreadsheetApp.openByUrl(mcc.urls.master).getSheetByName(mcc.tabs.settings);
        settingSheet.getRange(rowIndex + 1, 3).setValue(currentHour); // Column 3 is the 'Run At' column

        // Add a message in the error column
        settingSheet.getRange(rowIndex + 1, mcc.errorCol).setValue(`Default Run At time (${currentHour}) was set to current hour`);

        // Use the current hour for this execution
        runAt = currentHour;
    }

    if (runAt === parseInt(mcc.mccHour)) {
        Logger.log('----' + '\n' + `Woohoo! It's time to update ${client}`);
        return true;
    } else if (!lastRun || !clientSheet) {
        Logger.log('----' + '\n' + `Either there's no 'last run' or no sheet url, so running now.`);
        return true;
    } else {
        Logger.log('----\n' + `It's not the right time of day to update ${client}. Skipping account.`);
        return false;
    }
}

function processAccountTasks(mcc, cid, client, clientSheet, settingsSheet, rowIndex) {
    try {
        if (!clientSheet) {
            clientSheet = createClientSheet(mcc, client);
            settingsSheet.getRange(rowIndex + 1, 4).setValue(clientSheet);
        }

        let result = performMainTasks(clientSheet, client, mcc);
        settingsSheet.getRange(rowIndex + 1, 4).setValue(clientSheet);
        settingsSheet.getRange(rowIndex + 1, 5).setValue(Utilities.formatDate(new Date(), mcc.timezone, "MMM:dd HH:mm"));
        settingsSheet.getRange(rowIndex + 1, 6).clearContent(); // Clear the error column

        return result;

    } catch (e) {
        let errorMessage = `Problem with ${client} - ${e.message}`;
        Logger.log(`Error stack: ${e.stack}`);
        settingsSheet.getRange(rowIndex + 1, 6).setValue(errorMessage);
        return null;
    }
}

function createClientSheet(mcc, client) {
    try {
        const newSheet = safeOpenAndShareSpreadsheet(mcc.urls.singleAccountTemplate, true, client + ' - Negative Keyword Analysis - (c) MikeRhodes.com.au');
        Logger.log(`****\nNew sheet created: ${newSheet.getUrl()}\n****`);
        return newSheet.getUrl();
    } catch (e) {
        Logger.log(`Error creating new sheet from template: ${e.message}`);
    }
    throw new Error(`Failed to create a new sheet. Try again in 5 mins!`);
}

function isValidAccountId(accountId) {
    // Example: check if the account ID is not empty and is in a specific format
    return accountId && typeof accountId === 'string' && accountId.match(/^\d{3}-\d{3}-\d{4}$/);
}

function populateAllTab(allSheet, mcc) {
    allSheet.clearContents();
    let headers = ['Client ID', 'Account Name', 'Total Cost Last 30 Days'];
    let data = [headers];

    let accountIterator = AdsManagerApp.accounts().get();
    let accountData = [];

    while (accountIterator.hasNext()) {
        let account = accountIterator.next();
        AdsManagerApp.select(account);

        let accountId = account.getCustomerId();
        let accountName = account.getName();
        let totalCost = account.getStatsFor("LAST_30_DAYS").getCost();

        if (totalCost > mcc.spendThreshold) {
            accountData.push([accountId, accountName, totalCost]);
        }
    }

    // Sort account data by total cost
    accountData.sort((a, b) => b[2] - a[2]);
    data = data.concat(accountData);

    allSheet.getRange(1, 1, data.length, headers.length).setValues(data);

    Logger.log(`Populated 'all' tab with ${accountData.length} accounts that spent over ${mcc.spendThreshold} in the last 30 days.`);
}

function safeOpenAndShareSpreadsheet(url, setAccess = false, newName = null) {
    try {
        if (!url) {
            console.error(`URL is empty or undefined: ${url}`);
            return null;
        }

        let ss;
        try {
            ss = SpreadsheetApp.openByUrl(url);
        } catch (error) {
            Logger.log(`Error opening spreadsheet: ${error.message}`);
            Logger.log(`Settings were: ${url}, ${setAccess}, ${newName}`);
            return null;
        }

        if (newName) {
            ss = ss.copy(newName);
        }

        if (setAccess) {
            let file = DriveApp.getFileById(ss.getId());

            try {
                file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
            } catch (error) {
                Logger.log("ANYONE_WITH_LINK failed, trying DOMAIN_WITH_LINK");

                try {
                    file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.EDIT);
                    Logger.log("Sharing set to DOMAIN_WITH_LINK");
                } catch (error) {
                    Logger.log("DOMAIN_WITH_LINK failed, setting to PRIVATE");

                    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.EDIT);
                    Logger.log("Sharing set to PRIVATE");
                }
            }
        }
        return ss;

    } catch (error) {
        console.error(`Error opening, copying, or sharing spreadsheet: ${error.message}`);
        return null;
    }
}
//#endregion end processing account section

function performMainTasks(sheetUrl, client, mcc) {
    Logger.log(`Starting Negative Keyword Script for ${client}`);
    let start = new Date(),
        settings = {},
        accountData = {};
    let spreadsheet = validateAndGetSpreadsheet(sheetUrl, mcc.urls.singleAccountTemplate);

    settings = configSheet(spreadsheet, settings, start);
    settings = calculateDateRange(settings.numberOfDays, settings);
    accountData = collectAccountData(settings.dateRange, settings);

    // If no active campaigns are found, abort processing for this account.
    if (Object.keys(accountData.campaigns).length === 0) {
        Logger.log('No active campaigns with impressions found for the selected date range. Aborting further processing for this account.');
        return { summary: { /* Provide a default empty summary */ } };
    }

    settings = createSheets(spreadsheet, accountData, settings);
    setCampAndDate(spreadsheet, accountData, settings);
    settings.data = aiData(spreadsheet, settings.aiDataSheet, settings);
    if (settings.runAI) {
        settings = mainAI(spreadsheet, settings);
    }

    log(spreadsheet, settings);
    settings.clientSheet = spreadsheet.getUrl();

    if (accountData && accountData.campaigns) {
        accountData.summary = {
            campaignsWithImpressions: Object.values(accountData.campaigns).filter(c => c.hasImpressions).length,
            totalCampaignNegatives: Object.values(accountData.campaigns)
                .filter(c => c.status === 'ENABLED')
                .reduce((sum, c) => sum + (c.campaignNegatives ? c.campaignNegatives.length : 0), 0),
            totalAdGroupNegatives: Object.values(accountData.campaigns)
                .filter(c => c.status === 'ENABLED')
                .flatMap(c => Object.values(c.adGroups || {}))
                .filter(ag => ag.status === 'ENABLED')
                .reduce((sum, ag) => sum + (ag.negatives ? ag.negatives.filter(neg => neg.status === 'ENABLED').length : 0), 0),
            searchTermsCount: (accountData.searchTerms || []).filter(st => st.metrics.impressions > settings.showOutput).length,
            poorPerformersCount: (accountData.poorPerformers || []).length,
            conflictingNegsCount: Math.max(0, (accountData.conflictingNegatives || []).length - 1),
            redundantNegsCount: Math.max(0, (accountData.redundantNegatives || []).length - 1),
            mostExpensiveCPC: calculateMostExpensiveCPC(accountData.searchTerms || []),
            newWordsCount: (accountData.ngramData && accountData.ngramData.newWords) ? accountData.ngramData.newWords.filter(row => row[2] > 0).length : 0,
            singleWordBroadMatchCount: countSingleWordBroadMatchKeywords(accountData.campaigns)
        };
    }

    return accountData;
}

//#region collect data -----------------------------------------------------------------
function collectAccountData(dateRange, settings) {
    let campLike = '';
    settings.campFilter ? campLike += ` AND campaign.name LIKE "%${settings.campFilter}%" ` : null;
    settings.excludeFilter ? campLike += ` AND campaign.name NOT LIKE "%${settings.excludeFilter}%"` : null;

    const accountData = {
        campaigns: {},
        negativeKeywordLists: {},
        searchTerms: [],
        poorPerformers: [],
        conflictingNegatives: [],
        redundantNegatives: [],
        ngramData: { newWords: [] }
    };

    try {
        // Step 1: Collect only active campaigns first. This is the master filter.
        collectCampaignData(accountData, dateRange, campLike, settings);

        const activeCampaignIds = Object.keys(accountData.campaigns);

        // If no active campaigns, no point in continuing.
        if (activeCampaignIds.length === 0) {
            return accountData;
        }

        // Step 2: Pass the list of active campaign IDs to all other functions.
        collectKeywordData(accountData, dateRange, campLike, settings, activeCampaignIds);
        collectCampaignNegatives(accountData, dateRange, campLike, settings, activeCampaignIds);
        collectSearchTerms(accountData, dateRange, campLike, settings, activeCampaignIds);
        collectNegativeKeywordLists(accountData, dateRange, campLike, settings, activeCampaignIds);

    } catch (e) {
        Logger.log(`A critical error occurred in collectAccountData: ${e.message}`);
        throw e;
    }

    return accountData;
}

function collectCampaignData(accountData, dateRange, campLike, settings) {
    const campaignsIterator = AdsApp.search(`
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          metrics.all_conversions,
          metrics.all_conversions_value
        FROM campaign
        WHERE 
          ${dateRange} 
          ${campLike}
          AND campaign.status = ENABLED
          AND metrics.impressions > 0
    `);

    while (campaignsIterator.hasNext()) {
        const row = campaignsIterator.next();
        const { id, name, status, advertisingChannelType } = row.campaign;
        const metrics = row.metrics;

        accountData.campaigns[id] = {
            name: name,
            status: status,
            channelType: advertisingChannelType,
            hasImpressions: Number(metrics.impressions) > 0,
            metrics: {
                impressions: Number(metrics.impressions) || 0,
                clicks: Number(metrics.clicks) || 0,
                cost: Number(metrics.costMicros) / 1000000 || 0,
                conversions: Number(settings.useAllConv ? metrics.allConversions : metrics.conversions) || 0,
                conversionValue: Number(settings.useAllConv ? metrics.allConversionsValue : metrics.conversionsValue) || 0
            },
            adGroups: {},
            campaignNegatives: [],
            negativeListNames: [],
            enabledAdGroups: 0
        };

        if (advertisingChannelType === 'SHOPPING') {
            collectShoppingAdGroups(accountData, id, dateRange, settings);
        }
    }
}

function collectShoppingAdGroups(accountData, campaignId, dateRange, settings) {
    const adGroupIterator = AdsApp.search(`
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          metrics.all_conversions,
          metrics.all_conversions_value
        FROM ad_group
        WHERE campaign.id = ${campaignId} AND ${dateRange}
    `);

    while (adGroupIterator.hasNext()) {
        const row = adGroupIterator.next();
        const { id, name, status } = row.adGroup;
        const metrics = row.metrics;

        accountData.campaigns[campaignId].adGroups[id] = {
            id: id,
            name: name,
            status: status,
            keywords: [],
            negatives: [],
            metrics: {
                impressions: Number(metrics.impressions) || 0,
                clicks: Number(metrics.clicks) || 0,
                cost: Number(metrics.costMicros) / 1000000 || 0,
                conversions: Number(settings.useAllConv ? metrics.allConversions : metrics.conversions) || 0,
                conversionValue: Number(settings.useAllConv ? metrics.allConversionsValue : metrics.conversionsValue) || 0
            }
        };

        if (status === 'ENABLED') {
            accountData.campaigns[campaignId].enabledAdGroups++;
        }
    }
}

function collectKeywordData(accountData, dateRange, campLike, settings, activeCampaignIds) {
    const keywordIterator = AdsApp.search(`
        SELECT
          campaign.id,
          ad_group.id,
          ad_group.name,
          ad_group.status,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.status,
          ad_group_criterion.negative,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value
        FROM keyword_view
        WHERE 
          ${dateRange} 
          ${campLike}
          AND campaign.id IN (${activeCampaignIds.join(',')})
    `);
    while (keywordIterator.hasNext()) {
        processKeywordRow(accountData, keywordIterator.next());
    }
}

function processKeywordRow(accountData, row) {
    const campaignId = row.campaign.id;
    const adGroupId = row.adGroup.id;
    const keywordText = row.adGroupCriterion.keyword.text;
    const matchType = row.adGroupCriterion.keyword.matchType;
    const isNegative = row.adGroupCriterion.negative;
    const metrics = row.metrics;

    ensureCampaignAndAdGroupExist(accountData, row);

    const normalizedKeyword = normalizeKeyword(keywordText, matchType);

    if (!isNegative) {
        const keywordData = createKeywordData(normalizedKeyword, row, metrics);
        const adGroup = accountData.campaigns[campaignId].adGroups[adGroupId];
        keywordData.id = `${campaignId}-${adGroupId}-${adGroup.keywords.length}`;
        keywordData.wordCount = keywordText.split(/\s+/).length;
        adGroup.keywords.push(keywordData);

        if (!adGroup.keywordMetrics) {
            adGroup.keywordMetrics = {
                impressions: 0,
                clicks: 0,
                cost: 0,
                conversions: 0,
                conversionValue: 0
            };
        }
        updateMetricsData(adGroup.keywordMetrics, metrics);

    } else {
        accountData.campaigns[campaignId].adGroups[adGroupId].negatives.push(normalizedKeyword);
    }
}

function ensureCampaignAndAdGroupExist(accountData, row) {
    const campaignId = row.campaign.id;
    const adGroupId = row.adGroup.id;

    if (!accountData.campaigns[campaignId]) {
        accountData.campaigns[campaignId] = {
            id: campaignId,
            name: row.campaign.name,
            status: row.campaign.status,
            channelType: row.campaign.advertisingChannelType,
            adGroups: {},
            metrics: {
                impressions: 0,
                clicks: 0,
                cost: 0,
                conversions: 0,
                conversionValue: 0
            }
        };
    }
    if (!accountData.campaigns[campaignId].adGroups[adGroupId]) {
        accountData.campaigns[campaignId].adGroups[adGroupId] = {
            id: adGroupId,
            name: row.adGroup.name,
            status: row.adGroup.status,
            keywords: [],
            negatives: [],
            metrics: {
                impressions: 0,
                clicks: 0,
                cost: 0,
                conversions: 0,
                conversionValue: 0
            }
        };
    }
}

function createKeywordData(normalizedKeyword, row, metrics) {
    return {
        ...normalizedKeyword,
        status: row.adGroupCriterion.status,
        metrics: {
            impressions: Number(metrics.impressions),
            clicks: Number(metrics.clicks),
            cost: Number(metrics.costMicros) / 1000000,
            conversions: Number(metrics.conversions),
            conversionValue: Number(metrics.conversionsValue)
        },
        isTopPerformer: false
    };
}

function collectCampaignNegatives(accountData, dateRange, campLike, settings, activeCampaignIds) {
    const campaignNegativeQuery = `
    SELECT
      campaign.id,
      campaign_criterion.keyword.text,
      campaign_criterion.keyword.match_type,
      campaign_criterion.status
    FROM campaign_criterion
    WHERE
      campaign_criterion.negative = TRUE AND
      campaign_criterion.type = KEYWORD AND
      campaign.status != "REMOVED" AND
      campaign.id IN (${activeCampaignIds.join(',')})
    `;
    const campaignNegativeIterator = AdsApp.search(campaignNegativeQuery);
    while (campaignNegativeIterator.hasNext()) {
        const row = campaignNegativeIterator.next();
        const campaignId = row.campaign.id;
        if (accountData.campaigns[campaignId]) {
            accountData.campaigns[campaignId].campaignNegatives.push(
                normalizeKeyword(row.campaignCriterion.keyword.text, row.campaignCriterion.keyword.matchType, row.campaignCriterion.status)
            );
        }
    }
}

function collectNegativeKeywordLists(accountData, dateRange, campLike, settings, activeCampaignIds) {
    const negativeKeywordListsIterator = AdsApp.negativeKeywordLists().get();
    const activeCampaignIdSet = new Set(activeCampaignIds);

    while (negativeKeywordListsIterator.hasNext()) {
        const list = negativeKeywordListsIterator.next();
        const listName = list.getName();
        let isListRelevant = false;
        const relevantCampaignsForThisList = [];

        const campaignsIterator = list.campaigns().get();
        while (campaignsIterator.hasNext()) {
            const campaign = campaignsIterator.next();
            const campaignId = campaign.getId().toString();

            if (activeCampaignIdSet.has(campaignId)) {
                isListRelevant = true;
                relevantCampaignsForThisList.push(campaignId);
            }
        }

        if (isListRelevant) {
            const keywords = [];
            const keywordsIterator = list.negativeKeywords().get();
            while (keywordsIterator.hasNext()) {
                const keyword = keywordsIterator.next();
                keywords.push(normalizeKeyword(keyword.getText(), keyword.getMatchType()));
            }

            accountData.negativeKeywordLists[listName] = {
                appliedToCampaigns: relevantCampaignsForThisList,
                keywords: keywords
            };

            for (const campaignId of relevantCampaignsForThisList) {
                if (accountData.campaigns[campaignId]) {
                    accountData.campaigns[campaignId].negativeListNames.push(listName);
                }
            }
        }
    }
}

function collectSearchTerms(accountData, dateRange, campLike, settings, activeCampaignIds) {
    const query = `
        SELECT 
            campaign.id,
            ad_group.id,
            search_term_view.search_term,
            segments.search_term_match_type,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.all_conversions,
            metrics.all_conversions_value
        FROM search_term_view
        WHERE 
          ${dateRange} 
          ${campLike}
          AND campaign.id IN (${activeCampaignIds.join(',')})
    `;

    const searchTermIterator = AdsApp.search(query);

    while (searchTermIterator.hasNext()) {
        const row = searchTermIterator.next();
        const campaignId = row.campaign.id;
        const adGroupId = row.adGroup.id;

        if (accountData.campaigns[campaignId] && accountData.campaigns[campaignId].adGroups[adGroupId]) {
            const searchTerm = normalizeKeyword(row.searchTermView.searchTerm, row.segments.searchTermMatchType).text;
            accountData.searchTerms.push({
                term: searchTerm,
                campaignId: campaignId,
                adGroupId: adGroupId,
                matchType: row.segments.searchTermMatchType,
                wordCount: searchTerm.split(/\s+/).length,
                metrics: {
                    impressions: Number(row.metrics.impressions) || 0,
                    clicks: Number(row.metrics.clicks) || 0,
                    cost: Number(row.metrics.costMicros) / 1000000 || 0,
                    conversions: Number(settings.useAllConv ? row.metrics.allConversions : row.metrics.conversions) || 0,
                    conversionValue: Number(settings.useAllConv ? row.metrics.allConversionsValue : row.metrics.conversionsValue) || 0
                }
            });
        }
    }
}
//#endregion

//#region create sheets ----------------------------------------------------------------
function createSheets(spreadsheet, accountData, settings) {
    calculateCampaignMetrics(accountData);
    identifyPoorPerformers(accountData, settings);
    prepareNGramData(accountData, settings);
    findConflictingNegatives(accountData, settings);

    // Initialize redundant negatives arrays to prevent errors
    if (!accountData.redundantNegatives) {
        accountData.redundantNegatives = [];
    }
    if (!settings.analysisData.redundantNegatives) {
        settings.analysisData.redundantNegatives = [];
    }

    if (!TURN_OFF_REDUNDANT_NEGS) {
        findRedundantNegatives(accountData, settings);
    }

    const sheetCreators = [{
        name: 'Campaign',
        creator: createCampaignSummarySheet
    }, {
        name: 'CampLists',
        creator: createCampaignNegativeKeywordListsOverview
    }, {
        name: 'CampNegs',
        creator: createCampaignNegativeKeywordsOverview
    }, {
        name: 'Account',
        creator: createAccountSummarySheet
    }, {
        name: 'AllKeywords',
        creator: createCampaignKeywordsOverview
    }, {
        name: 'AllSearchTerms',
        creator: createSearchTermsSheet
    }, {
        name: 'STnGrams',
        creator: createNGramSheet
    }, {
        name: 'KWnGrams',
        creator: createNGramSheet
    }, {
        name: 'PoorPerformers',
        creator: createPoorPerformersSheet
    }, {
        name: 'KWmatch',
        creator: createMatchTypeSheet
    }, {
        name: 'STmatch',
        creator: createMatchTypeSheet
    }, {
        name: 'NewWords',
        creator: createNewWordsSheet
    }, {
        name: 'highCPC',
        creator: createHighCPCSheet
    }, {
        name: 'KWdist',
        creator: createDistributionSheet
    }, {
        name: 'STdist',
        creator: createDistributionSheet
    }, {
        name: 'Conflicting',
        creator: createConflictingNegativesSheet
    }];

    // Add Redundant sheet only if not disabled
    if (!TURN_OFF_REDUNDANT_NEGS) {
        sheetCreators.push({
            name: 'Redundant',
            creator: createRedundantNegativesSheet
        });
    }

    for (const { name, creator } of sheetCreators) {
        try {
            creator(spreadsheet, accountData, name, settings);
        } catch (error) {
            Logger.log(`Error creating ${name} sheet: ${error.message}`);
            console.error(`Full error details for ${name} sheet:`, error);
        }
    }
    return settings;
}


// --- THE REST OF THE SCRIPT FUNCTIONS WOULD GO HERE ---
// (No changes are needed to the sheet creation, calculation, or utility functions themselves)
// The following are placeholders for brevity. The full script provided previously should be used.

function createCampaignKeywordsOverview(spreadsheet, accountData, sheetName, settings) {
    let sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();

    const headers = [
        'Campaign', 'Campaign Status', 'Ad Group', 'Ad Group Status',
        'Keyword', 'Keyword Status', 'Match Type', 'Word Count', 'Impr', 'Clicks',
        'Cost', 'Conv', 'Value', 'CTR', 'CVR', 'CPA', 'AOV', 'ROAS',
        `Top ${settings.limits.topPercent}% AdGroup Impr`
    ];

    let outputData = [];

    if (accountData && accountData.campaigns) {
        outputData = Object.values(accountData.campaigns)
            .filter(campaign => campaign.channelType === 'SEARCH')
            .flatMap(campaign =>
                Object.values(campaign.adGroups)
                    .flatMap(adGroup =>
                        adGroup.keywords
                            .filter(keyword => keyword.metrics.impressions > settings.showOutput)
                            .map(keyword => [
                                campaign.name,
                                campaign.status,
                                adGroup.name,
                                adGroup.status,
                                keyword.text,
                                keyword.status,
                                keyword.matchType,
                                keyword.wordCount,
                                ...createMetricsRow(keyword.metrics),
                                keyword.isTopPerformer ? 'x' : ''
                            ])
                    )
            )
            .sort((a, b) => b[8] - a[8]); // Sort by impressions (index 8)
    }

    if (outputData.length > 0) {
        outputData.unshift(headers);
        sheet.getRange(1, 1, outputData.length, headers.length).setValues(outputData);

        clearExistingFilters(sheet);
        const filter = sheet.getRange(1, 1, outputData.length, headers.length).createFilter();

        filter.setColumnFilterCriteria(2, SpreadsheetApp.newFilterCriteria().whenTextEqualTo('ENABLED').build());
        filter.setColumnFilterCriteria(4, SpreadsheetApp.newFilterCriteria().whenTextEqualTo('ENABLED').build());
        filter.setColumnFilterCriteria(6, SpreadsheetApp.newFilterCriteria().whenTextEqualTo('ENABLED').build());
    } else {
        sheet.getRange(1, 1).setValue('No keyword data found for the specified criteria.');
    }
}

function createCampaignNegativeKeywordsOverview(spreadsheet, accountData, sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();

    const headers = ['Campaign', 'Campaign Type', 'Ad Group', 'Level', 'Negative Keyword', 'Match Type', 'Status'];

    let outputData = Object.values(accountData.campaigns)
        .filter(campaign => campaign.hasImpressions)
        .flatMap(campaign => [
            ...(campaign.campaignNegatives || []).map(negative =>
                [campaign.name, campaign.channelType, '-', 'Campaign', negative.text, negative.matchType, negative.status]
            ),
            ...Object.values(campaign.adGroups || {}).flatMap(adGroup =>
                (adGroup.negatives || []).map(negative =>
                    [campaign.name, campaign.channelType, adGroup.name, 'Ad Group', negative.text, negative.matchType, negative.status]
                )
            )
        ]);

    if (outputData.length > 0) {
        outputData.unshift(headers);
        sheet.getRange(1, 1, outputData.length, headers.length).setValues(outputData);
    } else {
        sheet.getRange(1, 1).setValue('No negative keywords found for campaigns with impressions.');
    }

    clearExistingFilters(sheet);
    sheet.getRange(1, 1, sheet.getLastRow(), headers.length).createFilter();
}

function createCampaignNegativeKeywordListsOverview(spreadsheet, accountData, sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();

    const headers = ['Negative Keyword List', 'Campaign', 'Campaign Type', 'Keyword Count'];
    const outputData = [];

    for (const [listName, listData] of Object.entries(accountData.negativeKeywordLists)) {
        for (const id of listData.appliedToCampaigns) {
            const campaign = accountData.campaigns[id];
            if (campaign && (campaign.channelType === 'SEARCH' || campaign.channelType === 'SHOPPING') && campaign.hasImpressions) {
                outputData.push([listName, campaign.name, campaign.channelType, listData.keywords.length]);
            }
        }
    }

    if (outputData.length > 0) {
        outputData.unshift(headers);
        sheet.getRange(1, 1, outputData.length, headers.length).setValues(outputData);
    } else {
        sheet.getRange(1, 1).setValue('No campaign negative keyword lists found for campaigns with impressions.');
    }

    clearExistingFilters(sheet);
    sheet.getRange(1, 1, sheet.getLastRow(), headers.length).createFilter();
}

function createPoorPerformersSheet(spreadsheet, accountData, sheetName, settings) {
    settings.analysisData.poorPerformers = [];
    let sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();

    const headers = [
        'Type', 'Campaign', 'Ad Group', 'KW/ST', 'Match Type', 'Impr', 'Clicks', 'Cost', 'Conv', 'Value',
        'CTR', 'CPA', 'ROAS', 'Reasons', 'Details'
    ];

    let poorPerformers = [];

    if (accountData && accountData.poorPerformers) {
        poorPerformers = accountData.poorPerformers
            .filter(item => item && item.impressions > 0)
            .map(item => [
                item.type,
                item.campaign,
                item.adGroup,
                item.text,
                item.matchType,
                item.impressions,
                item.clicks,
                item.cost.toFixed(2),
                item.conversions,
                item.conversionValue.toFixed(2),
                (item.ctr * 100).toFixed(1) + '%',
                item.cpa !== null ? item.cpa.toFixed(2) : '',
                item.roas !== null ? item.roas.toFixed(1) : '',
                item.reasons,
                item.details
            ])
            .sort((a, b) => {
                if (a[13] !== b[13]) return a[13].localeCompare(b[13]); // Sort by reasons
                return parseFloat(b[7]) - parseFloat(a[7]); // Then by cost descending
            });
    }


    if (poorPerformers.length > 0) {
        sheet.getRange(1, 1, poorPerformers.length + 1, headers.length).setValues([headers, ...poorPerformers]);

        // Create limited dataset for AI analysis
        let aiPoorPerformers = poorPerformers.reduce((acc, item) => {
            let reason = item[13].split(';')[0].trim(); // Use the first reason for grouping
            if (!acc[reason]) acc[reason] = [];
            if (acc[reason].length < settings.limits.aiMax) acc[reason].push(item);
            return acc;
        }, {});

        settings.analysisData.poorPerformers = [headers, ...Object.values(aiPoorPerformers).flat()];
    } else {
        sheet.getRange(1, 1).setValue('No poor performers found.');
        settings.analysisData.poorPerformers = [
            ['No poor performers found.']
        ];
    }

    clearExistingFilters(sheet);
    sheet.getRange(1, 1, sheet.getLastRow(), headers.length).createFilter();
}

function createMatchTypeSheet(spreadsheet, accountData, sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();

    const headers = ['Level', 'Entity', 'Match Type', 'Impr', 'Clicks', 'Cost', 'Conv', 'Value', 'CTR', 'CVR', 'CPA', 'AOV', 'ROAS'];
    const isKeywordSheet = sheetName === 'KWmatch';
    const matchTypes = isKeywordSheet ? ['EXACT', 'PHRASE', 'BROAD'] : ['EXACT', 'PHRASE', 'NEAR_EXACT', 'NEAR_PHRASE', 'BROAD'];
    const data = calculateMatchTypePerformance(accountData, isKeywordSheet, matchTypes);

    let outputData = [];

    // Account level data
    matchTypes.forEach(matchType => {
        if (data.accountLevel[matchType]) {
            outputData.push(createDataRow('Account', 'All Campaigns', matchType, data.accountLevel[matchType]));
        }
    });

    // Campaign level data
    const sortedCampaigns = sortCampaignsByCost(accountData);
    sortedCampaigns.forEach(campaignName => {
        const campaignData = data.campaignLevel[campaignName];
        if (campaignData) {
            matchTypes.forEach(matchType => {
                if (campaignData[matchType] && (!isKeywordSheet || campaignData[matchType].impressions > 0)) {
                    outputData.push(createDataRow('Campaign', campaignName, matchType, campaignData[matchType]));
                }
            });
        }
    });

    if (outputData.length > 0) {
        sheet.getRange(1, 1, outputData.length + 1, headers.length).setValues([headers, ...outputData]);
    } else {
        sheet.getRange(1, 1).setValue(isKeywordSheet ? 'No keyword match type performance data found.' : 'No search term match type performance data found.');
    }

    clearExistingFilters(sheet);
    sheet.getRange(1, 1, sheet.getLastRow(), headers.length).createFilter();
}

function createNewWordsSheet(spreadsheet, accountData, sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();

    const headers = ['Word', 'Total Count', 'Filtered Count', 'Impr', 'Clicks', 'Cost', 'Conv', 'Value', 'CTR', 'CVR', 'CPA', 'AOV', 'ROAS', 'Bucket', 'Campaign', 'Ngram Length'];

    if (!Array.isArray(accountData.ngramData.newWords)) {
        sheet.getRange(1, 1).setValue('No new words data found or data is in incorrect format.');
        return;
    }

    const newWordsData = accountData.ngramData.newWords.filter(row => row[2] > 0); // Filter based on filteredCount

    if (newWordsData.length > 0) {
        newWordsData.sort((a, b) => b[3] - a[3]); // impr index 3
        sheet.getRange(1, 1, newWordsData.length + 1, headers.length).setValues([headers, ...newWordsData]);
    } else {
        sheet.getRange(1, 1).setValue('No new words found matching the filtering criteria.');
    }

    clearExistingFilters(sheet);
    sheet.getRange(1, 1, sheet.getLastRow(), headers.length).createFilter();
}

function createCampaignSummarySheet(spreadsheet, accountData, sheetName, settings) {
    settings.analysisData.campaigns = [];
    let sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();

    const headers = [
        'Campaign', 'Status', 'Channel', 'Ad Groups', 'Enabled Ad Groups',
        'Total Keywords', 'Enabled Keywords', 'Negative Lists', 'Camp Negs', 'AG Negs', 'Total Negs',
        'Impr', 'Clicks', 'Cost', 'Conv', 'Conv Value', 'CTR', 'CVR', 'CPA', 'AOV', 'ROAS'
    ];

    let outputData = Object.values(accountData.campaigns)
        .filter(campaign => campaign.metrics.impressions > 0)
        .map(campaign => {
            const totalAdGroups = Object.keys(campaign.adGroups).length;
            const enabledAdGroups = campaign.enabledAdGroups || Object.values(campaign.adGroups).filter(ag => ag.status === 'ENABLED').length;
            const totalKeywords = Object.values(campaign.adGroups).reduce((sum, ag) => sum + ag.keywords.length, 0);
            const enabledKeywords = Object.values(campaign.adGroups).reduce((sum, ag) =>
                sum + ag.keywords.filter(kw => kw.status === 'ENABLED').length, 0);
            const agNegatives = Object.values(campaign.adGroups).reduce((sum, ag) => sum + ag.negatives.length, 0);
            const negListKeywords = campaign.negativeListNames.reduce((sum, listName) =>
                sum + (accountData.negativeKeywordLists[listName]?.keywords.length || 0), 0);
            const totalNegatives = negListKeywords + campaign.campaignNegatives.length + agNegatives;

            const keywordMetrics = Object.values(campaign.adGroups).reduce((sum, ag) => {
                if (ag.keywordMetrics) {
                    sum.impressions += Number(ag.keywordMetrics.impressions);
                    sum.clicks += Number(ag.keywordMetrics.clicks);
                    sum.cost += Number(ag.keywordMetrics.cost);
                    sum.conversions += Number(ag.keywordMetrics.conversions);
                    sum.conversionValue += Number(ag.keywordMetrics.conversionValue);
                }
                return sum;
            }, {
                impressions: 0,
                clicks: 0,
                cost: 0,
                conversions: 0,
                conversionValue: 0
            });

            return [
                campaign.name,
                campaign.status,
                campaign.channelType,
                totalAdGroups,
                enabledAdGroups,
                campaign.channelType === 'SHOPPING' ? '-' : totalKeywords,
                campaign.channelType === 'SHOPPING' ? '-' : enabledKeywords,
                campaign.negativeListNames.length,
                campaign.campaignNegatives.length,
                agNegatives,
                totalNegatives,
                ...createMetricsRow(campaign.metrics)
            ];
        })
        .sort((a, b) => b[14] - a[14]); // Sort by cost (index 14) descending

    if (outputData.length > 0) {
        sheet.getRange(1, 1, outputData.length + 1, headers.length).setValues([headers, ...outputData]);

        clearExistingFilters(sheet);
        const filter = sheet.getRange(1, 1, outputData.length + 1, headers.length).createFilter();
        filter.setColumnFilterCriteria(2, SpreadsheetApp.newFilterCriteria().whenTextEqualTo('ENABLED').build());
        filter.setColumnFilterCriteria(3, SpreadsheetApp.newFilterCriteria()
            .whenFormulaSatisfied('=OR(C:C="SEARCH", C:C="SHOPPING")')
            .build());

        // Create limited dataset for AI analysis
        settings.analysisData.campaigns = [
            headers,
            ...outputData.filter(row => row[2] === 'SEARCH' || row[2] === 'SHOPPING').slice(1, CONFIG.limits.aiMax + 1)
        ];
    } else {
        sheet.getRange(1, 1).setValue('No campaign data found.');
        settings.analysisData.campaigns = [
            ['No campaign data found.']
        ];
    }
}

function createAccountSummarySheet(spreadsheet, accountData, sheetName, settings) {
    settings.analysisData.accountSummary = [];
    let sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();

    const headers = [
        'Account Type', 'Total Campaigns', 'Total AdGroups', 'Enabled AdGroups',
        'Total Keywords', 'Enabled Keywords', 'Neg Lists', 'Total Negs',
        'Impr', 'Clicks', 'Cost', 'Conv', 'Conv Value', 'CTR', 'CVR', 'CPA', 'AOV', 'ROAS'
    ];

    function calculateSummary(campaigns) {
        let summary = {
            totalCampaigns: campaigns.length,
            totalAdGroups: 0,
            enabledAdGroups: 0,
            totalKeywords: 0,
            enabledKeywords: 0,
            negLists: 0,
            totalNegatives: 0,
            impr: 0,
            clicks: 0,
            cost: 0,
            conv: 0,
            value: 0
        };

        campaigns.forEach(campaign => {
            let campaignAdGroups = Object.values(campaign.adGroups);
            summary.totalAdGroups += campaignAdGroups.length;
            summary.enabledAdGroups += campaignAdGroups.filter(ag => ag.status === 'ENABLED').length;
            campaignAdGroups.forEach(adGroup => {
                summary.totalKeywords += adGroup.keywords.length;
                summary.enabledKeywords += adGroup.keywords.filter(kw => kw.status === 'ENABLED').length;
            });
            summary.negLists += campaign.negativeListNames.length;
            summary.totalNegatives += campaign.campaignNegatives.length +
                campaignAdGroups.reduce((sum, ag) => sum + ag.negatives.length, 0) +
                campaign.negativeListNames.reduce((sum, listName) =>
                    sum + (accountData.negativeKeywordLists[listName]?.keywords.length || 0), 0);

            // Use campaign.metrics directly
            summary.impr += Number(campaign.metrics.impressions);
            summary.clicks += Number(campaign.metrics.clicks);
            summary.cost += Number(campaign.metrics.cost);
            summary.conv += Number(campaign.metrics.conversions);
            summary.value += Number(campaign.metrics.conversionValue);
        });

        return summary;
    }

    function getSummaryRow(type, sum) {
        const impr = Number(sum.impr) || 0;
        const clicks = Number(sum.clicks) || 0;
        const cost = Number(sum.cost) || 0;
        const conv = Number(sum.conv) || 0;
        const value = Number(sum.value) || 0;

        const ctr = impr > 0 ? clicks / impr : 0;
        const cvr = clicks > 0 ? conv / clicks : 0;
        const cpa = conv > 0 ? cost / conv : 0;
        const aov = conv > 0 ? value / conv : 0;
        const roas = cost > 0 ? value / cost : 0;

        return [type, sum.totalCampaigns, sum.totalAdGroups, sum.enabledAdGroups, sum.totalKeywords, sum.enabledKeywords, sum.negLists, sum.totalNegatives,
            impr, clicks, cost, conv, value, ctr, cvr, cpa, aov, roas
        ];
    }

    const allCampaigns = Object.values(accountData.campaigns);
    const searchCampaigns = allCampaigns.filter(c => c.channelType === 'SEARCH' && c.hasImpressions);
    const shoppingCampaigns = allCampaigns.filter(c => c.channelType === 'SHOPPING' && c.hasImpressions);

    const allCampaignsSummary = calculateSummary(allCampaigns);
    const searchCampaignsSummary = calculateSummary(searchCampaigns);
    const shoppingCampaignsSummary = calculateSummary(shoppingCampaigns);


    const outputData = [
        headers,
        getSummaryRow('All Campaigns', allCampaignsSummary),
        getSummaryRow('Search Campaigns', searchCampaignsSummary),
        getSummaryRow('Shopping Campaigns', shoppingCampaignsSummary)
    ];

    sheet.getRange(1, 1, outputData.length, headers.length).setValues(outputData);

    clearExistingFilters(sheet);
    sheet.getRange(1, 1, outputData.length, headers.length).createFilter();

    accountData.accountSummary = outputData;
    settings.analysisData.accountSummary = outputData;
}

function createSearchTermsSheet(spreadsheet, accountData, sheetName, settings) {
    let sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();
    clearExistingFilters(sheet);

    const headers = [
        'Campaign', 'Ad Group', 'Search Term', 'Query Match Type', 'Word Count',
        'Impr', 'Clicks', 'Cost', 'Conv', 'Value',
        'CTR', 'CvR', 'CPA', 'AOV', 'ROAS'
    ];

    if (accountData.searchTerms.length > 0) {
        let values = accountData.searchTerms.map(st => {
            let campaign = accountData.campaigns[st.campaignId];
            let adGroup = campaign ? campaign.adGroups[st.adGroupId] : null;
            let metricsRow = createMetricsRow(st.metrics);
            return [
                campaign ? campaign.name : 'Unknown Campaign',
                adGroup ? adGroup.name : 'Unknown Ad Group',
                st.term,
                st.matchType,
                st.wordCount,
                ...metricsRow
            ];
        });

        values = values
            .filter(row => row[5] > settings.showOutput) // Filter rows with impressions > showOutput
            .sort((a, b) => b[5] - a[5]); // Sort by impressions (column F) in descending order

        if (values.length > 0) {
            sheet.getRange(1, 1, values.length + 1, headers.length).setValues([headers, ...values]);
        } else {
            sheet.getRange(1, 1).setValue('No search terms data found matching the filtering criteria.');
        }
    } else {
        sheet.getRange(1, 1).setValue('No search terms data found for the specified date range.');
    }
}

function createHighCPCSheet(spreadsheet, accountData, sheetName, settings) {
    settings.analysisData.highCPCData = [];
    let sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();

    const headers = ['Campaign Name', 'Keyword/Search Term', 'Match Type', 'CPC', 'Camp Avg CPC', 'Multiple', 'Type', 'Total Clicks', 'Total Cost'];
    let highCPCData = [];

    Object.values(accountData.campaigns).forEach(campaign => {
        if (campaign.channelType !== 'SEARCH' || !campaign.hasImpressions) return;

        let avgCampaignCPC = campaign.metrics.clicks > 0 ? campaign.metrics.cost / campaign.metrics.clicks : 0;

        Object.values(campaign.adGroups).forEach(adGroup => {
            adGroup.keywords.forEach(keyword => {
                if (keyword.metrics.clicks > 0) {
                    let cpc = keyword.metrics.cost / keyword.metrics.clicks;
                    let multiple = avgCampaignCPC > 0 ? cpc / avgCampaignCPC : 0;
                    if (multiple > settings.limits.highCPCMultiple) {
                        highCPCData.push([
                            campaign.name,
                            keyword.text,
                            keyword.matchType,
                            cpc.toFixed(2),
                            avgCampaignCPC.toFixed(2),
                            multiple.toFixed(2),
                            'Keyword',
                            keyword.metrics.clicks,
                            keyword.metrics.cost.toFixed(2)
                        ]);
                    }
                }
            });
        });
    });

    // Process search terms
    accountData.searchTerms.forEach(searchTerm => {
        if (searchTerm.metrics.clicks > 0) {
            let campaign = accountData.campaigns[searchTerm.campaignId];
            if (campaign && campaign.channelType === 'SEARCH' && campaign.hasImpressions) {
                let avgCampaignCPC = campaign.metrics.clicks > 0 ? campaign.metrics.cost / campaign.metrics.clicks : 0;
                let cpc = searchTerm.metrics.cost / searchTerm.metrics.clicks;
                let multiple = avgCampaignCPC > 0 ? cpc / avgCampaignCPC : 0;
                if (multiple > settings.limits.highCPCMultiple) {
                    highCPCData.push([
                        campaign.name,
                        searchTerm.term,
                        searchTerm.matchType,
                        cpc.toFixed(2),
                        avgCampaignCPC.toFixed(2),
                        multiple.toFixed(2),
                        'Search Term',
                        searchTerm.metrics.clicks,
                        searchTerm.metrics.cost.toFixed(2)
                    ]);
                }
            }
        }
    });

    // Sort all data by Multiple (descending)
    highCPCData.sort((a, b) => parseFloat(b[5]) - parseFloat(a[5]));

    if (highCPCData.length > 0) {
        let keywords = highCPCData.filter(row => row[6] === 'Keyword');
        let searchTerms = highCPCData.filter(row => row[6] === 'Search Term');
        let topKeywords = keywords.slice(0, settings.limits.aiMax);
        let topSearchTerms = searchTerms.slice(0, settings.limits.aiMax);
        settings.analysisData.highCPCData = [headers, ...topKeywords, ...topSearchTerms];

        // Output all data to sheet
        sheet.getRange(1, 1, highCPCData.length + 1, headers.length).setValues([headers, ...highCPCData]);
    } else {
        sheet.getRange(1, 1).setValue('No high CPC keywords or search terms found for the specified criteria.');
        settings.analysisData.highCPCData = [
            ['No high CPC keywords found for the specified criteria.']
        ];
    }
}

function createDistributionSheet(spreadsheet, accountData, sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();

    const headers = ['Campaign', 'Avg CPC', 'Min CPC', 'Max CPC', 'Total Clicks', 'Account-wide Range of CPC (same x axis)', 'Campaign Range of CPC'];
    const NUM_BINS = 30;

    let allItems;
    if (sheetName === 'KWdist') {
        allItems = Object.values(accountData.campaigns).flatMap(campaign =>
            Object.values(campaign.adGroups).flatMap(adGroup => {
                if (!adGroup.keywordMetrics || adGroup.keywordMetrics.clicks === 0) return [];
                return adGroup.keywords
                    .filter(keyword => keyword.metrics.clicks > 0)
                    .map(keyword => ({
                        campaign: campaign.name,
                        cpc: keyword.metrics.cost / keyword.metrics.clicks,
                        clicks: keyword.metrics.clicks
                    }));
            })
        );
    } else if (sheetName === 'STdist') {
        allItems = accountData.searchTerms.filter(st => st.metrics.clicks > 0)
            .map(st => ({
                campaign: accountData.campaigns[st.campaignId].name,
                cpc: st.metrics.cost / st.metrics.clicks,
                clicks: st.metrics.clicks
            }));
    } else {
        throw new Error('Invalid dataType. Use "keywords" or "searchTerms".');
    }

    let accountMinCPC = Math.min(...allItems.map(item => Number(item.cpc.toFixed(2))));
    let accountMaxCPC = Math.max(...allItems.map(item => Number(item.cpc.toFixed(2))));
    let accountBinSize = (accountMaxCPC - accountMinCPC) / NUM_BINS;

    function createCPCDistribution(items, minCPC, maxCPC, binSize) {
        let distribution = new Array(NUM_BINS).fill(0);
        items.forEach(item => {
            let binIndex = Math.min(Math.floor((item.cpc - minCPC) / binSize), NUM_BINS - 1);
            distribution[binIndex] += item.clicks;
        });
        return distribution;
    }

    function padArray(arr) {
        return arr.length < NUM_BINS ? arr.concat(new Array(NUM_BINS - arr.length).fill(0)) : arr.slice(0, NUM_BINS);
    }

    let outputData = [];
    let campaignData = {};

    allItems.forEach(item => {
        if (!campaignData[item.campaign]) {
            campaignData[item.campaign] = {
                items: [],
                minCPC: Infinity,
                maxCPC: -Infinity,
                totalCPC: 0,
                totalClicks: 0
            };
        }
        campaignData[item.campaign].items.push(item);
        campaignData[item.campaign].minCPC = Math.min(campaignData[item.campaign].minCPC, item.cpc);
        campaignData[item.campaign].maxCPC = Math.max(campaignData[item.campaign].maxCPC, item.cpc);
        campaignData[item.campaign].totalCPC += item.cpc * item.clicks;
        campaignData[item.campaign].totalClicks += item.clicks;
    });

    Object.entries(campaignData).forEach(([campaign, data]) => {
        let avgCPC = data.totalCPC / data.totalClicks;
        let accountWideBinsDistribution = padArray(createCPCDistribution(data.items, accountMinCPC, accountMaxCPC, accountBinSize));
        let campaignDistribution = padArray(createCPCDistribution(data.items, data.minCPC, data.maxCPC, (data.maxCPC - data.minCPC) / NUM_BINS));

        let maxAccountWideValue = Math.max(...accountWideBinsDistribution);
        let maxCampaignValue = Math.max(...campaignDistribution);

        const sparklineCommonSettings = `"charttype","column"; "color1","#D3D3D3"; "color2","#FFA500"; "min",0; "axis",TRUE; "axiscolor","#E0E0E0"; "highcolor","#FFA500"; "negcolor","#D3D3D3"; "empty","ignore"; "rtl",FALSE`;

        const accountWideSparkline = (binsDistribution, maxValue) =>
            `=SPARKLINE({${binsDistribution.join(',')}}, {${sparklineCommonSettings}; "max",${maxValue}})`;

        const campaignSparkline = (binsDistribution, maxValue) =>
            `=SPARKLINE({${binsDistribution.join(',')}}, {${sparklineCommonSettings}; "max",${maxValue}})`;

        outputData.push([
            campaign,
            avgCPC,
            data.minCPC,
            data.maxCPC,
            data.totalClicks,
            accountWideSparkline(accountWideBinsDistribution, maxAccountWideValue),
            campaignSparkline(campaignDistribution, maxCampaignValue)
        ]);
    });

    if (outputData.length > 0) {
        let dataToWrite = [headers].concat(outputData);
        sheet.getRange(1, 1, dataToWrite.length, headers.length).setValues(dataToWrite);
    } else {
        sheet.getRange(1, 1).setValue('No campaign data found with clicks > 0.');
    }
}

function createConflictingNegativesSheet(spreadsheet, accountData, sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();

    const headers = ['Negative Keyword', 'Match Type', 'Level', 'Campaign', 'Ad Group', 'List Name', 'Blocked Positives'];

    if (accountData.conflictingNegatives.length > 0) {
        const data = accountData.conflictingNegatives.map(conflict => [
            conflict.negative,
            conflict.matchType,
            conflict.level,
            conflict.campaignName,
            conflict.adGroupName || '',
            conflict.listName || '',
            conflict.blockedPositives.join(', ')
        ]);

        sheet.getRange(1, 1, data.length + 1, headers.length).setValues([headers, ...data]);
    } else {
        sheet.getRange(1, 1).setValue('No conflicting negative keywords found.');
        accountData.conflictingNegatives = [
            ['No conflicting negative keywords found.']
        ]
    }

    clearExistingFilters(sheet);
    sheet.getRange(1, 1, sheet.getLastRow(), headers.length).createFilter();
}

function createRedundantNegativesSheet(spreadsheet, accountData, sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    sheet.clearContents();

    const headers = ['Campaign / List Name', 'Negative Keyword 1', 'Match Type 1', 'Level 1', 'Negative Keyword 2', 'Match Type 2', 'Level 2'];

    if (accountData.redundantNegatives && accountData.redundantNegatives.length > 0) {
        let outputData = accountData.redundantNegatives.map(r => [
            r.identifier,
            r.negative1.text,
            r.negative1.matchType,
            r.negative1.level,
            r.negative2.text,
            r.negative2.matchType,
            r.negative2.level
        ]);

        outputData.unshift(headers);
        sheet.getRange(1, 1, outputData.length, headers.length).setValues(outputData);
    } else {
        sheet.getRange(1, 1).setValue('No redundant negative keywords found.');
        accountData.redundantNegatives = [
            ['No redundant negative keywords found.']
        ]
    }

    clearExistingFilters(sheet);
    sheet.getRange(1, 1, sheet.getLastRow(), headers.length).createFilter();
}

function createNGramSheet(spreadsheet, accountData, sheetName, settings) {
    try {
        const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
        sheet.clearContents();

        const headers = ['nGram', 'Total Count', 'Filtered Count', 'Impr', 'Clicks', 'Cost', 'Conv', 'Value', 'CTR', 'CVR', 'CPA', 'AOV', 'ROAS', 'Bucket', 'Campaign', 'Ngram Length'];
        const campaignIndex = headers.indexOf('Campaign');
        const ngramLengthIndex = headers.indexOf('Ngram Length');

        if (campaignIndex === -1 || ngramLengthIndex === -1) {
            throw new Error('Campaign or Ngram Length column not found in headers');
        }

        const ngramType = sheetName === 'STnGrams' ? 'searchTermsNGrams' : 'keywordsNGrams';
        const ngramData = accountData.ngramData[ngramType];

        let outputData = [];

        if (ngramData && ngramData.length > 0) {
            outputData = ngramData.filter(row => row[2] > 0 && row[3] > settings.showNgramOutput) // filtered count >0 & use output limit
                .sort((a, b) => b[3] - a[3]);
        }

        if (outputData.length > 0) {
            sheet.getRange(1, 1, outputData.length + 1, headers.length).setValues([headers, ...outputData]);
        } else {
            sheet.getRange(1, 1).setValue('No nGram data found.');
            accountData.ngramData = [
                ['No nGram data found.']
            ]
        }

        const allCampaignsData = outputData.filter(row =>
            row[campaignIndex] === 'All Campaigns' && parseInt(row[ngramLengthIndex]) === 1
        );

        settings.analysisData = settings.analysisData || {};
        settings.analysisData.ngramData = settings.analysisData.ngramData || {};
        settings.analysisData.ngramData[ngramType === 'searchTermsNGrams' ? 'searchTerms' : 'keywords'] = [headers, ...allCampaignsData.slice(0, settings.limits.aiMax)];

    } catch (error) {
        Logger.log(`Error in createNGramSheet for ${sheetName}: ${error.message}`);
    }
}
//#endregion

//#region create nGrams ----------------------------------------------------------------
function prepareNGramData(accountData, settings) {
    const keywordNgrams = new Set();
    const searchTermNgrams = new Map();
    const keywordsNGrams = new Map();
    const newWords = new Map();
    const maxNgramLength = settings.ngramLength;

    function createInitialNgramData(ngram, campaign, ngramLength) {
        return {
            ngram,
            campaign,
            ngramLength,
            totalCount: 0,
            filteredCount: 0,
            impressions: 0,
            clicks: 0,
            cost: 0,
            conversions: 0,
            conversionValue: 0
        };
    }

    function processWords(words, item, ngramMap, campaign, settings) {
        for (let n = 1; n <= settings.ngramLength; n++) {
            for (let i = 0; i <= words.length - n; i++) {
                const ngram = words.slice(i, i + n).join(' ');
                const key = `${ngram}|^|${campaign}|^|${n}`;
                if (!ngramMap.has(key)) {
                    ngramMap.set(key, createInitialNgramData(ngram, campaign, n));
                }
                updateNgramData(ngramMap.get(key), item, settings);
            }
        }
    }

    // Process keywords
    Object.values(accountData.campaigns).forEach(campaign => {
        Object.values(campaign.adGroups).forEach(adGroup => {
            (adGroup.keywords || []).forEach(keyword => {
                const words = keyword.text.toLowerCase().split(/\s+/);
                processWords(words, keyword, keywordsNGrams, campaign.name, settings);
                processWords(words, keyword, keywordsNGrams, 'All Campaigns', settings);
                words.forEach(word => keywordNgrams.add(word));
            });
        });
    });

    // Process search terms and identify new words
    (accountData.searchTerms || []).forEach(st => {
        const campaign = accountData.campaigns[st.campaignId].name;
        const words = st.term.toLowerCase().split(/\s+/);
        processWords(words, st, searchTermNgrams, campaign, settings);
        processWords(words, st, searchTermNgrams, 'All Campaigns', settings);

        words.forEach(word => {
            if (!keywordNgrams.has(word)) {
                const key = `${word}|^|All Campaigns|^|1`;
                if (!newWords.has(key)) {
                    newWords.set(key, createInitialNgramData(word, 'All Campaigns', 1));
                }
                updateNgramData(newWords.get(key), st, settings);
            }
        });
    });

    function finalizeNgramData(ngramMap, settings) {
        return Array.from(ngramMap.values()).map(data => {
            const ctr = data.impressions > 0 ? data.clicks / data.impressions : 0;
            const cvr = data.clicks > 0 ? data.conversions / data.clicks : 0;
            const cpa = data.conversions > 0 ? data.cost / data.conversions : 0;
            const aov = data.conversions > 0 ? data.conversionValue / data.conversions : 0;
            const roas = data.cost > 0 ? data.conversionValue / data.cost : 0;
            const bucket = getBucket(settings, data.cost, roas, data.conversions, cpa);

            return [
                data.ngram,
                data.totalCount,
                data.filteredCount,
                data.impressions,
                data.clicks,
                data.cost,
                data.conversions,
                data.conversionValue,
                ctr,
                cvr,
                cpa,
                aov,
                roas,
                bucket,
                data.campaign,
                data.ngramLength,
            ];
        });
    }

    const result = {
        searchTermsNGrams: finalizeNgramData(searchTermNgrams, settings),
        keywordsNGrams: finalizeNgramData(keywordsNGrams, settings),
        newWords: finalizeNgramData(newWords, settings)
    };

    accountData.ngramData = result;
}

function updateNgramData(data, item, settings) {
    data.totalCount++;
    if (item.metrics.impressions >= settings.limits.impressions || item.metrics.cost > 0) {
        data.filteredCount++;
    }
    data.impressions += Number(item.metrics.impressions) || 0;
    data.clicks += Number(item.metrics.clicks) || 0;
    data.cost += Number(item.metrics.cost) || 0;
    data.conversions += Number(item.metrics.conversions) || 0;
    data.conversionValue += Number(item.metrics.conversionValue) || 0;
}

function getBucket(settings, cost, roas, conversions, cpa) {
    const isProfitable = settings.useCPA ?
        cpa <= settings.bucket.profitableCPA :
        roas >= settings.bucket.profitableRoas;
    const isHighCost = cost >= settings.bucket.highBucketCost;
    const isZeroConv = conversions < settings.bucket.zeroConv;

    if (isZeroConv) {
        return cost <= settings.bucket.lowBucketCost ? 'zombies' : 'zeroconv';
    }

    if (isHighCost) {
        return isProfitable ? 'profitable' : 'costly';
    }

    return isProfitable ? 'flukes' : 'meh';
}
//#endregion 

//#region calc performance thresholds --------------------------------------------------
function calculateCampaignMetrics(accountData) {
    const campaignMetrics = new Map();

    for (const [campaignId, campaign] of Object.entries(accountData.campaigns)) {
        const metrics = campaign.metrics;
        const keywords = Object.values(campaign.adGroups).flatMap(ag => ag.keywords);
        const keywordMetrics = Object.values(campaign.adGroups).reduce((sum, ag) => {
            if (ag.keywordMetrics) {
                sum.impressions += ag.keywordMetrics.impressions;
                sum.clicks += ag.keywordMetrics.clicks;
                sum.cost += ag.keywordMetrics.cost;
                sum.conversions += ag.keywordMetrics.conversions;
                sum.conversionValue += ag.keywordMetrics.conversionValue;
            }
            return sum;
        }, {
            impressions: 0,
            clicks: 0,
            cost: 0,
            conversions: 0,
            conversionValue: 0
        });

        if (metrics.impressions > 0) {
            const avgCPA = metrics.conversions > 0 ? metrics.cost / metrics.conversions : 0;
            const avgCTR = metrics.clicks / metrics.impressions;
            const avgCVR = metrics.clicks > 0 ? metrics.conversions / metrics.clicks : 0;
            const avgROAS = metrics.conversions > 0 ? metrics.conversionValue / metrics.cost : 0;
            const avgAOV = metrics.conversions > 0 ? metrics.conversionValue / metrics.conversions : 0;
            const dynamicCostThreshold = calculateDynamicCostThreshold(keywords);

            campaignMetrics.set(campaign.name, {
                avgCPA,
                avgROAS,
                avgCTR,
                avgCVR,
                avgAOV,
                totalImpressions: metrics.impressions,
                totalClicks: metrics.clicks,
                totalCost: metrics.cost,
                totalConversions: metrics.conversions,
                totalConvValue: metrics.conversionValue,
                keywordMetrics: keywordMetrics,
                dynamicCostThreshold
            });
        }
    }

    accountData.campaignMetrics = campaignMetrics;
}

function identifyPoorPerformers(accountData, settings) {
    const poorPerformers = [];

    function checkPerformance(item, type, campaign, adGroup, campaignStats) {
        const metrics = type === 'Keyword' ? item.metrics : item.metrics;
        const reasons = [];
        const details = [];

        const impressions = metrics.impressions;
        const clicks = metrics.clicks;
        const cost = metrics.cost;
        const conversions = metrics.conversions;
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const cpa = conversions > 0 ? cost / conversions : null;
        const roas = conversions > 0 ? metrics.conversionValue / cost : null;

        if (impressions >= settings.limits.impressions) {
            if (impressions >= settings.limits.lowCtrImpressions && ctr < campaignStats.avgCTR * (settings.limits.lowCTR)) {
                reasons.push(`Low CTR (over ${settings.limits.lowCtrImpressions} Impr)`);
                details.push(`${(ctr * 100).toFixed(2)}% vs ${(campaignStats.avgCTR * 100).toFixed(2)}%`);
            }

            let highCostThreshold = Math.max(
                campaignStats.avgCPA > 0 ? campaignStats.avgCPA * settings.limits.highCPAMultiple : settings.limits.lowCost,
                settings.limits.lowCost
            );
            if (cost >= highCostThreshold) {
                if (conversions === 0) {
                    reasons.push('High Cost, Zero Conv');
                    details.push(`Cost: ${cost.toFixed(0)} vs Threshold: ${highCostThreshold.toFixed(0)}`);
                } else if (conversions < settings.limits.veryLowConv) {
                    reasons.push('High Cost, Very Low Conv');
                    details.push(`Cost: ${cost.toFixed(0)} vs Threshold: ${highCostThreshold.toFixed(0)}`);
                }
            }

            let highCPAThreshold = Math.max(
                campaignStats.avgCPA > 0 ? campaignStats.avgCPA * settings.limits.highCPAMultiple : settings.limits.lowCost,
                settings.limits.lowCost
            );
            if (cpa !== null && cpa > highCPAThreshold && conversions > settings.limits.veryLowConv) {
                reasons.push('High CPA');
                details.push(`CPA: ${cpa.toFixed(0)} vs Threshold: ${highCPAThreshold.toFixed(0)}`);
            }

            let lowROASThreshold = campaignStats.avgROAS > 0 ? campaignStats.avgROAS * settings.limits.lowROASMultiple : 0;
            if (roas !== null && roas < lowROASThreshold && conversions > settings.limits.veryLowConv && cost > settings.limits.lowCost && metrics.conversionValue > 0) {
                reasons.push('Low ROAS');
                details.push(`ROAS: ${roas.toFixed(1)} vs Threshold: ${lowROASThreshold.toFixed(1)}`);
            }

            if (reasons.length > 0) {
                poorPerformers.push({
                    type: type,
                    campaign: campaign.name,
                    adGroup: adGroup.name,
                    text: type === 'Keyword' ? item.text : item.term,
                    matchType: item.matchType,
                    impressions: impressions,
                    clicks: clicks,
                    cost: cost,
                    conversions: conversions,
                    conversionValue: metrics.conversionValue,
                    ctr: ctr,
                    cpa: cpa,
                    roas: roas,
                    reasons: reasons.join('; '),
                    details: details.join('; ')
                });
            }
        }
    }

    for (const [campaignId, campaign] of Object.entries(accountData.campaigns)) {
        const campaignStats = accountData.campaignMetrics.get(campaign.name);
        if (!campaignStats) continue;

        for (const [adGroupId, adGroup] of Object.entries(campaign.adGroups)) {
            for (const keyword of adGroup.keywords) {
                checkPerformance(keyword, 'Keyword', campaign, adGroup, campaignStats);
            }
        }
    }

    for (const searchTerm of accountData.searchTerms) {
        const campaign = accountData.campaigns[searchTerm.campaignId];
        const adGroup = campaign.adGroups[searchTerm.adGroupId];
        const campaignStats = accountData.campaignMetrics.get(campaign.name);
        checkPerformance(searchTerm, 'Search Term', campaign, adGroup, campaignStats);
    }

    accountData.poorPerformers = poorPerformers;
}

function isKeywordInCampaign(searchTerm, adGroups) {
    return Object.values(adGroups).some(adGroup =>
        adGroup.keywords.some(keyword => keyword.text.toLowerCase() === searchTerm.toLowerCase())
    );
}

function calculateDynamicCostThreshold(keywords) {
    // Sort keywords by cost in descending order
    keywords.sort((a, b) => b.metrics.cost - a.metrics.cost);

    // Calculate total cost
    let totalCost = keywords.reduce((sum, keyword) => sum + keyword.metrics.cost, 0);

    let cumulativeCost = 0;
    let thresholdIndex = 0;

    // Identify keywords responsible for 98% of the total cost
    for (let i = 0; i < keywords.length; i++) {
        cumulativeCost += keywords[i].metrics.cost;
        if (cumulativeCost / totalCost >= 0.98) {
            thresholdIndex = i;
            break;
        }
    }

    // Calculate average cost of the top keywords
    let topKeywords = keywords.slice(0, thresholdIndex + 1);
    let averageCost = topKeywords.reduce((sum, keyword) => sum + keyword.metrics.cost, 0) / topKeywords.length;

    return averageCost;
}

function calculateMatchTypePerformance(accountData, isKeyword, matchTypes) {
    const accountLevelData = {};
    const campaignLevelData = {};

    matchTypes.forEach(matchType => {
        accountLevelData[matchType] = {
            impressions: 0,
            clicks: 0,
            cost: 0,
            conversions: 0,
            conversionValue: 0
        };
    });

    if (isKeyword) {
        Object.values(accountData.campaigns).forEach(campaign => {
            campaignLevelData[campaign.name] = {};
            matchTypes.forEach(matchType => {
                campaignLevelData[campaign.name][matchType] = {
                    impressions: 0,
                    clicks: 0,
                    cost: 0,
                    conversions: 0,
                    conversionValue: 0
                };
            });

            Object.values(campaign.adGroups).forEach(adGroup => {
                if (adGroup.keywordMetrics) {
                    adGroup.keywords.forEach(keyword => {
                        const matchType = keyword.matchType.toUpperCase();
                        if (matchTypes.includes(matchType)) {
                            updateMetricsData(accountLevelData[matchType], keyword.metrics);
                            updateMetricsData(campaignLevelData[campaign.name][matchType], keyword.metrics);
                        }
                    });
                }
            });
        });
    } else {
        // Search terms part remains unchanged
        accountData.searchTerms.forEach(searchTerm => {
            const matchType = searchTerm.matchType.toUpperCase();
            if (matchTypes.includes(matchType)) {
                updateMetricsData(accountLevelData[matchType], searchTerm.metrics);

                const campaign = accountData.campaigns[searchTerm.campaignId];
                if (campaign) {
                    if (!campaignLevelData[campaign.name]) {
                        campaignLevelData[campaign.name] = {};
                        matchTypes.forEach(mt => {
                            campaignLevelData[campaign.name][mt] = {
                                impressions: 0,
                                clicks: 0,
                                cost: 0,
                                conversions: 0,
                                conversionValue: 0
                            };
                        });
                    }
                    updateMetricsData(campaignLevelData[campaign.name][matchType], searchTerm.metrics);
                }
            }
        });
    }

    return {
        accountLevel: accountLevelData,
        campaignLevel: campaignLevelData
    };
}

function updateMetricsData(target, source) {
    target.impressions += Number(source.impressions) || 0;
    target.clicks += Number(source.clicks) || 0;
    target.cost += Number(source.cost) || 0;
    target.conversions += Number(source.conversions) || 0;
    target.conversionValue += Number(source.conversionValue) || 0;
}
//#endregion

//#region conflicts & redundancies -----------------------------------------------------
function findConflictingNegatives(accountData, settings) {
    accountData.conflictingNegatives = [];
    settings.analysisData.conflictingNegatives = [];

    function checkConflicts(negatives, positives, level, campaign, adGroup = null, listName = null) {
        negatives.forEach(negative => {
            const blockedPositives = positives.filter(positive => isConflict({
                ...negative,
                campaignStatus: campaign.status,
                adGroupStatus: adGroup ? adGroup.status : 'ENABLED'
            }, {
                ...positive,
                campaignStatus: campaign.status,
                adGroupStatus: adGroup ? adGroup.status : 'ENABLED'
            }));
            if (blockedPositives.length > 0) {
                accountData.conflictingNegatives.push({
                    negative: negative.text,
                    matchType: negative.matchType,
                    level,
                    campaignName: campaign.name,
                    adGroupName: adGroup ? adGroup.name : null,
                    listName,
                    blockedPositives: blockedPositives.map(p => p.text).slice(0, 3)
                });
            }
        });
    }

    Object.values(accountData.campaigns).forEach(campaign => {
        if (!campaign.hasImpressions || campaign.status !== 'ENABLED') return;

        if (Array.isArray(campaign.campaignNegatives)) {
            checkConflicts(
                campaign.campaignNegatives,
                Object.values(campaign.adGroups || {}).flatMap(ag => ag.keywords),
                'Campaign', campaign
            );
        }

        if (Array.isArray(campaign.negativeListNames)) {
            campaign.negativeListNames.forEach(listName => {
                const list = accountData.negativeKeywordLists[listName];
                if (list && Array.isArray(list.keywords)) {
                    checkConflicts(
                        list.keywords,
                        Object.values(campaign.adGroups || {}).flatMap(ag => ag.keywords),
                        'List', campaign, null, listName
                    );
                }
            });
        }

        Object.values(campaign.adGroups || {}).forEach(adGroup => {
            if (Array.isArray(adGroup.negatives) && Array.isArray(adGroup.keywords)) {
                checkConflicts(adGroup.negatives, adGroup.keywords, 'Ad Group', campaign, adGroup);
            }
        });
    });

    if (accountData.conflictingNegatives.length > 0) {
        settings.analysisData.conflictingNegatives = accountData.conflictingNegatives.map(conflict => [
            conflict.negative,
            conflict.matchType,
            conflict.level,
            conflict.campaignName,
            conflict.adGroupName || '',
            conflict.listName || '',
            conflict.blockedPositives.join(', ')
        ]);
    }
}

function isSubsequence(text1, text2) {
    if (typeof text1 !== 'string' || typeof text2 !== 'string') {
        console.error('isSubsequence: Invalid input', {
            text1,
            text2
        });
        return false;
    }
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    let i = 0;
    let j = 0;

    while (i < words1.length && j < words2.length) {
        if (words1[i] === words2[j]) {
            i++;
        }
        j++;
    }

    return i === words1.length;
}

function isConflict(negative, positive) {
    // Check if campaign, ad group, and keywords are enabled
    if (negative.campaignStatus !== 'ENABLED' || positive.campaignStatus !== 'ENABLED' ||
        negative.adGroupStatus !== 'ENABLED' || positive.adGroupStatus !== 'ENABLED' ||
        negative.status !== 'ENABLED' || positive.status !== 'ENABLED') {
        return false;
    }

    if (!negative || !positive || typeof negative.text !== 'string' || typeof positive.text !== 'string') {
        return false;
    }

    const negText = negative.text.toLowerCase().trim();
    const posText = positive.text.toLowerCase().trim();

    // Exact negative only conflicts with exact positive of the same text
    if (negative.matchType === 'EXACT') {
        return positive.matchType === 'EXACT' && negText === posText;
    }

    // Phrase negative
    if (negative.matchType === 'PHRASE') {
        if (positive.matchType === 'EXACT') {
            return posText === negText;
        }
        if (positive.matchType === 'PHRASE') {
            return posText.includes(negText);
        }
        if (positive.matchType === 'BROAD') {
            // Check if all words in negText appear in posText, order doesn't matter
            const negWords = negText.split(/\s+/);
            const posWords = posText.split(/\s+/);
            return negWords.every(word => posWords.includes(word));
        }
    }

    // Broad negative
    if (negative.matchType === 'BROAD') {
        const negWords = negText.split(/\s+/);
        const posWords = posText.split(/\s+/);

        if (positive.matchType === 'EXACT' || positive.matchType === 'PHRASE') {
            return negWords.every(word => posWords.includes(word));
        }
        if (positive.matchType === 'BROAD') {
            // For broad match, all negative words must be present in positive, but order doesn't matter
            return negWords.every(word => posWords.includes(word));
        }
    }

    return false;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkConflicts(negatives, positives, level, campaignName, adGroupName = null, listName = null) {
    negatives.forEach(negative => {
        const blockedPositives = positives.filter(positive => isConflict(negative, positive));
        if (blockedPositives.length > 0) {
            conflicts.push({
                negative: negative.text,
                matchType: negative.matchType,
                level,
                campaignName,
                adGroupName,
                listName,
                blockedPositives: blockedPositives.map(p => p.text)
            });
        }
    });
}

function normalizeText(text) {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function isSubset(arr1, arr2) {
    return arr1.every(item => arr2.includes(item));
}

function isRedundant(neg1, neg2) {
    if (neg1.status !== 'ENABLED' || neg2.status !== 'ENABLED') return false;

    const text1 = normalizeText(neg1.text);
    const text2 = normalizeText(neg2.text);
    const words1 = text1.split(' ');
    const words2 = text2.split(' ');

    // Exact match redundancies
    if (neg1.matchType === 'EXACT' || neg2.matchType === 'EXACT') {
        return text1 === text2;
    }

    // Phrase match redundancies
    if (neg1.matchType === 'PHRASE') {
        if (neg2.matchType === 'PHRASE') {
            return text1 === text2;
        }
        if (neg2.matchType === 'BROAD') {
            return text2.includes(text1);
        }
    }

    if (neg2.matchType === 'PHRASE' && neg1.matchType === 'BROAD') {
        return words1.every(word => words2.includes(word));
    }

    // Broad match redundancies
    if (neg1.matchType === 'BROAD' && neg2.matchType === 'BROAD') {
        return isSubset(words1, words2) && isSubset(words2, words1);
    }

    // Check if a broader match encompasses a narrower match
    if (neg1.matchType === 'BROAD' && (neg2.matchType === 'PHRASE' || neg2.matchType === 'EXACT')) {
        return words2.every(word => words1.includes(word));
    }
    if (neg2.matchType === 'BROAD' && (neg1.matchType === 'PHRASE' || neg1.matchType === 'EXACT')) {
        return words1.every(word => words2.includes(word));
    }

    return false;
}

function findRedundantNegatives(accountData, settings) {
    accountData.redundantNegatives = [];
    settings.analysisData.redundantNegatives = [];

    const allNegatives = [];

    // Process negative keyword lists
    Object.entries(accountData.negativeKeywordLists).forEach(([listName, list]) => {
        if (Array.isArray(list.keywords)) {
            allNegatives.push(...list.keywords.map(neg => ({
                ...neg,
                level: 'List',
                identifier: listName,
                appliedTo: list.appliedToCampaigns
            })));
        }
    });

    // Process campaign and ad group negatives
    Object.values(accountData.campaigns).forEach(campaign => {
        if (!campaign.hasImpressions) return;

        allNegatives.push(...(campaign.campaignNegatives || []).map(neg => ({
            ...neg,
            level: 'Campaign',
            identifier: campaign.name,
            appliedTo: [campaign.name]
        })));

        Object.values(campaign.adGroups || {}).forEach(adGroup => {
            allNegatives.push(...(adGroup.negatives || []).map(neg => ({
                ...neg,
                level: 'Ad Group',
                identifier: `${campaign.name} / ${adGroup.name}`,
                appliedTo: [`${campaign.name} / ${adGroup.name}`]
            })));
        });
    });

    // Check for redundancies
    for (let i = 0; i < allNegatives.length; i++) {
        for (let j = i + 1; j < allNegatives.length; j++) {
            const neg1 = allNegatives[i];
            const neg2 = allNegatives[j];

            // Check if negatives are applied to the same campaign/ad group or if one is at a higher level
            const hasOverlap = neg1.appliedTo.some(app1 => neg2.appliedTo.includes(app1)) ||
                neg2.appliedTo.some(app2 => neg1.appliedTo.includes(app2)) ||
                (neg1.level === 'List' && neg2.level !== 'List') ||
                (neg2.level === 'List' && neg1.level !== 'List') ||
                (neg1.level === 'Campaign' && neg2.level === 'Ad Group') ||
                (neg2.level === 'Campaign' && neg1.level === 'Ad Group');

            if (hasOverlap && isRedundant(neg1, neg2)) {
                accountData.redundantNegatives.push({
                    identifier: `${neg1.identifier} & ${neg2.identifier}`,
                    negative1: neg1,
                    negative2: neg2
                });
            }
        }
    }

    if (accountData.redundantNegatives.length > 0) {
        settings.analysisData.redundantNegatives = accountData.redundantNegatives.map(r => [
            r.identifier,
            r.negative1.text,
            r.negative1.matchType,
            r.negative1.level,
            r.negative2.text,
            r.negative2.matchType,
            r.negative2.level
        ]);
    }
}
//#endregion

//#region utilities --------------------------------------------------------------------
function calculateDateRange(numDays, settings) {
    let timezone = AdsApp.currentAccount().getTimeZone();

    let now = new Date();
    let nowInTimezone = new Date(Utilities.formatDate(now, timezone, 'yyyy-MM-dd'));

    let endDate = new Date(nowInTimezone);
    endDate.setDate(endDate.getDate() - 1);

    let startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - numDays + 1);

    let formattedStartDate = Utilities.formatDate(startDate, timezone, 'yyyy-MM-dd');
    let formattedEndDate = Utilities.formatDate(endDate, timezone, 'yyyy-MM-dd');

    settings.dateRange = `segments.date BETWEEN '${formattedStartDate}' AND '${formattedEndDate}'`;
    settings.analysisDateRange = `${formattedStartDate} - ${formattedEndDate}`;

    return settings; // Return the updated settings
}

function validateAndGetSpreadsheet(spreadsheetUrl, templateUrl) {
    try {
        let ss;
        if (!spreadsheetUrl || spreadsheetUrl === '') {
            // Create a new spreadsheet from the template
            let templateSS = SpreadsheetApp.openByUrl(templateUrl);
            ss = templateSS.copy('Negative Keyword Analysis - MikeRhodes.com.au © 2024');
            Logger.log(`New spreadsheet created from template (copy this into your script before next run): \n${ss.getUrl()}`);

            // Attempt to set sharing permissions only for new spreadsheets
            try {
                let file = DriveApp.getFileById(ss.getId());
                file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
                Logger.log("Sharing set to ANYONE_WITH_LINK");
            } catch (sharingError) {
                Logger.log("ANYONE_WITH_LINK failed, trying DOMAIN_WITH_LINK");

                try {
                    let file = DriveApp.getFileById(ss.getId());
                    file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.EDIT);
                    Logger.log("Sharing set to DOMAIN_WITH_LINK");
                } catch (domainSharingError) {
                    Logger.log("DOMAIN_WITH_LINK failed, sharing permissions could not be set automatically");
                }
            }
        } else {
            // Open existing spreadsheet without modifying permissions
            ss = SpreadsheetApp.openByUrl(spreadsheetUrl);
            // Logger.log(`Existing spreadsheet used`);
        }

        return ss;
    } catch (error) {
        Logger.log(`Error in validateAndGetSpreadsheet function: ${error.message}`);
        throw error; // Re-throw the error to be handled by the calling function
    }
}

function configSheet(spreadsheet, settings, start) {
    // Combine all CONFIG properties into settings
    Object.assign(settings, CONFIG);

    let accountName = AdsApp.currentAccount().getName();
    settings.clientCode = accountName;
    settings.start = start;

    const namedRanges = spreadsheet.getNamedRanges();
    const getValue = (key, defaultValue) => {
        const range = namedRanges.find(r => r.getName() === key);
        return range ? range.getRange().getValue() || defaultValue : defaultValue;
    };

    // Process limits and bucket settings
    ['limits', 'bucket'].forEach(section => {
        Object.keys(settings[section]).forEach(key => {
            settings[section][key] = getValue(key, settings[section][key]);
        });
    });

    // Process other settings
    const extraSettings = [
        'sheetVersion', 'numberOfDays', 'showOutput', 'showNgramOutput', 'runAI', 'useCPA', 'useAllConv',
        'ngramLength', 'campFilter', 'excludeFilter', 'aiMax', 'llm', 'model', 'openaiApi',
        'anthropicApi', 'prompt', 'aiDataSheet'
    ];

    extraSettings.forEach(key => {
        settings[key] = getValue(key, settings[key]);
    });

    // Check if MCC API keys are present and set corresponding settings
    if (CONFIG.mccApiKey && CONFIG.mccApiKey !== '') {
        settings.openaiApi = CONFIG.mccApiKey;
    }
    if (CONFIG.mccAnthApiKey && CONFIG.mccAnthApiKey !== '') {
        settings.anthropicApi = CONFIG.mccAnthApiKey;
    }

    settings.analysisData = {
        conflictingNegatives: [],
        redundantNegatives: [],
        ngramData: {
            searchTerms: [],
            keywords: []
        },
        accountSummary: [],
        campaigns: [],
        poorPerformers: [],
        highCPCData: []
    };
    return settings;
}

function normalizeKeyword(text, matchType, status) {
    let raw = text.toLowerCase().replace(/\s+/g, ' ').trim();

    if (matchType === 'PHRASE') {
        raw = raw.replace(/^"/, '').replace(/"$/, '');
    } else if (matchType === 'EXACT') {
        raw = raw.replace(/^\[/, '').replace(/\]$/, '');
    }

    return {
        text: raw,
        matchType: matchType,
        status: status
    };
}

function clearExistingFilters(sheet) {
    const maxRetries = 3;
    let retryDelay = 1000; // Start with 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const existingFilter = sheet.getFilter();
            if (existingFilter) {
                existingFilter.remove();
            }
            return; // Success, exit the function
        } catch (error) {
            if (attempt === maxRetries - 1) {
                Logger.log(`Failed to clear filters after ${maxRetries} attempts: ${error}`);
                throw error;
            }
            Logger.log(`Attempt ${attempt + 1} failed, retrying in ${retryDelay / 1000} seconds`);
            Utilities.sleep(retryDelay);
            retryDelay *= 2; // Exponential backoff
        }
    }
}

function createDataRow(level, entity, matchType, metrics) {
    const metricsRow = createMetricsRow(metrics);
    return [level, entity, matchType, ...metricsRow];
}

function createMetricsRow(metrics) {
    const impr = Number(metrics.impressions) || 0;
    const clicks = Number(metrics.clicks) || 0;
    const cost = Number(metrics.cost) || 0;
    const conv = Number(metrics.conversions) || 0;
    const value = Number(metrics.conversionValue) || 0;

    const ctr = impr > 0 ? clicks / impr : 0;
    const cvr = clicks > 0 ? conv / clicks : 0;
    const cpa = conv > 0 ? cost / conv : 0;
    const aov = conv > 0 ? value / conv : 0;
    const roas = cost > 0 ? value / cost : 0;

    return [impr, clicks, cost, conv, value, ctr, cvr, cpa, aov, roas];
}

function markTopPerformers(accountData, settings) {
    Object.values(accountData.campaigns).forEach(campaign => {
        if (campaign.channelType === 'SEARCH') {
            Object.values(campaign.adGroups).forEach(adGroup => {
                if (adGroup.keywordMetrics && adGroup.keywordMetrics.impressions >= settings.limits.lowCtrImpressions) {
                    let sortedKeywords = adGroup.keywords.sort((a, b) => b.metrics.impressions - a.metrics.impressions);
                    let cumulativeImpressions = 0;
                    const threshold = adGroup.keywordMetrics.impressions * (settings.limits.topPercent / 100);

                    for (let keyword of sortedKeywords) {
                        cumulativeImpressions += keyword.metrics.impressions;
                        keyword.isTopPerformer = true;
                        if (cumulativeImpressions > threshold) {
                            break;
                        }
                    }
                }
            });
        }
    });
}

function sortCampaignsByCost(accountData) {
    return Object.values(accountData.campaigns)
        .sort((a, b) => b.metrics.cost - a.metrics.cost)
        .map(campaign => campaign.name);
}

function setCampAndDate(spreadsheet, accountData, settings) {
    try {
        let highestCostCamp = Object.values(accountData.campaigns)
            .filter(c => c.channelType === 'SEARCH' && c.metrics.impressions > 0)
            .sort((a, b) => b.metrics.cost - a.metrics.cost)[0]?.name || '';
        spreadsheet.getRangeByName('campChoice').setValue(highestCostCamp);
    } catch (error) {
        Logger.log(`Error setting highest cost campaign: ${error.message}`);
        // Optionally, set a default value or leave the current value unchanged
    }

    // Set data range on Account Level tab
    spreadsheet.getRangeByName('dateRange').setValue(`Last ${settings.numberOfDays} days`);
}

function log(ss, s) {
    let duration = ((new Date() - s.start) / 1000).toFixed(0);
    Logger.log(`Finished script for ${s.clientCode}. Total execution time: ${duration}s.`);
    let newRow = [new Date(), duration, s.clientCode, s.scriptVersion, s.sheetVersion,
    s.numberOfDays, s.ngramLength, s.campFilter, s.excludeFilter, s.showOutput, s.showNgramOutput,
    s.useCPA, s.runAI, s.aiMax, s.llm, s.model, s.cost
    ];
    let logUrl = ss.getRangeByName('u').getValue();
    [SpreadsheetApp.openByUrl(logUrl), ss].forEach(sheet => sheet.getSheetByName('log').appendRow(newRow));
}

//#endregion

//#region AI call & response -----------------------------------------------------------
function mainAI(spreadsheet, settings) {
    Logger.log('Generating output with AI');
    try {
        settings = initializeModel(settings);
        settings = generateTextLLM(settings);

    } catch (error) {
        Logger.log(`An error occurred in AI section: ${error}`);
        settings.output = error.toString();
        settings.cost = 0;
    }
    spreadsheet.getRangeByName('aiOutput').setValue(settings.output);
    spreadsheet.getRangeByName('aiCost').setValue(settings.cost);
    Logger.log('Data written to named ranges in AI Output sheet. Cost was $' + settings.cost);
    return settings;
}

function initializeModel(settings) {
    Logger.log('Initializing language model.');
    if (settings.llm === 'openai') {
        if (!settings.openaiApi) {
            console.error('Please enter your OpenAI API key in the Settings tab.');
            throw new Error('Error: OpenAI API key not found.');
        }
        settings.endpoint = 'https://api.openai.com/v1/chat/completions';
        settings.headers = {
            "Authorization": `Bearer ${settings.openaiApi}`,
            "Content-Type": "application/json"
        };
        settings.model = settings.model === 'better' ? 'gpt-4o-2024-08-06' : 'gpt-4o-mini';
    } else if (settings.llm === 'anthropic') {
        if (!settings.anthropicApi) {
            console.error('Please enter your Anthropic API key in the Settings tab.');
            throw new Error('Error: Anthropic API key not found.');
        }
        settings.endpoint = 'https://api.anthropic.com/v1/messages';
        settings.headers = {
            "x-api-key": settings.anthropicApi,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        };
        settings.model = settings.model === 'better' ? 'claude-3-5-sonnet-20240620' : 'claude-3-haiku-20240307';
    } else {
        console.error('Invalid model indicator. Please choose between "openai" and "anthropic".');
        throw new Error('Error: Invalid model indicator provided.');
    }
    return settings;
}

function generateTextLLM(settings) {
    let mes = [{
        "role": "user",
        "content": settings.prompt + settings.data
    }];
    let payload = {
        "model": settings.model,
        "messages": mes,
        ...(settings.model.includes('claude') && {
            "max_tokens": 4000
        }) // Add max_tokens for Claude models
    };
    let httpOptions = {
        "method": "POST",
        "muteHttpExceptions": true,
        "contentType": "application/json",
        "headers": settings.headers,
        'payload': JSON.stringify(payload)
    };
    let r = UrlFetchApp.fetch(settings.endpoint, httpOptions);
    let rCode = r.getResponseCode();
    let rText = r.getContentText();
    let start = Date.now();
    while (r.getResponseCode() !== 200 && Date.now() - start < 5000) {
        Utilities.sleep(1000);
        r = UrlFetchApp.fetch(settings.endpoint, httpOptions);
        Logger.log('Time elapsed: ' + (Date.now() - start) / 1000 + ' seconds');
    }

    if (rCode !== 200) {
        Logger.log(`Error: API request failed with status ${rCode}.`);
        Logger.log(`Read about error codes: https://help.openai.com/en/articles/6891839-api-error-codes`)
        try {
            let errorResponse = JSON.parse(rText);
            Logger.log(`Error details: ${JSON.stringify(errorResponse)}`);
            settings.output = `Error: ${errorResponse.error?.message || 'Unknown error'}`;
            settings.cost = 0;
        } catch (e) {
            Logger.log('Error parsing API error response.');
            settings.output = 'Error: Failed to parse the API error response.';
            settings.cost = 0;
        }
        return settings;
    }

    let rJson = JSON.parse(r.getContentText());
    if (settings.endpoint.includes('openai.com')) {
        settings.inputTokens = rJson.usage.prompt_tokens;
        settings.outputTokens = rJson.usage.completion_tokens;
        settings.output = rJson.choices[0].message.content;
    } else if (settings.endpoint.includes('anthropic.com')) {
        settings.inputTokens = rJson.usage.input_tokens;
        settings.outputTokens = rJson.usage.output_tokens;
        settings.output = rJson.content[0].text;
    }
    settings = calculateCost(settings);

    return settings;
}

function calculateCost(settings) {
    const PRICING = {
        'gpt-4o-mini': {
            inputCostPerMToken: 0.15,
            outputCostPerMToken: 0.6
        },
        'gpt-4o-2024-08-06': {
            inputCostPerMToken: 2.5,
            outputCostPerMToken: 10
        },
        'claude-3-5-sonnet-20240620': {
            inputCostPerMToken: 3,
            outputCostPerMToken: 15
        },
        'claude-3-haiku-20240307': {
            inputCostPerMToken: 0.25,
            outputCostPerMToken: 1.25
        },
    }

    // Directly access pricing for the model
    let modelPricing = PRICING[settings.model] || {
        inputCostPerMToken: 1,
        outputCostPerMToken: 10
    };
    if (!PRICING[settings.model]) {
        Logger.log(`Default pricing of $1/m input and $10/m output used as no pricing found for model: ${settings.model}`);
    }

    let inputCost = settings.inputTokens * (modelPricing.inputCostPerMToken / 1e6);
    let outputCost = settings.outputTokens * (modelPricing.outputCostPerMToken / 1e6);
    settings.cost = parseFloat((inputCost + outputCost).toFixed(2));

    return settings;
}

function formatMetric(metricType, value) {
    if (typeof value === 'string' && !isNaN(value)) {
        value = parseFloat(value);
    }
    if (typeof value !== 'number') return value;

    switch (metricType) {
        case 'impressions':
        case 'clicks':
        case 'cost':
        case 'convValue':
        case 'aov':
            return Math.round(value);
        case 'conversions':
            return value.toFixed(1);
        case 'ctr':
        case 'cvr':
            return (value * 100).toFixed(1) + '%';
        case 'cpa':
            return value.toFixed(2);
        case 'roas':
            return value.toFixed(1);
        default:
            return value;
    }
}

function formatRow(row, metricTypes) {
    return row.map((cell, index) => formatMetric(metricTypes[index], cell));
}

function writeSection(sheet, startRow, title, data) {
    sheet.getRange(startRow, 1).setValue("<" + title + ">");
    startRow++;

    if (!data || data.length === 0) {
        sheet.getRange(startRow, 1).setValue("No data available");
        startRow++;
    } else {
        const maxColumns = Math.max(...data.map(row => row.length));
        const paddedData = data.map(row => {
            while (row.length < maxColumns) {
                row.push('');
            }
            return row;
        });
        sheet.getRange(startRow, 1, paddedData.length, maxColumns).setValues(paddedData);
        startRow += paddedData.length;
    }

    sheet.getRange(startRow, 1).setValue("</" + title + ">");
    return startRow + 2;
}

function safeMap(data, formatter) {
    return Array.isArray(data) ? data.map(formatter) : [
        ['No data available']
    ];
}

function aiData(spreadsheet, sheetName, settings) {

    const sections = [{
        title: "AccountSummary",
        data: settings.analysisData.accountSummary,
        metrics: [
            'accountType', 'totalCampaigns', 'totalAdGroups', 'enabledAdGroups', 'totalKWs', 'enabledKWs', 'negLists', 'totalNegs',
            'impressions', 'clicks', 'cost', 'conversions', 'convValue', 'ctr', 'cvr', 'cpa', 'aov', 'roas'
        ]
    }, {
        title: "AllCampaigns",
        data: settings.analysisData.campaigns,
        metrics: [
            'campaign', 'status', 'channel', 'adGroups', 'enabledAdGroups', 'totalKWs', 'enabledKWs',
            'negLists', 'campNegs', 'agNegs', 'totalNegs', 'impressions', 'clicks',
            'cost', 'conversions', 'convValue', 'ctr', 'cvr', 'cpa', 'aov', 'roas'
        ]
    }, {
        title: "PoorPerformers",
        data: settings.analysisData.poorPerformers,
        metrics: [
            'type', 'campaign', 'adGroup', 'kwST', 'matchType', 'impressions', 'clicks',
            'cost', 'conversions', 'convValue', 'ctr', 'cpa', 'roas', 'reasons', 'details'
        ]
    }, {
        title: "NGramData (Search Terms)",
        data: settings.analysisData.ngramData.searchTerms,
        metrics: [
            'nGram', 'totalCount', 'filteredCount', 'impressions', 'clicks', 'cost', 'conversions', 'convValue',
            'ctr', 'cvr', 'cpa', 'aov', 'roas', 'bucket', 'campaign', 'ngramLength'
        ]
    }, {
        title: "NGramData (Keywords)",
        data: settings.analysisData.ngramData.keywords,
        metrics: [
            'nGram', 'totalCount', 'filteredCount', 'impressions', 'clicks', 'cost', 'conversions', 'convValue',
            'ctr', 'cvr', 'cpa', 'aov', 'roas', 'bucket', 'campaign', 'ngramLength'
        ]
    }, {
        title: "HighCPC",
        data: settings.analysisData.highCPCData,
        metrics: [
            'campaignName', 'keyword', 'matchType', 'cpc', 'campAvgCPC', 'multiple', 'type', 'clicks', 'cost'
        ]
    }, {
        title: "ConflictingNegatives",
        data: settings.analysisData.conflictingNegatives,
        metrics: [
            'negative', 'matchType', 'level', 'campaignName', 'adGroupName', 'listName', 'blockedPositives'
        ]
    }];

    // Add RedundantNegatives section only if not disabled
    if (!TURN_OFF_REDUNDANT_NEGS) {
        sections.push({
            title: "RedundantNegatives",
            data: settings.analysisData.redundantNegatives,
            metrics: [
                'identifier', 'negative1.text', 'negative1.matchType', 'negative1.level', 'negative2.text', 'negative2.matchType', 'negative2.level'
            ]
        });
    }

    sections.forEach(section => {
        section.data = safeMap(section.data, row => formatRow(row, section.metrics));
    });

    let outputString = sections.map(section =>
        `<${section.title}>\n` + JSON.stringify(section.data, null, 2) + `\n</${section.title}>\n\n`
    ).join('');

    let aiDataSheet = spreadsheet.getSheetByName(sheetName);
    aiDataSheet ? aiDataSheet.clear() : aiDataSheet = spreadsheet.insertSheet(sheetName);

    aiDataSheet.getRange(1, 1, 1, 2).setValues([
        ["Date Range:", settings.analysisDateRange]
    ]);
    let currentRow = 3;

    sections.forEach(section => {
        currentRow = writeSection(aiDataSheet, currentRow, section.title, section.data);
    });

    return outputString;
}

//#endregion

// If you're still getting an error, copy the logs & paste them into a post at https://mikerhodes.circle.so/c/help/ 
// Now hit preview (or run) and let's get this party started

// PS you're awesome! Thanks for using this script.