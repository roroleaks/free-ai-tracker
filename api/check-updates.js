import 'dotenv/config';
import { fetchGitHubReleases } from '../src/scrapers/github-rss.js';
import { fetchSocialUpdates } from '../src/scrapers/social-monitor.js';
import { scanFreeTiers } from '../src/scrapers/free-tier-scanner.js';
import { filterAndScore } from '../src/services/ai-filter.js';
import { sendNotification } from '../src/services/email-notifier.js';
import { logger } from '../src/utils/logger.js';
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const startTime = Date.now();
  logger.info('Starting AI offer check...');

  try {
    const [githubReleases, socialUpdates, freeTiers] = await Promise.allSettled([
      fetchGitHubReleases(),
      fetchSocialUpdates(),
      scanFreeTiers(),
    ]);

    const allFindings = [
      ...(githubReleases.status === 'fulfilled' ? githubReleases.value : []),
      ...(socialUpdates.status === 'fulfilled' ? socialUpdates.value : []),
      ...(freeTiers.status === 'fulfilled' ? freeTiers.value : []),
    ];

    logger.info(`Collected ${allFindings.length} raw findings`);

    const scoredFindings = await filterAndScore(allFindings);
    const relevantFindings = scoredFindings.filter(f => f.score >= 0.6);

    if (relevantFindings.length > 0) {
      await sendNotification(relevantFindings);
      logger.info(`Sent notification with ${relevantFindings.length} relevant findings`);
    } else {
      logger.info('No relevant findings to notify');
    }

    const result = {
      timestamp: new Date().toISOString(),
      totalFindings: allFindings.length,
      relevantFindings: relevantFindings.length,
      findings: relevantFindings,
    };

    await kv.set('latest_ai_offers', result);
    logger.info('Saved offers to Vercel KV');

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