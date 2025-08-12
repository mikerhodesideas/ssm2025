# Master Scripts - Scripts & Sheets Mastery 2025

This file contains all the Google Ads Scripts and Google Apps Scripts from the Scripts & Sheets Mastery 2025 course by Mike Rhodes Ideas.

---

## MCC Account Management Scripts

### 1. Basic MCC Conversion Export (`1-mcc-simple.js`)

**Purpose:** Basic conversion data export across all accounts in an MCC

**File:** `scripts/mcc/1-mcc-simple.js`

```javascript
// scripts/mcc/1-mcc-simple.js
// --- CONFIGURATION ---

// 1. SPREADSHEET URL (Optional)
//    - Leave blank ('') to create a new spreadsheet automatically.
//    - Or, paste the URL of an existing Google Sheet between the single quotes (e.g., 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit')
const SHEET_URL = '';

// 2. TEST CIDS (Optional)
//    - To run for specific accounts for testing, enter their Customer IDs as a comma-separated list (e.g., "639-644-4327, 968-809-7277").
//    - Leave blank ('') to run for all accounts under the MCC.
const CID_FOR_TESTING = ''; // Example: '123-456-7890, 987-654-3210' or ''

// 3. TIME PERIOD
//    - Choose 'LAST_7_DAYS' or 'LAST_30_DAYS'.
const SELECTED_TIME_PERIOD = 'LAST_7_DAYS'; // Options: 'LAST_7_DAYS', 'LAST_30_DAYS'

// 4. SHEET NAME (Name of the tab within the spreadsheet)
const SHEET_NAME = 'DailyConversionData';

// --- END OF CONFIGURATION ---

// ===========================
// MAIN ENTRY POINT
// ===========================

function main() {
  const accountType = typeof MccApp !== 'undefined' ? 'MCC' : 'Single';
  Logger.log(`Account type: ${accountType}`);
  Logger.log(`Starting script for time period: ${SELECTED_TIME_PERIOD}`);
  
  if (accountType === 'Single') {
    executeSingleAccountLogic();
  } else {
    executeMccLogic();
  }
}

// ===========================
// MCC LOGIC
// ===========================

function executeMccLogic() {
  // Log run mode
  if (CID_FOR_TESTING) {
    const cidList = CID_FOR_TESTING.split(',').map(cid => cid.trim()).filter(cid => cid.length > 0);
    Logger.log(`Running in test mode for CIDs: ${cidList.join(', ')}`);
  } else {
    Logger.log("Running for all accounts in the MCC.");
  }

  // Setup spreadsheet and sheet
  const spreadsheet = getOrCreateSpreadsheet('MCC');
  const sheet = setupSheet(spreadsheet, SHEET_NAME);
  
  // Get account iterator
  const accountIterator = getAccountIterator();
  if (!accountIterator) return;
  
  // Process all accounts
  const dataRows = processAllAccounts(accountIterator);
  
  // Write results to sheet
  writeDataToSheet(sheet, dataRows);
  
  // Final logging
  logCompletion(spreadsheet, 'MCC');
}

function getAccountIterator() {
  if (CID_FOR_TESTING) {
    const cidList = CID_FOR_TESTING.split(',').map(cid => cid.trim()).filter(cid => cid.length > 0);
    const accountIterator = AdsManagerApp.accounts().withIds(cidList).get();
    
    if (!accountIterator.hasNext()) {
      Logger.log(`Error: Test CIDs ${cidList.join(', ')} not found or not accessible.`);
      return null;
    }
    return accountIterator;
  } else {
    return AdsManagerApp.accounts().get();
  }
}

function processAllAccounts(accountIterator) {
  const dataRows = [];
  
  while (accountIterator.hasNext()) {
    const account = accountIterator.next();
    AdsManagerApp.select(account);

    let accountName = account.getName() || "N/A (Account Name Missing)";
    let accountId = account.getCustomerId();
    accountName = "dummy name for filming";

    Logger.log(`Processing account: ${accountName} (${accountId})`);

    try {
      const reportData = getConversionDataForAccount(accountId, accountName);
      reportData.forEach(row => dataRows.push(row));
    } catch (e) {
      Logger.log(`  Error processing account ${accountName} (${accountId}): ${e.message}. Skipping.`);
      dataRows.push([accountName, accountId, "ERROR", e.message, "N/A"]);
    }
  }
  
  return dataRows;
}

// ===========================
// SINGLE ACCOUNT LOGIC
// ===========================

function executeSingleAccountLogic() {
  Logger.log('Executing single account logic...');
  
  // Get current account info
  const currentAccount = AdsApp.currentAccount();
  const accountId = currentAccount.getCustomerId();
  const accountName = currentAccount.getName() || accountId;
  
  Logger.log(`Processing single account: ${accountName} (${accountId})`);
  
  // Setup spreadsheet and sheet
  const spreadsheet = getOrCreateSpreadsheet('Single', accountName);
  const sheet = setupSheet(spreadsheet, SHEET_NAME);
  
  // Get conversion data
  const dataRows = getConversionDataForAccount(accountId, accountName);
  
  // Write results to sheet
  writeDataToSheet(sheet, dataRows);
  
  // Resize columns for better readability
  sheet.autoResizeColumns(1, 5);
  
  // Final logging
  logCompletion(spreadsheet, 'Single');
}

// ===========================
// SHARED HELPER FUNCTIONS
// ===========================

function setupSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  } else {
    sheet.clearContents();
  }
  
  // Add headers
  const headers = ["Account Name", "Account ID (CID)", "Date", "Conversion Action Name", "All Conversions"];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  
  return sheet;
}

function writeDataToSheet(sheet, dataRows) {
  if (dataRows.length > 0) {
    sheet.getRange(2, 1, dataRows.length, dataRows[0].length).setValues(dataRows);
    Logger.log(`${dataRows.length} rows of data written to sheet: ${SHEET_NAME}`);
  } else {
    Logger.log("No conversion data found for the specified period.");
    sheet.appendRow(["No conversion data found for this period", "", "", "", ""]);
  }
}

function logCompletion(spreadsheet, accountType) {
  const url = spreadsheet.getUrl();
  Logger.log(`Script finished. Data written to: ${url}`);
  
  if (!SHEET_URL) {
    const message = accountType === 'MCC' 
      ? `Script finished. New spreadsheet created: ${url}`
      : `Script finished. Spreadsheet URL: ${url}`;
    Logger.log(message);
  }
}

// ===========================
// DATA RETRIEVAL FUNCTIONS
// ===========================

function getConversionDataForAccount(accountId, accountName) {
  const query = `
    SELECT
      segments.date,
      conversion_action.name,
      metrics.all_conversions
    FROM conversion_action
    WHERE segments.date DURING ${SELECTED_TIME_PERIOD}
      AND metrics.all_conversions > 0
    ORDER BY segments.date DESC, conversion_action.name ASC
  `;

  const report = AdsApp.report(query);
  const rows = report.rows();
  const accountData = [];

  while (rows.hasNext()) {
    const row = rows.next();
    accountData.push([
      accountName,
      accountId,
      row["segments.date"],
      row["conversion_action.name"],
      parseFloat(row["metrics.all_conversions"])
    ]);
  }
  
  if (accountData.length === 0) {
    Logger.log(`  No conversion data found for ${accountName} (${accountId}) in the period.`);
  }
  
  return accountData;
}

// ===========================
// SPREADSHEET FUNCTIONS
// ===========================

function getOrCreateSpreadsheet(mode, accountName = '') {
  try {
    if (SHEET_URL) {
      Logger.log(`Using existing spreadsheet: ${SHEET_URL}`);
      return SpreadsheetApp.openByUrl(SHEET_URL);
    } else {
      const dateStr = Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd");
      const spreadsheetName = mode === 'MCC' 
        ? `MCC Conversion Report - ${dateStr}`
        : `${accountName} - Conversion Report - ${dateStr}`;
      
      Logger.log(`Creating new spreadsheet: ${spreadsheetName}`);
      const newSpreadsheet = SpreadsheetApp.create(spreadsheetName);
      Logger.log(`New spreadsheet created: ${newSpreadsheet.getUrl()}`);
      return newSpreadsheet;
    }
  } catch (e) {
    Logger.log(`Error accessing or creating spreadsheet: ${e}. Ensure URL is correct or you have permissions.`);
    throw new Error(`Spreadsheet Error: ${e.message}. Check SHEET_URL or permissions.`);
  }
}
```

---

### 2. Multi-Tab MCC Reporting (`2-mcc-multi-tab.js`)

**Purpose:** Creates separate tabs for each account in a master sheet

**File:** `scripts/mcc/2-mcc-multi-tab.js`

```javascript
// scripts/2-mcc-multi-tab.js
// --- CONFIGURATION ---

// 1. SPREADSHEET URL (Optional)
//    - Leave blank ('') to create a new spreadsheet automatically.
//    - Or, paste the URL of an existing Google Sheet (e.g., 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit')
const SHEET_URL = '';

// 2. TEST CIDs (Optional)
//    - To run for specific accounts for testing, enter their Customer IDs as a comma-separated list (e.g., '639-644-4327, 968-809-7277').
//    - Leave blank ('') to run for all accounts under the MCC.
const CID_FOR_TESTING = '639-644-4327, 968-809-7277'; // Example: '123-456-7890, 987-654-3210' or ''

// 3. TIME PERIOD
//    - Choose 'LAST_7_DAYS' or 'LAST_30_DAYS'.
const SELECTED_TIME_PERIOD = 'LAST_7_DAYS'; // Options: 'LAST_7_DAYS', 'LAST_30_DAYS'

// 4. SPENDING THRESHOLD
//    - Only include accounts with spend greater than this amount during the selected period.
//    - Set to 0 to include all accounts.
const thresholdSpend = 0; // Example: 100 for $100 minimum spend

// 5. TAB NAMING
//    - true: Use account name for tab names (can be long)
//    - false: Use CID for tab names (shorter, fits more tabs on screen)
const useAccountName = false; // Default: false (use CID)

// --- END OF CONFIGURATION ---

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
      totalSpend += parseFloat(row['metrics.cost_micros']) / 1000000; // Convert micros to currency
    }

    return totalSpend;
  } catch (e) {
    Logger.log(`Error getting spend: ${e.message}`);
    return 0;
  }
}

function main() {
  Logger.log(`Starting script for time period: ${SELECTED_TIME_PERIOD}`);
  Logger.log(`Spending threshold: ${thresholdSpend}`);
  Logger.log(`Tab naming: ${useAccountName ? 'Account Name' : 'CID'}`);

  if (CID_FOR_TESTING) {
    const cidList = CID_FOR_TESTING.split(',').map(cid => cid.trim()).filter(cid => cid.length > 0);
    Logger.log(`Running in test mode for CIDs: ${cidList.join(', ')}`);
  } else {
    Logger.log('Running for all accounts in the MCC.');
  }

  const spreadsheet = getSpreadsheet();

  // Clear all existing sheets except the first one
  const sheets = spreadsheet.getSheets();
  for (let i = sheets.length - 1; i > 0; i--) {
    spreadsheet.deleteSheet(sheets[i]);
  }

  // Create or clear the Index tab
  let indexSheet = spreadsheet.getSheets()[0];
  indexSheet.setName('Index');
  indexSheet.clear();

  // Add headers to index sheet
  const indexHeaders = ['Account ID (CID)', 'Account Name', 'Spend', 'Link'];
  indexSheet.appendRow(indexHeaders);
  indexSheet.getRange(1, 1, 1, indexHeaders.length).setFontWeight('bold');

  const accountsData = []; // Store account info for index
  const qualifyingAccounts = []; // Accounts that meet spend threshold

  let accountIterator;
  if (CID_FOR_TESTING) {
    const cidList = CID_FOR_TESTING.split(',').map(cid => cid.trim()).filter(cid => cid.length > 0);
    accountIterator = AdsManagerApp.accounts().withIds(cidList).get();
    if (!accountIterator.hasNext()) {
      Logger.log(`Error: Test CIDs ${cidList.join(', ')} not found or not accessible.`);
      return;
    }
  } else {
    accountIterator = AdsManagerApp.accounts().get();
  }

  // First pass: collect accounts and their spend
  while (accountIterator.hasNext()) {
    const account = accountIterator.next();
    AdsManagerApp.select(account);

    const accountName = account.getName() || 'N/A';
    const accountId = account.getCustomerId();

    // Get spend for the account
    const spend = getAccountSpend(SELECTED_TIME_PERIOD);

    Logger.log(`Account: ${accountName} (${accountId}) - Spend: ${spend}`);

    if (spend > thresholdSpend) {
      qualifyingAccounts.push({
        accountId: accountId,
        accountName: accountName,
        spend: spend
      });
    }
  }

  // Sort accounts by spend (descending)
  qualifyingAccounts.sort((a, b) => b.spend - a.spend);

  // Process qualifying accounts and create tabs
  qualifyingAccounts.forEach((accountInfo, index) => {
    const { accountId, accountName, spend } = accountInfo;

    // Switch to account context
    const accountIterator = AdsManagerApp.accounts().withIds([accountId]).get();
    if (accountIterator.hasNext()) {
      const account = accountIterator.next();
      AdsManagerApp.select(account);

      // Determine tab name
      const tabName = useAccountName ?
        accountName.substring(0, 50) : // Limit name length for tabs
        accountId;

      // Create tab for this account
      const accountSheet = spreadsheet.insertSheet(tabName);

      // Add headers
      const headers = ['Date', 'Conversion Action Name', 'Conversions'];
      accountSheet.appendRow(headers);
      accountSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

      // Get conversion data
      try {
        const reportData = getConversionDataForAccount(accountId, accountName);
        if (reportData.length > 0) {
          // Remove account name and ID from each row since we have separate tabs
          const cleanedData = reportData.map(row => [row[2], row[3], row[4]]); // Date, Action, Conversions
          accountSheet.getRange(2, 1, cleanedData.length, cleanedData[0].length).setValues(cleanedData);
        } else {
          accountSheet.appendRow(['No conversion data found for this period', '', '']);
        }
      } catch (e) {
        Logger.log(`Error processing account ${accountName} (${accountId}): ${e.message}`);
        accountSheet.appendRow(['Error loading data', e.message, '']);
      }

      // Auto-resize columns to fit content
      accountSheet.autoResizeColumns(1, 3);

      // Delete any extra columns (keep only the 3 we need)
      const lastColumn = accountSheet.getMaxColumns();
      if (lastColumn > 3) {
        accountSheet.deleteColumns(4, lastColumn - 3);
      }

      // Add to index with hyperlink
      const sheetUrl = `#gid=${accountSheet.getSheetId()}`;
      accountsData.push([
        accountId,
        accountName,
        spend.toFixed(2),
        `=HYPERLINK('${sheetUrl}', 'Go to ${tabName}')`
      ]);
    }
  });

  // Write index data
  if (accountsData.length > 0) {
    indexSheet.getRange(2, 1, accountsData.length, accountsData[0].length).setValues(accountsData);
    Logger.log(`Created tabs for ${accountsData.length} accounts with spend > ${thresholdSpend}`);
  } else {
    indexSheet.appendRow(['No accounts found with spend > ' + thresholdSpend, '', '', '']);
  }

  // Format the index sheet
  indexSheet.autoResizeColumns(1, 4);

  Logger.log(`Script finished. Data written to: ${spreadsheet.getUrl()}`);
  Logger.log(`Created ${accountsData.length} account tabs with spend > ${thresholdSpend}`);
}

