// scripts/3-mcc-sheet.js
// --- CONFIGURATION ---

// 1. SPREADSHEET URL (Optional)
//    - Leave blank ('') to create a new spreadsheet automatically.
//    - Or, paste the URL of an existing Google Sheet between the single quotes (e.g., 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit')
const SHEET_URL = '';

// 2. TIME PERIOD
//    - Choose 'LAST_7_DAYS' or 'LAST_30_DAYS'.
const SELECTED_TIME_PERIOD = 'LAST_7_DAYS'; // Options: 'LAST_7_DAYS', 'LAST_30_DAYS'

// 3. SHEET NAMES
const ALL_SHEET_NAME = 'All Accounts';
const SETTINGS_SHEET_NAME = 'Settings';

// --- END OF CONFIGURATION ---

function main() {
    const accountType = typeof MccApp !== 'undefined' ? 'MCC' : 'Single';
    Logger.log(`Account type: ${accountType}`);
    Logger.log(`Starting script for time period: ${SELECTED_TIME_PERIOD}`);

    if (accountType === 'MCC') {
        executeMccLogic();
    } else {
        executeSingleAccountLogic();
    }

    Logger.log('Script finished.');
}

function getOrCreateSpreadsheet() {
    if (SHEET_URL) {
        Logger.log(`Using existing spreadsheet: ${SHEET_URL}`);
        return SpreadsheetApp.openByUrl(SHEET_URL);
    } else {
        const spreadsheetName = `MCC Master Sheet - ${Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd")}`;
        Logger.log(`Creating new spreadsheet: ${spreadsheetName}`);
        const newSpreadsheet = SpreadsheetApp.create(spreadsheetName);
        Logger.log(`New spreadsheet created: ${newSpreadsheet.getUrl()}`);
        return newSpreadsheet;
    }
}

function executeMccLogic() {
    Logger.log('Executing MCC logic...');

    // Get or create the master spreadsheet
    const spreadsheet = getOrCreateSpreadsheet();

    // Get or create the settings sheet
    let settingsSheet = spreadsheet.getSheetByName(SETTINGS_SHEET_NAME);
    if (!settingsSheet) {
        settingsSheet = spreadsheet.insertSheet(SETTINGS_SHEET_NAME);
        setupSettingsSheet(settingsSheet);
    }

    // Get or create the all accounts sheet
    let allSheet = spreadsheet.getSheetByName(ALL_SHEET_NAME);
    if (!allSheet) {
        allSheet = spreadsheet.insertSheet(ALL_SHEET_NAME);
        setupAllSheet(allSheet);
    }

    // Check if all sheet is empty (first run)
    if (allSheet.getLastRow() <= 1) {
        Logger.log("First run detected - populating all accounts tab");
        populateAllTab(allSheet);
    }

    // Process accounts from settings sheet
    processAccounts(spreadsheet, settingsSheet);

    Logger.log(`MCC data written to: ${spreadsheet.getUrl()}`);
    if (!SHEET_URL) { // Only show alert if we created the sheet
        SpreadsheetApp.getUi().alert(`Script finished. New spreadsheet created: ${spreadsheet.getUrl()}`);
    }
}

function setupSettingsSheet(sheet) {
    const headers = ["Account ID (CID)", "Account Name", "Account URL", "Last Run", "Status"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);
}

