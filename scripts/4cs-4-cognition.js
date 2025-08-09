
// Script to use OpenAI to analyze campaign performance. See 8020agent.com for more

const OPENAI_API_KEY = ''; // Add your OpenAI API key here
const SYSTEM_PROMPT = `
You are an expert Google Ads analyst. 
Provide a clear 2-sentence summary of campaign performance.
Focus on the most significant changes or patterns.
`;
  
  function main() {
    try {
      // Validate API key
      if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key is missing. Please add your API key to the OPENAI_API_KEY constant.');
      }
  
      // Get campaign data with error handling
      const data = getCampaignData();
      if (!data.length) {
        Logger.log('⚠️ Warning: No campaign data found to analyze');
        return;
      }
  
      Logger.log(`ℹ️ Retrieved data for ${data.length} campaigns`);
      
      // Make API request with error handling
      const aiResponse = getAIAnalysis(data);
      Logger.log('✅ AI Analysis: ' + aiResponse);
  
    } catch (error) {
      logError('Main execution error', error);
    }
  }
  
  function getCampaignData() {
    try {
      const data = [];
      const campaigns = AdsApp.campaigns()
        .withCondition('Status = ENABLED')
        .forDateRange('YESTERDAY')
        .get();
      
      if (!campaigns.hasNext()) {
        Logger.log('ℹ️ No enabled campaigns found for yesterday');
        return data;
      }
      
      while (campaigns.hasNext()) {
        try {
          const campaign = campaigns.next();
          const stats = campaign.getStatsFor('YESTERDAY');
          
          data.push({
            name: campaign.getName(),
            impressions: stats.getImpressions(),
            clicks: stats.getClicks(),
            cost: stats.getCost(),
            conversions: stats.getConversions()
          });
        } catch (campaignError) {
          logError('Error processing campaign', campaignError);
          // Continue with next campaign
          continue;
        }
      }
      
      return data;
      
    } catch (error) {
      logError('Error getting campaign data', error);
      return [];
    }
  }
  
  function getAIAnalysis(data) {
    try {
      const prompt = {
        model: "gpt-4",  // Fixed typo in model name
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(data) }
        ]
      };
      
      // Validate data before sending
      if (!validatePromptData(prompt)) {
        throw new Error('Invalid prompt data structure');
      }
      
      const response = makeAPIRequest(prompt);
      
      // Validate response
      if (!response.choices || !response.choices[0] || !response.choices[0].message) {
        throw new Error('Invalid response structure from OpenAI API');
      }
      
      return response.choices[0].message.content;
      
    } catch (error) {
      logError('Error getting AI analysis', error);
      return 'Unable to generate AI analysis due to error';
    }
  }
  
  function makeAPIRequest(prompt) {
    try {
      const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + OPENAI_API_KEY,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(prompt),
        muteHttpExceptions: true // Prevent HTTP exceptions from throwing
      });
      
      const responseCode = response.getResponseCode();
      if (responseCode !== 200) {
        throw new Error(`API request failed with status ${responseCode}: ${response.getContentText()}`);
      }
      
      return JSON.parse(response.getContentText());
      
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }
  
  function validatePromptData(prompt) {
    return prompt &&
           prompt.messages &&
           Array.isArray(prompt.messages) &&
           prompt.messages.length >= 2 &&
           prompt.messages[0].role === 'system' &&
           prompt.messages[1].role === 'user';
  }
  
  function logError(context, error) {
    const timestamp = new Date().toISOString();
    Logger.log(`❌ ERROR [${timestamp}] ${context}:\n`);
    Logger.log(`   Message: ${error.message}`);
    Logger.log(`   Stack: ${error.stack || 'No stack trace available'}`);
    Logger.log('------------------------');
  }