function getConversionDataForAccount(accountId, accountName) {
  const timePeriodCondition = SELECTED_TIME_PERIOD; // GAQL directly supports these date ranges

  const query = `
    SELECT
      segments.date,
      conversion_action.name,
      metrics.all_conversions
    FROM conversion_action
    WHERE segments.date DURING ${timePeriodCondition}
      AND metrics.all_conversions > 0  -- Only get actions that had conversions
    ORDER BY segments.date DESC, conversion_action.name ASC
  `;

  const report = AdsApp.report(query);
  const rows = report.rows();
  const accountData = [];

  while (rows.hasNext()) {
    const row = rows.next();
    const date = row['segments.date'];
    const conversionActionName = row['conversion_action.name'];
    const conversions = parseFloat(row['metrics.all_conversions']); // Use parseFloat for fractional conversions

    accountData.push([
      accountName,
      accountId,
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

function getSpreadsheet() {
  try {
    if (SHEET_URL) {
      Logger.log(`Using existing spreadsheet: ${SHEET_URL}`);
      return SpreadsheetApp.openByUrl(SHEET_URL);
    } else {
      const spreadsheetName = `MCC Conversion Report - ${Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd')}`;
      Logger.log(`Creating new spreadsheet: ${spreadsheetName}`);
      const newSpreadsheet = SpreadsheetApp.create(spreadsheetName);
      Logger.log(`New spreadsheet created: ${newSpreadsheet.getUrl()}`);
      return newSpreadsheet;
    }
  } catch (e) {
    Logger.log(`Error accessing or creating spreadsheet: ${e}. Ensure URL is correct or you have permissions if creating new.`);
    throw new Error(`Spreadsheet Error: ${e.message}. Check SHEET_URL or permissions.`);
  }
}
```

---

### 3. Advanced MCC Reporting (`3-mcc-sheet.js`)

**Purpose:** Advanced MCC reporting with account selection and individual spreadsheet creation

**File:** `scripts/mcc/3-mcc-sheet.js`

```javascript
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
        const spreadsheetName = `MCC Master Sheet - ${Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd')}`;
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
        Logger.log('First run detected - populating all accounts tab');
        populateAllTab(allSheet);
    }

    // Process accounts from settings sheet
    processAccounts(spreadsheet, settingsSheet);

    Logger.log(`MCC data written to: ${spreadsheet.getUrl()}`);
    if (!SHEET_URL) { // Only log if we created the sheet
        Logger.log(`Script finished. New spreadsheet created: ${spreadsheet.getUrl()}`);
    }
}

function setupSettingsSheet(sheet) {
    const headers = ['Account ID (CID)', 'Account Name', 'Account URL', 'Last Run', 'Status'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);
}

function setupAllSheet(sheet) {
    const headers = ['Account ID (CID)', 'Account Name', 'Last 30-Day Spend', 'Status'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

    Logger.log('All accounts sheet created');
}

function populateAllTab(allSheet) {
    Logger.log('Populating all accounts tab with MCC account data...');

    const accountIterator = AdsManagerApp.accounts().get();
    const accountsData = [];

    while (accountIterator.hasNext()) {
        const account = accountIterator.next();
        AdsManagerApp.select(account);

        const accountName = account.getName() || 'N/A';
        const accountId = account.getCustomerId();

        // Get spend for the account
        const spend = getAccountSpend(SELECTED_TIME_PERIOD);

        // uncomment if you want to see the list of accounts in logs
        // Logger.log(`Account: ${accountName} (${accountId}) - Spend: ${spend}`);

        accountsData.push([
            accountId,
            accountName,
            spend.toFixed(2),
            'Active'
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
            totalSpend += parseFloat(row['metrics.cost_micros']) / 1000000; // Convert micros to currency
        }

        return totalSpend;
    } catch (e) {
        Logger.log(`Error getting spend: ${e.message}`);
        return 0;
    }
}

function processAccounts(spreadsheet, settingsSheet) {
    Logger.log('Processing accounts from settings sheet...');

    const lastRow = settingsSheet.getLastRow();
    if (lastRow <= 1) {
        Logger.log('No accounts found in settings sheet');
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
            settingsSheet.getRange(i + 2, 5).setValue('Completed');

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
        dataSheet.appendRow(['No conversion data found for this period', '', '']);
        Logger.log('No conversion data found for this account');
    }

    Logger.log(`Single account data written to: ${spreadsheet.getUrl()}`);
    if (!SHEET_URL) {
        Logger.log(`Script finished. Spreadsheet URL: ${spreadsheet.getUrl()}`);
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
        const spreadsheetName = `${sheetName} - Conversion Report - ${Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd')}`;
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
        accountSheet.appendRow(['No conversion data found for this period', '', '']);
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
    const headers = ['Date', 'Conversion Action Name', 'Conversions'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
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
        const date = row['segments.date'];
        const conversionActionName = row['conversion_action.name'];
        const conversions = parseFloat(row['metrics.all_conversions']);

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
    const spreadsheetName = `${sheetName} - Conversion Report - ${Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd')}`;
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
```

---

## The 4 C's Framework Scripts

### 4. Check Script (`4cs-1-check.js`)

**Purpose:** Alerts when campaigns had zero impressions yesterday

**File:** `scripts/4cs/4cs-1-check.js`

```javascript

// script to alert if campaigns had zero impr yesterday. See 8020agent.com for more

const YOUR_EMAIL = '';   // enter your email address here between the single quotes

function main() {
  try {
    const campaigns = AdsApp.campaigns()
      .withCondition('Status = ENABLED')
      .withCondition('CampaignExperimentType = BASE')
      .withCondition('ServingStatus = SERVING')
      .withCondition('Impressions = 0')
      .forDateRange('YESTERDAY')
      .get();

    if (campaigns.totalNumEntities() === 0) {
      Logger.log('All campaigns received impressions yesterday - no email sent');
      return;
    }

    const problemCampaigns = [];
    while (campaigns.hasNext()) {
      const campaign = campaigns.next();
      const budget = campaign.getBudget().getAmount();
      problemCampaigns.push({
        name: campaign.getName(),
        budget: budget
      });
    }

    const subject = '8020agent Alert: Campaigns With Zero Impressions';

    MailApp.sendEmail({
      to: YOUR_EMAIL,
      subject: subject,
      body: `The following campaigns had zero impressions yesterday:\n\n${problemCampaigns.map(campaign =>
        `${campaign.name} (Daily Budget: $${campaign.budget})`
      ).join('\n')
        }\n\nThis is an automated alert sent by a google ads script.`
    });

    Logger.log(`Alert email sent to ${YOUR_EMAIL} for ${problemCampaigns.length} campaigns`);
  } catch (error) {
    Logger.log(`Error in campaign monitoring script: ${error.message}`);
    MailApp.sendEmail({
      to: YOUR_EMAIL,
      subject: 'Error in Google Ads Monitoring Script',
      body: `The campaign monitoring script encountered an error: ${error.message}`
    });
  }
}
```

---

### 5. Chart Script (`4cs-2-chart.js`)

**Purpose:** Creates performance charts and visualizations

**File:** `scripts/4cs/4cs-2-chart.js`

```javascript
const SPREADSHEET_URL = ''; // Optional: provide an existing Google Sheet URL (or raw ID) or leave blank to create new
const DEBUG_LOGS = false; // Set to true to enable detailed logging, false to run quietly

/**
 * Helper function for conditional logging based on DEBUG_LOGS setting
 */
function debugLog(message) {
    if (DEBUG_LOGS) {
        Logger.log(message);
    }
}

/**
 * Extracts a Google Sheet ID from a full URL or returns the input if it already
 * looks like a raw ID. Throws if no valid ID can be derived.
 */
function resolveSpreadsheetId(idOrUrl) {
    if (!idOrUrl) {
        throw new Error('No spreadsheet URL or ID provided');
    }

    // If it already looks like an ID (letters, digits, dash or underscore), accept it
    var rawIdPattern = /^[a-zA-Z0-9-_]{20,}$/; // typical sheet IDs are long
    if (rawIdPattern.test(idOrUrl)) {
        return idOrUrl;
    }

    // Try to extract from a standard Google Sheets URL
    var match = idOrUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        return match[1];
    }

    throw new Error('Could not parse a spreadsheet ID from the provided value');
}

function main() {
    debugLog('=== Starting Google Ads Campaign Export Script ===');
    let sheet;

    try {
        debugLog(`SPREADSHEET_URL configuration: ${SPREADSHEET_URL || 'Not set - will create new sheet'}`);

        // Determine the target sheet: create a fresh one or open an existing sheet by URL
        if (!SPREADSHEET_URL) {
            debugLog('Creating new spreadsheet...');
            // Create new spreadsheet
            const newSpreadsheet = SpreadsheetApp.create('Google Ads Campaign Data ' + new Date().toISOString().split('T')[0]);
            sheet = newSpreadsheet.getActiveSheet();
            Logger.log(`Created new spreadsheet: ${newSpreadsheet.getUrl()}`); // Always show new sheet URL
        } else {
            debugLog('Opening existing spreadsheet...');
            // Use existing spreadsheet (support both URL and raw ID)
            try {
                const spreadsheetId = resolveSpreadsheetId(SPREADSHEET_URL);
                debugLog(`Resolved spreadsheet ID: ${spreadsheetId}`);
                const ss = SpreadsheetApp.openById(spreadsheetId);
                sheet = ss.getActiveSheet();
                debugLog(`✓ Opened existing spreadsheet successfully`);
            } catch (error) {
                Logger.log(`✗ Failed to open spreadsheet: ${error.message}`); // Always show errors
                throw new Error(`Could not open spreadsheet at ${SPREADSHEET_URL}. Error: ${error.message}`);
            }
        }

        // Clear existing data so we always write a fresh export
        debugLog('Clearing existing sheet data...');
        sheet.clear();
        debugLog('✓ Sheet cleared successfully');

        // Add headers
        debugLog('Setting up headers...');
        const headers = [
            'Date', 'Campaign', 'Impressions', 'Clicks', 'Cost', 'Conversions', 'Conv. Value'
        ];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        debugLog(`✓ Headers added: ${headers.join(', ')}`);

        // Get campaign data using GAQL (LAST_30_DAYS for enabled campaigns)
        debugLog('Executing Google Ads query...');
        const queryString = `SELECT 
            segments.date,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
        FROM campaign
        WHERE campaign.status = 'ENABLED'
        AND segments.date DURING LAST_30_DAYS`;

        debugLog(`Query: ${queryString.replace(/\s+/g, ' ').trim()}`);

        const query = AdsApp.report(queryString);
        debugLog('✓ Query executed successfully');

        const rows = query.rows();
        const data = [];
        debugLog('Processing query results...');

        let rowCount = 0;
        while (rows.hasNext()) {
            const row = rows.next();
            rowCount++;

            // Log first few rows for debugging
            if (rowCount <= 3) {
                debugLog(`Row ${rowCount}: ${row['segments.date']} | ${row['campaign.name']} | Impressions: ${row['metrics.impressions']} | Clicks: ${row['metrics.clicks']}`);
            }

            data.push([
                row['segments.date'],
                row['campaign.name'],
                row['metrics.impressions'],
                row['metrics.clicks'],
                row['metrics.cost_micros'] / 1000000, // Convert micros to whole currency units
                row['metrics.conversions'],
                row['metrics.conversions_value']
            ]);
        }

        debugLog(`✓ Processed ${rowCount} rows from query results`);

        // Write data to sheet (skip if no rows were returned)
        if (data.length > 0) {
            debugLog(`Writing ${data.length} rows to spreadsheet...`);
            sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
            debugLog('✓ Data written to sheet successfully');

            // Format Cost (E), Conversions (F), and Conv. Value (G) to two decimal places
            debugLog('Applying number formatting...');
            sheet.getRange(2, 5, data.length, 3).setNumberFormat('#,##0.00');
            debugLog('✓ Number formatting applied');
        } else {
            Logger.log('⚠ No data rows found - only headers will be written'); // Always show this warning
        }

        // bold the header row
        debugLog('Applying header formatting...');
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        debugLog('✓ Header formatting applied');





        const message = `Exported ${data.length} campaign rows to Google Sheets`;
        Logger.log(message); // Always show final result
        if (!SPREADSHEET_URL) {
            Logger.log(`Spreadsheet URL: ${sheet.getParent().getUrl()}`); // Always show new sheet URL
        }
        debugLog('=== Script Execution Completed Successfully ===');

    } catch (error) {
        // Surface a clear error message in logs and fail fast
        Logger.log('=== SCRIPT ERROR OCCURRED ==='); // Always show errors
        Logger.log(`Error Type: ${error.name || 'Unknown'}`);
        Logger.log(`Error Message: ${error.message}`);
        debugLog(`Stack Trace: ${error.stack || 'Not available'}`);
        const errorMsg = `Error in campaign export script: ${error.message}`;
        Logger.log(`Final Error: ${errorMsg}`);
        Logger.log('=== End of Error Log ===');
        throw new Error(errorMsg);
    }
}

```

---

### 6. Change Script (`4cs-3-change.js`)

**Purpose:** Automated bid and budget adjustments

**File:** `scripts/4cs/4cs-3-change.js`

```javascript

// Script to pause campaigns that spent more than a specified multiple of their daily budget yesterday. See 8020agent.com for more
// Set this to true ONLY if you understand this script will pause campaigns
const I_UNDERSTAND_THIS_MAKES_CHANGES = false;

// Set how much over budget triggers pause action (default is 2x)
const BUDGET_OVERSPEND_THRESHOLD = 2;

function main() {
  Logger.log('========================================');
  Logger.log('Campaign Overspend Monitor');
  Logger.log('========================================');
  Logger.log('Mode: ' + (I_UNDERSTAND_THIS_MAKES_CHANGES ? '🔴 LIVE (WILL PAUSE CAMPAIGNS)' : '🟡 PREVIEW (READ-ONLY)'));
  Logger.log('Threshold: ' + BUDGET_OVERSPEND_THRESHOLD + 'x daily budget');
  Logger.log('Date Range: Yesterday');
  Logger.log('========================================');
  Logger.log('');
  
  processAllCampaigns();
}

function processAllCampaigns() {
  try {
    let hasOverspendingCampaigns = false;
    let totalCampaignsChecked = 0;
    let overspendingCampaignCount = 0;
    let totalOverspend = 0;
    
    // Handle regular campaigns
    Logger.log('📊 Processing Regular Campaigns...');
    const campaigns = AdsApp.campaigns()
      .withCondition('Status = ENABLED')
      .forDateRange('YESTERDAY')
      .get();
      
    if (campaigns.hasNext()) {
      const result = processCampaignIterator(campaigns, 'Regular');
      hasOverspendingCampaigns = result.found || hasOverspendingCampaigns;
      totalCampaignsChecked += result.totalChecked;
      overspendingCampaignCount += result.overspendCount;
      totalOverspend += result.totalOverspend;
    } else {
      Logger.log('ℹ️ No regular campaigns found');
    }
    
    Logger.log('');
    
    // Handle Performance Max campaigns
    Logger.log('📊 Processing Performance Max Campaigns...');
    const pmaxCampaigns = AdsApp.performanceMaxCampaigns()
      .withCondition('Status = ENABLED')
      .forDateRange('YESTERDAY')
      .get();
      
    if (pmaxCampaigns.hasNext()) {
      const result = processCampaignIterator(pmaxCampaigns, 'PMax');
      hasOverspendingCampaigns = result.found || hasOverspendingCampaigns;
      totalCampaignsChecked += result.totalChecked;
      overspendingCampaignCount += result.overspendCount;
      totalOverspend += result.totalOverspend;
    } else {
      Logger.log('ℹ️ No Performance Max campaigns found');
    }
    
    Logger.log('');
    Logger.log('========================================');
    Logger.log('SUMMARY');
    Logger.log('========================================');
    Logger.log('📊 Total campaigns checked: ' + totalCampaignsChecked);
    
    if (hasOverspendingCampaigns) {
      Logger.log('⚠️ ' + overspendingCampaignCount + ' campaigns exceeded ' + BUDGET_OVERSPEND_THRESHOLD + 'x daily budget');
      Logger.log('💰 Total overspend: $' + totalOverspend.toFixed(2));
      Logger.log(I_UNDERSTAND_THIS_MAKES_CHANGES ? 
        '🛑 ' + overspendingCampaignCount + ' campaigns PAUSED' : 
        '🔄 ' + overspendingCampaignCount + ' campaigns would be paused (PREVIEW MODE)');
    } else {
      Logger.log('✅ No campaigns exceeded ' + BUDGET_OVERSPEND_THRESHOLD + 'x daily budget');
    }
    
    Logger.log('🎯 ' + (totalCampaignsChecked - overspendingCampaignCount) + ' campaigns stayed within budget');
    Logger.log('========================================');
    
  } catch (e) {
    Logger.log('❌ Error: ' + e.toString());
  }
}

function processCampaignIterator(campaignIterator, campaignTypeLabel) {
  let foundOverspending = false;
  let campaignCount = 0;
  let overspendingCount = 0;
  let totalOverspend = 0;
  
  while (campaignIterator.hasNext()) {
    try {
      const campaign = campaignIterator.next();
      const stats = campaign.getStatsFor('YESTERDAY');
      const budget = campaign.getBudget().getAmount();
      const spend = stats.getCost();
      const type = campaign.getAdvertisingChannelType ? 
        campaign.getAdvertisingChannelType() : 
        'PERFORMANCE_MAX';
      
      campaignCount++;
      
      if (spend > budget * BUDGET_OVERSPEND_THRESHOLD) {
        foundOverspending = true;
        overspendingCount++;
        const overspendAmount = spend - budget;
        totalOverspend += overspendAmount;
        
        Logger.log('----------------------------------------');
        Logger.log('🚨 OVERSPEND DETECTED');
        Logger.log('Campaign: ' + campaign.getName());
        Logger.log('Type: ' + type);
        Logger.log('Daily Budget: $' + budget.toFixed(2));
        Logger.log('Actual Spend: $' + spend.toFixed(2));
        
        const overspendPercent = ((spend/budget - 1) * 100).toFixed(1);
        Logger.log('Overspend: $' + overspendAmount.toFixed(2) + ' (' + overspendPercent + '%)');
        
        if (I_UNDERSTAND_THIS_MAKES_CHANGES) {
          campaign.pause();
          Logger.log('Status: 🛑 PAUSED');
        } else {
          Logger.log('Status: 🔄 Would be paused (PREVIEW MODE)');
        }
      } else {
        // Campaign is within budget
        Logger.log('----------------------------------------');
        Logger.log('✅ WITHIN BUDGET');
        Logger.log('Campaign: ' + campaign.getName());
        Logger.log('Type: ' + type);
        Logger.log('Daily Budget: $' + budget.toFixed(2));
        Logger.log('Actual Spend: $' + spend.toFixed(2));
        
        const spendPercent = (spend/budget * 100).toFixed(1);
        Logger.log('Status: OK (' + spendPercent + '% of budget)');
      }
    } catch (e) {
      Logger.log('❌ Error processing campaign: ' + e.toString());
      continue;
    }
  }
  
  if (campaignCount > 0) {
    Logger.log('----------------------------------------');
    Logger.log('Subtotal for ' + campaignTypeLabel + ' campaigns:');
    Logger.log('- Checked: ' + campaignCount);
    Logger.log('- Within budget: ' + (campaignCount - overspendingCount));
    Logger.log('- Overspending: ' + overspendingCount);
  }
  
  return {
    found: foundOverspending,
    totalChecked: campaignCount,
    overspendCount: overspendingCount,
    totalOverspend: totalOverspend
  };
}
  
```

---

### 7. Cognition Script (`4cs-4-cognition.js`)

**Purpose:** AI-powered insights and recommendations

**File:** `scripts/4cs/4cs-4-cognition.js`

```javascript

// Script to use OpenAI to analyze campaign performance. See 8020agent.com for more

const OPENAI_API_KEY = ''; // Add your OpenAI API key here
const SYSTEM_PROMPT = `
You are an expert Google Ads analyst. 
Provide a clear 2-sentence summary of campaign performance.
Focus on the most significant changes or patterns.
`;
  
  function main() {
    try {
      // Validate API key
      if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key is missing. Please add your API key to the OPENAI_API_KEY constant.');
      }
  
      // Get campaign data with error handling
      const data = getCampaignData();
      if (!data.length) {
        Logger.log('⚠️ Warning: No campaign data found to analyze');
        return;
      }
  
      Logger.log(`ℹ️ Retrieved data for ${data.length} campaigns`);
      
      // Make API request with error handling
      const aiResponse = getAIAnalysis(data);
      Logger.log('✅ AI Analysis: ' + aiResponse);
  
    } catch (error) {
      logError('Main execution error', error);
    }
  }
  
  function getCampaignData() {
    try {
      const data = [];
      const campaigns = AdsApp.campaigns()
        .withCondition('Status = ENABLED')
        .forDateRange('YESTERDAY')
        .get();
      
      if (!campaigns.hasNext()) {
        Logger.log('ℹ️ No enabled campaigns found for yesterday');
        return data;
      }
      
      while (campaigns.hasNext()) {
        try {
          const campaign = campaigns.next();
          const stats = campaign.getStatsFor('YESTERDAY');
          
          data.push({
            name: campaign.getName(),
            impressions: stats.getImpressions(),
            clicks: stats.getClicks(),
            cost: stats.getCost(),
            conversions: stats.getConversions()
          });
        } catch (campaignError) {
          logError('Error processing campaign', campaignError);
          // Continue with next campaign
          continue;
        }
      }
      
      return data;
      
    } catch (error) {
      logError('Error getting campaign data', error);
      return [];
    }
  }
  
  function getAIAnalysis(data) {
    try {
      const prompt = {
        model: "gpt-4",  // Fixed typo in model name
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(data) }
        ]
      };
      
      // Validate data before sending
      if (!validatePromptData(prompt)) {
        throw new Error('Invalid prompt data structure');
      }
      
      const response = makeAPIRequest(prompt);
      
      // Validate response
      if (!response.choices || !response.choices[0] || !response.choices[0].message) {
        throw new Error('Invalid response structure from OpenAI API');
      }
      
      return response.choices[0].message.content;
      
    } catch (error) {
      logError('Error getting AI analysis', error);
      return 'Unable to generate AI analysis due to error';
    }
  }
  
  function makeAPIRequest(prompt) {
    try {
      const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + OPENAI_API_KEY,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(prompt),
        muteHttpExceptions: true // Prevent HTTP exceptions from throwing
      });
      
      const responseCode = response.getResponseCode();
      if (responseCode !== 200) {
        throw new Error(`API request failed with status ${responseCode}: ${response.getContentText()}`);
      }
      
      return JSON.parse(response.getContentText());
      
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }
  
  function validatePromptData(prompt) {
    return prompt &&
           prompt.messages &&
           Array.isArray(prompt.messages) &&
           prompt.messages.length >= 2 &&
           prompt.messages[0].role === 'system' &&
           prompt.messages[1].role === 'user';
  }
  
  function logError(context, error) {
    const timestamp = new Date().toISOString();
    Logger.log(`❌ ERROR [${timestamp}] ${context}:\n`);
    Logger.log(`   Message: ${error.message}`);
    Logger.log(`   Stack: ${error.stack || 'No stack trace available'}`);
    Logger.log('------------------------');
  }

```

---

## Script Monitoring & Health

### 8. Script Health Monitor (`script-health-monitor.js`)

**Purpose:** Monitors multiple scripts across accounts and sends alerts for failures

**File:** `scripts/health/script-health-monitor.js`

```javascript
/**
 * Script Health Monitor for Google Ads Scripts
 * Monitors multiple scripts and alerts when they haven't run according to schedule
 * Version 1.1
 */

// Configuration - these pull from named ranges in the Configuration sheet
function getConfig() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('Configuration');
    
    try {
      return {
        emailList: ss.getRangeByName('EMAIL_LIST').getValue() || '',
        emailSubject: ss.getRangeByName('EMAIL_SUBJECT').getValue() || 'Alert: Google Ads Script May Not Be Running',
        emailBody: ss.getRangeByName('EMAIL_BODY').getValue() || 'The following scripts have not run within their expected timeframe:',
        sendAlerts: String(ss.getRangeByName('SEND_ALERTS').getValue()).toUpperCase() !== 'FALSE'
      };
    } catch (e) {
      // If named ranges don't exist yet, return defaults
      return {
        emailList: '',
        emailSubject: 'Alert: Google Ads Script May Not Be Running',
        emailBody: 'The following scripts have not run within their expected timeframe:',
        sendAlerts: true
      };
    }
  }
  
  /**
   * Main monitoring function - set this to run every 15 minutes via trigger
   */
  function monitorScriptHealth() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Monitor');
    const config = getConfig();
    
    if (!config.sendAlerts) {
      console.log('Alerts are disabled');
      return;
    }
    
    // Get script data starting from row 6 (after headers in row 5)
    const lastRow = sheet.getLastRow();
    if (lastRow < 6) {
      console.log('No scripts to monitor');
      return;
    }
    const dataRange = sheet.getRange(6, 1, lastRow - 5, 8);
    const scripts = dataRange.getValues();
    
    const now = new Date();
    const alerts = [];
    
    scripts.forEach((row, index) => {
      const [scriptId, name, schedule, timezone, lastRun, alertSent, notes, dateAdded] = row;
      
      // Skip empty rows or scripts with no schedule
      if (!scriptId || !schedule || schedule === 'N/A') return;
      
      // Check if script has ever run
      if (!lastRun) {
        // Check how long ago this script was added to monitoring
        const addedDate = dateAdded ? new Date(dateAdded) : null;
        
        // Only alert if we haven't already alerted
        if (alertSent !== 'ALERTED') {
          if (addedDate) {
            const hoursSinceAdded = (now - addedDate) / (1000 * 60 * 60);
            const daysSinceAdded = hoursSinceAdded / 24;
            // Only alert if script was added more than 2 hours ago
            if (hoursSinceAdded > 2) {
              const timeText = daysSinceAdded >= 1 ? 
                `${Math.floor(daysSinceAdded)} days ago` : 
                `${Math.floor(hoursSinceAdded)} hours ago`;
              alerts.push({
                id: scriptId,
                name: name || `Script ${scriptId}`,
                issue: `Never run (added ${timeText})`,
                timezone: timezone || 'Not specified',
                row: index + 6
              });
            } else {
              // In grace period - add note instead of alert
              const graceNote = `Grace period active (${Math.floor(hoursSinceAdded)} hours since added)`;
              sheet.getRange(index + 6, 7).setValue(graceNote);
              console.log(`Script ${name} (${scriptId}) not yet run, but only added ${Math.floor(hoursSinceAdded)} hours ago - grace period active`);
            }
          } else {
            // No Date Added - just say "Never run" without the days
            alerts.push({
              id: scriptId,
              name: name || `Script ${scriptId}`,
              issue: 'Never run',
              timezone: timezone || 'Not specified',
              row: index + 6
            });
          }
        }
        return;
      }
      
      // Calculate time since last run
      const lastRunDate = new Date(lastRun);
      const hoursSinceRun = (now - lastRunDate) / (1000 * 60 * 60);
      
      let shouldAlert = false;
      let timeframeText = '';
      
      switch(schedule.toUpperCase()) {
        case 'HOURLY':
          shouldAlert = hoursSinceRun > 1.5; // 90 minutes grace period
          timeframeText = `${Math.floor(hoursSinceRun)} hours`;
          break;
        case 'DAILY':
          shouldAlert = hoursSinceRun > 25; // 25 hours grace period
          timeframeText = `${Math.floor(hoursSinceRun / 24)} days`;
          break;
        case 'WEEKLY':
          shouldAlert = hoursSinceRun > (24 * 7.5); // 7.5 days grace period
          timeframeText = `${Math.floor(hoursSinceRun / 24)} days`;
          break;
        case 'MONTHLY':
          shouldAlert = hoursSinceRun > (24 * 32); // 32 days grace period
          timeframeText = `${Math.floor(hoursSinceRun / 24)} days`;
          break;
      }
      
      if (shouldAlert) {
        // Check if we already sent an alert for this script being down
        // alertSent will contain "ALERTED" if we've already notified about this issue
        if (alertSent !== 'ALERTED') {
          alerts.push({
            id: scriptId,
            name: name || `Script ${scriptId}`,
            issue: `Not run for ${timeframeText} (Schedule: ${schedule})`,
            lastRun: lastRunDate.toLocaleString(),
            timezone: timezone || 'Not specified',
            row: index + 6
          });
        }
      } else if (alertSent === 'ALERTED') {
        // Script is running normally again - clear the alert flag and any grace period notes
        sheet.getRange(index + 6, 6).setValue('');
        // Clear grace period note if it exists
        const currentNote = sheet.getRange(index + 6, 7).getValue();
        if (currentNote && currentNote.toString().includes('Grace period')) {
          sheet.getRange(index + 6, 7).setValue('');
        }
        console.log(`Alert cleared for ${name} (${scriptId}) - script is running normally again`);
      }
    });
    
    // Send alerts if any
    if (alerts.length > 0 && config.emailList) {
      sendAlertEmail(alerts, config);
      
      // Mark alerts as sent with simple "ALERTED" flag
      alerts.forEach(alert => {
        sheet.getRange(alert.row, 6).setValue('ALERTED');
      });
    }
    
    // Log status
    console.log(`Checked ${scripts.length} scripts, found ${alerts.length} alerts`);
  }
  
  /**
   * Send alert email for scripts that haven't run
   */
  function sendAlertEmail(alerts, config) {
    const emails = config.emailList.split(',').map(e => e.trim()).filter(e => e);
    
    if (emails.length === 0) {
      console.log('No email addresses configured');
      return;
    }
    
    let body = config.emailBody + '\n\n';
    
    alerts.forEach(alert => {
      body += `• Script ${alert.id}: ${alert.name}\n`;
      body += `  Issue: ${alert.issue}\n`;
      body += `  Timezone: ${alert.timezone}\n`;
      if (alert.lastRun) {
        body += `  Last successful run: ${alert.lastRun}\n`;
      }
      body += '\n';
    });
    
    body += `Checked at: ${new Date().toLocaleString()}\n\n`;
    body += 'To manage these alerts, open your Script Health Monitor sheet.';
    
    emails.forEach(email => {
      try {
        MailApp.sendEmail({
          to: email,
          subject: config.emailSubject,
          body: body
        });
        console.log(`Alert sent to ${email}`);
      } catch (e) {
        console.error(`Failed to send email to ${email}: ${e.toString()}`);
      }
    });
  }
  
  /**
   * Get the user's locale to determine date format
   */
  function getUserLocale() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const locale = ss.getSpreadsheetLocale();
    
    // US locales use MM/DD/YYYY
    const usLocales = ['en_US', 'en_US', 'und_US'];
    const isUS = usLocales.some(usLocale => locale.startsWith(usLocale.split('_')[0]));
    
    return {
      locale: locale,
      dateFormat: isUS ? 'mm/dd/yyyy hh:mm:ss' : 'dd/mm/yyyy hh:mm:ss',
      dateFormatShort: isUS ? 'mm/dd/yyyy' : 'dd/mm/yyyy',
      dateLabel: isUS ? '(MM/DD/YY)' : '(DD/MM/YY)'
    };
  }
  
  /**
   * Initialize the sheet with proper structure and named ranges
   */
  function initializeSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const localeInfo = getUserLocale();
    
    // Create Configuration tab
    let configSheet = ss.getSheetByName('Configuration');
    if (!configSheet) {
      configSheet = ss.insertSheet('Configuration');
    } else {
      configSheet.clear();
    }
    
    // Set up configuration section
    configSheet.getRange('A1').setValue('CONFIGURATION SETTINGS');
    configSheet.getRange('A1').setFontWeight('bold');
    configSheet.getRange('A1').setFontSize(14);
    
    configSheet.getRange('A3').setValue('Email Recipients:');
    configSheet.getRange('B3').setValue('your-email@example.com, team@example.com');
    
    configSheet.getRange('A4').setValue('Send Alerts:');
    configSheet.getRange('B4').setValue('TRUE');
    
    // Add dropdown for Send Alerts
    const alertRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE', 'FALSE'])
      .build();
    configSheet.getRange('B4').setDataValidation(alertRule);
    
    configSheet.getRange('A5').setValue('Email Subject:');
    configSheet.getRange('B5').setValue('Alert: Google Ads Script May Not Be Running');
    
    configSheet.getRange('A6').setValue('Email Body Prefix:');
    configSheet.getRange('B6').setValue('The following scripts have not run within their expected timeframe:');
    
    // Example section
    configSheet.getRange('A9').setValue('EXAMPLE SCRIPTS (DO NOT EDIT - FOR REFERENCE ONLY)');
    configSheet.getRange('A9').setFontWeight('bold');
    configSheet.getRange('A9').setFontSize(12);
    configSheet.getRange('A9').setBackground('#fff3cd');
    
    // Example headers with DD/MM/YYYY format
    configSheet.getRange('A11:H11').setValues([[
      'Script ID (100-999)', 'Script Name', 'Schedule', 'Timezone', 
      'Last Run (DD/MM/YY)', 'Alert Sent', 'Notes', 
      'Date Added'
    ]]);
    configSheet.getRange('A11:H11').setFontWeight('bold');
    configSheet.getRange('A11:H11').setBackground('#f3f3f3');
    
    // Example data
    const exampleDate = new Date();
    const lastRunExample = new Date(exampleDate.getTime() - (2 * 60 * 60 * 1000)); // 2 hours ago
    configSheet.getRange('A12:H13').setValues([
      [101, 'Daily Performance Report', 'Daily', 'America/New_York', lastRunExample, '', 'Running normally', exampleDate],
      [102, 'Budget Monitor', 'Hourly', 'Australia/Melbourne', '', 'ALERTED', 'Script not configured yet', exampleDate]
    ]);
    configSheet.getRange('A12:H13').setBackground('#f9f9f9');
    
    // Format example dates - use DD/MM/YYYY
    configSheet.getRange('E12:E13').setNumberFormat('dd/mm/yyyy hh:mm:ss');
    configSheet.getRange('H12:H13').setNumberFormat('dd mmm yy'); // Keep this universal format
    
    // Set column widths for Configuration sheet
    configSheet.setColumnWidth(1, 150);
    configSheet.setColumnWidth(2, 300);
    
    // Create Monitor tab
    let monitorSheet = ss.getSheetByName('Monitor');
    if (!monitorSheet) {
      monitorSheet = ss.insertSheet('Monitor');
    } else {
      monitorSheet.clear();
    }
    
    // Monitor sheet header
    monitorSheet.getRange('A1').setValue('MONITORED SCRIPTS');
    monitorSheet.getRange('A1').setFontWeight('bold');
    monitorSheet.getRange('A1').setFontSize(14);
    
    // Instructions
    monitorSheet.getRange('A3').setValue('Add your scripts below. Use Script Monitor menu for help and to copy code snippets.');
    monitorSheet.getRange('A3').setFontStyle('italic');
    
    // Headers for script list with DD/MM/YYYY format indicator
    monitorSheet.getRange('A5:H5').setValues([[
      'Script ID (100-999)', 'Script Name', 'Schedule', 'Timezone', 
      'Last Run (DD/MM/YY)', 'Alert Sent', 'Notes', 
      'Date Added'
    ]]);
    monitorSheet.getRange('A5:H5').setFontWeight('bold');
    monitorSheet.getRange('A5:H5').setBackground('#f3f3f3');
    
    // Set column widths for Monitor sheet
    monitorSheet.setColumnWidth(1, 100);
    monitorSheet.setColumnWidth(2, 250);
    monitorSheet.setColumnWidth(3, 100);
    monitorSheet.setColumnWidth(4, 150);
    monitorSheet.setColumnWidth(5, 150);
    monitorSheet.setColumnWidth(6, 100);
    monitorSheet.setColumnWidth(7, 200);
    monitorSheet.setColumnWidth(8, 100);
    
    // Create named ranges pointing to Configuration sheet
    try {
      // Delete existing named ranges
      ss.getNamedRanges().forEach(nr => nr.remove());
      
      ss.setNamedRange('EMAIL_LIST', configSheet.getRange('B3'));
      ss.setNamedRange('SEND_ALERTS', configSheet.getRange('B4'));
      ss.setNamedRange('EMAIL_SUBJECT', configSheet.getRange('B5'));
      ss.setNamedRange('EMAIL_BODY', configSheet.getRange('B6'));
    } catch (e) {
      console.log('Error setting named ranges: ' + e);
    }
    
    // Add data validation for Schedule column
    const scheduleRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Hourly', 'Daily', 'Weekly', 'Monthly', 'N/A'])
      .build();
    monitorSheet.getRange('C6:C200').setDataValidation(scheduleRule);
    
    // Apply conditional formatting for schedule colors
    const rules = [];
    
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Hourly')
      .setBackground('#ffcdd2')
      .setRanges([monitorSheet.getRange('C6:C200')])
      .build());
    
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Daily')
      .setBackground('#bbdefb')
      .setRanges([monitorSheet.getRange('C6:C200')])
      .build());
    
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Weekly')
      .setBackground('#c8e6c9')
      .setRanges([monitorSheet.getRange('C6:C200')])
      .build());
    
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Monthly')
      .setBackground('#fff9c4')
      .setRanges([monitorSheet.getRange('C6:C200')])
      .build());
    
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('N/A')
      .setBackground('#f5f5f5')
      .setRanges([monitorSheet.getRange('C6:C200')])
      .build());
    
    monitorSheet.setConditionalFormatRules(rules);
    
    // Add timezone validation
    const timezoneRule = SpreadsheetApp.newDataValidation()
      .requireValueInList([
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Phoenix',
        'Europe/London',
        'Europe/Paris',
        'Europe/Berlin',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Australia/Sydney',
        'Australia/Melbourne',
        'Pacific/Auckland'
      ])
      .setAllowInvalid(true)
      .build();
    monitorSheet.getRange('D6:D200').setDataValidation(timezoneRule);
    
    // Format date columns - use DD/MM/YYYY for Last Run
    monitorSheet.getRange('E6:E30').setNumberFormat('dd/mm/yyyy hh:mm:ss');
    monitorSheet.getRange('H6:H30').setNumberFormat('dd mmm yy'); // Keep this universal format
    
    // Add validation for Script ID column (100-999)
    const scriptIdRule = SpreadsheetApp.newDataValidation()
      .requireNumberBetween(100, 999)
      .setHelpText('Script ID must be between 100 and 999')
      .build();
    monitorSheet.getRange('A6:A30').setDataValidation(scriptIdRule);
    
    // Delete any other empty sheets
    const sheets = ss.getSheets();
    sheets.forEach(s => {
      if (s.getName() !== 'Configuration' && s.getName() !== 'Monitor' && 
          s.getLastRow() === 0 && s.getLastColumn() === 0) {
        ss.deleteSheet(s);
      }
    });
    
    // Move Configuration tab first, Monitor second
    ss.setActiveSheet(configSheet);
    ss.moveActiveSheet(1);
    ss.setActiveSheet(monitorSheet);
    ss.moveActiveSheet(2);
    
    SpreadsheetApp.getUi().alert('Sheets initialized successfully! Configuration tab contains settings and examples. Monitor tab is ready for your scripts.');
  }
  
  /**
   * Auto-increment script ID when user adds new scripts
   * This function can be triggered on edit
   */
  function onEdit(e) {
    const sheet = e.source.getActiveSheet();
    
    // Only work on Monitor sheet
    if (sheet.getName() !== 'Monitor') return;
    
    const range = e.range;
    const row = range.getRow();
    const col = range.getColumn();
    
    // Check if user edited columns B, C, or D (Name, Schedule, or Timezone) in data rows
    if (row >= 6 && row <= 30 && col >= 2 && col <= 4) {
      // Check if this row has a script ID
      const scriptId = sheet.getRange(row, 1).getValue();
      
      // If no script ID and user is filling in details, check if we need to add next ID
      if (!scriptId && row > 6) {
        // Get the previous row's script ID
        let lastId = 100; // Default starting point
        for (let r = row - 1; r >= 6; r--) {
          const id = sheet.getRange(r, 1).getValue();
          if (id && !isNaN(id)) {
            lastId = parseInt(id);
            break;
          }
        }
        
        // Set the next ID
        sheet.getRange(row, 1).setValue(lastId + 1);
        
        // If there's a next empty row and it's within our range, pre-fill its ID too
        if (row < 30) {
          const nextRowHasData = sheet.getRange(row + 1, 2, 1, 3).getValues()[0].some(v => v);
          if (!nextRowHasData) {
            sheet.getRange(row + 1, 1).setValue(lastId + 2);
          }
        }
      }
    }
  }
  
  /**
   * Create menu on sheet open and auto-setup trigger if needed
   */
  function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('Script Monitor')
      .addItem('Initialize Sheet', 'initializeSheet')
      .addItem('Check All Scripts Now', 'monitorScriptHealth')
      .addItem('Set Up Monitoring Trigger', 'setupTrigger')
      .addItem('Populate Date Added', 'populateDateAdded')
      .addSeparator()
      .addItem('📋 Copy Log Function', 'copyLogFunction')
      .addItem('📋 Copy Log Call (Latest Script)', 'copyLogCall')
      .addSeparator()
      .addItem('View Instructions', 'showInstructions')
      .addItem('📋 Instructions for AI', 'copyInstructionsForAI')
      .addItem('Test Email Alert', 'testEmail')
      .addToUi();
    
    // Auto-setup monitoring trigger if it doesn't exist
    autoSetupTrigger();
  }
  
  /**
   * Automatically set up the monitoring trigger if it doesn't exist
   */
  function autoSetupTrigger() {
    const triggers = ScriptApp.getProjectTriggers();
    const hasMonitorTrigger = triggers.some(trigger => 
      trigger.getHandlerFunction() === 'monitorScriptHealth'
    );
    
    if (!hasMonitorTrigger) {
      try {
        ScriptApp.newTrigger('monitorScriptHealth')
          .timeBased()
          .everyMinutes(15)
          .create();
        console.log('Monitoring trigger automatically created');
      } catch (e) {
        console.log('Could not auto-create monitoring trigger: ' + e.toString());
      }
    }
  }
  
  /**
   * Set up time-based trigger
   */
  function setupTrigger() {
    // Remove existing triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'monitorScriptHealth') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Create new trigger to run every 15 minutes
    ScriptApp.newTrigger('monitorScriptHealth')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    SpreadsheetApp.getUi().alert('Monitoring trigger set up successfully. The system will check scripts every 15 minutes.');
  }
  
  /**
   * Test email functionality
   */
  function testEmail() {
    const config = getConfig();
    if (!config.emailList) {
      SpreadsheetApp.getUi().alert('Please configure email recipients first (cell B2)');
      return;
    }
    
    const testAlerts = [{
      id: 999,
      name: 'Test Script',
      issue: 'This is a test alert',
      timezone: 'America/New_York',
      lastRun: new Date().toLocaleString()
    }];
    
    sendAlertEmail(testAlerts, config);
    SpreadsheetApp.getUi().alert('Test email sent to: ' + config.emailList);
  }
  
  /**
   * Copy the logScriptHealth function to clipboard with correct sheet URL
   */
  function copyLogFunction() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetUrl = ss.getUrl();
    
    const functionCode = `function logScriptHealth(scriptId) {
  const MONITOR_SHEET_URL = '${sheetUrl}';
  
  try {
    const sheet = SpreadsheetApp.openByUrl(MONITOR_SHEET_URL).getSheetByName('Monitor');
    const dataRange = sheet.getRange(6, 1, sheet.getLastRow() - 5, 1);
    const scriptIds = dataRange.getValues().flat();
    const rowIndex = scriptIds.indexOf(scriptId);
    
    if (rowIndex !== -1) {
      const actualRow = rowIndex + 6;
      sheet.getRange(actualRow, 5).setValue(new Date());
      sheet.getRange(actualRow, 6).setValue(''); // Clear any alert flag
    }
  } catch (e) {
    // Don't let monitoring errors break your script
    Logger.log('Could not update monitor: ' + e.toString());
  }
}`;
    
    // Create a textarea element to copy from
    const html = `
      <div style="font-family: monospace; padding: 20px;">
        <h3>Copy this function to your Google Ads Script:</h3>
        <textarea id="codeArea" style="width: 100%; height: 400px; font-family: monospace; font-size: 12px;">${functionCode}</textarea>
        <br><br>
        <button onclick="document.getElementById('codeArea').select(); document.execCommand('copy'); google.script.host.close();">
          Copy to Clipboard & Close
        </button>
        <button onclick="google.script.host.close();">Close</button>
        <br><br>
        <p><strong>Instructions:</strong> Paste this function anywhere in your script (outside of main function)</p>
      </div>
    `;
    
    const htmlOutput = HtmlService.createHtmlOutput(html)
      .setWidth(700)
      .setHeight(550);
    
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Log Function Code');
  }
  
  /**
   * Generate the logScriptHealth call for the most recent script
   */
  function copyLogCall() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Monitor');
    
    // Find the last row with a script ID
    const lastRow = sheet.getLastRow();
    let scriptId = null;
    let scriptName = null;
    
    for (let row = lastRow; row >= 6; row--) {
      const id = sheet.getRange(row, 1).getValue();
      if (id) {
        scriptId = id;
        scriptName = sheet.getRange(row, 2).getValue() || `Script ${id}`;
        break;
      }
    }
    
    if (!scriptId) {
      SpreadsheetApp.getUi().alert('No scripts found in the monitor sheet. Please add a script first.');
      return;
    }
    
    const callCode = `logScriptHealth(${scriptId}); // ${scriptName}`;
    
    const html = `
      <div style="font-family: monospace; padding: 20px;">
        <h3>Add this line to your main() function:</h3>
        <p>For script: <strong>${scriptName} (ID: ${scriptId})</strong></p>
        <textarea id="codeArea" style="width: 100%; height: 80px; font-family: monospace; font-size: 14px;">${callCode}</textarea>
        <br><br>
        <button onclick="document.getElementById('codeArea').select(); document.execCommand('copy'); google.script.host.close();">
          Copy to Clipboard & Close
        </button>
        <button onclick="google.script.host.close();">Close</button>
        <br><br>
        <p><strong>Instructions:</strong></p>
        <ul>
          <li>Add this line at the END of your main() function</li>
          <li>Also add it before any return statements in main()</li>
          <li>This will log successful runs for Script ID ${scriptId}</li>
        </ul>
      </div>
    `;
    
    const htmlOutput = HtmlService.createHtmlOutput(html)
      .setWidth(600)
      .setHeight(400);
    
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Log Call Code');
  }
  
  /**
   * Helper function to auto-populate Date Added for new scripts
   * Run this manually or add to menu
   */
  function populateDateAdded() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Monitor');
    const today = new Date();
    
    // Check rows starting from 6 (after headers in row 5)
    const lastRow = sheet.getLastRow();
    if (lastRow < 6) {
      SpreadsheetApp.getUi().alert('No scripts found. Add scripts starting from row 6.');
      return;
    }
    
    let updated = 0;
    for (let row = 6; row <= lastRow; row++) {
      const scriptId = sheet.getRange(row, 1).getValue();
      const dateAdded = sheet.getRange(row, 8).getValue();
      
      // If there's a script ID but no Date Added, set it to today
      if (scriptId && !dateAdded) {
        sheet.getRange(row, 8).setValue(today);
        updated++;
        console.log(`Set Date Added for script ${scriptId} to ${today.toLocaleDateString()}`);
      }
    }
    
    if (updated > 0) {
      SpreadsheetApp.getUi().alert(`Updated Date Added for ${updated} script(s) to today's date.`);
    } else {
      SpreadsheetApp.getUi().alert('All scripts already have Date Added values.');
    }
  }
  
  /**
   * Show instructions
   */
  function showInstructions() {
    const instructions = `
  SCRIPT HEALTH MONITOR - INSTRUCTIONS
  
  INITIAL SETUP:
  1. Run 'Script Monitor > Initialize Sheet' from the menu
  2. Update email recipients in cell B2
  3. Run 'Script Monitor > Set Up Monitoring Trigger'
  
  ADDING SCRIPTS TO MONITOR:
  1. Each script needs a unique 3-digit ID (100-999)
  2. Add the script ID, name, schedule, timezone to the list
  3. Schedule options: Hourly, Daily, Weekly, Monthly, or N/A
  4. Timezone should match your Google Ads account timezone
  5. Date Added will auto-populate when you run 'Populate Date Added'
  
  GRACE PERIOD FOR NEW SCRIPTS:
  - New scripts have a 2-hour grace period before "never run" alerts
  - This gives you time to set up the script code
  - After 2 hours, you'll get an alert if the script hasn't run
  - The alert will show how long ago the script was added (hours or days)
  
  IN YOUR GOOGLE ADS SCRIPTS:
  
  Step 1: Add this function anywhere in your script (outside main):
  
  function logScriptHealth(scriptId) {
    const MONITOR_SHEET_URL = 'YOUR_MONITOR_SHEET_URL_HERE'; // Update this once
    
    try {
      const sheet = SpreadsheetApp.openByUrl(MONITOR_SHEET_URL).getSheetByName('Monitor');
      const dataRange = sheet.getRange(6, 1, sheet.getLastRow() - 5, 1);
      const scriptIds = dataRange.getValues().flat();
      const rowIndex = scriptIds.indexOf(scriptId);
      
      if (rowIndex !== -1) {
        const actualRow = rowIndex + 6;
        sheet.getRange(actualRow, 5).setValue(new Date());
        sheet.getRange(actualRow, 6).setValue(''); // Clear any alert flag
      }
    } catch (e) {
      // Don't let monitoring errors break your script
      Logger.log('Could not update monitor: ' + e.toString());
    }
  }
  
  Step 2: Add this line at the end of main() and before any return statements:
  
  logScriptHealth(101); // Replace 101 with your script's ID
  
  Note: If your script has multiple exit points (return statements), 
  add the logScriptHealth() call before each one. Your developer 
  or AI can help identify all the places this needs to be added.
  
  ALERT BEHAVIOR:
  - Alerts are sent ONCE per failure (no spam)
  - Alert flag shows "ALERTED" when notification sent
  - When script runs successfully again, alert clears automatically
  - Different timezones are handled correctly
  
  MENU OPTIONS:
  - Initialize Sheet: Set up or reset the monitoring sheet
  - Check All Scripts Now: Manually run the monitoring check
  - Set Up Monitoring Trigger: Create 15-minute automatic checks
  - Populate Date Added: Auto-fill today's date for new scripts
  - View Instructions: Show this help text
  - Test Email Alert: Send a test email to verify setup
  
  TROUBLESHOOTING:
  - Check spam folder for alert emails
  - Verify timezone matches your Google Ads account
  - Make sure script IDs are unique
  - Use 'Populate Date Added' if Date Added column is empty
  - Test with 'Script Monitor > Test Email Alert'
  `;
    
    SpreadsheetApp.getUi().alert(instructions);
  }
  
  /**
   * Copy instructions for AI with sheet URL and latest script ID
   */
  function copyInstructionsForAI() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetUrl = ss.getUrl();
    const sheet = ss.getSheetByName('Monitor');
    
    // Find the last row with a script ID
    const lastRow = sheet.getLastRow();
    let scriptId = null;
    let scriptName = null;
    
    for (let row = lastRow; row >= 6; row--) {
      const id = sheet.getRange(row, 1).getValue();
      if (id) {
        scriptId = id;
        scriptName = sheet.getRange(row, 2).getValue() || `Script ${id}`;
        break;
      }
    }
    
    if (!scriptId) {
      SpreadsheetApp.getUi().alert('No scripts found in the monitor sheet. Please add a script first.');
      return;
    }
    
    const logFunction = `function logScriptHealth(scriptId) {
  const MONITOR_SHEET_URL = '${sheetUrl}';
  
  try {
    const sheet = SpreadsheetApp.openByUrl(MONITOR_SHEET_URL).getSheetByName('Monitor');
    const dataRange = sheet.getRange(6, 1, sheet.getLastRow() - 5, 1);
    const scriptIds = dataRange.getValues().flat();
    const rowIndex = scriptIds.indexOf(scriptId);
    
    if (rowIndex !== -1) {
      const actualRow = rowIndex + 6;
      sheet.getRange(actualRow, 5).setValue(new Date());
      sheet.getRange(actualRow, 6).setValue(''); // Clear any alert flag
    }
  } catch (e) {
    // Don't let monitoring errors break your script
    Logger.log('Could not update monitor: ' + e.toString());
  }
}`;

    const logCall = `logScriptHealth(${scriptId}); // ${scriptName}`;
    
    const aiInstructions = `# Google Apps Script Monitoring Setup Instructions

You need to add script health monitoring to a Google Ads script. Follow these steps exactly:

## Step 1: Add the Log Function
Add this function at the END of the script (after all other functions):

\`\`\`javascript
${logFunction}
\`\`\`

## Step 2: Add Log Calls
Add this line in TWO places:
\`\`\`javascript
${logCall}
\`\`\`

### WHERE to add the log call:
1. **At the very end of the main() function** - just before the closing brace
2. **Before every return statement** - Search the script for all occurrences of "return" and add the log call on the line immediately before each return statement

### Example:
\`\`\`javascript
function main() {
  // Your existing code here
  
  if (someCondition) {
    ${logCall}
    return; // Early exit
  }
  
  // More code here
  
  ${logCall}
} // End of main function
\`\`\`

## Instructions:
1. Search through the entire script for all "return" statements
2. Add the log call before each return statement  
3. Add the log call at the end of main() function
4. Add the logScriptHealth function at the very end of the script
5. Return the complete modified script

The user will copy-paste your response directly into Google Apps Script, so make sure it's complete and ready to run.

## User's Script:
[Paste your Google Ads script below]`;

    // Create HTML dialog for easy copying  
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h3>Instructions for AI Implementation</h3>
        <p>Copy this text and paste it into your AI conversation along with your script to automatically add monitoring:</p>
        <textarea id="instructionsArea" style="width: 100%; height: 400px; font-family: monospace; font-size: 12px; border: 1px solid #ccc; padding: 10px;">${aiInstructions}</textarea>
        <br><br>
        <button onclick="document.getElementById('instructionsArea').select(); document.execCommand('copy'); google.script.host.close();" 
                style="background: #1a73e8; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
          Copy & Close
        </button>
        <button onclick="google.script.host.close();" 
                style="background: #dadce0; color: #3c4043; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">
          Close
        </button>
      </div>
    `;
    
    const htmlOutput = HtmlService.createHtmlOutput(html)
      .setWidth(700)
      .setHeight(550);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Instructions for AI Implementation');
  }
```

