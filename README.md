# Scripts & Sheets Mastery 2025

A collection of Google Ads Scripts for advanced automation and reporting.

## Script Folders

### `/mcc/` - MCC Account Management Scripts
Scripts designed to work with Manager (MCC) accounts, automatically handling multiple child accounts:

- **`1-mcc-simple.js`** - Basic conversion data export across all accounts
- **`2-mcc-multi-tab.js`** - Creates separate tabs for each account in a master sheet  
- **`3-mcc-sheet.js`** - Advanced MCC reporting with account selection and individual spreadsheet creation

All MCC scripts automatically detect single vs MCC accounts and adapt accordingly.

### `/4cs/` - The 4 C's Framework Scripts
Campaign monitoring scripts based on the 4 C's methodology (Check, Chart, Change, Cognition):

- **`4cs-1-check.js`** - Alerts when campaigns had zero impressions yesterday
- **`4cs-2-chart.js`** - Creates performance charts and visualizations
- **`4cs-3-change.js`** - Automated bid and budget adjustments
- **`4cs-4-cognition.js`** - AI-powered insights and recommendations

### `/health/` - Script Monitoring & Health
Tools for monitoring script performance and ensuring reliable execution:

- **`script-health-monitor.js`** - Monitors multiple scripts across accounts and sends alerts for failures
- **`script-health-post.md`** - Documentation for health monitoring setup
- **`script-log-mike.js`** - Centralized logging system
- **`script-running-check.md`** - Guide for verifying script execution

### `/negatives/` - Negative Keywords Management
Automated negative keyword research and application:

- **`neg-v8.js`** - Advanced negative keyword script with MCC support and account scheduling

### `/ngram/` - Search Term Analysis
N-gram analysis for search term optimization:

- **`ngram.js`** - Analyzes search terms to identify patterns and optimization opportunities

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