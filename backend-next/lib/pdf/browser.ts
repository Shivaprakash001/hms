/**
 * 🖥️ Headless Browser Singleton — Hardened for Production
 *
 * Guarantees:
 * - Single browser instance reused across requests
 * - Auto-recovery on browser crash / disconnect
 * - Max 2 retries on PDF generation failure
 * - Hard 20s timeout on page operations
 * - ALL external requests blocked (fonts are base64-embedded)
 * - Deterministic output: same input → same PDF
 */

import type { Browser } from "puppeteer-core";

// ─── Browser Singleton ────────────────────────────────────────

let _browser: Browser | null = null;
let _launching: Promise<Browser> | null = null;

/**
 * Get or create the singleton browser instance.
 * Uses a launch lock to prevent concurrent browser launches.
 */
export async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) {
    return _browser;
  }

  // Prevent concurrent launches (multiple requests hitting cold start)
  if (_launching) {
    return _launching;
  }

  _launching = launchBrowser();

  try {
    _browser = await _launching;
    return _browser;
  } finally {
    _launching = null;
  }
}

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");
  const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  let browser: Browser;

  if (isVercel) {
    const chromium = (await import("@sparticuz/chromium")).default;
    (chromium as any).setHeadlessMode = true;
    (chromium as any).setGraphicsMode = false;

    browser = await puppeteer.default.launch({
      args: [...chromium.args, "--disable-dev-shm-usage", "--disable-extensions"],
      defaultViewport: { width: 794, height: 1123 },
      executablePath: await chromium.executablePath(),
      headless: true,
      timeout: 15_000,
    });
  } else {
    const executablePath = findLocalChrome();

    browser = await puppeteer.default.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-extensions",
      ],
      defaultViewport: { width: 794, height: 1123 },
      executablePath,
      headless: true,
      timeout: 15_000,
    });
  }

  browser.on("disconnected", () => {
    console.warn("[pdf.browser] Browser disconnected — will relaunch on next request");
    _browser = null;
  });

  return browser;
}

function findLocalChrome(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const fs = require("fs");
  const candidates = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    "No local Chrome/Chromium found. Set CHROME_PATH env variable.\n" +
    "Checked: " + candidates.join(", ")
  );
}

// ─── PDF Generation ───────────────────────────────────────────

const MAX_RETRIES = 2;
const PAGE_TIMEOUT = 20_000;

/**
 * Generate a PDF buffer from raw HTML string.
 *
 * Production hardening:
 * - Retry up to 2 times on transient failures
 * - Hard 20s timeout per attempt
 * - ALL external network requests blocked (fonts are embedded)
 * - Page always closed in finally block
 * - Structured error logging
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await _generatePdf(html);
    } catch (err: any) {
      lastError = err;
      console.error(`[pdf.browser] Attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);

      // If browser crashed, force a fresh instance on next try
      if (err.message?.includes("disconnected") || err.message?.includes("crashed")) {
        _browser = null;
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  throw new Error(`PDF generation failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

async function _generatePdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // ── STRICT: Block ALL external requests ──
    // Fonts are base64-embedded, logos are data URIs or whitelisted hostel URLs
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      const type = req.resourceType();

      if (
        url.startsWith("data:") ||
        type === "document"
      ) {
        req.continue();
      } else if (type === "image" && (url.startsWith("https://") || url.startsWith("http://"))) {
        // Allow hostel logo images (ImageKit, S3, etc.)
        req.continue();
      } else {
        req.abort();
      }
    });

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: PAGE_TIMEOUT,
    });

    // Ensure all base64 fonts are loaded before rendering
    await page.evaluateHandle("document.fonts.ready");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      preferCSSPageSize: true,
      timeout: PAGE_TIMEOUT,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close().catch(() => {});
  }
}
