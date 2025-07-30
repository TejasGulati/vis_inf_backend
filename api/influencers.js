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
    let sqlQuery;
    let params = [];

    // --- GET ALL (NO FILTERS) ---
    if (
      method === 'GET' &&
      !query.id &&
      !query.username &&
      !query.location &&
      !query.category &&
      !query.categories_combined &&
      !query.locations_combined
    ) {
      // Return unique influencers with all their combined data
      sqlQuery = `
        SELECT DISTINCT
          id, 
          username, 
          category, 
          categories_combined, 
          location, 
          locations_combined,
          account_tier,
          robust_tier_adjusted_engagement_rate,
          total_posts_analyzed,
          risk_level,
          risk_score,
          risk_factors,
          credibility_score,
          average_days_between_posts,
          posting_consistency_score,
          hashtag_frequency,
          top_hashtag,
          top_hashtag_percentage,
          total_unique_hashtags,
          ai_analysis
        FROM scrapped.influencer_ui 
        ORDER BY username
      `;
      result = await pool.query(sqlQuery);
      return res.status(200).json(result.rows);
    }

    // --- GET BY ID ---
    if (method === 'GET' && query.id) {
      sqlQuery = 'SELECT * FROM scrapped.influencer_ui WHERE id = $1 LIMIT 1';
      params = [query.id];
      result = await pool.query(sqlQuery, params);
    }

    // --- GET BY USERNAME ---
    else if (method === 'GET' && query.username) {
      sqlQuery = 'SELECT * FROM scrapped.influencer_ui WHERE username = $1 LIMIT 1';
      params = [query.username];
      result = await pool.query(sqlQuery, params);
    }

    // --- GET BY LOCATION ---
    else if (method === 'GET' && query.location) {
      sqlQuery = `
        SELECT DISTINCT
          id, username, category, categories_combined, 
          location, locations_combined,
          account_tier, robust_tier_adjusted_engagement_rate,
          total_posts_analyzed, risk_level, risk_score, risk_factors,
          credibility_score, average_days_between_posts, posting_consistency_score,
          hashtag_frequency, top_hashtag, top_hashtag_percentage, total_unique_hashtags,
          ai_analysis
        FROM scrapped.influencer_ui 
        WHERE location = $1 
        ORDER BY username
      `;
      params = [query.location];
      result = await pool.query(sqlQuery, params);
    }

    // --- GET BY CATEGORY ---
    else if (method === 'GET' && query.category) {
      sqlQuery = `
        SELECT DISTINCT
          id, username, category, categories_combined, 
          location, locations_combined,
          account_tier, robust_tier_adjusted_engagement_rate,
          total_posts_analyzed, risk_level, risk_score, risk_factors,
          credibility_score, average_days_between_posts, posting_consistency_score,
          hashtag_frequency, top_hashtag, top_hashtag_percentage, total_unique_hashtags,
          ai_analysis
        FROM scrapped.influencer_ui 
        WHERE category = $1 
        ORDER BY username
      `;
      params = [query.category];
      result = await pool.query(sqlQuery, params);
    }

    // --- GET BY CATEGORIES_COMBINED ---
    else if (method === 'GET' && query.categories_combined) {
      sqlQuery = `
        SELECT DISTINCT
          id, username, category, categories_combined, 
          location, locations_combined,
          account_tier, robust_tier_adjusted_engagement_rate,
          total_posts_analyzed, risk_level, risk_score, risk_factors,
          credibility_score, average_days_between_posts, posting_consistency_score,
          hashtag_frequency, top_hashtag, top_hashtag_percentage, total_unique_hashtags,
          ai_analysis
        FROM scrapped.influencer_ui 
        WHERE categories_combined LIKE $1 
        ORDER BY username
      `;
      params = [`%${query.categories_combined}%`];
      result = await pool.query(sqlQuery, params);
    }

    // --- GET BY LOCATIONS_COMBINED ---
    else if (method === 'GET' && query.locations_combined) {
      sqlQuery = `
        SELECT DISTINCT
          id, username, category, categories_combined, 
          location, locations_combined,
          account_tier, robust_tier_adjusted_engagement_rate,
          total_posts_analyzed, risk_level, risk_score, risk_factors,
          credibility_score, average_days_between_posts, posting_consistency_score,
          hashtag_frequency, top_hashtag, top_hashtag_percentage, total_unique_hashtags,
          ai_analysis
        FROM scrapped.influencer_ui 
        WHERE locations_combined LIKE $1 
        ORDER BY username
      `;
      params = [`%${query.locations_combined}%`];
      result = await pool.query(sqlQuery, params);
    }

    // --- NOT FOUND ---
    if (!result || result.rows.length === 0) {
      return res.status(404).json({ error: 'Influencer not found' });
    }

    // --- PROCESS RESULTS ---
    let responseData;
    
    if (result.rows.length === 1) {
      // Single influencer
      responseData = result.rows[0];
    } else {
      // Multiple influencers - remove duplicates by id+username
      const uniqueInfluencers = new Map();
      
      result.rows.forEach(row => {
        const key = `${row.id}-${row.username}`;
        if (!uniqueInfluencers.has(key)) {
          uniqueInfluencers.set(key, row);
        }
      });
      
      responseData = Array.from(uniqueInfluencers.values());
    }

    // --- PARSE AI JSON (if any and needed) ---
    const processAiAnalysis = (influencer) => {
      if (influencer.ai_analysis?.startsWith && influencer.ai_analysis.startsWith('```json')) {
        try {
          influencer.ai_analysis = JSON.parse(
            influencer.ai_analysis.replace(/```json\s*/, '').replace(/\s*```$/, '')
          );
        } catch (e) {
          console.error('Error parsing AI analysis:', e);
        }
      }
      return influencer;
    };

    if (Array.isArray(responseData)) {
      responseData = responseData.map(processAiAnalysis);
    } else {
      responseData = processAiAnalysis(responseData);
    }

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}