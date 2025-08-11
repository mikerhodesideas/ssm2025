function logScriptHealth(scriptId) {
    const MONITOR_SHEET_URL = 'https://docs.google.com/spreadsheets/d/19c_6UQ0BOpD-kna021Okq0beHWa-2bTUHKk1DiC0lBE/'; // Update this once with your sheet
    
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