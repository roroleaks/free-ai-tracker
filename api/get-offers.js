import { kv } from '../src/utils/kv.js';

export default async function handler(req, res) {
  try {
    const data = await kv.get('latest_ai_offers');

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'No offers found. Cron job may not have run yet.',
      });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error('Failed to fetch offers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}