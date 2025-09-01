# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Scripts & Sheets Mastery 2025** is an educational repository containing Google Ads Scripts and Google Apps Scripts for automating Google Ads workflows, created by Mike Rhodes for the 8020agent.com course.

The project focuses on teaching automation through AI-assisted code generation rather than traditional programming education - the philosophy is "You don't need to learn JavaScript - you need to know what's possible and ask AI to build it for you."

## Script Architecture & Patterns

### Core Script Structure
All Google Ads Scripts follow this standard pattern:
- **Configuration section** at top with constants (sheet URLs, email addresses, time periods)  
- **main() function** as entry point
- **Try/catch blocks** for error handling
- **Logger.log()** for console output and debugging
- **Conditional logic** to handle both single accounts and MCC (Manager) accounts

### MCC (Multi-Client Center) Architecture
Scripts automatically detect account type and adapt behavior:
```javascript
const accountType = typeof MccApp !== 'undefined' ? 'MCC' : 'Single';
```

Three MCC implementation patterns are used:
1. **Single Tab Pattern** (`1-mcc-simple.js`) - All data in one sheet
2. **Multi-Tab Pattern** (`2-mcc-multi-tab.js`) - One tab per account
3. **Multi-Sheet Pattern** (`3-mcc-sheet.js`) - Separate sheets with master control

### Data Flow Pattern
1. **Query**: Select data from Google Ads API
2. **Process**: Transform data (micros to dollars, calculate metrics)  
3. **Output**: Write to Google Sheets or log results

## Directory Structure

### `/scripts/`
- **`4cs/`** - Campaign monitoring scripts based on 4 C's methodology (Check, Chart, Change, Cognition)
- **`mcc/`** - Multi-Client Center scripts for managing multiple Google Ads accounts
- **`simple/`** - Basic utility scripts for common tasks
- **`health/`** - Script monitoring and health check tools
- **`negatives/`** - Negative keyword management automation
- **`ngram/`** - Search term analysis tools
- **`apps-scripts/`** - Google Apps Scripts for Sheets/Gmail automation

### `/transcripts/`
Course transcripts from video modules

## Key Script Categories

### MCC Scripts (`/scripts/mcc/`)
- Handle multiple Google Ads accounts from single MCC account
- Automatically adapt to single vs MCC environment
- Include test mode with specific Customer ID filtering
- Optimize for 6-minute execution time limit

### 4 C's Framework Scripts (`/scripts/4cs/`)
Campaign monitoring system:
- **Check** (`4cs-1-check.js`) - Zero impression alerts
- **Chart** (`4cs-2-chart.js`) - Performance visualization
- **Change** (`4cs-3-change.js`) - Automated adjustments
- **Cognition** (`4cs-4-cognition.js`) - AI-powered insights

### Apps Scripts (`/scripts/apps-scripts/`)
Google Workspace automation using Google Apps Script (not Google Ads Scripts)

## Configuration Requirements

### Google Ads Scripts
- Require Google Ads account with scripting access
- MCC scripts need Manager (MCC) account access
- Email alerts require valid email addresses in configuration

### Common Configuration Variables
- `SHEET_URL` - Google Sheets destination (blank creates new sheet)
- `YOUR_EMAIL` - Email address for alerts and notifications  
- `CID_FOR_TESTING` - Customer IDs for testing specific accounts
- `SELECTED_TIME_PERIOD` - Date ranges like 'LAST_7_DAYS', 'LAST_30_DAYS'

## Development Approach

### AI-First Development
- Use AI (ChatGPT/Claude) to generate and modify scripts
- Start with existing working examples from the repository
- Iterate through AI-assisted modifications rather than manual coding
- Focus on describing desired functionality rather than writing code

### Script Testing
- Always test scripts in preview mode before production
- Use test Customer IDs for MCC script development
- Check logs for errors and execution details
- Verify Google Sheets integration and data accuracy

### Error Handling Standards
- Wrap main logic in try/catch blocks
- Send email alerts on script failures
- Include meaningful error messages in logs
- Graceful degradation when services unavailable

## Google Services Integration

### Google Ads API
Scripts use Google Ads API through AdsApp interface:
- Campaign, keyword, and search term data
- Performance metrics and statistics
- Account management and MCC operations

### Google Sheets Integration  
- Automatic spreadsheet creation when SHEET_URL empty
- Batch data writing for performance
- Dynamic sheet naming and tab organization

### Gmail Integration
- MailApp for sending alerts and notifications
- Email processing through GmailApp (Apps Scripts)

## Performance Considerations

### Execution Limits
- Google Ads Scripts: 30-minute maximum runtime
- MCC Scripts: 6-minute limit per account processing
- Apps Scripts: Various limits based on quotas

### Optimization Strategies
- Collect data in memory before writing to sheets
- Batch API calls to minimize requests
- Use efficient data structures for large datasets
- Optimize queries with appropriate conditions and date ranges

## Course Integration

This repository serves as the practical component of the Scripts & Sheets Mastery 2025 course, with 9 modules covering:
1. Script Basics
2. Custom Script Development  
3. Script Structure Understanding
4. AI-Powered Script Creation
5. Google Sheets Integration
6. MCC Script Patterns
7. Apps Script Automation
8. Advanced AI Techniques (Mega Prompt)
9. Code Management & GitHub

Scripts are designed as educational examples that can be modified and extended for specific business needs through AI assistance.