function setupAllSheet(sheet) {
    const headers = ["Account ID (CID)", "Account Name", "Last 30-Day Spend", "Status"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

    Logger.log("All accounts sheet created");
}

function populateAllTab(allSheet) {
    Logger.log("Populating all accounts tab with MCC account data...");

    const accountIterator = AdsManagerApp.accounts().get();
    const accountsData = [];

    while (accountIterator.hasNext()) {
        const account = accountIterator.next();
        AdsManagerApp.select(account);

        const accountName = account.getName() || "N/A";
        const accountId = account.getCustomerId();

        // Get spend for the account
        const spend = getAccountSpend(SELECTED_TIME_PERIOD);

        // uncomment if you want to see the list of accounts in logs
        // Logger.log(`Account: ${accountName} (${accountId}) - Spend: ${spend}`);

        accountsData.push([
            accountId,
            accountName,
            spend.toFixed(2),
            "Active"
        ]);
    }

    // Sort accounts by spend (descending)
    accountsData.sort((a, b) => parseFloat(b[2]) - parseFloat(a[2]));

    // Write data to sheet
    if (accountsData.length > 0) {
        allSheet.getRange(2, 1, accountsData.length, accountsData[0].length).setValues(accountsData);
        Logger.log(`Populated all tab with ${accountsData.length} accounts`);
    }
}

function getAccountSpend(timePeriod) {
    const query = `
    SELECT
      metrics.cost_micros
    FROM customer
    WHERE segments.date DURING ${timePeriod}
  `;

    try {
        const report = AdsApp.report(query);
        const rows = report.rows();
        let totalSpend = 0;

        while (rows.hasNext()) {
            const row = rows.next();
            totalSpend += parseFloat(row["metrics.cost_micros"]) / 1000000; // Convert micros to currency
        }

        return totalSpend;
    } catch (e) {
        Logger.log(`Error getting spend: ${e.message}`);
        return 0;
    }
}

function processAccounts(spreadsheet, settingsSheet) {
    Logger.log("Processing accounts from settings sheet...");

    const lastRow = settingsSheet.getLastRow();
    if (lastRow <= 1) {
        Logger.log("No accounts found in settings sheet");
        return;
    }

    // Get account data from settings sheet
    const accountData = settingsSheet.getRange(2, 1, lastRow - 1, 3).getValues(); // CID, Name, URL

    for (let i = 0; i < accountData.length; i++) {
        const [accountId, accountName, accountUrl] = accountData[i];

        if (!accountId || !accountName) {
            Logger.log(`Skipping row ${i + 2}: missing CID or account name`);
            continue;
        }

        Logger.log(`Processing account: ${accountName} (${accountId})`);

        try {
            // Execute single account logic and get the new spreadsheet URL
            const newSpreadsheetUrl = executeSingleAccountLogicForMcc(spreadsheet, accountId, accountName, accountUrl);

            // Update the account URL in column C
            settingsSheet.getRange(i + 2, 3).setValue(newSpreadsheetUrl);

            // Update last run timestamp
            const now = new Date();
            settingsSheet.getRange(i + 2, 4).setValue(now);
            settingsSheet.getRange(i + 2, 5).setValue("Completed");

        } catch (e) {
            Logger.log(`Error processing account ${accountName} (${accountId}): ${e.message}`);
            settingsSheet.getRange(i + 2, 5).setValue(`Error: ${e.message}`);
        }
    }
}

function executeSingleAccountLogic() {
    Logger.log('Executing single account logic...');
    
    // Get current account info
    const currentAccount = AdsApp.currentAccount();
    const accountId = currentAccount.getCustomerId();
    const accountName = currentAccount.getName() || accountId;
    
    Logger.log(`Processing single account: ${accountName} (${accountId})`);
    
    // Create or get spreadsheet for single account
    const spreadsheet = getOrCreateSingleAccountSpreadsheet(accountName, accountId);
    
    // Get conversion data and populate sheet
    const conversionData = getConversionDataForAccount(accountId, accountName);
    const dataSheet = spreadsheet.getSheets()[0];
    
    if (conversionData.length > 0) {
        dataSheet.getRange(2, 1, conversionData.length, conversionData[0].length).setValues(conversionData);
        Logger.log(`Added ${conversionData.length} conversion records to spreadsheet`);
    } else {
        dataSheet.appendRow(["No conversion data found for this period", "", ""]);
        Logger.log('No conversion data found for this account');
    }
    
    Logger.log(`Single account data written to: ${spreadsheet.getUrl()}`);
    if (!SHEET_URL) {
        SpreadsheetApp.getUi().alert(`Script finished. Spreadsheet URL: ${spreadsheet.getUrl()}`);
    }
}

function getOrCreateSingleAccountSpreadsheet(accountName, accountId) {
    if (SHEET_URL) {
        Logger.log(`Using existing spreadsheet: ${SHEET_URL}`);
        const spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);
        
        // Setup the sheet with headers if needed
        const sheet = spreadsheet.getSheets()[0];
        if (sheet.getLastRow() === 0) {
            setupAccountSheet(sheet);
        }
        
        return spreadsheet;
    } else {
        // Create a new spreadsheet for this single account
        const sheetName = getSheetName(accountName, accountId);
        const spreadsheetName = `${sheetName} - Conversion Report - ${Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd")}`;
        Logger.log(`Creating new spreadsheet: ${spreadsheetName}`);
        
        const newSpreadsheet = SpreadsheetApp.create(spreadsheetName);
        
        // Setup the first sheet
        const defaultSheet = newSpreadsheet.getSheets()[0];
        defaultSheet.setName('Conversion Data');
        setupAccountSheet(defaultSheet);
        
        Logger.log(`Created new spreadsheet: ${newSpreadsheet.getUrl()}`);
        return newSpreadsheet;
    }
}

