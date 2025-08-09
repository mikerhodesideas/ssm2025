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
