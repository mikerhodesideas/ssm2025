# Scripts & Sheets Mastery 2025

A collection of Google Ads Scripts for advanced automation and reporting.

## Scripts

### 1. MCC Multi-Tab Report (`scripts/mcc-multi-tab.js`)
Creates a comprehensive Google Sheet with individual tabs for each account in your MCC, showing conversion data.

**Features:**
- Filters accounts by spending threshold
- Creates an index tab with links to all account tabs
- Customizable tab naming (CID or Account Name)
- Auto-resizes columns for better readability

**Configuration:**
```javascript
const thresholdSpend = 0; // Minimum spend to include account
const useAccountName = false; // true: use account names, false: use CIDs
```

### 2. Script Health Monitor (`script-health-monitor.js`)
Monitors multiple Google Ads scripts and sends alerts when they haven't run according to schedule.

**Features:**
- Tracks script execution across multiple accounts
- Sends email alerts for missed runs (only once per failure)
- Auto-clears alerts when scripts resume normal operation
- Supports hourly, daily, weekly, and monthly schedules

**Setup:**
1. Create a Google Sheet and run the script's `initializeSheet()` function
2. Add email recipients in cell B2
3. Set up 15-minute monitoring trigger
4. Add script IDs to monitor in the sheet

**In your monitored scripts, add:**
```javascript
function logScriptHealth(scriptId) {
  const MONITOR_SHEET_URL = 'YOUR_SHEET_URL';
  // ... (function code from instructions)
}

// Call at end of main():
logScriptHealth(101); // Your script's ID
```

## Installation

1. Copy the desired script to your Google Ads account
2. Update configuration variables at the top of each script
3. For MCC scripts, ensure you're running from an MCC account
4. Schedule scripts according to your needs

## Requirements

- Google Ads account with scripting access
- For MCC scripts: Manager (MCC) account access
- For Script Health Monitor: Google Sheets access

## Support

For issues or questions, contact Mike Rhodes at 8020agent.com