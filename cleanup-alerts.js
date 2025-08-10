/**
 * One-time cleanup function to clear old alert keys
 * Run this once to clean up the old format alert keys
 */
function cleanupOldAlerts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Monitor');
  
  // Get all alert sent values starting from row 9
  const lastRow = sheet.getLastRow();
  if (lastRow < 9) return;
  
  const alertRange = sheet.getRange(9, 6, lastRow - 8, 1);
  const values = alertRange.getValues();
  
  // Clear any values that look like the old format (contain numbers and dashes)
  const cleanedValues = values.map(([value]) => {
    if (value && value.toString().match(/^\d+-\d+$/)) {
      return ['']; // Clear old format
    }
    return [value]; // Keep as is (including 'ALERTED' or empty)
  });
  
  alertRange.setValues(cleanedValues);
  
  console.log('Cleaned up old alert keys');
  SpreadsheetApp.getUi().alert('Old alert keys have been cleared. The system will now use the new "ALERTED" format.');
}