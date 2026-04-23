#!/usr/bin/env node

/**
 * scan-h1b.mjs — H1B Company Portal Scanner
 *
 * Scans companies from the H1B database by category.
 * Each category has a TSV file with company names, locations, and career URLs.
 *
 * Usage:
 *   node scan-h1b.mjs --category tech                    # scan tech companies
 *   node scan-h1b.mjs --category manufacturing             # scan manufacturing
 *   node scan-h1b.mjs --category all                      # scan ALL H1B companies
 *   node scan-h1b.mjs --category tech --dry-run          # preview only
 *   node scan-h1b.mjs --list                             # show available categories
 *   node scan-h1b.mjs --company "Google"                # scan specific company
 *   node scan-h1b.mjs --company "Google" --dry-run      # preview specific company
 *   node scan-h1b.mjs --search "AI Operations"           # search all H1B for keyword
 *
 * Categories available:
 *   tech, manufacturing, healthcare, financial, professional,
 *   retail, media, transportation, energy, realestate,
 *   education, agriculture, construction, hospitality, wholesale, uncategorized, all
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { readdirSync } from 'fs';

// ── Config ──────────────────────────────────────────────────────────

const H1B_CATEGORIES_DIR = 'data/h1b-categories';
const SCAN_HISTORY_PATH = 'data/scan-history.tsv';
const PIPELINE_PATH = 'data/pipeline.md';
const APPLICATIONS_PATH = 'data/applications.md';

mkdirSync('data', { recursive: true });

const CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 10_000;

// ── Title filter (reused from portals.yml logic) ───────────────────

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

// ── Career URL generation ───────────────────────────────────────────

function generateCareerUrls(employer, state = '', city = '') {
  const slug = employer
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  const isIndia = ['AZ', 'BLR', 'CHE', 'HYD', 'MUM', 'PUNE', 'DEL', 'GUR'].some(
    s => state.toUpperCase().includes(s) || city.toUpperCase().includes(s)
  ) || ['AZ', 'BLR', 'CHE', 'HYD', 'MUM', 'PUNE', 'DEL', 'GUR'].some(
    s => employer.toLowerCase().includes('india')
  );

  const baseUrls = [
    `https://jobs.ashbyhq.com/${slug}`,
    `https://job-boards.greenhouse.io/${slug}`,
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    `https://jobs.lever.co/${slug}`,
    `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(slug)}`,
  ];

  // India-specific job boards
  if (isIndia || state.toUpperCase() === 'IN') {
    return [
      ...baseUrls,
      `https://www.naukri.com/jobs-in-${slug}`,
      `https://www.instahyre.com/jobs/${slug}`,
      `https://www.ambitionbox.com/jobs/${slug}`,
      `https://www.glassdoor.co.in/Job/jobs-in-${slug}.htm`,
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(employer)}&location=India`,
    ];
  }

  return baseUrls;
}

function detectApi(url) {
  // Ashby
  const ashbyMatch = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
  if (ashbyMatch) {
    return {
      type: 'ashby',
      url: `https://api.ashbyhq.com/posting-api/job-board/${ashbyMatch[1]}?includeCompensation=true`,
    };
  }

  // Lever
  const leverMatch = url.match(/jobs\.lever\.co\/([^/?#]+)/);
  if (leverMatch) {
    return {
      type: 'lever',
      url: `https://api.lever.co/v0/postings/${leverMatch[1]}`,
    };
  }

  // Greenhouse
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

  if (existsSync(APPLICATIONS_PATH)) {
    const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
    for (const match of text.matchAll(/https?:\/\/[^\s|)]+/g)) {
      seen.add(match[0]);
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
  console.log('\nUsage: node scan-h1b.mjs --category <name>\n');
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

  const dryRun = args.includes('--dry-run');
  const limit = parseInt(args[args.indexOf('--limit') + 1]) || 0; // 0 = unlimited

  let filesToScan = [];
  let companySearch = null;
  let keywordSearch = null;

  // Parse --company flag
  if (companyFlag !== -1) {
    companySearch = args[companyFlag + 1];
    if (!companySearch) {
      console.error('Error: --company requires a company name');
      process.exit(1);
    }
  }

  // Parse --search flag
  if (searchFlag !== -1) {
    keywordSearch = args[searchFlag + 1];
    if (!keywordSearch) {
      console.error('Error: --search requires a keyword');
      process.exit(1);
    }
  }

  // Determine which files to scan
  if (companySearch) {
    // Search for a specific company in all H1B data
    const allFile = `${H1B_CATEGORIES_DIR}/h1b-all-companies.tsv`;
    if (!existsSync(allFile)) {
      console.error(`Error: ${allFile} not found`);
      process.exit(1);
    }
    filesToScan.push({ file: allFile, category: 'all', companyFilter: companySearch.toLowerCase() });
  } else if (keywordSearch) {
    // Search all categories for keyword
    const allFiles = readdirSync(H1B_CATEGORIES_DIR)
      .filter(f => f.startsWith('h1b-') && f.endsWith('.tsv') && f !== 'h1b-all-companies.tsv');
    for (const file of allFiles) {
      const catName = file.replace('h1b-', '').replace('.tsv', '');
      filesToScan.push({ file: `${H1B_CATEGORIES_DIR}/${file}`, category: catName, keywordFilter: keywordSearch.toLowerCase() });
    }
  } else if (categoryFlag !== -1) {
    const category = args[categoryFlag + 1]?.toLowerCase();
    if (!category) {
      console.error('Error: --category requires a value');
      process.exit(1);
    }

    if (category === 'all') {
      const allFiles = readdirSync(H1B_CATEGORIES_DIR)
        .filter(f => f.startsWith('h1b-') && f.endsWith('.tsv') && f !== 'h1b-all-companies.tsv');
      for (const file of allFiles) {
        const catName = file.replace('h1b-', '').replace('.tsv', '');
        filesToScan.push({ file: `${H1B_CATEGORIES_DIR}/${file}`, category: catName });
      }
    } else {
      const file = `${H1B_CATEGORIES_DIR}/h1b-${category}.tsv`;
      if (!existsSync(file)) {
        console.error(`Error: Category "${category}" not found. Run --list to see available categories.`);
        process.exit(1);
      }
      filesToScan.push({ file, category });
    }
  } else {
    console.error('Usage: node scan-h1b.mjs --category <name>');
    console.error('       node scan-h1b.mjs --company <name>');
    console.error('       node scan-h1b.mjs --search <keyword>');
    console.error('       node scan-h1b.mjs --list  (show available categories)');
    process.exit(1);
  }

  const titleFilter = buildTitleFilter();
  const seenUrls = loadSeenUrls();
  const date = new Date().toISOString().slice(0, 10);

  let totalCompanies = 0;
  let totalScanned = 0;
  let totalFound = 0;
  let totalFiltered = 0;
  let totalDupes = 0;
  const newOffers = [];

  // Process each category file
  for (const { file, category: catName, companyFilter, keywordFilter } of filesToScan) {
    if (companySearch || keywordSearch) {
      console.log(`\nSearching in ${catName}...`);
    } else {
      console.log(`\nProcessing ${catName}...`);
    }

    const lines = readFileSync(file, 'utf-8').split('\n').filter(l => l.trim());
    totalCompanies += lines.length;

    const tasks = [];
    let companyCount = 0;

    for (const line of lines.slice(1)) { // skip header
      if (limit > 0 && companyCount >= limit) break;
      companyCount++;

      const cols = line.split('\t');
      if (cols.length < 1) continue;

      const employer = cols[0].trim().replace(/^"|"$/g, '');
      const state = cols.length > 1 ? cols[1].trim() : '';
      const city = cols.length > 2 ? cols[2].trim() : '';

      if (!employer) continue;

      // Apply company filter if searching for specific company
      if (companyFilter && !employer.toLowerCase().includes(companyFilter)) continue;

      // Apply keyword filter if searching for keyword in company name
      if (keywordFilter && !employer.toLowerCase().includes(keywordFilter)) continue;

      // Try each potential career URL
      const urls = generateCareerUrls(employer, state, city);

      tasks.push(async () => {
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
                source: `${api.type}-api (${catName})`
              });
              break; // found jobs, move to next company
            }
            break; // got API response, stop trying URLs
          } catch (err) {
            // Try next URL
          }
        }
        totalScanned++;
      });
    }

    // Run with concurrency limit
    await parallelFetch(tasks.slice(0, limit || tasks.length), CONCURRENCY);
  }

  // Write results
  if (!dryRun && newOffers.length > 0) {
    appendToPipeline(newOffers);
    appendToScanHistory(newOffers, date);
  }

  // Print summary
  console.log(`\n${'━'.repeat(50)}`);
  console.log(`H1B Scan — ${date}`);
  if (companySearch) {
    console.log(`Company search: ${companySearch}`);
  } else if (keywordSearch) {
    console.log(`Keyword search: ${keywordSearch}`);
  } else {
    console.log(`Category: ${args[categoryFlag + 1] || 'all'}`);
  }
  console.log(`${'━'.repeat(50)}`);
  console.log(`Companies in scope:   ${totalCompanies.toLocaleString()}`);
  console.log(`Companies scanned:    ${totalScanned.toLocaleString()}`);
  console.log(`Total jobs found:     ${totalFound.toLocaleString()}`);
  console.log(`Filtered by title:    ${totalFiltered.toLocaleString()}`);
  console.log(`Duplicates:          ${totalDupes.toLocaleString()}`);
  console.log(`New offers added:     ${newOffers.length}`);

  if (newOffers.length > 0) {
    console.log('\nNew offers:');
    for (const o of newOffers.slice(0, 30)) {
      console.log(`  + ${o.company} | ${o.title} | ${o.location || 'N/A'}`);
    }
    if (newOffers.length > 30) {
      console.log(`  ... and ${newOffers.length - 30} more`);
    }
    if (dryRun) {
      console.log('\n(dry run — run without --dry-run to save results)');
    } else {
      console.log(`\nResults saved to ${PIPELINE_PATH}`);
    }
  }

  console.log(`\n→ Run /career-ops pipeline to evaluate new offers.`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});