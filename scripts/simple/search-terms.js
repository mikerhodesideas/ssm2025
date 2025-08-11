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