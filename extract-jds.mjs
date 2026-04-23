#!/usr/bin/env node
// Extract JDs for batch processing using Playwright
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const inputFile = './batch/batch-input.tsv';
const lines = readFileSync(inputFile, 'utf8').trim().split('\n');
// Skip header
const rows = lines.slice(1);

async function extractJD(id, url) {
  const jdFile = `/tmp/batch-jd-${id}.txt`;
  console.log(`[${id}] Extracting JD from: ${url}`);

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait a bit for SPA to render
    await page.waitForTimeout(3000);

    // Get page content - try to find main JD text
    const content = await page.evaluate(() => {
      // Try to find job description content
      const selectors = [
        '[data-job-id]',
        '.job-body',
        '.job-description',
        '#job-description',
        '.content-body',
        'article',
        'main'
      ];

      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el.innerText;
      }

      // Fallback: get body text
      return document.body.innerText;
    });

    await browser.close();

    // Save to file
    const { writeFileSync } = await import('fs');
    writeFileSync(jdFile, content, 'utf8');
    console.log(`[${id}] Saved JD (${content.length} chars) to ${jdFile}`);
    return { id, success: true, chars: content.length };
  } catch (err) {
    console.error(`[${id}] Error: ${err.message}`);
    const { writeFileSync } = await import('fs');
    writeFileSync(jdFile, `ERROR: ${err.message}`, 'utf8');
    return { id, success: false, error: err.message };
  }
}

async function main() {
  // Process sequentially to avoid browser conflicts
  const results = [];
  for (const row of rows) {
    const [id, url] = row.split('\t');
    if (!id || !url) continue;
    const result = await extractJD(parseInt(id), url);
    results.push(result);
  }

  console.log('\n=== Extraction Summary ===');
  console.log(`Total: ${results.length}`);
  console.log(`Success: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
}

main().catch(console.error);
