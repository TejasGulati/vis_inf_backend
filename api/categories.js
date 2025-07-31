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

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all unique categories with accurate influencer counts
    const result = await pool.query(`
      WITH unique_category_influencers AS (
        SELECT DISTINCT 
          category,
          username
        FROM scrapped.influencer_ui 
        WHERE category IS NOT NULL AND category != ''
      )
      SELECT 
        category,
        COUNT(username) as influencer_count
      FROM unique_category_influencers
      GROUP BY category 
      ORDER BY influencer_count DESC, category ASC
    `);

    const categories = result.rows.map(row => ({
      name: row.category,
      influencer_count: parseInt(row.influencer_count)
    }));

    return res.status(200).json({
      total_categories: categories.length,
      categories: categories
    });

  } catch (error) {
    console.error('Categories API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}