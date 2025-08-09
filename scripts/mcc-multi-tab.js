// --- CONFIGURATION ---

// 1. SPREADSHEET URL (Optional)
//    - Leave blank ("") to create a new spreadsheet automatically.
//    - Or, paste the URL of an existing Google Sheet (e.g., "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit")
const SHEET_URL = '';

// 2. TEST CID (Optional)
//    - To run for a single account for testing, enter its Customer ID (e.g., "123-456-7890").
//    - Leave blank ("") to run for all accounts under the MCC.
const SINGLE_CID_FOR_TESTING = ''; // Example: "123-456-7890" or ""

// 3. TIME PERIOD
//    - Choose "LAST_7_DAYS" or "LAST_30_DAYS".
const SELECTED_TIME_PERIOD = 'LAST_7_DAYS'; // Options: "LAST_7_DAYS", "LAST_30_DAYS"

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
      totalSpend += parseFloat(row["metrics.cost_micros"]) / 1000000; // Convert micros to currency
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
  
  if (SINGLE_CID_FOR_TESTING) {
    Logger.log(`Running in test mode for CID: ${SINGLE_CID_FOR_TESTING}`);
  } else {
    Logger.log("Running for all accounts in the MCC.");
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
  const indexHeaders = ["Account ID (CID)", "Account Name", "Spend", "Link"];
  indexSheet.appendRow(indexHeaders);
  indexSheet.getRange(1, 1, 1, indexHeaders.length).setFontWeight("bold");
  
  const accountsData = []; // Store account info for index
  const qualifyingAccounts = []; // Accounts that meet spend threshold

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

  // First pass: collect accounts and their spend
  while (accountIterator.hasNext()) {
    const account = accountIterator.next();
    AdsManagerApp.select(account);

    const accountName = account.getName() || "N/A";
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
      const headers = ["Date", "Conversion Action Name", "Conversions"];
      accountSheet.appendRow(headers);
      accountSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      
      // Get conversion data
      try {
        const reportData = getConversionDataForAccount(accountId, accountName);
        if (reportData.length > 0) {
          // Remove account name and ID from each row since we have separate tabs
          const cleanedData = reportData.map(row => [row[2], row[3], row[4]]); // Date, Action, Conversions
          accountSheet.getRange(2, 1, cleanedData.length, cleanedData[0].length).setValues(cleanedData);
        } else {
          accountSheet.appendRow(["No conversion data found for this period", "", ""]);
        }
      } catch (e) {
        Logger.log(`Error processing account ${accountName} (${accountId}): ${e.message}`);
        accountSheet.appendRow(["Error loading data", e.message, ""]);
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
        `=HYPERLINK("${sheetUrl}", "Go to ${tabName}")`
      ]);
    }
  });
  
  // Write index data
  if (accountsData.length > 0) {
    indexSheet.getRange(2, 1, accountsData.length, accountsData[0].length).setValues(accountsData);
    Logger.log(`Created tabs for ${accountsData.length} accounts with spend > ${thresholdSpend}`);
  } else {
    indexSheet.appendRow(["No accounts found with spend > " + thresholdSpend, "", "", ""]);
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
    const date = row["segments.date"];
    const conversionActionName = row["conversion_action.name"];
    const conversions = parseFloat(row["metrics.all_conversions"]); // Use parseFloat for fractional conversions

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