function executeSingleAccountLogicForMcc(spreadsheet, accountId, accountName, accountUrl) {
    Logger.log(`Executing logic for MCC child account: ${accountName} (${accountId})`);

    // Check if account exists and is accessible
    if (!isValidAccountId(accountId)) {
        throw new Error(`Account ${accountId} not found or not accessible`);
    }

    // Select the account
    selectAccount(accountId);

    // Create a new spreadsheet for this account
    const sheetName = getSheetName(accountName, accountId);
    const accountSpreadsheet = createAccountSpreadsheet(sheetName, accountId, accountName);

    // Get conversion data and populate sheet
    const conversionData = getConversionDataForAccount(accountId, accountName);
    if (conversionData.length > 0) {
        const accountSheet = accountSpreadsheet.getSheets()[0]; // Get the first (and only) sheet
        accountSheet.getRange(2, 1, conversionData.length, conversionData[0].length).setValues(conversionData);
        Logger.log(`Created spreadsheet for ${accountName} with ${conversionData.length} conversion records`);
    } else {
        const accountSheet = accountSpreadsheet.getSheets()[0];
        accountSheet.appendRow(["No conversion data found for this period", "", ""]);
        Logger.log(`No conversion data found for ${accountName}`);
    }

    // Return the URL of the created spreadsheet
    return accountSpreadsheet.getUrl();
}

function getSheetName(accountName, accountId) {
    // Use account name if it's short enough, otherwise use CID
    if (accountName && accountName.length <= 30) {
        return accountName;
    }
    return accountId;
}

function setupAccountSheet(sheet) {
    const headers = ["Date", "Conversion Action Name", "Conversions"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
}

function getConversionDataForAccount(accountId, accountName) {
    const timePeriodCondition = SELECTED_TIME_PERIOD;

    const query = `
    SELECT
      segments.date,
      conversion_action.name,
      metrics.all_conversions
    FROM conversion_action
    WHERE segments.date DURING ${timePeriodCondition}
      AND metrics.all_conversions > 0
    ORDER BY segments.date DESC, conversion_action.name ASC
  `;

    const report = AdsApp.report(query);
    const rows = report.rows();
    const accountData = [];

    while (rows.hasNext()) {
        const row = rows.next();
        const date = row["segments.date"];
        const conversionActionName = row["conversion_action.name"];
        const conversions = parseFloat(row["metrics.all_conversions"]);

        accountData.push([
            date,
            conversionActionName,
            conversions
        ]);
    }

    if (accountData.length === 0) {
        Logger.log(`  No conversion data found for ${accountName} (${accountId}) in the period.`);
    }

    return accountData;
}

function isValidAccountId(accountId) {
    try {
        const accountIterator = AdsManagerApp.accounts().withIds([accountId]).get();
        return accountIterator.hasNext();
    } catch (e) {
        Logger.log(`Error validating account ID ${accountId}: ${e.message}`);
        return false;
    }
}

function createAccountSpreadsheet(sheetName, accountId, accountName) {
    // Create a new spreadsheet for this account
    const spreadsheetName = `${sheetName} - Conversion Report - ${Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd")}`;
    Logger.log(`Creating new spreadsheet: ${spreadsheetName}`);

    const newSpreadsheet = SpreadsheetApp.create(spreadsheetName);

    // Get the default sheet and rename it
    const defaultSheet = newSpreadsheet.getSheets()[0];
    defaultSheet.setName('Conversion Data');

    // Setup the sheet with headers
    setupAccountSheet(defaultSheet);

    Logger.log(`Created new spreadsheet for ${accountName}: ${newSpreadsheet.getUrl()}`);
    return newSpreadsheet;
}

function selectAccount(accountId) {
    const accountIterator = AdsManagerApp.accounts().withIds([accountId]).get();
    if (accountIterator.hasNext()) {
        const account = accountIterator.next();
        AdsManagerApp.select(account);
        Logger.log(`Selected account: ${account.getName()} (${accountId})`);
    } else {
        throw new Error(`Could not select account ${accountId}`);
    }
}