---

### 9. Script Running Check Documentation (`script-running-check.md`)

**Purpose:** Guide for verifying script execution

**File:** `scripts/health/script-running-check.md`

```markdown
# Script Health Monitor - Setup Guide

## What This Does
This monitoring system watches all your Google Ads scripts and alerts you when they stop running. Instead of discovering problems days later when a client asks why their reports stopped, you'll know within minutes.

## Initial Setup (5 minutes)

### Step 1: Prepare Your Sheet
1. Create a new Google Sheet or use an existing one
2. Open Extensions > Apps Script
3. Delete any existing code and paste the Script Health Monitor code
4. Save the project with a name like "Script Health Monitor"
5. Return to your sheet

### Step 2: Initialize the Monitor
1. Refresh your sheet (you should see a new "Script Monitor" menu)
2. Click Script Monitor > Initialize Sheet
3. This creates the Monitor tab with all necessary structure

### In the Monitor Tab, update these cells:
- **B2**: Add email addresses (comma-separated) for alerts
- **B3**: Keep as TRUE to receive alerts

### Step 4: Start Monitoring
1. Click Script Monitor > Set Up Monitoring Trigger
2. Authorize the script when prompted
3. The system now checks every 15 minutes automatically

## Adding Scripts to Monitor

### In the Monitor Sheet
For each Google Ads script you want to monitor:

1. **Script ID** (Column A): Choose a unique 3-digit number (100-999)
   - Can't start with 0
   - Must be unique across all your scripts
   - Example: 101, 205, 999

2. **Script Name** (Column B): Descriptive name for your reference
   - Example: "Daily Performance Report - Client ABC"
   - Include client name if monitoring multiple accounts

3. **Schedule** (Column C): How often the script should run
   - Choose from dropdown: Hourly, Daily, Weekly, Monthly, N/A
   - This determines when to alert you
   - Each option has a different color for easy scanning

4. **Timezone** (Column D): The timezone of your Google Ads account
   - Critical for accurate monitoring across different regions
   - Select from dropdown or type your own

### In Your Google Ads Scripts
Just two simple steps:

**Step 1:** Add this function anywhere in your script (outside of main):
```javascript
function logScriptHealth(scriptId) {
  const MONITOR_SHEET_URL = ''; // Update this once with your sheet
  
  try {
    const sheet = SpreadsheetApp.openByUrl(MONITOR_SHEET_URL).getSheetByName('Monitor');
    const dataRange = sheet.getRange(9, 1, sheet.getLastRow() - 8, 1);
    const scriptIds = dataRange.getValues().flat();
    const rowIndex = scriptIds.indexOf(scriptId);
    
    if (rowIndex !== -1) {
      const actualRow = rowIndex + 9;
      sheet.getRange(actualRow, 5).setValue(new Date());
      sheet.getRange(actualRow, 6).setValue(''); // Clear any alert flag
    }
  } catch (e) {
    // Don't let monitoring errors break your script
    Logger.log('Could not update monitor: ' + e.toString());
  }
}
```
Update the `MONITOR_SHEET_URL` once with your monitor sheet's URL. Then you can copy this entire function to all your scripts.

**Step 2:** Add this single line at the end of your main() function:
```javascript
function main() {
  // Your existing script code here
  
  // Add this line at the very end of main():
  logScriptHealth(101); // Replace 101 with your script's unique ID
}
```

**Important:** If your script has multiple exit points (return statements), you'll need to add the `logScriptHealth()` call before each return. For example:
```javascript
function main() {
  // Some code...
  
  if (someCondition) {
    logScriptHealth(101); // Add before this return
    return;
  }
  
  // More code...
  
  logScriptHealth(101); // And at the normal end
}
```

The exact placement depends on your script's logic. Your developer or an AI assistant can help identify all the places where this needs to be added.

## How Alerts Work

### Timing Logic
The monitor gives scripts a grace period before alerting:
- **Hourly scripts**: Alert if not run for 90 minutes
- **Daily scripts**: Alert if not run for 25 hours  
- **Weekly scripts**: Alert if not run for 7.5 days
- **Monthly scripts**: Alert if not run for 32 days

### Alert Behavior
- You get ONE email per problem (not repeated spam)
- Email includes all scripts with issues
- Shows when each script last ran successfully
- Alerts auto-clear when scripts start running again

### What You'll See
The Monitor sheet shows:
- **Last Run**: Timestamp of most recent execution
- **Alert Sent**: System tracking (ignore this column)
- **Notes**: Your notes about the script (optional)

## Testing & Troubleshooting

### Test Your Setup
1. Click Script Monitor > Test Email Alert
2. Check that you receive the test email
3. If not, check your spam folder

### Common Issues

**Not receiving alerts?**
- Check email addresses in B2 are correct
- Look in spam/promotions folders
- Verify Send Alerts (B4) is TRUE

**Scripts showing as not run?**
- Verify the script ID matches between sheet and script
- Check timezone matches your Google Ads account
- Make sure the monitoring code is at the END of your script

**Getting false alerts?**
- Double-check the Schedule setting matches actual script schedule
- Remember scripts might run a few minutes late (that's why we have grace periods)

## Pro Tips

1. **Start Small**: Monitor your most critical scripts first
2. **Use Meaningful IDs**: Consider grouping (100s for reports, 200s for bid management, etc.)
3. **Document in Notes**: Use the Notes column for script location or special instructions
4. **Different Emails**: You can have different monitor sheets for different clients/teams
5. **Check Duration**: If duration suddenly changes, the script might be having issues

## Advanced Options

### Custom Alert Messages
- Edit cell B5 to change email subject
- Edit cell B6 to change email body introduction

### Disable Temporarily
- Set cell B4 to FALSE to pause all alerts
- Useful during maintenance or testing

### Manual Check
- Click Script Monitor > Check All Scripts Now
- Useful for immediate verification

## Questions?
This system saves hours of manual checking and prevents client-facing failures. Once set up, it runs itself. The peace of mind is worth the 5-minute setup.
```

