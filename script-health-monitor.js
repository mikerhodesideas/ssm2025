/**
 * Script Health Monitor for Google Ads Scripts
 * Monitors multiple scripts and alerts when they haven't run according to schedule
 * Version 1.1
 */

// Configuration - these pull from named ranges in the sheet
function getConfig() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('Monitor');
    
    try {
      return {
        emailList: ss.getRangeByName('EMAIL_LIST').getValue() || '',
        emailSubject: ss.getRangeByName('EMAIL_SUBJECT').getValue() || 'Alert: Google Ads Script May Not Be Running',
        emailBody: ss.getRangeByName('EMAIL_BODY').getValue() || 'The following scripts have not run within their expected timeframe:',
        sendAlerts: ss.getRangeByName('SEND_ALERTS').getValue() !== false
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
    
    // Get script data starting from row 9 (after config rows and blank line)
    const dataRange = sheet.getRange(9, 1, sheet.getLastRow() - 8, 7);
    const scripts = dataRange.getValues();
    
    const now = new Date();
    const alerts = [];
    
    scripts.forEach((row, index) => {
      const [scriptId, name, schedule, timezone, lastRun, alertSent, notes] = row;
      
      // Skip empty rows or scripts with no schedule
      if (!scriptId || !schedule || schedule === 'N/A') return;
      
      // Check if script has ever run
      if (!lastRun) {
        // Only alert if we haven't already alerted for this
        if (alertSent !== 'ALERTED') {
          alerts.push({
            id: scriptId,
            name: name || `Script ${scriptId}`,
            issue: 'Never run',
            timezone: timezone || 'Not specified',
            row: index + 9
          });
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
            row: index + 9
          });
        }
      } else if (alertSent === 'ALERTED') {
        // Script is running normally again - clear the alert flag
        sheet.getRange(index + 9, 6).setValue('');
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
   * Initialize the sheet with proper structure and named ranges
   */
  function initializeSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Monitor');
    
    if (!sheet) {
      sheet = ss.insertSheet('Monitor');
    }
    
    // Set up configuration section
    sheet.getRange('A1').setValue('CONFIGURATION');
    sheet.getRange('A1').setFontWeight('bold');
    sheet.getRange('A1').setHorizontalAlignment('left');
    
    sheet.getRange('A2').setValue('Email Recipients:');
    sheet.getRange('A2').setHorizontalAlignment('left');
    sheet.getRange('B2').setValue('your-email@example.com, team@example.com');
    
    sheet.getRange('A3').setValue('Send Alerts:');
    sheet.getRange('A3').setHorizontalAlignment('left');
    sheet.getRange('B3').setValue(true);
    
    sheet.getRange('A4').setValue('Email Subject:');
    sheet.getRange('A4').setHorizontalAlignment('left');
    sheet.getRange('B4').setValue('Alert: Google Ads Script May Not Be Running');
    
    sheet.getRange('A5').setValue('Email Body Prefix:');
    sheet.getRange('A5').setHorizontalAlignment('left');
    sheet.getRange('B5').setValue('The following scripts have not run within their expected timeframe:');
    
    // Leave row 6 blank
    sheet.getRange('A6').setValue('');
    
    // Add instructions in row 7
    sheet.getRange('A7').setValue('MONITORED SCRIPTS');
    sheet.getRange('A7').setFontWeight('bold');
    sheet.getRange('A7').setHorizontalAlignment('left');
    
    // Headers for script list
    sheet.getRange('A8:G8').setValues([[
      'Script ID', 'Script Name', 'Schedule', 'Timezone', 'Last Run', 'Alert Sent', 'Notes'
    ]]);
    sheet.getRange('A8:G8').setFontWeight('bold');
    sheet.getRange('A8:G8').setBackground('#f3f3f3');
    
    // Set column widths
    sheet.setColumnWidth(1, 100);  // Script ID - increased width
    sheet.setColumnWidth(2, 250); // Script Name
    sheet.setColumnWidth(3, 100); // Schedule
    sheet.setColumnWidth(4, 150); // Timezone
    sheet.setColumnWidth(5, 150); // Last Run
    sheet.setColumnWidth(6, 100); // Alert Sent
    sheet.setColumnWidth(7, 200); // Notes
    
    // Create named ranges
    try {
      ss.setNamedRange('EMAIL_LIST', sheet.getRange('B2'));
      ss.setNamedRange('SEND_ALERTS', sheet.getRange('B3'));
      ss.setNamedRange('EMAIL_SUBJECT', sheet.getRange('B4'));
      ss.setNamedRange('EMAIL_BODY', sheet.getRange('B5'));
    } catch (e) {
      console.log('Some named ranges may already exist');
    }
    
    // Add data validation for Schedule column with colors
    const scheduleRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Hourly', 'Daily', 'Weekly', 'Monthly', 'N/A'])
      .build();
    sheet.getRange('C9:C200').setDataValidation(scheduleRule);
    
    // Apply conditional formatting for schedule colors
    const rules = [];
    
    // Hourly - Light Red
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Hourly')
      .setBackground('#ffcdd2')
      .setRanges([sheet.getRange('C9:C200')])
      .build());
    
    // Daily - Light Blue
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Daily')
      .setBackground('#bbdefb')
      .setRanges([sheet.getRange('C9:C200')])
      .build());
    
    // Weekly - Light Green
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Weekly')
      .setBackground('#c8e6c9')
      .setRanges([sheet.getRange('C9:C200')])
      .build());
    
    // Monthly - Light Yellow
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Monthly')
      .setBackground('#fff9c4')
      .setRanges([sheet.getRange('C9:C200')])
      .build());
    
    // N/A - Light Gray
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('N/A')
      .setBackground('#f5f5f5')
      .setRanges([sheet.getRange('C9:C200')])
      .build());
    
    sheet.setConditionalFormatRules(rules);
    
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
      .setAllowInvalid(true) // Allow custom timezones if needed
      .build();
    sheet.getRange('D9:D200').setDataValidation(timezoneRule);
    
    // Add sample scripts
    sheet.getRange('A9:D11').setValues([
      [101, 'Daily Performance Report', 'Daily', 'America/New_York'],
      [102, 'Budget Monitor', 'Hourly', 'America/New_York'],
      [103, 'Weekly Account Audit', 'Weekly', 'America/Chicago']
    ]);
    
    // Format the Last Run column as date/time
    sheet.getRange('E9:E200').setNumberFormat('mm/dd/yyyy hh:mm:ss');
    
    // Left-align all of column A
    sheet.getRange('A:A').setHorizontalAlignment('left');
    
    // Delete any other empty sheets
    const sheets = ss.getSheets();
    sheets.forEach(s => {
      if (s.getName() !== 'Monitor' && s.getLastRow() === 0 && s.getLastColumn() === 0) {
        ss.deleteSheet(s);
      }
    });
    
    console.log('Sheet initialized successfully');
  }
  
  /**
   * Create menu on sheet open
   */
  function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('Script Monitor')
      .addItem('Initialize Sheet', 'initializeSheet')
      .addItem('Check All Scripts Now', 'monitorScriptHealth')
      .addItem('Set Up Monitoring Trigger', 'setupTrigger')
      .addItem('View Instructions', 'showInstructions')
      .addSeparator()
      .addItem('Test Email Alert', 'testEmail')
      .addToUi();
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
  2. Add the script ID, name, schedule, and timezone to the list
  3. Schedule options: Hourly, Daily, Weekly, Monthly, or N/A
  4. Timezone should match your Google Ads account timezone
  
  IN YOUR GOOGLE ADS SCRIPTS:
  
  Step 1: Add this function anywhere in your script (outside main):
  
  function logScriptHealth(scriptId) {
    const MONITOR_SHEET_URL = 'YOUR_MONITOR_SHEET_URL_HERE'; // Update this once
    
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
  
  Step 2: Add this line at the end of main() and before any return statements:
  
  logScriptHealth(101); // Replace 101 with your script's ID
  
  Note: If your script has multiple exit points (return statements), 
  add the logScriptHealth() call before each one. Your developer 
  or AI can help identify all the places this needs to be added.
  
  MONITORING:
  - The system checks every 15 minutes
  - You'll get one email per failure (won't spam you)
  - When a script starts running again, alerts auto-clear
  - Different timezones are handled correctly
  
  TROUBLESHOOTING:
  - Check spam folder for alert emails
  - Verify timezone matches your Google Ads account
  - Make sure script IDs are unique
  - Test with 'Script Monitor > Test Email Alert'
  `;
    
    SpreadsheetApp.getUi().alert(instructions);
  }