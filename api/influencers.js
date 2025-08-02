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
    'https://static-swaykart.vercel.app'
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
    let countResult;

    // Extract pagination and filter parameters
    const limit = parseInt(query.limit) || 16;
    const offset = parseInt(query.offset) || 0;
    const search = query.search || '';
    const category = query.category || '';
    const location = query.location || '';

    // --- GET BY ID (unchanged) ---
    if (method === 'GET' && query.id) {
      result = await pool.query(
        'SELECT * FROM scrapped.influencer_ui WHERE id = $1',
        [query.id]
      );
    }
    // --- GET BY USERNAME (unchanged) ---
    else if (method === 'GET' && query.username) {
      result = await pool.query(
        'SELECT * FROM scrapped.influencer_ui WHERE username = $1',
        [query.username]
      );
    }
    // --- PAGINATED GET WITH FILTERS ---
    else if (method === 'GET' && (limit || offset || search || category || location)) {
      // Build WHERE conditions
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      // Search filter
      if (search) {
        whereConditions.push(`username ILIKE $${paramIndex}`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Category filter
      if (category) {
        whereConditions.push(`(category = $${paramIndex} OR categories_combined ILIKE $${paramIndex + 1})`);
        queryParams.push(category);
        queryParams.push(`%${category}%`);
        paramIndex += 2;
      }

      // Location filter
      if (location) {
        whereConditions.push(`(location = $${paramIndex} OR locations_combined ILIKE $${paramIndex + 1})`);
        queryParams.push(location);
        queryParams.push(`%${location}%`);
        paramIndex += 2;
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      // Get total count for pagination info
      const countQuery = `
        SELECT COUNT(DISTINCT username) as total 
        FROM scrapped.influencer_ui 
        ${whereClause}
      `;
      
      countResult = await pool.query(countQuery, queryParams);
      const totalCount = parseInt(countResult.rows[0].total);

      // Get paginated results with deduplication
      const dataQuery = `
        SELECT DISTINCT ON (username) 
          id, username, category, categories_combined, location, locations_combined
        FROM scrapped.influencer_ui 
        ${whereClause}
        ORDER BY username, id
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(limit, offset);
      result = await pool.query(dataQuery, queryParams);

      // Return paginated response
      return res.status(200).json({
        influencers: result.rows,
        totalCount,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + limit < totalCount,
        limit,
        offset
      });
    }
    // --- GET ALL (fallback for legacy support) ---
    else if (method === 'GET') {
      result = await pool.query(
        'SELECT id, username, category, categories_combined, location, locations_combined FROM scrapped.influencer_ui'
      );
      return res.status(200).json(result.rows);
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