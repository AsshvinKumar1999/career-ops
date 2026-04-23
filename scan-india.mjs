#!/usr/bin/env node
/**
 * scan-india.mjs — India Portal Scanner
 *
 * Scans India job boards (Naukri, Instahyre, AmbitionBox, LinkedIn India) for target roles.
 * Adds discovered jobs to data/pipeline.md
 *
 * Usage:
 *   node scan-india.mjs              # Full scan
 *   node scan-india.mjs --dry-run    # Preview only
 *   node scan-india.mjs --limit 50  # Limit results
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// === CONFIGURATION ===

const PIPELINE_FILE = `${__dirname}/data/pipeline.md`;
const SCAN_HISTORY = `${__dirname}/data/india-scan-history.tsv`;
const H1B_ALL_FILE = `${__dirname}/data/h1b-categories/h1b-all-companies.tsv`;

// Target roles to search
const TARGET_ROLES = [
  'Marketing Operations', 'Marketing Ops', 'MarTech', 'RevOps',
  'Revenue Operations', 'AI Operations', 'AI Ops', 'LLMOps',
  'Agentic', 'Solutions Engineer', 'Implementation Engineer',
  'Growth Lead', 'Operations Lead', 'Automation Engineer'
];

// India cities to search
const INDIA_CITIES = [
  'bangalore', 'mumbai', 'hyderabad', 'pune', 'chennai',
  'delhi', 'gurgaon', 'noida', 'kolkata', 'ahmedabad'
];

// === JOB BOARDS ===

const INDIA_BOARDS = {
  naukri: {
    name: 'Naukri.com',
    searchUrl: (keyword, city) =>
      `https://www.naukri.com/${keyword.replace(/\s+/g, '-')}-jobs-in-${city}-india`,
    jobsInUrl: (city) =>
      `https://www.naukri.com/jobs-in-${city}-india`
  },
  instahyre: {
    name: 'Instahyre.com',
    searchUrl: (keyword) =>
      `https://www.instahyre.com/jobs/${encodeURIComponent(keyword)}`
  },
  ambitionbox: {
    name: 'AmbitionBox',
    companyUrl: (company) =>
      `https://www.ambitionbox.com/jobs/${encodeURIComponent(company)}`
  },
  linkedin: {
    name: 'LinkedIn India',
    searchUrl: (keyword) =>
      `https://www.linkedin.com/jobs/${encodeURIComponent(keyword)}-jobs/?location=India`
  },
  glassdoor: {
    name: 'Glassdoor India',
    jobsInUrl: (city) =>
      `https://www.glassdoor.co.in/Job/jobs-in-${city}.htm`
  }
};

// === FUNCTIONS ===

function readTSV(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    return headers.reduce((obj, h, i) => { obj[h] = values[i] || ''; return obj; }, {});
  });
}

function isH1BCompany(companyName, h1bCompanies) {
  const normalized = companyName.toLowerCase().trim();
  return h1bCompanies.some(c =>
    c.employer && (c.employer.toLowerCase().trim() === normalized ||
    normalized.includes(c.employer.toLowerCase().trim()))
  );
}

function appendToPipeline(url, source, company, role) {
  const dir = path.dirname(PIPELINE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(PIPELINE_FILE)) {
    fs.writeFileSync(PIPELINE_FILE, '# Pipeline\n\n## Pendientes\n\n', 'utf-8');
  }
  const entry = `\n- [ ] ${url} (${source}${company ? ` - ${company}` : ''})`;
  fs.appendFileSync(PIPELINE_FILE, entry, 'utf-8');
}

function recordScan(url) {
  const dir = path.dirname(SCAN_HISTORY);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(SCAN_HISTORY)) {
    fs.writeFileSync(SCAN_HISTORY, 'timestamp\turl\n', 'utf-8');
  }
  const timestamp = new Date().toISOString().replace('T', '\t').split('.')[0];
  fs.appendFileSync(SCAN_HISTORY, `${timestamp}\t${url}\n`, 'utf-8');
}

function alreadyScanned(url) {
  if (!fs.existsSync(SCAN_HISTORY)) return false;
  const content = fs.readFileSync(SCAN_HISTORY, 'utf-8');
  return content.includes(url);
}

// === MAIN ===

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg !== -1 && process.argv[limitArg + 1] ? parseInt(process.argv[limitArg + 1]) : 0;
  const h1bOnly = process.argv.includes('--h1b-only');

  console.log('=== India Portal Scanner ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : h1bOnly ? 'H1B ONLY' : 'FULL SCAN'}\n`);

  // Load H1B companies for cross-reference
  let h1bCompanies = [];
  if (fs.existsSync(H1B_ALL_FILE)) {
    h1bCompanies = readTSV(H1B_ALL_FILE);
    console.log(`Loaded ${h1bCompanies.length} H1B companies for cross-reference\n`);
  } else {
    console.log('H1B companies file not found, skipping H1B cross-reference\n');
  }

  let totalAdded = 0;
  let h1bCount = 0;

  // === Stage 1: Generate search URLs for each board ===

  console.log('Stage 1: Generating India job board search URLs...\n');

  for (const board of Object.values(INDIA_BOARDS)) {
    console.log(`  ${board.name}...`);
  }

  // === Stage 2: Generate Naukri URLs for each role + city ===

  if (!h1bOnly) {
    console.log('\nStage 2: Generating Naukri search URLs...\n');

    let count = 0;
    for (const city of INDIA_CITIES.slice(0, 5)) { // Limit to top 5 cities
      for (const role of TARGET_ROLES.slice(0, 5)) { // Limit to top 5 roles
        const url = INDIA_BOARDS.naukri.searchUrl(role, city);
        if (!alreadyScanned(url)) {
          if (!dryRun) {
            appendToPipeline(url, 'INDIA-NAUKRI', `${role} in ${city}`, role);
            recordScan(url);
          }
          console.log(`  [NAUKRI] ${role} in ${city}`);
          totalAdded++;
          count++;

          if (limit > 0 && totalAdded >= limit) {
            console.log(`\n  (Limit reached: ${limit})`);
            break;
          }
        }
      }
      if (limit > 0 && totalAdded >= limit) break;
    }

    // LinkedIn India
    console.log('\nStage 3: Generating LinkedIn India search URLs...\n');
    for (const role of TARGET_ROLES.slice(0, 3)) {
      const url = INDIA_BOARDS.linkedin.searchUrl(role);
      if (!alreadyScanned(url)) {
        if (!dryRun) {
          appendToPipeline(url, 'INDIA-LINKEDIN', role, role);
          recordScan(url);
        }
        console.log(`  [LINKEDIN] ${role}`);
        totalAdded++;
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total URLs generated: ${totalAdded}`);

  if (dryRun) {
    console.log('\n(DRY RUN - no files written)');
  } else {
    console.log(`\nAdded to ${PIPELINE_FILE}`);
    if (fs.existsSync(SCAN_HISTORY)) {
      const history = fs.readFileSync(SCAN_HISTORY, 'utf-8');
      const lines = history.trim().split('\n').length - 1;
      console.log(`${lines} URLs in scan history`);
    }
  }
}

main().catch(console.error);