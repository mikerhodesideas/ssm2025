// scripts/search-terms-report.js

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1HF8SVhCHNbs2DwTEZSQ_kDxZHD03BdAwS_frwJj4VKA/edit?gid=1266648278#gid=1266648278'; // Will create a new sheet if not provided
const TAB = 'searchterms'; // lowercase tab name

const QUERY = `
SELECT 
    search_term_view.search_term,
    campaign.name,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value
FROM search_term_view
WHERE segments.date DURING LAST_30_DAYS
AND campaign.advertising_channel_type = "SEARCH"
ORDER BY metrics.cost_micros DESC
`;

function main() {
    try {
        // Get or create spreadsheet
        let ss;
        if (!SHEET_URL) {
            ss = SpreadsheetApp.create("Search Terms Report");
            let url = ss.getUrl();
            Logger.log("No SHEET_URL found, so this sheet was created: " + url);
        } else {
            ss = SpreadsheetApp.openByUrl(SHEET_URL);
        }

        // Get or create the tab
        let sheet = ss.getSheetByName(TAB);
        if (!sheet) {
            sheet = ss.insertSheet(TAB);
        }

        // Clear existing data
        sheet.clear();

        // Execute the query
        let rows = AdsApp.search(QUERY);

        // Check if we got any results
        if (!rows.hasNext()) {
            Logger.log("WARNING: No search terms found for the last 30 days");
            return;
        }

        // Process the data and calculate metrics
        let data = calculateMetrics(rows);

        // Create headers
        let headers = [
            'SearchTerm',
            'Campaign',
            'Impressions',
            'Clicks',
            'Cost',
            'Conversions',
            'ConversionValue',
            'Cpc',
            'Ctr',
            'ConvRate',
            'Cpa',
            'Roas',
            'Aov'
        ];

        // Add headers to the beginning of data array
        data.unshift(headers);

        // Write all data to sheet in one operation
        if (data.length > 0) {
            sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
            Logger.log(`Successfully exported ${data.length - 1} search terms to sheet`);
        } else {
            Logger.log("No data found to export");
        }

    } catch (e) {
        Logger.log("Error in main function: " + e);
    }
}

function calculateMetrics(rows) {
    let data = [];

    // Log first row structure to debug field access patterns
    if (rows.hasNext()) {
        const sampleRow = rows.next();
        Logger.log("Sample row structure for debugging:");
        for (let key in sampleRow) {
            Logger.log(`${key}: ${sampleRow[key]}`);
        }

        // Reset iterator by creating a new one
        rows = AdsApp.search(QUERY);
    }

    while (rows.hasNext()) {
        try {
            let row = rows.next();

            // Access nested object properties correctly
            let searchTerm = row.searchTermView ? row.searchTermView.searchTerm || '' : '';
            let campaignName = row.campaign ? row.campaign.name || '' : '';

            // Debug: Log the actual field names to see what's available
            if (data.length === 0) { // Only log for first row
                Logger.log("Available fields in row:");
                for (let field in row) {
                    Logger.log(`Field: ${field}, Value: ${row[field]}`);
                }
                Logger.log("Nested campaign object:");
                for (let prop in row.campaign) {
                    Logger.log(`  campaign.${prop}: ${row.campaign[prop]}`);
                }
                Logger.log("Nested searchTermView object:");
                for (let prop in row.searchTermView) {
                    Logger.log(`  searchTermView.${prop}: ${row.searchTermView[prop]}`);
                }
                Logger.log("Nested metrics object:");
                for (let prop in row.metrics) {
                    Logger.log(`  metrics.${prop}: ${row.metrics[prop]}`);
                }
            }

            // ALWAYS convert metrics to numbers and handle null/undefined
            let impressions = row.metrics ? Number(row.metrics.impressions) || 0 : 0;
            let clicks = row.metrics ? Number(row.metrics.clicks) || 0 : 0;
            let costMicros = row.metrics ? Number(row.metrics.cost_micros) || 0 : 0;
            let conversions = row.metrics ? Number(row.metrics.conversions) || 0 : 0;
            let conversionValue = row.metrics ? Number(row.metrics.conversions_value) || 0 : 0;

            // Calculate metrics
            let cost = costMicros / 1000000;  // Convert micros to actual currency
            let cpc = clicks > 0 ? cost / clicks : 0;
            let ctr = impressions > 0 ? clicks / impressions : 0;
            let convRate = clicks > 0 ? conversions / clicks : 0;
            let cpa = conversions > 0 ? cost / conversions : 0;
            let roas = cost > 0 ? conversionValue / cost : 0;
            let aov = conversions > 0 ? conversionValue / conversions : 0;

            // Add all variables and calculated metrics to a new row
            let newRow = [
                searchTerm, campaignName, impressions, clicks, cost,
                conversions, conversionValue, cpc, ctr, convRate, cpa, roas, aov
            ];

            // push new row to the end of data array
            data.push(newRow);
        } catch (e) {
            Logger.log("Error processing row: " + e);
            // Continue with next row
        }
    }

    return data;
}
