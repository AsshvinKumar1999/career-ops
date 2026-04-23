#!/usr/bin/env node

/**
 * scan-h1b-parallel.mjs — Parallel H1B Company Scanner
 *
 * Splits H1B scanning into batches of 100 companies and dispatches
 * parallel agents to maximize throughput.
 *
 * Usage:
 *   node scan-h1b-parallel.mjs --category tech           # scan tech, parallel agents
 *   node scan-h1b-parallel.mjs --category all           # scan ALL 28K companies
 *   node scan-h1b-parallel.mjs --company "Google"        # scan specific company
 *   node scan-h1b-parallel.mjs --search "cloud"          # search by keyword
 *   node scan-h1b-parallel.mjs --batch 0 --category tech # process batch 0 only
 *   node scan-h1b-parallel.mjs --dry-run                 # preview batch distribution
 *
 * For Claude Code CLI integration:
 *   claude -p "node scan-h1b-parallel.mjs --category tech"
 *   claude -p "node scan-h1b-parallel.mjs --batch N --category tech"
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { readdirSync, statSync } from 'fs';
import { spawn } from 'child_process';

// ── Config ──────────────────────────────────────────────────────────

const H1B_CATEGORIES_DIR = 'data/h1b-categories';
const SCAN_HISTORY_PATH = 'data/scan-history.tsv';
const PIPELINE_PATH = 'data/pipeline.md';
const BATCH_SIZE = 100;
const MAX_PARALLEL_AGENTS = 10;
const FETCH_TIMEOUT_MS = 10_000;

// ── Title filter (same as scan-h1b.mjs) ───────────────────────────

const TITLE_FILTER = {
  positive: [
    'Marketing Operations', 'Marketing Ops', 'MarTech', 'MarOps',
    'Revenue Operations', 'RevOps', 'Sales Operations', 'SalesOps',
    'GTM Operations', 'GTM Engineer', 'Go-to-Market',
    'AI Operations', 'AI Ops', 'LLMOps', 'Agentic', 'Agent',
    'AI Automation', 'Intelligent Automation', 'Workflow Automation',
    'Product Operations', 'ProdOps', 'Customer Success Operations', 'CS Ops',
    'Solutions Engineer', 'Solutions Architect', 'Integration Engineer',
    'Customer Engineer', 'Technical Account Manager', 'Implementation Engineer',
    'Business Systems', 'Systems Engineer', 'Platform Operations',
    'Product Manager', 'Technical Product Manager', 'Technical PM',
    'Automation', 'Low-Code', 'No-Code', 'Internal Tools', 'Workflow',
    'CRM', 'HubSpot', 'Salesforce', 'Marketing Cloud',
    'AI', 'LLM', 'GenAI', 'Generative AI', 'Conversational AI', 'Voice AI',
    'Digital Transformation', 'Business Transformation', 'Process Automation',
  ],
  negative: [
    'Senior', 'Director', 'VP', 'Chief', 'Head of', 'Lead', 'Principal', 'Staff',
    'Intern', 'Junior', 'Entry Level', 'Developer', 'Software Engineer',
    'Data Scientist', 'Data Analyst',
  ]
};

function buildTitleFilter() {
  const positive = TITLE_FILTER.positive.map(k => k.toLowerCase());
  const negative = TITLE_FILTER.negative.map(k => k.toLowerCase());

  return (title) => {
    const lower = title.toLowerCase();
    const hasPositive = positive.length === 0 || positive.some(k => lower.includes(k));
    const hasNegative = negative.some(k => lower.includes(k));
    return hasPositive && !hasNegative;
  };
}

// ── Career URL generation ─────────────────────────────────────────

function generateCareerUrls(employer, state = '', city = '') {
  const slug = employer
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  const isIndia = ['AZ', 'BLR', 'CHE', 'HYD', 'MUM', 'PUNE', 'DEL', 'GUR'].some(
    s => state.toUpperCase().includes(s) || city.toUpperCase().includes(s)
  );

  const baseUrls = [
    `https://jobs.ashbyhq.com/${slug}`,
    `https://job-boards.greenhouse.io/${slug}`,
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    `https://jobs.lever.co/${slug}`,
    `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(slug)}`,
  ];

  if (isIndia || state.toUpperCase() === 'IN') {
    return [
      ...baseUrls,
      `https://www.naukri.com/jobs-in-${slug}`,
      `https://www.instahyre.com/jobs/${slug}`,
      `https://www.ambitionbox.com/jobs/${slug}`,
      `https://www.glassdoor.co.in/Job/jobs-in-${slug}.htm`,
    ];
  }

  return baseUrls;
}

function detectApi(url) {
  const ashbyMatch = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
  if (ashbyMatch) {
    return {
      type: 'ashby',
      url: `https://api.ashbyhq.com/posting-api/job-board/${ashbyMatch[1]}?includeCompensation=true`,
    };
  }

  const leverMatch = url.match(/jobs\.lever\.co\/([^/?#]+)/);
  if (leverMatch) {
    return {
      type: 'lever',
      url: `https://api.lever.co/v0/postings/${leverMatch[1]}`,
    };
  }

  const ghMatch = url.match(/greenhouse\.io\/([^/?#]+)/);
  if (ghMatch) {
    return {
      type: 'greenhouse',
      url: `https://boards-api.greenhouse.io/v1/boards/${ghMatch[1]}/jobs`,
    };
  }

  return null;
}

// ── API parsers ─────────────────────────────────────────────────────

function parseGreenhouse(json) {
  const jobs = json.jobs || [];
  return jobs.map(j => ({
    title: j.title || '',
    url: j.absolute_url || '',
    location: j.location?.name || '',
  }));
}

function parseAshby(json) {
  const jobs = json.jobs || [];
  return jobs.map(j => ({
    title: j.title || '',
    url: j.jobUrl || '',
    location: j.location || '',
  }));
}

function parseLever(json) {
  if (!Array.isArray(json)) return [];
  return json.map(j => ({
    title: j.text || '',
    url: j.hostedUrl || '',
    location: j.categories?.location || '',
  }));
}

const PARSERS = { greenhouse: parseGreenhouse, ashby: parseAshby, lever: parseLever };

// ── Fetch with timeout ──────────────────────────────────────────────

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Parallel fetch ──────────────────────────────────────────────────

async function parallelFetch(tasks, limit) {
  const results = [];
  let i = 0;

  async function next() {
    while (i < tasks.length) {
      const task = tasks[i++];
      results.push(await task());
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
  await Promise.all(workers);
  return results;
}

// ── Dedup ───────────────────────────────────────────────────────────

function loadSeenUrls() {
  const seen = new Set();

  if (existsSync(SCAN_HISTORY_PATH)) {
    const lines = readFileSync(SCAN_HISTORY_PATH, 'utf-8').split('\n');
    for (const line of lines.slice(1)) {
      const url = line.split('\t')[0];
      if (url) seen.add(url);
    }
  }

  if (existsSync(PIPELINE_PATH)) {
    const text = readFileSync(PIPELINE_PATH, 'utf-8');
    for (const match of text.matchAll(/- \[[ x]\] (https?:\/\/\S+)/g)) {
      seen.add(match[1]);
    }
  }

  return seen;
}

// ── Pipeline writer ─────────────────────────────────────────────────

function appendToPipeline(offers) {
  if (offers.length === 0) return;

  let text = existsSync(PIPELINE_PATH)
    ? readFileSync(PIPELINE_PATH, 'utf-8')
    : '# Pipeline\n\n## Pendientes\n\n## Procesadas\n';

  const marker = '## Pendientes';
  const idx = text.indexOf(marker);

  if (idx === -1) {
    text += `\n${marker}\n\n` + offers.map(o =>
      `- [ ] ${o.url} | ${o.company} | ${o.title}`
    ).join('\n') + '\n';
  } else {
    const afterMarker = idx + marker.length;
    const nextSection = text.indexOf('\n## ', afterMarker);
    const insertAt = nextSection === -1 ? text.length : nextSection;

    const block = '\n' + offers.map(o =>
      `- [ ] ${o.url} | ${o.company} | ${o.title}`
    ).join('\n') + '\n';
    text = text.slice(0, insertAt) + block + text.slice(insertAt);
  }

  writeFileSync(PIPELINE_PATH, text, 'utf-8');
}

function appendToScanHistory(offers, date) {
  if (!existsSync(SCAN_HISTORY_PATH)) {
    writeFileSync(SCAN_HISTORY_PATH, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\n', 'utf-8');
  }

  const lines = offers.map(o =>
    `${o.url}\t${date}\t${o.source}\t${o.title}\t${o.company}\tadded`
  ).join('\n') + '\n';

  appendFileSync(SCAN_HISTORY_PATH, lines, 'utf-8');
}

// ── Batch management ────────────────────────────────────────────────

function createBatchDir() {
  mkdirSync('data/h1b-batches', { recursive: true });
}

function saveBatch(batchIndex, companies) {
  const batchPath = `data/h1b-batches/batch-${batchIndex.toString().padStart(3, '0')}.json`;
  writeFileSync(batchPath, JSON.stringify(companies, null, 2), 'utf-8');
  return batchPath;
}

function loadBatch(batchIndex) {
  const batchPath = `data/h1b-batches/batch-${batchIndex.toString().padStart(3, '0')}.json`;
  if (!existsSync(batchPath)) return null;
  return JSON.parse(readFileSync(batchPath, 'utf-8'));
}

function getTotalBatches() {
  const files = readdirSync('data/h1b-batches').filter(f => f.startsWith('batch-') && f.endsWith('.json'));
  return files.length;
}

// ── List categories ────────────────────────────────────────────────

function listCategories() {
  console.log('\nAvailable H1B categories:\n');
  const files = readdirSync(H1B_CATEGORIES_DIR)
    .filter(f => f.startsWith('h1b-') && f.endsWith('.tsv'))
    .map(f => f.replace('h1b-', '').replace('.tsv', ''))
    .sort();

  for (const cat of files) {
    const path = `${H1B_CATEGORIES_DIR}/h1b-${cat}.tsv`;
    const lines = readFileSync(path, 'utf-8').split('\n').filter(l => l.trim());
    console.log(`  ${cat.padEnd(20)} (${lines.length.toLocaleString()} companies)`);
  }
  console.log('\nUsage: node scan-h1b-parallel.mjs --category <name>\n');
}

// ── Scan a single batch ─────────────────────────────────────────────

async function scanBatch(batchIndex, batchCompanies, dryRun = false) {
  const titleFilter = buildTitleFilter();
  const seenUrls = loadSeenUrls();
  const date = new Date().toISOString().slice(0, 10);

  let totalFound = 0;
  let totalFiltered = 0;
  let totalDupes = 0;
  const newOffers = [];

  const tasks = batchCompanies.map(company => async () => {
    const { employer, state, city } = company;
    const urls = generateCareerUrls(employer, state, city);

    for (const url of urls) {
      const api = detectApi(url);
      if (!api) continue;

      try {
        const json = await fetchJson(api.url);
        const jobs = PARSERS[api.type](json);

        for (const job of jobs) {
          if (!titleFilter(job.title)) {
            totalFiltered++;
            continue;
          }
          if (seenUrls.has(job.url)) {
            totalDupes++;
            continue;
          }

          seenUrls.add(job.url);
          totalFound++;
          newOffers.push({
            ...job,
            company: employer,
            source: `${api.type}-api (batch-${batchIndex})`
          });
          break;
        }
        break;
      } catch (err) {
        // Try next URL
      }
    }
  });

  await parallelFetch(tasks, 10);

  // Write results
  if (!dryRun && newOffers.length > 0) {
    appendToPipeline(newOffers);
    appendToScanHistory(newOffers, date);
  }

  return { batchIndex, newOffers: newOffers.length, totalFound, totalFiltered, totalDupes };
}

// ── Parse companies from category file ────────────────────────────

function parseCompaniesFromFile(filePath, companyFilter = null, keywordFilter = null) {
  const lines = readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
  const companies = [];

  for (const line of lines.slice(1)) {
    const cols = line.split('\t');
    if (cols.length < 1) continue;

    const employer = cols[0].trim().replace(/^"|"$/g, '');
    const state = cols.length > 1 ? cols[1].trim() : '';
    const city = cols.length > 2 ? cols[2].trim() : '';

    if (!employer) continue;
    if (companyFilter && !employer.toLowerCase().includes(companyFilter.toLowerCase())) continue;
    if (keywordFilter && !employer.toLowerCase().includes(keywordFilter.toLowerCase())) continue;

    companies.push({ employer, state, city });
  }

  return companies;
}

// ── Split into batches ──────────────────────────────────────────────

function splitIntoBatches(companies, batchSize = BATCH_SIZE) {
  const batches = [];
  for (let i = 0; i < companies.length; i += batchSize) {
    batches.push(companies.slice(i, i + batchSize));
  }
  return batches;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    listCategories();
    process.exit(0);
  }

  const categoryFlag = args.indexOf('--category');
  const companyFlag = args.indexOf('--company');
  const searchFlag = args.indexOf('--search');
  const batchFlag = args.indexOf('--batch');
  const dispatchFlag = args.indexOf('--dispatch');

  const dryRun = args.includes('--dry-run');
  const limit = parseInt(args[args.indexOf('--limit') + 1]) || 0;

  // Determine category/source file
  let sourceFile = null;
  let categoryName = 'all';

  if (companyFlag !== -1) {
    const companySearch = args[companyFlag + 1];
    const allFile = `${H1B_CATEGORIES_DIR}/h1b-all-companies.tsv`;
    const companies = parseCompaniesFromFile(allFile, companySearch, null);
    if (companies.length === 0) {
      console.error(`No companies found matching "${companySearch}"`);
      process.exit(1);
    }
    const batches = splitIntoBatches(companies, BATCH_SIZE);
    createBatchDir();
    batches.forEach((batch, i) => saveBatch(i, batch));
    console.log(`Found ${companies.length} companies matching "${companySearch}"`);
    console.log(`Split into ${batches.length} batches of ${BATCH_SIZE}`);
    sourceFile = allFile;
    categoryName = `search:${companySearch}`;
  } else if (searchFlag !== -1) {
    const keyword = args[searchFlag + 1];
    const allFiles = readdirSync(H1B_CATEGORIES_DIR)
      .filter(f => f.startsWith('h1b-') && f.endsWith('.tsv') && f !== 'h1b-all-companies.tsv');

    let allCompanies = [];
    for (const file of allFiles) {
      const catName = file.replace('h1b-', '').replace('.tsv', '');
      const companies = parseCompaniesFromFile(`${H1B_CATEGORIES_DIR}/${file}`, null, keyword);
      allCompanies.push(...companies.map(c => ({ ...c, _category: catName })));
    }

    if (allCompanies.length === 0) {
      console.error(`No companies found matching keyword "${keyword}"`);
      process.exit(1);
    }

    const batches = splitIntoBatches(allCompanies, BATCH_SIZE);
    createBatchDir();
    batches.forEach((batch, i) => saveBatch(i, batch));
    console.log(`Found ${allCompanies.length} companies matching "${keyword}"`);
    console.log(`Split into ${batches.length} batches of ${BATCH_SIZE}`);
    sourceFile = 'all';
    categoryName = `keyword:${keyword}`;
  } else if (batchFlag !== -1) {
    // Process single batch
    const batchIndex = parseInt(args[batchFlag + 1]);
    const batch = loadBatch(batchIndex);

    if (!batch) {
      console.error(`Batch ${batchIndex} not found. Run --category or --search first to create batches.`);
      process.exit(1);
    }

    console.log(`Processing batch ${batchIndex} (${batch.length} companies)...`);
    const result = await scanBatch(batchIndex, batch, dryRun);

    console.log(`\nBatch ${batchIndex} Results:`);
    console.log(`  Jobs found:    ${result.totalFound}`);
    console.log(`  Filtered:      ${result.totalFiltered}`);
    console.log(`  Duplicates:     ${result.totalDupes}`);
    console.log(`  New offers:     ${result.newOffers}`);

    process.exit(0);
  } else if (categoryFlag !== -1) {
    const category = args[categoryFlag + 1];
    const filePath = `${H1B_CATEGORIES_DIR}/h1b-${category}.tsv`;

    if (!existsSync(filePath)) {
      console.error(`Category "${category}" not found. Run --list to see available categories.`);
      process.exit(1);
    }

    const companies = parseCompaniesFromFile(filePath);
    const batches = splitIntoBatches(companies, BATCH_SIZE);

    createBatchDir();
    batches.forEach((batch, i) => saveBatch(i, batch));

    console.log(`\nCategory: ${category}`);
    console.log(`Total companies: ${companies.length.toLocaleString()}`);
    console.log(`Batch size: ${BATCH_SIZE}`);
    console.log(`Total batches: ${batches.length}`);

    sourceFile = filePath;
    categoryName = category;
  } else {
    console.error('Usage: node scan-h1b-parallel.mjs --category <name>');
    console.error('       node scan-h1b-parallel.mjs --company <name>');
    console.error('       node scan-h1b-parallel.mjs --search <keyword>');
    console.error('       node scan-h1b-parallel.mjs --batch <index>');
    console.error('       node scan-h1b-parallel.mjs --list');
    process.exit(1);
  }

  // Check if --dispatch flag is set
  if (dispatchFlag !== -1) {
    const totalBatches = getTotalBatches();
    console.log(`\nDispatching ${totalBatches} batches in parallel...`);
    console.log(`Max parallel agents: ${MAX_PARALLEL_AGENTS}`);

    const results = [];
    let batchNum = 0;

    while (batchNum < totalBatches) {
      const batchChunk = [];
      for (let i = 0; i < MAX_PARALLEL_AGENTS && batchNum < totalBatches; i++) {
        batchChunk.push(batchNum);
        batchNum++;
      }

      console.log(`\nLaunching ${batchChunk.length} agents: batches ${batchChunk.join(', ')}`);

      // Dispatch parallel processes
      const promises = batchChunk.map(batchIndex => {
        return new Promise((resolve) => {
          const startTime = Date.now();
          const proc = spawn('node', [
            'scan-h1b-parallel.mjs',
            '--batch', batchIndex.toString()
          ], { stdio: 'pipe' });

          let output = '';
          proc.stdout.on('data', (data) => { output += data.toString(); });
          proc.stderr.on('data', (data) => { output += data.toString(); });

          proc.on('close', (code) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            resolve({
              batchIndex,
              code,
              duration,
              output
            });
          });
        });
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      for (const r of batchResults) {
        if (r.code === 0) {
          console.log(`  ✓ Batch ${r.batchIndex} completed in ${r.duration}s`);
        } else {
          console.log(`  ✗ Batch ${r.batchIndex} failed (exit ${r.code})`);
          console.log(`    ${r.output.substring(0, 200)}`);
        }
      }
    }

    // Summary
    const successful = results.filter(r => r.code === 0).length;
    console.log(`\n${'━'.repeat(50)}`);
    console.log(`Parallel Scan Complete`);
    console.log(`${'━'.repeat(50)}`);
    console.log(`Total batches:    ${results.length}`);
    console.log(`Successful:       ${successful}`);
    console.log(`Failed:           ${results.length - successful}`);
    console.log(`\n→ Run /career-ops pipeline to evaluate new offers.`);

    process.exit(0);
  }

  // Just create batches and show summary (no scanning)
  const totalBatches = getTotalBatches();
  console.log(`\n${'━'.repeat(50)}`);
  console.log(`Batches created: ${totalBatches}`);
  console.log(`${'━'.repeat(50)}`);
  console.log('\nTo scan with parallel agents:');
  console.log(`  node scan-h1b-parallel.mjs --dispatch --category ${categoryName}`);
  console.log('\nTo scan a specific batch:');
  console.log(`  node scan-h1b-parallel.mjs --batch 0`);
  console.log('\nTo scan all batches sequentially:');
  console.log(`  for i in $(seq 0 ${totalBatches - 1}); do node scan-h1b-parallel.mjs --batch $i; done`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});