---



---

## Search Term Analysis

### 11. N-Gram Analysis (`ngram.js`)

**Purpose:** Analyzes search terms to identify patterns and optimization opportunities

**File:** `scripts/ngram/ngram.js`

```javascript
// template sheet to copy -> https://docs.google.com/spreadsheets/d/1f_1C2fZneYLfL_7ooDwnEJdL2o_L2J4XC35VGoACjQA/copy

const SHEET_URL  = ''        // create a copy of the template above first
const CLIENTCODE = ''        // this string will be added to the sheet name 

// ------------------ //   (c) MikeRhodes.com.au   // ------------------- //

function main() {
    Logger.log(`Starting the Free nGram script.`);
    const e = CLIENTCODE || AdsApp.currentAccount().getName(),
          t = SpreadsheetApp.openByUrl(SHEET_URL);
    t.rename(`${e} - Free nGram Analysis - MikeRhodes.com.au (c)`);
    const a = {
        impr: 'metrics.impressions',
        clicks: 'metrics.clicks',
        cost: 'metrics.cost_micros',
        conv: 'metrics.conversions',
        value: 'metrics.conversions_value',
        prodTitle: 'segments.product_title',
        campName: 'campaign.name',
        campId: 'campaign.id',
        catLabel: 'campaign_search_term_insight.category_label',
        chType: 'campaign.advertising_channel_type',
        pmaxOnly: 'campaign.advertising_channel_type = \'PERFORMANCE_MAX\' ',
        last30: 'segments.date DURING LAST_30_DAYS',
        impr0: 'metrics.impressions > 0'
    };
    const c = `SELECT ${[a.prodTitle, a.cost, a.conv, a.value, a.impr, a.clicks, a.campName, a.chType].join(",")}
        FROM shopping_performance_view WHERE ${a.impr0} AND ${a.last30} AND ${a.pmaxOnly}`;
    const r = fetchProductData(c);
    if (!r) return;
    Logger.log(`Starting nGram processing...`);
    const s = extractAndAggregateNGrams(extractSearchTerms(a), 's'),
          n = extractAndAggregateNGrams(r, 't');
    outputDataToSheet(t, "sNgrams", s);
    outputDataToSheet(t, "tNgrams", n);
}

function extractSearchTerms(e) {
    let t = AdsApp.report(`
        SELECT ${[e.campId, e.campName, e.clicks, e.impr, e.conv, e.value].join(",")}
        FROM campaign WHERE campaign.status != 'REMOVED' AND ${e.pmaxOnly} AND ${e.impr0} AND ${e.last30}
        ORDER BY metrics.conversions DESC 
    `).rows(),
        a = [["Campaign Name", "Campaign ID", "Category Label", "Clicks", "Impr", "Conv", "Value", "Bucket", "Distance"]];
    for (; t.hasNext(); ) {
        let c = t.next(),
            r = c["campaign.name"],
            s = c["campaign.id"],
            n = AdsApp.report(` 
                SELECT ${[e.catLabel, e.campId, e.clicks, e.impr, e.conv, e.value].join(",")}
                FROM campaign_search_term_insight WHERE ${e.last30}
                AND ${e.campId} = ${s} ORDER BY ${e.impr} DESC 
            `).rows();
        for (; n.hasNext(); ) {
            let e = n.next(),
                t = (e["campaign_search_term_insight.category_label"] || "blank").toLowerCase();
            t = cleanNGram(t);
            a.push([r, s, t, e["metrics.clicks"], e["metrics.impressions"], e["metrics.conversions"], e["metrics.conversions_value"]]);
        }
    }
    return a;
}

function extractAndAggregateNGrams(e, t) {
    let a = {};
    e.slice(1).forEach((e) => {
        ("s" === t ? cleanNGram(e[2]) : cleanNGram(e["t"].toLowerCase())).split(" ").forEach((c) => {
            a[c = c || "blank"] || (a[c] = {
                nGram: c,
                clicks: 0,
                impr: 0,
                conv: 0,
                value: 0,
                cost: "t" === t ? 0 : void 0
            });
            a[c].clicks += "s" === t ? Number(e[3]) : e.Clicks;
            a[c].impr += "s" === t ? Number(e[4]) : e.Impr;
            a[c].conv += "s" === t ? Number(e[5]) : e.Conv;
            a[c].value += "s" === t ? Number(e[6]) : e.Value;
            "t" === t && (a[c].cost += e.Cost);
        });
    });
    let c = "s" === t ? [["nGram", "Impr", "Clicks", "Conv", "Value", "CTR", "CvR", "AOV"]] : [["nGram", "Impr", "Clicks", "Cost", "Conv", "Value", "CTR", "CvR", "AOV", "ROAS", "Bucket"]];
    for (let e in a) {
        let r = a[e];
        r.CTR = r.impr > 0 ? r.clicks / r.impr : 0;
        r.CvR = r.clicks > 0 ? r.conv / r.clicks : 0;
        r.AOV = r.conv > 0 ? r.value / r.conv : 0;
        if (t === "t") {
            r.ROAS = r.cost > 0 ? r.value / r.cost : 0;
            r.Bucket = determineBucket(r.cost, r.conv, r.ROAS, (r.cost * 10), (r.ROAS * 2));
        }
        c.push("s" === t ? [r.nGram, r.impr, r.clicks, r.conv, r.value, r.CTR, r.CvR, r.AOV] : [r.nGram, r.impr, r.clicks, r.cost, r.conv, r.value, r.CTR, r.CvR, r.AOV, r.ROAS, r.Bucket]);
    }
    return c.sort(((e, t) => "nGram" === e[0] ? -1 : "nGram" === t[0] ? 1 : t[2] - e[2])), c = c.filter((e) => "blank" !== e[0]), c;
}

function outputDataToSheet(e, t, a) {
    let c = e.getSheetByName(t) || e.insertSheet(t);
    if (c.clearContents(), Array.isArray(a[0])) o = a;
    else {
        const e = Object.keys(a[0]),
              t = a.map((t) => e.map((e) => null !== t[e] && void 0 !== t[e] ? t[e] : ""));
        o = [e].concat(t);
    }
    c.getRange(1, 1, o.length, o[0].length).setValues(o);
}

function flattenObject(e) {
    let t = {};
    for (let a in e) if ("object" == typeof e[a]) {
        let c = flattenObject(e[a]);
        for (let e in c) t[a + "." + e] = c[e];
    } else t[a] = e[a];
    return t;
}

function fetchProductData(e) {
    let t = [],
        a = {};
    const c = AdsApp.search(e);
    for (; c.hasNext(); ) {
        let e = flattenObject(c.next()),
            t = e["segments.productTitle"];
        a[t] || (a[t] = {
            Impr: 0,
            Clicks: 0,
            Cost: 0,
            Conv: 0,
            Value: 0,
            "t": e["segments.productTitle"]
        });
        let r = a[t];
        r.Impr += Number(e["metrics.impressions"]) || 0;
        r.Clicks += Number(e["metrics.clicks"]) || 0;
        r.Cost += Number(e["metrics.costMicros"]) / 1e6 || 0;
        r.Conv += Number(e["metrics.conversions"]) || 0;
        r.Value += Number(e["metrics.conversionsValue"]) || 0;
    }
    for (let e in a) t.push(a[e]);
    return t;
}

function cleanNGram(e) {
    const t = ".,/#!$%^&*;:{}=-_`~()";
    for (; e.length > 0 && t.includes(e[0]); ) e = e.substring(1);
    for (; e.length > 0 && t.includes(e[e.length - 1]); ) e = e.substring(0, e.length - 1);
    return e.length <= 1 ? "" : e;
} 

