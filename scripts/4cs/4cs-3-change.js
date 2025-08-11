
// Script to pause campaigns that spent more than a specified multiple of their daily budget yesterday. See 8020agent.com for more
// Set this to true ONLY if you understand this script will pause campaigns
const I_UNDERSTAND_THIS_MAKES_CHANGES = false;

// Set how much over budget triggers pause action (default is 2x)
const BUDGET_OVERSPEND_THRESHOLD = 2;

function main() {
  Logger.log('========================================');
  Logger.log('Campaign Overspend Monitor');
  Logger.log('========================================');
  Logger.log('Mode: ' + (I_UNDERSTAND_THIS_MAKES_CHANGES ? '🔴 LIVE (WILL PAUSE CAMPAIGNS)' : '🟡 PREVIEW (READ-ONLY)'));
  Logger.log('Threshold: ' + BUDGET_OVERSPEND_THRESHOLD + 'x daily budget');
  Logger.log('Date Range: Yesterday');
  Logger.log('========================================');
  Logger.log('');
  
  processAllCampaigns();
}

function processAllCampaigns() {
  try {
    let hasOverspendingCampaigns = false;
    let totalCampaignsChecked = 0;
    let overspendingCampaignCount = 0;
    let totalOverspend = 0;
    
    // Handle regular campaigns
    Logger.log('📊 Processing Regular Campaigns...');
    const campaigns = AdsApp.campaigns()
      .withCondition('Status = ENABLED')
      .forDateRange('YESTERDAY')
      .get();
      
    if (campaigns.hasNext()) {
      const result = processCampaignIterator(campaigns, 'Regular');
      hasOverspendingCampaigns = result.found || hasOverspendingCampaigns;
      totalCampaignsChecked += result.totalChecked;
      overspendingCampaignCount += result.overspendCount;
      totalOverspend += result.totalOverspend;
    } else {
      Logger.log('ℹ️ No regular campaigns found');
    }
    
    Logger.log('');
    
    // Handle Performance Max campaigns
    Logger.log('📊 Processing Performance Max Campaigns...');
    const pmaxCampaigns = AdsApp.performanceMaxCampaigns()
      .withCondition('Status = ENABLED')
      .forDateRange('YESTERDAY')
      .get();
      
    if (pmaxCampaigns.hasNext()) {
      const result = processCampaignIterator(pmaxCampaigns, 'PMax');
      hasOverspendingCampaigns = result.found || hasOverspendingCampaigns;
      totalCampaignsChecked += result.totalChecked;
      overspendingCampaignCount += result.overspendCount;
      totalOverspend += result.totalOverspend;
    } else {
      Logger.log('ℹ️ No Performance Max campaigns found');
    }
    
    Logger.log('');
    Logger.log('========================================');
    Logger.log('SUMMARY');
    Logger.log('========================================');
    Logger.log('📊 Total campaigns checked: ' + totalCampaignsChecked);
    
    if (hasOverspendingCampaigns) {
      Logger.log('⚠️ ' + overspendingCampaignCount + ' campaigns exceeded ' + BUDGET_OVERSPEND_THRESHOLD + 'x daily budget');
      Logger.log('💰 Total overspend: $' + totalOverspend.toFixed(2));
      Logger.log(I_UNDERSTAND_THIS_MAKES_CHANGES ? 
        '🛑 ' + overspendingCampaignCount + ' campaigns PAUSED' : 
        '🔄 ' + overspendingCampaignCount + ' campaigns would be paused (PREVIEW MODE)');
    } else {
      Logger.log('✅ No campaigns exceeded ' + BUDGET_OVERSPEND_THRESHOLD + 'x daily budget');
    }
    
    Logger.log('🎯 ' + (totalCampaignsChecked - overspendingCampaignCount) + ' campaigns stayed within budget');
    Logger.log('========================================');
    
  } catch (e) {
    Logger.log('❌ Error: ' + e.toString());
  }
}

function processCampaignIterator(campaignIterator, campaignTypeLabel) {
  let foundOverspending = false;
  let campaignCount = 0;
  let overspendingCount = 0;
  let totalOverspend = 0;
  
  while (campaignIterator.hasNext()) {
    try {
      const campaign = campaignIterator.next();
      const stats = campaign.getStatsFor('YESTERDAY');
      const budget = campaign.getBudget().getAmount();
      const spend = stats.getCost();
      const type = campaign.getAdvertisingChannelType ? 
        campaign.getAdvertisingChannelType() : 
        'PERFORMANCE_MAX';
      
      campaignCount++;
      
      if (spend > budget * BUDGET_OVERSPEND_THRESHOLD) {
        foundOverspending = true;
        overspendingCount++;
        const overspendAmount = spend - budget;
        totalOverspend += overspendAmount;
        
        Logger.log('----------------------------------------');
        Logger.log('🚨 OVERSPEND DETECTED');
        Logger.log('Campaign: ' + campaign.getName());
        Logger.log('Type: ' + type);
        Logger.log('Daily Budget: $' + budget.toFixed(2));
        Logger.log('Actual Spend: $' + spend.toFixed(2));
        
        const overspendPercent = ((spend/budget - 1) * 100).toFixed(1);
        Logger.log('Overspend: $' + overspendAmount.toFixed(2) + ' (' + overspendPercent + '%)');
        
        if (I_UNDERSTAND_THIS_MAKES_CHANGES) {
          campaign.pause();
          Logger.log('Status: 🛑 PAUSED');
        } else {
          Logger.log('Status: 🔄 Would be paused (PREVIEW MODE)');
        }
      } else {
        // Campaign is within budget
        Logger.log('----------------------------------------');
        Logger.log('✅ WITHIN BUDGET');
        Logger.log('Campaign: ' + campaign.getName());
        Logger.log('Type: ' + type);
        Logger.log('Daily Budget: $' + budget.toFixed(2));
        Logger.log('Actual Spend: $' + spend.toFixed(2));
        
        const spendPercent = (spend/budget * 100).toFixed(1);
        Logger.log('Status: OK (' + spendPercent + '% of budget)');
      }
    } catch (e) {
      Logger.log('❌ Error processing campaign: ' + e.toString());
      continue;
    }
  }
  
  if (campaignCount > 0) {
    Logger.log('----------------------------------------');
    Logger.log('Subtotal for ' + campaignTypeLabel + ' campaigns:');
    Logger.log('- Checked: ' + campaignCount);
    Logger.log('- Within budget: ' + (campaignCount - overspendingCount));
    Logger.log('- Overspending: ' + overspendingCount);
  }
  
  return {
    found: foundOverspending,
    totalChecked: campaignCount,
    overspendCount: overspendingCount,
    totalOverspend: totalOverspend
  };
}
  