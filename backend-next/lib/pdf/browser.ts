/**
 * 🖥️ Headless Browser Singleton — Puppeteer + @sparticuz/chromium
 *
 * Reuses a single browser instance across requests to avoid cold-start overhead.
 * Works in both local development (system Chrome) and Vercel serverless
 * (@sparticuz/chromium provides a compressed Chromium binary).
 *
 * Usage:
 *   const browser = await getBrowser();
 *   const page = await browser.newPage();
 *   // ... generate PDF ...
 *   await page.close();  // Always close pages, NEVER close the browser
 */

import type { Browser } from "puppeteer-core";

let _browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) {
    return _browser;
  }

  const puppeteer = await import("puppeteer-core");

  const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isVercel) {
    // Vercel / AWS Lambda — use @sparticuz/chromium
    const chromium = (await import("@sparticuz/chromium")).default;
    (chromium as any).setHeadlessMode = true;
    (chromium as any).setGraphicsMode = false;

    _browser = await puppeteer.default.launch({
      args: chromium.args,
      defaultViewport: { width: 794, height: 1123 }, // A4 at 96 DPI
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    // Local development — use system Chrome / Chromium
    const executablePath = findLocalChrome();

    _browser = await puppeteer.default.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
      defaultViewport: { width: 794, height: 1123 },
      executablePath,
      headless: true,
    });
  }

  // Auto-cleanup on disconnect
  _browser!.on("disconnected", () => {
    _browser = null;
  });

  return _browser!;
}

/**
 * Find a local Chrome/Chromium installation for development.
 */
function findLocalChrome(): string {
  // Allow explicit override via env
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const fs = require("fs");
  const candidates = [
    // Linux
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    // Windows (WSL)
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  ];

  for (const path of candidates) {
    if (fs.existsSync(path)) return path;
  }

  throw new Error(
    "No local Chrome/Chromium found. Install Chrome or set CHROME_PATH env variable.\n" +
    "Checked: " + candidates.join(", ")
  );
}

/**
 * Generate a PDF buffer from raw HTML string.
 * Handles page lifecycle, timeout, and cleanup.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Block external requests except fonts (Google Fonts must load)
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      const type = req.resourceType();

      // Allow data URLs, font loads, and stylesheet loads
      if (
        url.startsWith("data:") ||
        url.includes("fonts.googleapis.com") ||
        url.includes("fonts.gstatic.com") ||
        type === "document"
      ) {
        req.continue();
      } else {
        req.abort();
      }
    });

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 15_000,
    });

    // Wait for fonts to render
    await page.evaluateHandle("document.fonts.ready");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}
