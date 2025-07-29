const { Pool } = require('pg');

// PostgreSQL connection pool
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
  const { method, query } = req;

  // ✅ Set CORS headers to allow cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', 'https://visualize-inf-pob4.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ✅ Handle CORS preflight request
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ✅ GET /api/influencer → fetch all
    if (method === 'GET' && !query.id) {
      const result = await pool.query(
        'SELECT id, username FROM scrapped.instagram_profile_analysis'
      );
      return res.status(200).json(result.rows);
    }

    // ✅ GET /api/influencer?id=xxx → fetch by ID
    if (method === 'GET' && query.id) {
      const id = query.id.trim(); // sanitize input
      const result = await pool.query(
        'SELECT * FROM scrapped.instagram_profile_analysis WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Influencer not found' });
      }

      const influencer = result.rows[0];

      // ✅ Try parsing AI analysis if markdown-encoded
      if (influencer.ai_analysis?.startsWith('```json')) {
        try {
          influencer.ai_analysis = JSON.parse(
            influencer.ai_analysis.replace(/```json\s*/, '').replace(/\s*```$/, '')
          );
        } catch (err) {
          console.error('AI analysis parse error:', err);
        }
      }

      return res.status(200).json(influencer);
    }

    // ❌ Any other method
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
