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

export default async function handler(req, res) {
  const { method, query } = req;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', 'https://visualize-inf-pob4.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (method === 'GET' && !query.id) {
      const result = await pool.query(
        'SELECT id, username FROM scrapped.instagram_profile_analysis'
      );
      return res.status(200).json(result.rows);
    }

    if (method === 'GET' && query.id) {
      const result = await pool.query(
        'SELECT * FROM scrapped.instagram_profile_analysis WHERE id = $1',
        [query.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Influencer not found' });
      }

      const influencer = result.rows[0];

      if (influencer.ai_analysis?.startsWith('```json')) {
        try {
          influencer.ai_analysis = JSON.parse(
            influencer.ai_analysis.replace(/```json\s*/, '').replace(/\s*```$/, '')
          );
        } catch (e) {
          console.error('Error parsing AI analysis:', e);
        }
      }

      return res.status(200).json(influencer);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
