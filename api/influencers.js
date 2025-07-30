import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

export default async function handler(req, res) {
  const { method, query } = req;

  // CORS Headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://visualize-inf-pob4.vercel.app',
    'https://influencer-analytics-dashboard.vercel.app',
  ];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let result;

    // ✅ Get all influencers with specific fields
    if (method === 'GET' && !query.id && !query.username) {
      result = await pool.query(`
        SELECT 
          id,
          username,
          robust_tier_adjusted_engagement_rate,
          credibility_score->>'value' AS credibility_score,
          account_tier
        FROM scrapped.instagram_profile_analysis
      `);
      return res.status(200).json(result.rows);
    }

    // ✅ Fetch single influencer by ID or username (kept unchanged)
    if (method === 'GET' && query.id) {
      result = await pool.query(
        'SELECT * FROM scrapped.instagram_profile_analysis WHERE id = $1',
        [query.id]
      );
    } else if (method === 'GET' && query.username) {
      result = await pool.query(
        'SELECT * FROM scrapped.instagram_profile_analysis WHERE username = $1',
        [query.username]
      );
    }

    if (!result || result.rows.length === 0) {
      return res.status(404).json({ error: 'Influencer not found' });
    }

    const influencer = result.rows[0];

    // Parse AI JSON if needed
    if (influencer.ai_analysis?.startsWith('```json')) {
      try {
        influencer.ai_analysis = JSON.parse(
          influencer.ai_analysis.replace(/```json\s*/, '').replace(/\s*```$/, '')
        );
      } catch (e) {
        console.error('Error parsing AI analysis:', e);
      }
    }

    influencer.stats = {
      followers: influencer.follower_count ?? null,
      engagement: influencer.robust_tier_adjusted_engagement_rate ?? null,
      credibility: influencer.credibility_score?.value ?? influencer.credibility_score ?? null,
      posts: influencer.total_posts_analyzed ?? null,
    };

    return res.status(200).json(influencer);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
