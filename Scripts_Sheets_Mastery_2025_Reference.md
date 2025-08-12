# Scripts & Sheets Mastery 2025 - Complete Course Reference

*Comprehensive reference document for writers, AI, and content creators*

## Course Overview

**Scripts & Sheets Mastery 2025** is a comprehensive course by Mike Rhodes that teaches how to automate Google Ads workflows using scripts and Google Sheets, with a focus on leveraging AI to write and modify code rather than learning programming from scratch.

**Key Philosophy**: "You don't need to learn JavaScript - you need to know what's possible and ask AI to build it for you."

---

## Module 1: Script Basics

### Core Concepts
- **Purpose**: Automate repetitive manual work in Google Ads
- **Benefits**: Scale operations, proactive notifications, data centralization
- **Limitations**: 30-minute runtime limit, Google Ads only, can't make strategic decisions

### Basic Script Structure
- All scripts must have a `main()` function
- Scripts can pull data from Google Ads and send to Google Sheets
- Use `logger.log()` for output messages
- Scripts run in Google Ads Tools > Scripts section

### Getting Started Process
1. Copy code from provided examples
2. Create new script in Google Ads
3. Paste code and run/preview
4. View logs for output and errors
5. Authorize when connecting to external services (Google Sheets)

---

## Module 2: Custom Scripts

### Key Tools Introduced
- **Cursor**: Code editor with built-in AI assistance
- **AI Integration**: Use ChatGPT/Claude to explain and modify scripts
- **Script Library**: Build collection of reusable scripts

### Customization Workflow
1. Start with existing script (from course or online)
2. Use AI to explain what the code does
3. Ask AI to modify for specific needs
4. Test in Google Ads account
5. Save working versions in Cursor

### Best Practices
- Always test scripts before production use
- Use AI to understand code before modifying
- Build library of working scripts
- Start simple and iterate

---

## Module 3: Understanding Scripts

### Script Components
- **Constants**: Configuration variables at top (sheet URLs, date ranges)
- **Main Function**: Entry point that runs when script executes
- **Comments**: Explain what code does (use AI to add these)
- **Error Handling**: Try/catch blocks for graceful failure
- **Logging**: Console output for debugging and user feedback

### Data Flow Pattern
1. **Query**: Select data from Google Ads (campaigns, keywords, etc.)
2. **Process**: Transform data (convert micros to dollars, calculate metrics)
3. **Output**: Send to Google Sheets or display in logs

### Common Patterns
- Check if spreadsheet exists, create if needed
- Collect all data in memory before writing to sheets
- Use conditional logic for different scenarios
- Format data appropriately (dates, numbers, text)

---

## Module 4: Create with Scripts

### AI-Assisted Script Creation
- **Prompt Engineering**: Describe what you want the script to do
- **Iterative Development**: Start simple, add features gradually
- **Error Handling**: Use AI to fix issues when scripts fail
- **Documentation**: Reference Google Ads API docs for accuracy

### Script Development Process
1. Describe desired functionality to AI
2. Review generated code for accuracy
3. Test in Google Ads account
4. Iterate based on errors or new requirements
5. Refine prompts for better results

### Common Use Cases
- **Data Collection**: Pull metrics from campaigns, keywords, search terms
- **Reporting**: Create automated reports in Google Sheets
- **Monitoring**: Set up alerts for budget, performance issues
- **Analysis**: Calculate derived metrics (ROAS, CPA, conversion rates)

---

## Module 5: Google Sheet Formulas

### Essential Formulas
- **QUERY**: Filter and sort data (similar to SQL SELECT FROM WHERE)
- **UNIQUE**: Remove duplicate values
- **IMPORTRANGE**: Pull data from other sheets
- **ARRAYFORMULA**: Apply formulas to entire columns
- **Named Ranges**: Reference cells by name instead of coordinates

### Dynamic Dashboard Creation
1. **Data Source**: Raw data from scripts
2. **Helper Tabs**: Process and clean data
3. **Dynamic Dropdowns**: User selection controls
4. **Charts**: Visualize filtered data
5. **Auto-updating**: Scripts refresh data automatically

### Advanced Techniques
- **Conditional Formatting**: Highlight important data
- **Data Validation**: Create controlled input options
- **Cross-sheet References**: Link multiple sheets together
- **Automated Calculations**: Real-time metric updates

---

## Module 6: MCC Scripts

### Multi-Account Management
- **Single Installation**: One script runs across multiple accounts
- **Scalability**: Handle hundreds of accounts efficiently
- **Privacy**: Account owners can't see your scripts
- **Audit Capabilities**: Quick analysis of multiple accounts

### Three Implementation Patterns

#### Pattern 1: Single Tab, All Accounts
- One spreadsheet with all account data
- Simple structure, easy to analyze
- Good for basic reporting needs

#### Pattern 2: Multiple Tabs, Single Sheet
- One tab per account in same spreadsheet
- Better organization for detailed analysis
- Index tab for navigation

#### Pattern 3: Multiple Sheets, Master Control
- Separate sheet for each account
- Master sheet controls which accounts to process
- Most flexible but complex setup

### Best Practices
- Start with test accounts for development
- Optimize for execution time (6-minute limit)
- Collect data in memory before writing
- Use efficient data structures

---

## Module 7: Apps Scripts

### Google Workspace Automation
- **Gmail Integration**: Process emails automatically
- **Sheets Enhancement**: Add custom menus and functions
- **Drive Operations**: Create and manage files
- **Triggers**: Run scripts automatically (time-based, event-based)

