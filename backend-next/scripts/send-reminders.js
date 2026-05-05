'use strict';

/**
 * WhatsApp Rent Reminder Script
 * Runs daily via GitHub Actions cron.
 *
 * Flow:
 *   1. Connect to PostgreSQL
 *   2. Ensure whatsapp_logs table exists (idempotent DDL)
 *   3. Fetch obligations due today, in 3 days, or 2+ days overdue
 *   4. Skip if already sent today (dedup)
 *   5. Send WhatsApp template message
 *   6. Log SENT / FAILED
 *   7. Continue on per-tenant errors (never crash the job)
 *
 * Templates (must be pre-approved in Meta Business Manager):
 *   rent_due_reminder_v2   — 3 days before due date
 *   rent_due_today_v2      — due today
 *   rent_overdue_reminder_v2 — 2+ days overdue
 *
 * Variables (positional, same order for all 3 templates):
 *   {{1}} tenant name
 *   {{2}} hostel name
 *   {{3}} amount  (e.g. ₹5,000)
 *   {{4}} due date (pre/today) or days overdue (overdue template)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { Pool } = require('pg');
const { sendWithRetry, sleep } = require('../lib/whatsapp');

// ─── DB pool ─────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10_000,
});

// ─── DDL — idempotent table + index ──────────────────────────────────────────

async function ensureLogTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
      phone         TEXT        NOT NULL,
      template      TEXT        NOT NULL,
      obligation_id UUID,
      status        TEXT        NOT NULL,
      error_message TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wl_obligation_template_date
      ON whatsapp_logs (obligation_id, template, (created_at::date));
  `);
}

// ─── query: fetch due obligations ────────────────────────────────────────────
//
// days_diff = CURRENT_DATE − due_date
//   -3  → 3 days before  → rent_due_reminder_v2
//    0  → due today       → rent_due_today_v2
//   2+  → overdue         → rent_overdue_reminder_v2

async function fetchDueTenants(client) {
  const { rows } = await client.query(`
    SELECT
      o.id                                               AS obligation_id,
      p.name                                             AS tenant_name,
      COALESCE(NULLIF(t.phone_1, ''), p.phone)           AS phone,
      o.total_amount                                     AS amount,
      TO_CHAR(o.rent_month, 'Mon YYYY')                  AS rent_month,
      TO_CHAR(o.due_date,   'DD-MM-YYYY')                AS due_date_fmt,
      COALESCE(h.name, 'Your Hostel')                    AS hostel_name,
      (CURRENT_DATE - o.due_date::date)::int             AS days_diff
    FROM rent_obligations o
    JOIN  tenants   t  ON t.id  = o.tenant_id
    JOIN  profiles  p  ON p.id  = t.profile_id
    LEFT JOIN room_allocations ra ON ra.tenant_id = t.id AND ra.is_active = true
    LEFT JOIN rooms   r  ON r.id  = ra.room_id
    LEFT JOIN hostels h  ON h.id  = r.hostel_id
    WHERE o.status    = 'PENDING'
      AND t.status    = 'ACTIVE'
      AND COALESCE(NULLIF(t.phone_1, ''), p.phone) IS NOT NULL
      AND (
            o.due_date::date = CURRENT_DATE + INTERVAL '3 days'
         OR o.due_date::date = CURRENT_DATE
         OR o.due_date::date <= CURRENT_DATE - INTERVAL '2 days'
      )
    ORDER BY o.due_date ASC
  `);
  return rows;
}

// ─── dedup check ─────────────────────────────────────────────────────────────

async function alreadySentToday(client, obligationId, template) {
  const { rows } = await client.query(
    `SELECT 1 FROM whatsapp_logs
     WHERE obligation_id  = $1
       AND template       = $2
       AND created_at::date = CURRENT_DATE
       AND status         = 'SENT'
     LIMIT 1`,
    [obligationId, template],
  );
  return rows.length > 0;
}

// ─── logging ─────────────────────────────────────────────────────────────────

async function logAttempt(client, phone, template, obligationId, status, errorMessage = null) {
  await client.query(
    `INSERT INTO whatsapp_logs (phone, template, obligation_id, status, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [phone, template, obligationId, status, errorMessage ? String(errorMessage).slice(0, 500) : null],
  );
}

// ─── template selector ───────────────────────────────────────────────────────

function pickTemplate(daysDiff) {
  if (daysDiff === -3) return 'rent_due_reminder_v2';    // 3 days before
  if (daysDiff === 0)  return 'rent_due_today_v2';        // due today
  if (daysDiff >= 2)   return 'rent_overdue_reminder_v2'; // 2+ days overdue
  return null;
}

// ─── test guards (removed before GitHub Actions) ───────────────────────────

const TEST_PHONE = process.env.TEST_PHONE || null; // e.g. '919876543210' — limits run to one number
const DRY_RUN    = process.env.DRY_RUN === 'true'; // log payload only, skip API call

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  const counts = { sent: 0, skipped: 0, failed: 0 };
  const tag = `[WhatsApp Reminders] ${new Date().toISOString()}`;
  if (TEST_PHONE) console.log(`${tag} — TEST MODE : only → ${TEST_PHONE}`);
  if (DRY_RUN)    console.log(`${tag} — DRY RUN   : no API calls`);

  try {
    await ensureLogTable(client);

    const rows = await fetchDueTenants(client);
    console.log(`${tag} — ${rows.length} obligation(s) queued`);

    for (const row of rows) {
      const template = pickTemplate(row.days_diff);

      if (!template) {
        counts.skipped++;
        continue;
      }

      // ── TEST GUARD ──────────────────────────────────────────────────────────
      if (TEST_PHONE) {
        const digits = String(row.phone || '').replace(/\D/g, '');
        const e164   = digits.startsWith('91') && digits.length === 12 ? digits : `91${digits}`;
        if (e164 !== TEST_PHONE) { counts.skipped++; continue; }
      }

      const isDuplicate = await alreadySentToday(client, row.obligation_id, template);
      if (isDuplicate) {
        console.log(`  SKIP  [${row.obligation_id}] ${row.tenant_name} — already sent today`);
        counts.skipped++;
        continue;
      }

      // Variable 6 differs by reminder type
      const var6 = row.days_diff >= 2
        ? `${row.days_diff} days`
        : row.due_date_fmt;

      // Template variables — positional order matches approved templates:
      // {{1}} obligation_id  {{2}} name  {{3}} hostel  {{4}} amount  {{5}} rent_month  {{6}} due_date/days
      const variables = [
        row.obligation_id,
        row.tenant_name,
        row.hostel_name,
        `₹${Number(row.amount).toLocaleString('en-IN')}`,
        row.rent_month,
        var6,
      ];

      // ── DRY RUN ─────────────────────────────────────────────────────────────
      if (DRY_RUN) {
        console.log(`  DRY   [${row.obligation_id}] ${row.tenant_name}`);
        console.log(`          to:           ${row.phone}`);
        console.log(`          templateName: ${template}`);
        console.log(`          variables:   `, variables);
        counts.skipped++;
        continue;
      }

      try {
        await sendWithRetry(row.phone, template, variables);
        await logAttempt(client, row.phone, template, row.obligation_id, 'SENT');
        console.log(`  SENT  [${row.obligation_id}] ${row.tenant_name} → ${row.phone} (${template})`);
        counts.sent++;
      } catch (err) {
        const msg = err.message || String(err);
        await logAttempt(client, row.phone, template, row.obligation_id, 'FAILED', msg);
        console.error(`  FAIL  [${row.obligation_id}] ${row.tenant_name} — ${msg}`);
        counts.failed++;
        // intentional: continue to next tenant
      }

      await sleep(200); // 200 ms rate-limit gap between messages
    }

    console.log(`${tag} — done | sent: ${counts.sent}  skipped: ${counts.skipped}  failed: ${counts.failed}`);

    if (counts.failed > 0) {
      process.exitCode = 1; // signal partial failure without crashing
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[WhatsApp Reminders] Fatal error:', err.message);
  process.exit(1);
});
