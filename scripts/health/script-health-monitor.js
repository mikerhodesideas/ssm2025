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