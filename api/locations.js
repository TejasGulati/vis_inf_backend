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
  const { method } = req;

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

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await pool.query(`
      SELECT 
        location,
        COUNT(DISTINCT id) AS influencer_count
      FROM scrapped.influencer_ui
      WHERE location IS NOT NULL AND location != ''
      GROUP BY location
      ORDER BY influencer_count DESC, location ASC
    `);

    const locations = result.rows.map(row => {
      const locationParts = row.location.split(',');
      const city = locationParts[0]?.trim() || '';
      const state = locationParts[1]?.trim() || '';

      return {
        name: row.location,
        city,
        state,
        influencer_count: parseInt(row.influencer_count),
      };
    });

    const grouped_by_state = locations.reduce((acc, location) => {
      const state = location.state || 'Other';
      if (!acc[state]) acc[state] = [];
      acc[state].push(location);
      return acc;
    }, {});

    return res.status(200).json({
      total_locations: locations.length,
      locations,
      grouped_by_state,
    });

  } catch (error) {
    console.error('Locations API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