function determineBucket(cost, conv, roas, tCost, tRoas) {
    if (cost === 0) return 'zombie';
    if (conv === 0) return 'zeroconv';
    if (cost < tCost) return roas < tRoas ? 'meh' : 'flukes';
    return roas < tRoas ? 'costly' : 'profitable';
}
```

---

## Simple Utility Scripts

### 12. Basic Search Terms (`search-terms.js`)

**Purpose:** Basic search term analysis and export

**File:** `scripts/simple/search-terms.js`

```javascript
function main() {
    // Replace with your Google Sheet URL or paste it between the quotes
    var SHEET_URL = '';
    
    var spreadsheet, sheet;
    
    // If no URL provided, create a new sheet
    if (!SHEET_URL || SHEET_URL.trim() === '') {
      spreadsheet = SpreadsheetApp.create('Search Terms Data - ' + new Date().toDateString());
      sheet = spreadsheet.getActiveSheet();
      
      // Log the URL for the user
      Logger.log('Created new sheet for you! URL: ' + spreadsheet.getUrl());
      Logger.log('Copy this URL and paste it in the SHEET_URL variable for future runs');
    } else {
      // Use the provided URL
      spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);
      sheet = spreadsheet.getActiveSheet();
    }
    
    // Clear existing data and add headers
    sheet.clear();
    sheet.getRange(1, 1, 1, 12).setValues([
      ['Search Term', 'Impressions', 'Clicks', 'Cost', 'CTR', 'CPC', 'Conversions', 'Conversion Value', 'AOV', 'ROAS', 'CPA', 'Conversion Rate']
    ]);
    
    // Get search terms data for past 7 days using Google Ads API v21
    var query = "SELECT search_term_view.search_term, " +
               "metrics.impressions, " +
               "metrics.clicks, " +
               "metrics.cost_micros, " +
               "metrics.ctr, " +
               "metrics.average_cpc, " +
               "metrics.conversions, " +
               "metrics.conversions_value " +
               "FROM search_term_view " +
               "WHERE metrics.impressions > 100 " +
               "AND segments.date DURING LAST_7_DAYS " +
               "ORDER BY metrics.impressions DESC";
    
    var report = AdsApp.search(query, {apiVersion: 'v21'});
    var data = [];
    
    // Process each row of data
    for (var row of report) {
      var conversions = parseFloat(row.metrics.conversions) || 0;
      var conversionValue = parseFloat(row.metrics.conversions_value) || 0;
      var costMicros = parseInt(row.metrics.cost_micros) || 0;
      var cost = costMicros / 1000000; // Convert from micros to currency
      var clicks = parseInt(row.metrics.clicks) || 0;
      var cpcMicros = parseInt(row.metrics.average_cpc) || 0;
      var cpc = cpcMicros / 1000000; // Convert from micros to currency
      
      // Calculate metrics
      var aov = conversions > 0 ? conversionValue / conversions : 0;
      var roas = cost > 0 ? conversionValue / cost : 0;
      var cpa = conversions > 0 ? cost / conversions : 0;
      var conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
      
      data.push([
        row.searchTermView.searchTerm,
        parseInt(row.metrics.impressions),
        clicks,
        cost.toFixed(2),
        (parseFloat(row.metrics.ctr) * 100).toFixed(2) + '%',
        cpc.toFixed(2),
        conversions,
        conversionValue.toFixed(2),
        aov.toFixed(2),
        roas.toFixed(2),
        cpa.toFixed(2),
        conversionRate.toFixed(2) + '%'
      ]);
    }
    
    // Write data to sheet if we have any
    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, 12).setValues(data);
      Logger.log('Successfully wrote ' + data.length + ' search terms to the sheet');
    } else {
      Logger.log('No search term data found for the past 7 days with >100 impressions');
    }
  }
