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
    'https://swaykart-frontend-next.vercel.app',
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

    // --- GET ALL ---
    if (
      method === 'GET' &&
      !query.id &&
      !query.username &&
      !query.location &&
      !query.category
    ) {
      result = await pool.query(
        'SELECT id, username FROM scrapped.influencer_ui'
      );
      return res.status(200).json(result.rows);
    }

    // --- GET BY ID ---
    if (method === 'GET' && query.id) {
      result = await pool.query(
        'SELECT * FROM scrapped.influencer_ui WHERE id = $1',
        [query.id]
      );
    }

    // --- GET BY USERNAME ---
    else if (method === 'GET' && query.username) {
      result = await pool.query(
        'SELECT * FROM scrapped.influencer_ui WHERE username = $1',
        [query.username]
      );
    }

    // --- GET BY LOCATION ---
    else if (method === 'GET' && query.location) {
      result = await pool.query(
        'SELECT * FROM scrapped.influencer_ui WHERE location = $1',
        [query.location]
      );
    }

    // --- GET BY CATEGORY ---
    else if (method === 'GET' && query.category) {
      result = await pool.query(
        'SELECT * FROM scrapped.influencer_ui WHERE category = $1',
        [query.category]
      );
    }

    // --- NOT FOUND ---
    if (!result || result.rows.length === 0) {
      return res.status(404).json({ error: 'Influencer not found' });
    }

    // --- PARSE AI JSON (if any and needed) ---
    const influencer = result.rows.length === 1 ? result.rows[0] : result.rows;
    if (
      !Array.isArray(influencer) &&
      influencer.ai_analysis?.startsWith('```json')
    ) {
      try {
        influencer.ai_analysis = JSON.parse(
          influencer.ai_analysis.replace(/```json\s*/, '').replace(/\s*```$/, '')
        );
      } catch (e) {
        console.error('Error parsing AI analysis:', e);
      }
    }

    return res.status(200).json(influencer);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
