'use strict';

/**
 * WhatsApp Cloud API — reusable sender module
 * Env vars required:  WHATSAPP_TOKEN, PHONE_NUMBER_ID
 * Optional:           WHATSAPP_API  (default: https://graph.facebook.com/v19.0)
 */

const https = require('https');

const BASE_URL = (process.env.WHATSAPP_API || 'https://graph.facebook.com/v19.0').replace(/\/$/, '');

// ─── phone normaliser ────────────────────────────────────────────────────────

function formatPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) throw new Error(`Invalid phone number: "${raw}"`);
  if (digits.startsWith('91') && digits.length === 12) return digits; // already E.164
  if (digits.length === 10) return `91${digits}`;                      // Indian mobile
  return digits;                                                        // international passthrough
}

// ─── low-level POST ──────────────────────────────────────────────────────────

function _post(url, bodyStr, token) {
  return new Promise((resolve, reject) => {
    const u   = new URL(url);
    const buf = Buffer.from(bodyStr, 'utf8');
    const req = https.request(
      {
        hostname: u.hostname,
        path:     u.pathname + u.search,
        method:   'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': buf.length,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const err = new Error(`WhatsApp API ${res.statusCode}: ${raw.slice(0, 300)}`);
            err.status = res.statusCode;
            err.body   = parsed;
            reject(err);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
}

// ─── core send ───────────────────────────────────────────────────────────────

/**
 * Send a single approved template message.
 *
 * @param {string}   rawPhone      Recipient phone (10-digit or with country code)
 * @param {string}   templateName  Approved template name
 * @param {string[]} variables     Body component variables (positional)
 * @returns {Promise<object>}      WhatsApp API response
 */
async function sendTemplate(rawPhone, templateName, variables = []) {
  const token   = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.PHONE_NUMBER_ID;
  if (!token)   throw new Error('WHATSAPP_TOKEN env var is not set');
  if (!phoneId) throw new Error('PHONE_NUMBER_ID env var is not set');

  const phone = formatPhone(rawPhone);

  const components = variables.length > 0
    ? [{ type: 'body', parameters: variables.map((v) => ({ type: 'text', text: String(v) })) }]
    : [];

  const payload = JSON.stringify({
    messaging_product: 'whatsapp',
    to:   phone,
    type: 'template',
    template: {
      name:     templateName,
      language: { code: 'en' },
      ...(components.length > 0 ? { components } : {}),
    },
  });

  return _post(`${BASE_URL}/${phoneId}/messages`, payload, token);
}

// ─── retry wrapper ───────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Send with automatic retry on transient network/5xx errors.
 * 4xx errors (bad template, invalid number, etc.) are NOT retried.
 *
 * @param {string}   rawPhone
 * @param {string}   templateName
 * @param {string[]} variables
 * @param {number}   maxRetries   default 2  (up to 3 total attempts)
 */
async function sendWithRetry(rawPhone, templateName, variables = [], maxRetries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await sendTemplate(rawPhone, templateName, variables);
    } catch (err) {
      lastErr = err;
      const status = err.status ?? 0;
      if (status >= 400 && status < 500) throw err; // not retryable
      if (attempt < maxRetries) await sleep(1500 * (attempt + 1)); // 1.5s, 3s
    }
  }
  throw lastErr;
}

module.exports = { sendWithRetry, sendTemplate, formatPhone, sleep };
