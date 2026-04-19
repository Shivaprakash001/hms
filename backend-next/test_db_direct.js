const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Strip brackets if they were accidentally included
const dbUrl = process.env.DATABASE_URL.replace('[', '').replace(']', '');

console.log('Testing Postgres connection to pooler...');

const client = new Client({
  connectionString: dbUrl,
});

async function test() {
  try {
    await client.connect();
    console.log('Postgres Connection SUCCESS!');
    const res = await client.query('SELECT NOW()');
    console.log('Server time:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Postgres Connection FAILED:', err.message);
  }
}

test();
