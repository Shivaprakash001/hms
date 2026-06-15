const { Client } = require('pg');

const urls = {
  pooler_5432: "postgresql://postgres.czxlsnmezoxpczuvanjk:Supa%4021200605@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?schema=test",
  pooler_6543: "postgresql://postgres.czxlsnmezoxpczuvanjk:Supa%4021200605@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?schema=test",
  direct: "postgresql://postgres.czxlsnmezoxpczuvanjk:Supa%4021200605@db.czxlsnmezoxpczuvanjk.supabase.co:5432/postgres?schema=test"
};

async function testUrl(name, connectionString) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  client.on('error', (err) => {
    // Suppress unhandled error event crashes
    console.error(`[${name}] Client background error:`, err.message);
  });
  try {
    console.log(`Trying ${name}...`);
    await client.connect();
    console.log(`[${name}] Connected successfully!`);
    const res = await client.query('SELECT 1');
    console.log(`[${name}] Query result:`, res.rows);
    await client.end();
    return true;
  } catch (err) {
    console.error(`[${name}] Error:`, err.message);
    try { await client.end(); } catch (e) {}
    return false;
  }
}

async function main() {
  console.log("Starting DB ping tests...");
  for (let i = 1; i <= 30; i++) {
    console.log(`\n--- Loop ${i} ---`);
    let success = false;
    for (const [name, url] of Object.entries(urls)) {
      if (await testUrl(name, url)) {
        success = true;
      }
    }
    if (success) {
      console.log("\nOne or more connections succeeded!");
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

main().catch(console.error);
