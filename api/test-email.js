import { kv } from '../src/utils/kv.js';
import { sendNotification, sendWelcomeEmail } from '../src/services/email-notifier.js';
import { logger } from '../src/utils/logger.js';

const ALLOWED_RECIPIENT = 'raouf66@gmail.com';

const FALLBACK_OFFERS = [
  {
    title: 'DeepSeek-V3 Open Weights Release',
    description: 'State of the art 671B mixture-of-experts model available with open weights for local inference via Ollama and vLLM with free public checkpoints.',
    url: 'https://ollama.com/library/deepseek-v3',
    source: 'ollama',
    date: new Date().toISOString(),
    score: 0.98,
    isNew: true,
  },
  {
    title: 'Llama 3.3 70B Free Tier Inference',
    description: 'Ultra fast free tier inference on Groq Cloud and OpenRouter with generous rate limits for open-source AI developers.',
    url: 'https://openrouter.ai/models/meta-llama/llama-3.3-70b-instruct:free',
    source: 'openrouter',
    date: new Date().toISOString(),
    score: 0.95,
    isNew: true,
  },
  {
    title: 'Kaggle Models Hub: Gemma 2 9B Free Hosting',
    description: 'Google AI Gemma 2 available for free notebook GPU inference and serverless deployment directly on Kaggle.',
    url: 'https://kaggle.com/models/google/gemma-2',
    source: 'kaggle',
    date: new Date(Date.now() - 86400000).toISOString(),
    score: 0.91,
    isNew: false,
  },
  {
    title: 'DeepInfra: $5 Free Welcome API Credit',
    description: 'Get free serverless inference credits for Mistral, Qwen, and Llama models upon initial account creation.',
    url: 'https://deepinfra.com',
    source: 'deepinfra',
    date: new Date().toISOString(),
    score: 0.89,
    isNew: true,
    offerType: 'signup-credit',
  },
];

export default async function handler(req, res) {
  // Hardened security: only allows sending to raouf66@gmail.com
  const email = ALLOWED_RECIPIENT;
  const type = req.query?.type || 'digest';

  try {
    let offers = [];
    try {
      const cached = await kv.get('latest_ai_offers');
      if (cached && Array.isArray(cached.findings) && cached.findings.length > 0) {
        offers = cached.findings;
      }
    } catch (e) {
      logger.warn('Could not read cached offers from KV, using fallback:', e.message);
    }

    if (!offers || offers.length === 0) {
      offers = FALLBACK_OFFERS;
    }

    if (type === 'welcome') {
      await sendWelcomeEmail(email);
      return res.status(200).json({
        success: true,
        type: 'welcome',
        recipient: email,
        message: `Welcome email sent successfully to ${email}`,
      });
    }

    // Default: send weekly digest with offer cards
    await sendNotification(offers, email);

    return res.status(200).json({
      success: true,
      type: 'digest',
      recipient: email,
      offersCount: offers.length,
      message: `Weekly AI Digest (${offers.length} offers) sent successfully to ${email}`,
    });
  } catch (error) {
    logger.error('Failed to send test email:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
