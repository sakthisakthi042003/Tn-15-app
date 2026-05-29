const mysql = require("mysql2/promise");
const { env } = require("../config/env");

let pool = null;

function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: env.mysql.host,
    port: env.mysql.port,
    user: env.mysql.user,
    password: env.mysql.password,
    database: env.mysql.database,
    connectionLimit: 10,
    enableKeepAlive: true,
  });
  return pool;
}

async function checkDb() {
  const p = getPool();
  const conn = await p.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

module.exports = { getPool, checkDb };

