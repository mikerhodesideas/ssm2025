// --- CONFIGURATION ---

// 1. SPREADSHEET URL (Optional)
//    - Leave blank ('') to create a new spreadsheet automatically.
//    - Or, paste the URL of an existing Google Sheet (e.g., 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit')
const SHEET_URL = '';

// 2. TEST CID (Optional)
//    - To run for a single account for testing, enter its Customer ID (e.g., '741-519-8088').
//    - Leave blank ("") to run for all accounts under the MCC.
const SINGLE_CID_FOR_TESTING = ''; // Example: '123-456-7890' or ''

// 3. TIME PERIOD
//    - Choose "LAST_7_DAYS" or "LAST_30_DAYS".
const SELECTED_TIME_PERIOD = 'LAST_7_DAYS'; // Options: 'LAST_7_DAYS', 'LAST_30_DAYS'

// 4. SHEET NAME (Name of the tab within the spreadsheet)
const SHEET_NAME = 'DailyConversionData';

// --- END OF CONFIGURATION ---

function main() {
  Logger.log(`Starting script for time period: ${SELECTED_TIME_PERIOD}`);
  if (SINGLE_CID_FOR_TESTING) {
    Logger.log(`Running in test mode for CID: ${SINGLE_CID_FOR_TESTING}`);
  } else {
    Logger.log(`Running for all accounts in the MCC.`);
  }

  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  } else {
    sheet.clearContents(); // Clear existing data
  }

  const allConversionActions = new Set(); // To collect all unique conversion action names
  const accountsData = []; // To collect raw data from all accounts

  let accountIterator;
  if (SINGLE_CID_FOR_TESTING) {
    accountIterator = AdsManagerApp.accounts().withIds([SINGLE_CID_FOR_TESTING]).get();
    if (!accountIterator.hasNext()) {
      Logger.log(`Error: Test CID ${SINGLE_CID_FOR_TESTING} not found or not accessible.`);
      return;
    }
  } else {
    accountIterator = AdsManagerApp.accounts().get();
  }

  // First pass: collect all data and unique conversion action names
  while (accountIterator.hasNext()) {
    const account = accountIterator.next();
    AdsManagerApp.select(account); // Switch context to the current account

    const accountName = account.getName() || 'N/A (Account Name Missing)';
    const accountId = account.getCustomerId();
    Logger.log(`Processing account: ${accountName} (${accountId})`);

    try {
      const reportData = getConversionDataForAccount(accountId, accountName);

      // Collect conversion action names and store account data
      reportData.forEach(row => {
        allConversionActions.add(row.conversionActionName);
      });

      accountsData.push({
        accountName: accountName,
        accountId: accountId,
        data: reportData
      });
    } catch (e) {
      Logger.log(`  Error processing account ${accountName} (${accountId}): ${e.message}. Skipping.`);
    }
  }

  // Convert Set to sorted array for consistent column order
  const conversionActionNames = Array.from(allConversionActions).sort();
  Logger.log(`Found ${conversionActionNames.length} unique conversion actions: ${conversionActionNames.join(', ')}`);

  // Create headers: Account Name, Account ID, Date, then each conversion action
  const headers = ["Account Name", "Account ID (CID)", "Date", ...conversionActionNames];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold"); // Make headers bold

  // Second pass: create pivot-style data
  const pivotRows = createPivotData(accountsData, conversionActionNames);

  if (pivotRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, pivotRows.length, pivotRows[0].length).setValues(pivotRows);
    Logger.log(`${pivotRows.length} rows of pivot data written to sheet: ${SHEET_NAME}`);
  } else {
    Logger.log('No conversion data found for the selected accounts and period.');
    const emptyRow = ['No conversion data found for the selected accounts and period.', '', ''];
    // Fill remaining columns with empty strings
    for (let i = 0; i < conversionActionNames.length; i++) {
      emptyRow.push('');
    }
    sheet.appendRow(emptyRow);
  }

  Logger.log(`Script finished. Data written to: ${spreadsheet.getUrl()}`);
  if (!SHEET_URL) { // Log the new spreadsheet URL if we created it
    Logger.log(`New spreadsheet created at: ${spreadsheet.getUrl()}`);
  }
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
    const date = row["segments.date"];
    const conversionActionName = row["conversion_action.name"];
    const conversions = parseFloat(row["metrics.all_conversions"]); // Use parseFloat for fractional conversions

    accountData.push({
      date: date,
      conversionActionName: conversionActionName,
      conversions: conversions
    });
  }
  if (accountData.length === 0) {
    Logger.log(`  No conversion data found for ${accountName} (${accountId}) in the period.`);
  }
  return accountData;
}

function createPivotData(accountsData, conversionActionNames) {
  const pivotRows = [];

  // Process each account's data
  accountsData.forEach(accountInfo => {
    const { accountName, accountId, data } = accountInfo;

    // Group data by date
    const dateGroups = {};
    data.forEach(row => {
      if (!dateGroups[row.date]) {
        dateGroups[row.date] = {};
      }
      dateGroups[row.date][row.conversionActionName] = row.conversions;
    });

    // Create pivot rows for each date
    Object.keys(dateGroups).sort().reverse().forEach(date => { // Sort dates descending (newest first)
      const pivotRow = [accountName, accountId, date];

      // Add conversion values for each action (0 if not present)
      conversionActionNames.forEach(actionName => {
        const value = dateGroups[date][actionName] || 0;
        pivotRow.push(value);
      });

      pivotRows.push(pivotRow);
    });
  });

  return pivotRows;
}

function getSpreadsheet() {
  try {
    if (SHEET_URL) {
      Logger.log(`Using existing spreadsheet: ${SHEET_URL}`);
      return SpreadsheetApp.openByUrl(SHEET_URL);
    } else {
      const spreadsheetName = `MCC Conversion Report - ${Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd")}`;
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