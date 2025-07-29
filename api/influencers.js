const { Pool } = require('pg');

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

module.exports = async (req, res) => {
  // 1. Set CORS headers FIRST - this is crucial
  const allowedOrigins = [
    'https://visualize-inf-pob4.vercel.app',
    'http://localhost:3000' // for local development
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // 2. Handle OPTIONS preflight immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 3. Extract ID from either query param or path
    let influencerId = req.query.id || req.url.split('/').pop();

    // GET all influencers
    if (req.method === 'GET' && !influencerId) {
      const result = await pool.query(
        'SELECT id, username FROM scrapped.instagram_profile_analysis'
      );
      return res.status(200).json(result.rows);
    }

    // GET specific influencer
    if (req.method === 'GET' && influencerId) {
      const result = await pool.query(
        'SELECT * FROM scrapped.instagram_profile_analysis WHERE id = $1',
        [influencerId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Influencer not found' });
      }

      let influencer = result.rows[0];
      
      // Parse AI analysis
      if (influencer.ai_analysis) {
        try {
          let jsonString = influencer.ai_analysis;
          if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/```json\s*/, '').replace(/\s*```$/, '');
          }
          influencer.ai_analysis = JSON.parse(jsonString);
        } catch (e) {
          console.error('JSON parse error:', e);
          influencer.ai_analysis = { error: 'Invalid analysis data' };
        }
      }

      return res.status(200).json(influencer);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};