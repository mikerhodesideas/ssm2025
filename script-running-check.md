# Script Health Monitor - Setup Guide

## What This Does
This monitoring system watches all your Google Ads scripts and alerts you when they stop running. Instead of discovering problems days later when a client asks why their reports stopped, you'll know within minutes.

## Initial Setup (5 minutes)

### Step 1: Prepare Your Sheet
1. Create a new Google Sheet or use an existing one
2. Open Extensions > Apps Script
3. Delete any existing code and paste the Script Health Monitor code
4. Save the project with a name like "Script Health Monitor"
5. Return to your sheet

### Step 2: Initialize the Monitor
1. Refresh your sheet (you should see a new "Script Monitor" menu)
2. Click Script Monitor > Initialize Sheet
3. This creates the Monitor tab with all necessary structure

### In the Monitor Tab, update these cells:
- **B2**: Add email addresses (comma-separated) for alerts
- **B3**: Keep as TRUE to receive alerts

### Step 4: Start Monitoring
1. Click Script Monitor > Set Up Monitoring Trigger
2. Authorize the script when prompted
3. The system now checks every 15 minutes automatically

## Adding Scripts to Monitor

### In the Monitor Sheet
For each Google Ads script you want to monitor:

1. **Script ID** (Column A): Choose a unique 3-digit number (100-999)
   - Can't start with 0
   - Must be unique across all your scripts
   - Example: 101, 205, 999

2. **Script Name** (Column B): Descriptive name for your reference
   - Example: "Daily Performance Report - Client ABC"
   - Include client name if monitoring multiple accounts

3. **Schedule** (Column C): How often the script should run
   - Choose from dropdown: Hourly, Daily, Weekly, Monthly, N/A
   - This determines when to alert you
   - Each option has a different color for easy scanning

4. **Timezone** (Column D): The timezone of your Google Ads account
   - Critical for accurate monitoring across different regions
   - Select from dropdown or type your own

### In Your Google Ads Scripts
Just two simple steps:

**Step 1:** Add this function anywhere in your script (outside of main):
```javascript
function logScriptHealth(scriptId) {
  const MONITOR_SHEET_URL = ''; // Update this once with your sheet
  
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
```
Update the `MONITOR_SHEET_URL` once with your monitor sheet's URL. Then you can copy this entire function to all your scripts.

**Step 2:** Add this single line at the end of your main() function:
```javascript
function main() {
  // Your existing script code here
  
  // Add this line at the very end of main():
  logScriptHealth(101); // Replace 101 with your script's unique ID
}
```

**Important:** If your script has multiple exit points (return statements), you'll need to add the `logScriptHealth()` call before each return. For example:
```javascript
function main() {
  // Some code...
  
  if (someCondition) {
    logScriptHealth(101); // Add before this return
    return;
  }
  
  // More code...
  
  logScriptHealth(101); // And at the normal end
}
```

The exact placement depends on your script's logic. Your developer or an AI assistant can help identify all the places where this needs to be added.

## How Alerts Work

### Timing Logic
The monitor gives scripts a grace period before alerting:
- **Hourly scripts**: Alert if not run for 90 minutes
- **Daily scripts**: Alert if not run for 25 hours  
- **Weekly scripts**: Alert if not run for 7.5 days
- **Monthly scripts**: Alert if not run for 32 days

### Alert Behavior
- You get ONE email per problem (not repeated spam)
- Email includes all scripts with issues
- Shows when each script last ran successfully
- Alerts auto-clear when scripts start running again

### What You'll See
The Monitor sheet shows:
- **Last Run**: Timestamp of most recent execution
- **Alert Sent**: System tracking (ignore this column)
- **Notes**: Your notes about the script (optional)

## Testing & Troubleshooting

### Test Your Setup
1. Click Script Monitor > Test Email Alert
2. Check that you receive the test email
3. If not, check your spam folder

### Common Issues

**Not receiving alerts?**
- Check email addresses in B2 are correct
- Look in spam/promotions folders
- Verify Send Alerts (B4) is TRUE

**Scripts showing as not run?**
- Verify the script ID matches between sheet and script
- Check timezone matches your Google Ads account
- Make sure the monitoring code is at the END of your script

**Getting false alerts?**
- Double-check the Schedule setting matches actual script schedule
- Remember scripts might run a few minutes late (that's why we have grace periods)

## Pro Tips

1. **Start Small**: Monitor your most critical scripts first
2. **Use Meaningful IDs**: Consider grouping (100s for reports, 200s for bid management, etc.)
3. **Document in Notes**: Use the Notes column for script location or special instructions
4. **Different Emails**: You can have different monitor sheets for different clients/teams
5. **Check Duration**: If duration suddenly changes, the script might be having issues

## Advanced Options

### Custom Alert Messages
- Edit cell B5 to change email subject
- Edit cell B6 to change email body introduction

### Disable Temporarily
- Set cell B4 to FALSE to pause all alerts
- Useful during maintenance or testing

### Manual Check
- Click Script Monitor > Check All Scripts Now
- Useful for immediate verification

## Questions?
This system saves hours of manual checking and prevents client-facing failures. Once set up, it runs itself. The peace of mind is worth the 5-minute setup.