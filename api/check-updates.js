import 'dotenv/config';
import { fetchGitHubReleases } from '../src/scrapers/github-rss.js';
import { fetchSocialUpdates } from '../src/scrapers/social-monitor.js';
import { scanFreeTiers } from '../src/scrapers/free-tier-scanner.js';
import { fetchAifreeOffers } from '../src/scrapers/aifree-rss.js';
import { fetchStudentPackOffers } from '../src/scrapers/student-pack.js';
import { filterAndScore } from '../src/services/ai-filter.js';
import { sendNotification } from '../src/services/email-notifier.js';
import { logger } from '../src/utils/logger.js';
import { kv } from '../src/utils/kv.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  logger.info('Starting AI offer check...');

  try {
    const [githubReleases, socialUpdates, freeTiers, aifreeOffers, studentPack] = await Promise.all([
      fetchGitHubReleases(),
      fetchSocialUpdates(),
      scanFreeTiers(),
      fetchAifreeOffers(),
      fetchStudentPackOffers(),
    ]);

    const allFindings = [
      ...githubReleases,
      ...socialUpdates,
      ...freeTiers,
      ...aifreeOffers,
      ...studentPack,
    ].filter(Boolean);

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
        for (const recipient of recipients) {
          try {
            await sendNotification(relevantFindings, recipient);
            logger.info(`Digest sent to ${recipient}`);
          } catch (e) {
            logger.error(`Failed to email ${recipient}`, e);
          }
        }
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