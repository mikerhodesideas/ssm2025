/**
 * Combined Gmail extraction and Drive export script
 * Extracts emails with a label and exports them as text files
 */

// Configuration constants
const CONFIG = {
  labelName: '',  // Label name to search for
  folderId: '',   // Folder ID to export to
  headerRow: 1,
  columns: {
    subject: 2,   // Column C
    body: 3,      // Column D
    flag: 4,      // Column E
  }
};


function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Gmail Processor')
    .addItem('Extract Z-Sam Emails', 'extractZSamEmails')
    .addItem('Export to Drive Text Files', 'exportRowsToDriveTextDocs')
    .addItem('Run Full Process', 'runFullProcess')
    .addSeparator()
    .addItem('Setup Daily Trigger', 'setupDailyTrigger')
    .addItem('Remove Daily Trigger', 'removeDailyTrigger')
    .addToUi();
}


function extractZSamEmails() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Only add header if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Date', 'From', 'Subject', 'Body', 'Exported']);
  }

  const label = GmailApp.getUserLabelByName(CONFIG.labelName);
  if (!label) {
    Logger.log(`Label '${CONFIG.labelName}' not found.`);
    SpreadsheetApp.getUi().alert(`Label '${CONFIG.labelName}' not found.`);
    return;
  }

  // Search for threads with z-sam label that are still in inbox
  const searchQuery = `label:${CONFIG.labelName} in:inbox`;
  const threads = GmailApp.search(searchQuery);
  let processedCount = 0;

  if (threads.length === 0) {
    Logger.log('No new emails found in inbox with z-sam label.');
    return processedCount;
  }

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(msg => {
      const rawBody = msg.getPlainBody();
      const cleanedBody = cleanEmailBody(rawBody);

      const row = [
        msg.getDate(),
        msg.getFrom(),
        msg.getSubject(),
        cleanedBody,
        '' // Empty flag column
      ];
      // Insert at row 2 to keep new emails at top
      sheet.insertRowBefore(2);
      sheet.getRange(2, 1, 1, row.length).setValues([row]);
      processedCount++;
    });
    
    // Archive the thread (remove from inbox)
    thread.moveToArchive();
  });

  Logger.log(`Processed ${processedCount} new messages from ${threads.length} threads and archived them.`);
  if (processedCount > 0) {
    SpreadsheetApp.getUi().alert(`Processed ${processedCount} new messages and archived them.`);
  }
  
  return processedCount;
}


function cleanEmailBody(body) {
  const delimiter = '********';
  const index = body.indexOf(delimiter);
  return index !== -1 ? body.substring(index + delimiter.length).trim() : body.trim();
}


function exportRowsToDriveTextDocs() {
  try {
    const folder = DriveApp.getFolderById(CONFIG.folderId);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    let processedCount = 0;

    for (let i = CONFIG.headerRow; i < data.length; i++) {
      const row = data[i];
      const alreadyProcessed = row[CONFIG.columns.flag];
      const subject = row[CONFIG.columns.subject];
      const body = row[CONFIG.columns.body];

      if (!subject || !body || alreadyProcessed === '✅') continue;

      // Create text file with subject as name
      const safeFileName = subject.substring(0, 100).replace(/[\\/:*?"<>|]/g, '-');
      folder.createFile(safeFileName + '.txt', body, MimeType.PLAIN_TEXT);

      // Mark as processed in column G
      sheet.getRange(i + 1, CONFIG.columns.flag + 1).setValue('✅');
      processedCount++;
    }

    Logger.log(`Created ${processedCount} text documents and updated flags.`);
    if (processedCount > 0) {
      SpreadsheetApp.getUi().alert(`Created ${processedCount} text documents in Drive.`);
    }
    
    return processedCount;
    
  } catch (error) {
    Logger.log(`Error in exportRowsToDriveTextDocs: ${error.message}`);
    SpreadsheetApp.getUi().alert(`Error: ${error.message}`);
    return 0;
  }
}


function runFullProcess() {
  try {
    const extractedCount = extractZSamEmails();
    
    if (extractedCount > 0) {
      Utilities.sleep(2000); // Brief pause between operations
      const exportedCount = exportRowsToDriveTextDocs();
      
      Logger.log(`Daily process: ${extractedCount} emails processed, ${exportedCount} files created`);
      SpreadsheetApp.getUi().alert(`Daily process complete: ${extractedCount} emails processed, ${exportedCount} files created`);
    } else {
      Logger.log('Daily process: No new emails to process');
      // Don't show alert for silent daily runs when there's nothing new
    }
    
  } catch (error) {
    Logger.log(`Error in runFullProcess: ${error.message}`);
    SpreadsheetApp.getUi().alert(`Error during full process: ${error.message}`);
  }
}


function setupDailyTrigger() {
  // Remove existing triggers first
  removeDailyTrigger();
  
  // Create new daily trigger
  ScriptApp.newTrigger('runFullProcess')
    .timeBased()
    .everyDays(1)
    .atHour(9) // Run at 9 AM
    .create();
    
  SpreadsheetApp.getUi().alert('Daily trigger set up successfully! Will run at 9 AM each day.');
  Logger.log('Daily trigger created for runFullProcess at 9 AM');
}


function removeDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removedCount = 0;
  
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runFullProcess') {
      ScriptApp.deleteTrigger(trigger);
      removedCount++;
    }
  });
  
  if (removedCount > 0) {
    SpreadsheetApp.getUi().alert(`Removed ${removedCount} existing trigger(s).`);
    Logger.log(`Removed ${removedCount} triggers`);
  } else {
    SpreadsheetApp.getUi().alert('No existing triggers found.');
  }
}


function listCurrentTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    Logger.log(`Trigger: ${trigger.getHandlerFunction()}, Type: ${trigger.getEventType()}`);
  });
}