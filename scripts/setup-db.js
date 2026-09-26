const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupDatabase() {
  const client = await pool.connect();

  try {
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const seedPath = path.join(__dirname, '../db/seed.sql');

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const seedSql = fs.readFileSync(seedPath, 'utf8');

    console.log('Applying database schema...');
    await client.query(schemaSql);

    const taskCountResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM tasks'
    );

    const taskCount = taskCountResult.rows[0].count;

    if (taskCount > 0) {
      console.log(
        `Database already contains ${taskCount} task(s). Seed skipped.`
      );
    } else {
      console.log('Database is empty. Loading demo seed data...');
      await client.query(seedSql);
      console.log('Demo tasks and dependencies inserted successfully.');
    }

    console.log('Database setup completed successfully.');
  } catch (error) {
    console.error('Database setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();