```

---

### 13. Enhanced Search Terms (`search-terms-v2.js`)

**Purpose:** Enhanced version with additional features

**File:** `scripts/simple/search-terms-v2.js`

```javascript
function main() {
    // Replace with your Google Sheet URL or paste it between the quotes
    var SHEET_URL = '';

    // Tab names for the three data types
    var campaignsTab = 'campaigns';
    var keywordsTab = 'keywords';
    var searchTermsTab = 'searchterms';

    var spreadsheet;

    // If no URL provided, create a new sheet
    if (!SHEET_URL || SHEET_URL.trim() === '') {
        spreadsheet = SpreadsheetApp.create('Google Ads Data - ' + new Date().toDateString());

        // Create the three tabs
        createTab(spreadsheet, campaignsTab);
        createTab(spreadsheet, keywordsTab);
        createTab(spreadsheet, searchTermsTab);

        // Log the URL for the user
        Logger.log('Created new sheet for you! URL: ' + spreadsheet.getUrl());
        Logger.log('Copy this URL and paste it in the SHEET_URL variable for future runs');
    } else {
        // Use the provided URL
        spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);

        // Ensure all three tabs exist
        ensureTabsExist(spreadsheet, [campaignsTab, keywordsTab, searchTermsTab]);
    }

    // Process campaigns data
    processCampaignsData(spreadsheet, campaignsTab);

    // Process keywords data
    processKeywordsData(spreadsheet, keywordsTab);

    // Process search terms data
    processSearchTermsData(spreadsheet, searchTermsTab);

    Logger.log('All data processing completed successfully!');
}

