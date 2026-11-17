import 'dotenv/config';
import { fetchGitHubReleases } from '../src/scrapers/github-rss.js';
import { fetchSocialUpdates } from '../src/scrapers/social-monitor.js';
import { scanFreeTiers } from '../src/scrapers/free-tier-scanner.js';
import { fetchAifreeOffers } from '../src/scrapers/aifree-rss.js';
import { fetchStudentPackOffers } from '../src/scrapers/student-pack.js';
import { fetchOllamaModels } from '../src/scrapers/ollama-models.js';
import { fetchKaggleModels } from '../src/scrapers/kaggle-models.js';
import { filterAndScore } from '../src/services/ai-filter.js';
import { sendNotification } from '../src/services/email-notifier.js';
import { logger } from '../src/utils/logger.js';
import { kv } from '../src/utils/kv.js';

export default async function handler(req, res) {
  if (process.env.VERCEL_ENV === 'production' && !process.env.CRON_SECRET) {
    console.error('[CRON] CRON_SECRET is required in production to protect /api/check-updates');
    return res.status(500).json({ success: false, error: 'Server misconfiguration: CRON_SECRET is required in production' });
  }

  const auth = req.headers?.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const startTime = Date.now();
  logger.info('Starting AI offer check...');

  try {
    const scraperTasks = [
      { name: 'github', run: fetchGitHubReleases },
      { name: 'social', run: fetchSocialUpdates },
      { name: 'freeTiers', run: scanFreeTiers },
      { name: 'aifree', run: fetchAifreeOffers },
      { name: 'studentPack', run: fetchStudentPackOffers },
      { name: 'ollama', run: fetchOllamaModels },
      { name: 'kaggle', run: fetchKaggleModels },
    ];

    const settled = await Promise.allSettled(scraperTasks.map(s => s.run()));

    const counts = {};
    const allFindings = [];

    settled.forEach((resItem, idx) => {
      const name = scraperTasks[idx].name;
      if (resItem.status === 'fulfilled') {
        const items = Array.isArray(resItem.value) ? resItem.value : [];
        counts[name] = items.length;
        allFindings.push(...items);
      } else {
        counts[name] = 'failed';
        logger.error(`Scraper "${name}" rejected:`, resItem.reason);
      }
    });

    const countSummary = scraperTasks.map(s => `${s.name}=${counts[s.name]}`).join(' ');
    logger.info(`Scraper counts: ${countSummary}`);

    logger.info(`Collected ${allFindings.length} raw findings`);

    const scoredFindings = await filterAndScore(allFindings);
    const relevantFindings = scoredFindings.filter(f => f.score >= 0.6);

    const result = {
      timestamp: new Date().toISOString(),
      totalFindings: allFindings.length,
      relevantFindings: relevantFindings.length,
      findings: relevantFindings,
    };

    await kv.set('latest_ai_offers', result);
    logger.info('Saved offers to KV');

    if (relevantFindings.length > 0) {
      const subscribers = await kv.smembers('subscribers');
      const recipients = subscribers.length > 0 ? subscribers : [process.env.EMAIL_TO].filter(Boolean);

      if (recipients.length > 0) {
        await Promise.allSettled(recipients.map((recipient) =>
          sendNotification(relevantFindings, recipient).then(
            () => logger.info(`Digest sent to ${recipient}`),
            (e) => logger.error(`Failed to email ${recipient}`, e),
          )
        ));
      } else {
        logger.warn('No subscribers and no EMAIL_TO configured — digest not emailed');
      }
    } else {
      logger.info('No relevant findings to notify');
    }

    const duration = Date.now() - startTime;
    logger.info(`Check completed in ${duration}ms`);

    res.status(200).json({
      success: true,
      duration,
      ...result,
    });
  } catch (error) {
    logger.error('Check failed', error);
    res.status(500).json({ success: false, error: error.message });
  }
}