// scripts/1-mcc-simple.js
// --- CONFIGURATION ---

// 1. SPREADSHEET URL (Optional)
//    - Leave blank ('') to create a new spreadsheet automatically.
//    - Or, paste the URL of an existing Google Sheet between the single quotes (e.g., 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit')
const SHEET_URL = '';

// 2. TEST CIDs (Optional)
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
  const headers = ["Account Name", "Account ID (CID)", "Date", "Conversion Action Name", "Conversions"];
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
    SpreadsheetApp.getUi().alert(message);
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