function createTab(spreadsheet, tabName) {
    var sheet = spreadsheet.insertSheet(tabName);
    return sheet;
}

function ensureTabsExist(spreadsheet, tabNames) {
    for (var i = 0; i < tabNames.length; i++) {
        var tabName = tabNames[i];
        try {
            spreadsheet.getSheetByName(tabName);
        } catch (e) {
            // Tab doesn't exist, create it
            createTab(spreadsheet, tabName);
        }
    }
}

function processCampaignsData(spreadsheet, tabName) {
    var sheet = spreadsheet.getSheetByName(tabName);

    // Clear existing data and add headers
    sheet.clear();
    sheet.getRange(1, 1, 1, 12).setValues([
        ['Campaign', 'Status', 'Impressions', 'Clicks', 'Cost', 'CTR', 'CPC', 'Conversions', 'Conversion Value', 'AOV', 'ROAS', 'CPA']
    ]);

    // Get campaign data for enabled campaigns from past 30 days
    var query = "SELECT campaign.name, " +
        "campaign.status, " +
        "metrics.impressions, " +
        "metrics.clicks, " +
        "metrics.cost_micros, " +
        "metrics.ctr, " +
        "metrics.average_cpc, " +
        "metrics.conversions, " +
        "metrics.conversions_value " +
        "FROM campaign " +
        "WHERE campaign.status = 'ENABLED' " +
        "AND segments.date DURING LAST_30_DAYS " +
        "ORDER BY metrics.impressions DESC";

    var report = AdsApp.search(query, { apiVersion: 'v21' });
    var data = [];

    // Process each row of data
    for (var row of report) {
        var conversions = parseFloat(row.metrics.conversions) || 0;
        var conversionValue = parseFloat(row.metrics.conversions_value) || 0;
        var costMicros = parseInt(row.metrics.cost_micros) || 0;
        var cost = costMicros / 1000000; // Convert from micros to currency
        var clicks = parseInt(row.metrics.clicks) || 0;
        var cpcMicros = parseInt(row.metrics.average_cpc) || 0;
        var cpc = cpcMicros / 1000000; // Convert from micros to currency

        // Calculate metrics
        var aov = conversions > 0 ? conversionValue / conversions : 0;
        var roas = cost > 0 ? conversionValue / cost : 0;
        var cpa = conversions > 0 ? cost / conversions : 0;

        data.push([
            row.campaign.name,
            row.campaign.status,
            parseInt(row.metrics.impressions),
            clicks,
            cost.toFixed(2),
            (parseFloat(row.metrics.ctr) * 100).toFixed(2) + '%',
            cpc.toFixed(2),
            conversions,
            conversionValue.toFixed(2),
            aov.toFixed(2),
            roas.toFixed(2),
            cpa.toFixed(2)
        ]);
    }

    // Write data to sheet if we have any
    if (data.length > 0) {
        sheet.getRange(2, 1, data.length, 12).setValues(data);
        Logger.log('Successfully wrote ' + data.length + ' campaigns to the ' + tabName + ' tab');
    } else {
        Logger.log('No campaign data found for enabled campaigns in the past 30 days');
    }
}

