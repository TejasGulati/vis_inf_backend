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
  // Set CORS headers - allow all origins for development
  // For production, replace * with your frontend URL
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract ID from either query param or path
    let influencerId;
    
    // Handle /api/influencers?id=123
    if (req.query.id) {
      influencerId = req.query.id;
    } 
    // Handle /api/influencer/123
    else if (req.url.startsWith('/api/influencer/')) {
      influencerId = req.url.split('/')[3];
    }

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
      
      // Parse AI analysis if it exists
      if (influencer.ai_analysis) {
        try {
          // Handle both JSON strings and markdown-wrapped JSON
          let jsonString = influencer.ai_analysis;
          if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/```json\s*/, '').replace(/\s*```$/, '');
          }
          influencer.ai_analysis = JSON.parse(jsonString);
        } catch (parseError) {
          console.error('Error parsing AI analysis:', parseError);
          influencer.ai_analysis = { error: 'Could not parse analysis' };
        }
      }

      return res.status(200).json(influencer);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: err.message 
    });
  }
};