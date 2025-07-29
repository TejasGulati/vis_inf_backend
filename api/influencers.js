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

  try {
    // ✅ GET /api/influencers → fetch all influencers
    if (method === 'GET' && !query.id) {
      const result = await pool.query(
        'SELECT id, username FROM scrapped.instagram_profile_analysis'
      );
      return res.status(200).json(result.rows);
    }

    // ✅ GET /api/influencers?id=123 → fetch specific influencer
    if (method === 'GET' && query.id) {
      const result = await pool.query(
        'SELECT * FROM scrapped.instagram_profile_analysis WHERE id = $1',
        [query.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Influencer not found' });
      }

      const influencer = result.rows[0];

      // Parse AI analysis safely if it's wrapped in markdown
      if (influencer.ai_analysis && influencer.ai_analysis.startsWith('```json')) {
        try {
          const jsonString = influencer.ai_analysis
            .replace(/```json\s*/, '')
            .replace(/\s*```$/, '');
          influencer.ai_analysis = JSON.parse(jsonString);
        } catch (parseError) {
          console.error('Error parsing AI analysis:', parseError);
        }
      }

      return res.status(200).json(influencer);
    }

    // ❌ Unsupported method
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};