function processKeywordsData(spreadsheet, tabName) {
    var sheet = spreadsheet.getSheetByName(tabName);

    // Clear existing data and add headers
    sheet.clear();
    sheet.getRange(1, 1, 1, 12).setValues([
        ['Keyword', 'Campaign', 'Status', 'Impressions', 'Clicks', 'Cost', 'CTR', 'CPC', 'Conversions', 'Conversion Value', 'AOV', 'ROAS']
    ]);

    // Get keyword data for all keywords with any impressions in past 30 days
    var query = "SELECT ad_group_criterion.keyword.text, " +
        "campaign.name, " +
        "ad_group_criterion.status, " +
        "metrics.impressions, " +
        "metrics.clicks, " +
        "metrics.cost_micros, " +
        "metrics.ctr, " +
        "metrics.average_cpc, " +
        "metrics.conversions, " +
        "metrics.conversions_value " +
        "FROM keyword_view " +
        "WHERE metrics.impressions > 0 " +
        "AND segments.date DURING LAST_30_DAYS " +
        "ORDER BY metrics.impressions DESC";

    var report = AdsApp.search(query, { apiVersion: 'v21' });
    var data = [];

    // Process each row of data
    for (var row of report) {
        var conversions = parseFloat(row.metrics.conversions) || 0;
        var conversionValue = parseFloat(row.metrics.conversions_value) || 0;
        var costMicros = parseInt(row.metrics.cost_micros) || 0;
        var cost = costMicros / 1000000; // Convert from micros to currency
        var clicks = parseInt(row.metrics.clicks) || 0;
        var cpcMicros = parseInt(row.metrics.average_cpc) || 0;
        var cpc = cpcMicros / 1000000; // Convert from micros to currency

        // Calculate metrics
        var aov = conversions > 0 ? conversionValue / conversions : 0;
        var roas = cost > 0 ? conversionValue / cost : 0;

        data.push([
            row.adGroupCriterion.keyword.text,
            row.campaign.name,
            row.adGroupCriterion.status,
            parseInt(row.metrics.impressions),
            clicks,
            cost.toFixed(2),
            (parseFloat(row.metrics.ctr) * 100).toFixed(2) + '%',
            cpc.toFixed(2),
            conversions,
            conversionValue.toFixed(2),
            aov.toFixed(2),
            roas.toFixed(2)
        ]);
    }

    // Write data to sheet if we have any
    if (data.length > 0) {
        sheet.getRange(2, 1, data.length, 12).setValues(data);
        Logger.log('Successfully wrote ' + data.length + ' keywords to the ' + tabName + ' tab');
    } else {
        Logger.log('No keyword data found with impressions in the past 30 days');
    }
}

function processSearchTermsData(spreadsheet, tabName) {
    var sheet = spreadsheet.getSheetByName(tabName);

    // Clear existing data and add headers
    sheet.clear();
    sheet.getRange(1, 1, 1, 12).setValues([
        ['Search Term', 'Impressions', 'Clicks', 'Cost', 'CTR', 'CPC', 'Conversions', 'Conversion Value', 'AOV', 'ROAS', 'CPA', 'Conversion Rate']
    ]);

    // Get search terms data for past 30 days using Google Ads API v21
    var query = "SELECT search_term_view.search_term, " +
        "metrics.impressions, " +
        "metrics.clicks, " +
        "metrics.cost_micros, " +
        "metrics.ctr, " +
        "metrics.average_cpc, " +
        "metrics.conversions, " +
        "metrics.conversions_value " +
        "FROM search_term_view " +
        "WHERE metrics.impressions > 50 " +
        "AND segments.date DURING LAST_30_DAYS " +
        "ORDER BY metrics.impressions DESC";

    var report = AdsApp.search(query, { apiVersion: 'v21' });
    var data = [];

    // Process each row of data
    for (var row of report) {
        var conversions = parseFloat(row.metrics.conversions) || 0;
        var conversionValue = parseFloat(row.metrics.conversions_value) || 0;
        var costMicros = parseInt(row.metrics.cost_micros) || 0;
        var cost = costMicros / 1000000; // Convert from micros to currency
        var clicks = parseInt(row.metrics.clicks) || 0;
        var cpcMicros = parseInt(row.metrics.average_cpc) || 0;
        var cpc = cpcMicros / 1000000; // Convert from micros to currency

        // Calculate metrics
        var aov = conversions > 0 ? conversionValue / conversions : 0;
        var roas = cost > 0 ? conversionValue / cost : 0;
        var cpa = conversions > 0 ? cost / conversions : 0;
        var conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

        data.push([
            row.searchTermView.searchTerm,
            parseInt(row.metrics.impressions),
            clicks,
            cost.toFixed(2),
            (parseFloat(row.metrics.ctr) * 100).toFixed(2) + '%',
            cpc.toFixed(2),
            conversions,
            conversionValue.toFixed(2),
            aov.toFixed(2),
            roas.toFixed(2),
            cpa.toFixed(2),
            conversionRate.toFixed(2) + '%'
        ]);
    }

    // Write data to sheet if we have any
    if (data.length > 0) {
        sheet.getRange(2, 1, data.length, 12).setValues(data);
        Logger.log('Successfully wrote ' + data.length + ' search terms to the ' + tabName + ' tab');
    } else {
        Logger.log('No search term data found for the past 30 days with >50 impressions');
    }
}
```

---

## Google Apps Scripts

### 14. Email Sheet Document (`email-sheet-doc.js`)

**Purpose:** Email automation using Google Sheets data

**File:** `scripts/apps-scripts/email-sheet-doc.js`

```javascript
/**
 * Combined Gmail extraction and Drive export script
 * Extracts emails with a label and exports them as text files
 */

// Configuration constants
const CONFIG = {
  labelName: '',  // Label name to search for
  folderId: '',   // Folder ID to export to
  headerRow: 1,
  columns: {
    subject: 2,   // Column C
    body: 3,      // Column D
    flag: 4,      // Column E
  }
};


function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Gmail Processor')
    .addItem('Extract Z-Sam Emails', 'extractZSamEmails')
    .addItem('Export to Drive Text Files', 'exportRowsToDriveTextDocs')
    .addItem('Run Full Process', 'runFullProcess')
    .addSeparator()
    .addItem('Setup Daily Trigger', 'setupDailyTrigger')
    .addItem('Remove Daily Trigger', 'removeDailyTrigger')
    .addToUi();
}


function extractZSamEmails() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Only add header if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Date', 'From', 'Subject', 'Body', 'Exported']);
  }

  const label = GmailApp.getUserLabelByName(CONFIG.labelName);
  if (!label) {
    Logger.log(`Label '${CONFIG.labelName}' not found.`);
    SpreadsheetApp.getUi().alert(`Label '${CONFIG.labelName}' not found.`);
    return;
  }

  // Search for threads with z-sam label that are still in inbox
  const searchQuery = `label:${CONFIG.labelName} in:inbox`;
  const threads = GmailApp.search(searchQuery);
  let processedCount = 0;

  if (threads.length === 0) {
    Logger.log('No new emails found in inbox with z-sam label.');
    return processedCount;
  }

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(msg => {
      const rawBody = msg.getPlainBody();
      const cleanedBody = cleanEmailBody(rawBody);

      const row = [
        msg.getDate(),
        msg.getFrom(),
        msg.getSubject(),
        cleanedBody,
        '' // Empty flag column
      ];
      // Insert at row 2 to keep new emails at top
      sheet.insertRowBefore(2);
      sheet.getRange(2, 1, 1, row.length).setValues([row]);
      processedCount++;
    });
    
    // Archive the thread (remove from inbox)
    thread.moveToArchive();
  });

  Logger.log(`Processed ${processedCount} new messages from ${threads.length} threads and archived them.`);
  if (processedCount > 0) {
    SpreadsheetApp.getUi().alert(`Processed ${processedCount} new messages and archived them.`);
  }
  
  return processedCount;
}


function cleanEmailBody(body) {
  const delimiter = '********';
  const index = body.indexOf(delimiter);
  return index !== -1 ? body.substring(index + delimiter.length).trim() : body.trim();
}


function exportRowsToDriveTextDocs() {
  try {
    const folder = DriveApp.getFolderById(CONFIG.folderId);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    let processedCount = 0;

    for (let i = CONFIG.headerRow; i < data.length; i++) {
      const row = data[i];
      const alreadyProcessed = row[CONFIG.columns.flag];
      const subject = row[CONFIG.columns.subject];
      const body = row[CONFIG.columns.body];

      if (!subject || !body || alreadyProcessed === '✅') continue;

      // Create text file with subject as name
      const safeFileName = subject.substring(0, 100).replace(/[\\/:*?"<>|]/g, '-');
      folder.createFile(safeFileName + '.txt', body, MimeType.PLAIN_TEXT);

      // Mark as processed in column G
      sheet.getRange(i + 1, CONFIG.columns.flag + 1).setValue('✅');
      processedCount++;
    }

    Logger.log(`Created ${processedCount} text documents and updated flags.`);
    if (processedCount > 0) {
      SpreadsheetApp.getUi().alert(`Created ${processedCount} text documents in Drive.`);
    }
    
    return processedCount;
    
  } catch (error) {
    Logger.log(`Error in exportRowsToDriveTextDocs: ${error.message}`);
    SpreadsheetApp.getUi().alert(`Error: ${error.message}`);
    return 0;
  }
}


function runFullProcess() {
  try {
    const extractedCount = extractZSamEmails();
    
    if (extractedCount > 0) {
      Utilities.sleep(2000); // Brief pause between operations
      const exportedCount = exportRowsToDriveTextDocs();
      
      Logger.log(`Daily process: ${extractedCount} emails processed, ${exportedCount} files created`);
      SpreadsheetApp.getUi().alert(`Daily process complete: ${extractedCount} emails processed, ${exportedCount} files created`);
    } else {
      Logger.log('Daily process: No new emails to process');
      // Don't show alert for silent daily runs when there's nothing new
    }
    
  } catch (error) {
    Logger.log(`Error in runFullProcess: ${error.message}`);
    SpreadsheetApp.getUi().alert(`Error during full process: ${error.message}`);
  }
}


function setupDailyTrigger() {
  // Remove existing triggers first
  removeDailyTrigger();
  
  // Create new daily trigger
  ScriptApp.newTrigger('runFullProcess')
    .timeBased()
    .everyDays(1)
    .atHour(9) // Run at 9 AM
    .create();
    
  SpreadsheetApp.getUi().alert('Daily trigger set up successfully! Will run at 9 AM each day.');
  Logger.log('Daily trigger created for runFullProcess at 9 AM');
}


function removeDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removedCount = 0;
  
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runFullProcess') {
      ScriptApp.deleteTrigger(trigger);
      removedCount++;
    }
  });
  
  if (removedCount > 0) {
    SpreadsheetApp.getUi().alert(`Removed ${removedCount} existing trigger(s).`);
    Logger.log(`Removed ${removedCount} triggers`);
  } else {
    SpreadsheetApp.getUi().alert('No existing triggers found.');
  }
}


function listCurrentTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    Logger.log(`Trigger: ${trigger.getHandlerFunction()}, Type: ${trigger.getEventType()}`);
  });
}
```

---



---



---

*End of Master Scripts*
