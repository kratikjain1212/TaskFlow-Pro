const { Pool, types } = require('pg');

require('dotenv').config();

// PostgreSQL DATE values are kept as YYYY-MM-DD strings.
// This avoids JavaScript timezone conversion shifting dates by one day.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  query: (text, params) =>
    pool.query(text, params)
};