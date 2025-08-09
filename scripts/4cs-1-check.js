
// script to alert if campaigns had zero impr yesterday. See 8020agent.com for more

const YOUR_EMAIL = '';   // enter your email address here between the single quotes

function main() {
  try {
    const campaigns = AdsApp.campaigns()
      .withCondition('Status = ENABLED')
      .withCondition('CampaignExperimentType = BASE')
      .withCondition('ServingStatus = SERVING')
      .withCondition('Impressions = 0')
      .forDateRange('YESTERDAY')
      .get();

    if (campaigns.totalNumEntities() === 0) {
      Logger.log('All campaigns received impressions yesterday - no email sent');
      return;
    }

    const problemCampaigns = [];
    while (campaigns.hasNext()) {
      const campaign = campaigns.next();
      const budget = campaign.getBudget().getAmount();
      problemCampaigns.push({
        name: campaign.getName(),
        budget: budget
      });
    }

    const subject = '8020agent Alert: Campaigns With Zero Impressions';

    MailApp.sendEmail({
      to: YOUR_EMAIL,
      subject: subject,
      body: `The following campaigns had zero impressions yesterday:\n\n${problemCampaigns.map(campaign =>
        `${campaign.name} (Daily Budget: $${campaign.budget})`
      ).join('\n')
        }\n\nThis is an automated alert sent by a google ads script.`
    });

    Logger.log(`Alert email sent to ${YOUR_EMAIL} for ${problemCampaigns.length} campaigns`);
  } catch (error) {
    Logger.log(`Error in campaign monitoring script: ${error.message}`);
    MailApp.sendEmail({
      to: YOUR_EMAIL,
      subject: 'Error in Google Ads Monitoring Script',
      body: `The campaign monitoring script encountered an error: ${error.message}`
    });
  }
}