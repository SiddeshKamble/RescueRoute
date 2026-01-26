const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  user: process.env.PGUSER || "siddesh",
  password: process.env.PGPASSWORD || "",
  database: process.env.PGDATABASE || "rescueroute"
});

async function testConnection() {
  await pool.query("SELECT 1");
  const r = await pool.query("SELECT current_database() AS db, current_user AS usr");
  console.log("Connected to Postgres");
  console.log("PG:", r.rows[0]);
}

module.exports = { pool, testConnection };