### Use Case Examples
- **Email Processing**: Extract data from emails to sheets
- **Document Creation**: Generate reports from sheet data
- **Workflow Automation**: Connect different Google services
- **Custom Tools**: Build internal applications

### Development Approach
1. **Start Small**: Basic functionality first
2. **Iterate**: Add features gradually
3. **Test**: Verify each addition works
4. **Automate**: Set up triggers for hands-off operation

---

## Module 8: The Mega Prompt

### AI Prompt Engineering
- **Comprehensive Examples**: Include working code samples
- **Clear Instructions**: Specify requirements precisely
- **Context Provision**: Give AI relevant background information
- **Iterative Refinement**: Improve prompts based on results

### Prompt Structure
1. **Objective**: What you want to accomplish
2. **Examples**: Working code to use as reference
3. **Requirements**: Specific constraints and preferences
4. **Context**: Relevant background information
5. **Format**: How you want the output structured

### Best Practices
- Include working examples in prompts
- Be specific about requirements
- Provide context about your environment
- Test and refine prompts iteratively

---

## Module 9: Code Management

### GitHub Integration
- **Repository**: Central storage for all scripts
- **Version Control**: Track changes and improvements
- **Collaboration**: Share code with team members
- **Backup**: Secure storage of valuable scripts

### Workflow Management
1. **Local Development**: Work on scripts in Cursor
2. **Version Control**: Commit changes to GitHub
3. **Deployment**: Use scripts in Google Ads
4. **Iteration**: Continuous improvement cycle

---

## Key Technologies & Tools

### Core Platforms
- **Google Ads Scripts**: Automation within Google Ads
- **Google Sheets**: Data storage and analysis
- **Google Apps Script**: Workspace automation
- **Cursor**: AI-powered code editor

### AI Tools
- **ChatGPT/Claude**: Script generation and modification
- **Whisperflow**: Voice-to-text for faster communication
- **Built-in AI**: Cursor's integrated AI assistance

### Data Sources
- **Google Ads API**: Campaign, keyword, and performance data
- **Google Sheets API**: Spreadsheet operations
- **Gmail API**: Email processing capabilities

---

## Common Use Cases & Applications

### Marketing Automation
- **Performance Monitoring**: Track KPIs across accounts
- **Budget Management**: Automated budget alerts and adjustments
- **Keyword Optimization**: Identify opportunities and issues
- **Competitive Analysis**: Monitor market changes

### Reporting & Analysis
- **Client Reporting**: Automated report generation
- **Data Visualization**: Charts and dashboards
- **Trend Analysis**: Historical performance tracking
- **ROI Optimization**: Performance metric calculations

### Operational Efficiency
- **Task Automation**: Reduce manual work
- **Quality Control**: Automated checks and alerts
- **Data Hygiene**: Clean and validate data
- **Workflow Integration**: Connect different systems

---

## Development Best Practices

### Code Quality
- **Error Handling**: Graceful failure with meaningful messages
- **Logging**: Comprehensive debugging information
- **Comments**: Clear explanation of functionality
- **Modular Design**: Break complex tasks into functions

### Performance Optimization
- **Batch Operations**: Minimize API calls
- **Memory Management**: Efficient data structures
- **Execution Time**: Stay within 6-minute limit
- **Resource Usage**: Minimize Google service calls

### User Experience
- **Clear Instructions**: Easy setup and configuration
- **Helpful Messages**: Informative error and success feedback
- **Flexible Configuration**: Easy customization options
- **Documentation**: Clear usage instructions

---

## Troubleshooting & Debugging

### Common Issues
- **API Errors**: Incorrect resource names or parameters
- **Permission Issues**: Missing authorization for services
- **Syntax Errors**: JavaScript code problems
- **Timeout Issues**: Scripts exceeding execution limits

### Debugging Strategies
- **Logging**: Add detailed output for troubleshooting
- **Error Messages**: Capture and analyze error details
- **Incremental Testing**: Test components individually
- **AI Assistance**: Use AI to identify and fix issues

### Support Resources
- **Google Documentation**: Official API references
- **AI Tools**: ChatGPT, Claude for problem-solving
- **Community**: Online forums and groups
- **Course Materials**: Examples and templates

---

## Future Development & Expansion

### Advanced Capabilities
- **Machine Learning**: Predictive analytics and insights
- **API Integration**: Connect to external services
- **Custom Dashboards**: Interactive data visualization
- **Workflow Automation**: End-to-end process automation

### Skill Development
- **JavaScript Knowledge**: Understanding code structure
- **API Mastery**: Deep knowledge of Google services
- **Problem Solving**: Analytical thinking and troubleshooting
- **AI Collaboration**: Effective prompt engineering

### Business Applications
- **Agency Services**: Client automation solutions
- **Internal Tools**: Company-specific applications
- **Product Development**: Commercial automation products
- **Consulting**: Implementation and optimization services

---

## Course Philosophy & Approach

### Learning Methodology
- **Practical Focus**: Learn by doing, not just theory
- **AI-First**: Leverage AI for code generation
- **Iterative Development**: Build, test, improve, repeat
- **Real-World Application**: Solve actual business problems

### Success Principles
- **Start Simple**: Basic functionality first
- **Test Everything**: Verify before production use
- **Document Everything**: Keep records of what works
- **Continuous Learning**: Always improving and expanding

### Mindset Shift
- **From Manual to Automated**: Eliminate repetitive tasks
- **From Reactive to Proactive**: Anticipate and prevent issues
- **From Data Entry to Analysis**: Focus on insights, not input
- **From Individual to Scalable**: Handle multiple accounts efficiently


