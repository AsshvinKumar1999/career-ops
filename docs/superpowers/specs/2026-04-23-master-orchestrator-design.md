# Master Orchestrator Agent Design Spec

## Overview

A persistent job search orchestrator agent that manages the complete job search lifecycle from onboarding to learning. Triggered via `/career-ops start`.

---

## Geographic Preference

The orchestrator asks **"Where do you want to work?"** before any scanning.

| Geography | Scan Priority | Sources |
|-----------|---------------|---------|
| US only | H1B first → US other | `h1b-categories/` + `scan.mjs` |
| India only | India only | `scan-india.mjs` |
| Both | H1B → India → US other | All combined |

**Source Tags in Pipeline:**
- `H1B-US` — H1B-sponsored US employers (highest priority for US)
- `INDIA` — India-based companies
- `US-OTHER` — Non-H1B US companies

---

## State File Structure

Location: `data/orchestration-state.json`

```json
{
  "session_id": "uuid",
  "created_at": "ISO date",
  "phase": 0,
  "preferences": {
    "geography": "BOTH",
    "h1b_priority": true,
    "india_companies": true
  },
  "profile": {
    "name": "Asshvin Kumar",
    "cv_verified": false,
    "target_roles": [],
    "target_cities": [],
    "profile_complete": false
  },
  "learnings": {
    "keywords_that_work": [],
    "keywords_that_dont": [],
    "companies_that_respond": [],
    "companies_that_dont": [],
    "message_templates_that_work": [],
    "response_rate_by_keyword": {},
    "response_rate_by_company": {}
  },
  "stats": {
    "total_scanned": 0,
    "total_evaluated": 0,
    "total_applications": 0,
    "auto_submitted": 0,
    "response_rate": 0,
    "interview_rate": 0,
    "last_updated": "ISO date"
  }
}
```

---

## Phase Flow

### Phase 0: Geography Selection

**Trigger:** `/career-ops start`

**Flow:**
```
Q: "Where do you want to work?"
  A) US only
  B) India only
  C) Both US + India

→ Set preferences.geography
→ Set preferences.h1b_priority (true for US)
→ Set preferences.india_companies (true for Both)
→ Transition to Phase 1
```

---

### Phase 1: Onboarding

**Trigger:** First run or `onboarding_complete: false`

**Collect in order:**
1. **CV** — Paste markdown, LinkedIn URL, or file path
2. **Profile details** — Name, email, location, target comp
3. **Target roles** — Confirm from profile or add new
4. **Target cities** — Bangalore, Mumbai, etc. for India / SF, NYC, etc. for US

**Output:**
- `cv.md` updated (canonical CV)
- `config/profile.yml` filled
- `modes/_profile.md` updated with archetypes

**State Update:**
```json
{
  "phase": 1,
  "profile": {
    "name": "...",
    "cv_verified": true,
    "target_roles": ["Marketing Ops", "AI Operations"],
    "target_cities": ["Bangalore", "Mumbai", "Hyderabad"],
    "profile_complete": true
  }
}
```

---

### Phase 2: Research

**Trigger:** After onboarding, or `keywords_need_update: true`

**Actions:**
1. Search market for target role keywords
2. Analyze competitor postings (top 20 jobs in target roles)
3. Identify emerging keywords/variants
4. Update `portals.yml` with optimized keywords

**Output:**
- `portals.yml` updated with researched keywords
- Learn which keywords resonate in market

**Keywords to Research:**
- Marketing Ops / MarTech / RevOps
- AI Operations / AI Ops / LLMOps / Agentic
- Solutions Engineer / Implementation Engineer
- India variants: Growth Lead, Operations Lead

---

### Phase 3: Scan

**Trigger:** `/career-ops scan` or automatic after research

**Based on Geography Preference:**

**US Only:**
```
1. Scan h1b-categories/h1b-tech.tsv + other categories
2. Generate careers URLs for H1B companies
3. Scan non-H1B US companies via scan.mjs
4. Combine with source tags
```

**India Only:**
```
1. Run scan-india.mjs
2. Generate Naukri + Instahyre + LinkedIn India URLs
3. Track source as INDIA
```

**Both:**
```
1. H1B companies (priority)
2. India companies
3. Non-H1B US companies
4. Combine with source tags
```

**Pipeline Entry Format:**
```
- [ ] https://jobs.url (H1B-US - CompanyName)
- [ ] https://jobs.url (INDIA - CompanyName)
- [ ] https://jobs.url (US-OTHER - CompanyName)
```

---

### Phase 4: Apply

**Trigger:** `/career-ops apply` or after pipeline is full

**Workflow:**
1. For each role in pipeline:
   - Run `oferta.md` evaluation
   - Get score (1-5)
2. **Score >= 4.2:** Auto-generate CV PDF + auto-submit
3. **Score 4.0-4.2:** Generate PDF, ask for approval before submit
4. **Score < 4.0:** Skip

**Auto-Submit Threshold:** 4.2/5

**Output:**
- PDF generated to `output/`
- Tracker updated (`data/applications.md`)
- State stats updated

---

### Phase 5: Networking

**Trigger:** `/career-ops network` or after applying to company

**Workflow:**
1. For approved companies:
   - Find LinkedIn contacts (2nd/3rd degree connections)
   - Research contact background
   - Draft personalized connection message
2. Present messages for approval
3. Send after approval

**Message Template Variables:**
- `{{contact_name}}` — First name
- `{{company_name}}` — Company they're at
- `{{shared_connection}}` — If any (mutual connections)
- `{{your_achievement}}` — Relevant proof point
- `{{role_target}}` — Role you're targeting

---

### Phase 6: Gmail Tracking

**Trigger:** `/career-ops gmail` or scheduled

**OAuth Setup (one-time):**
1. User authorizes via Google OAuth
2. Credentials stored securely
3. Subsequent runs use stored tokens

**Workflow:**
1. Connect to Gmail API
2. Search for emails from applied companies
3. Categorize responses:
   - `INTERVIEW` — Request for interview
   - `REJECTION` — Rejection email
   - `OFFER` — Offer received
   - `OTHER` — General response
4. Update tracker statuses automatically

**State Update:**
```json
{
  "stats": {
    "response_rate": 0.23,
    "interview_rate": 0.08,
    "last_gmail_sync": "ISO date"
  }
}
```

---

### Phase 7: Learning Engine

**Trigger:** After each application cycle or `/career-ops learn`

**What Gets Learned:**

| Category | Tracking |
|----------|----------|
| Keywords | Which CV keywords get responses |
| Companies | Which companies reply vs ignore |
| Messages | Which LinkedIn templates get accepted |
| Timing | When you get fastest responses |
| Compensation | Which offers are negotiable |

**Learning Output:**
```json
{
  "learnings": {
    "keywords_that_work": ["AI Operations", "RevOps"],
    "keywords_that_dont": ["Marketing Operations"],
    "companies_that_respond": ["Stripe", "Razorpay", "Coinbase"],
    "companies_that_dont": ["Amazon", "Google"],
    "best_message_templates": ["Short (50 words) + specific metric"],
    "response_rate_by_keyword": {
      "AI Operations": 0.31,
      "RevOps": 0.27
    }
  }
}
```

**Storage:** Updates `modes/_profile.md` with learnings section

---

## Command Reference

| Command | Phase | What it does |
|---------|-------|-------------|
| `/career-ops start` | 0 | Begin new session, ask geography |
| `/career-ops status` | any | Show current state + stats |
| `/career-ops onboard` | 1 | Run onboarding (CV + profile) |
| `/career-ops research` | 2 | Research keywords |
| `/career-ops scan` | 3 | Scan portals based on geography |
| `/career-ops apply` | 4 | Apply to scored roles |
| `/career-ops network` | 5 | LinkedIn networking |
| `/career-ops gmail` | 6 | Sync Gmail tracking |
| `/career-ops learn` | 7 | Show learning insights |
| `/career-ops continue` | any | Resume interrupted workflow |

---

## New Files

| File | Purpose |
|------|---------|
| `modes/orchestrate.md` | Master orchestrator (persistent agent) |
| `modes/onboarding.md` | Phase 1 CV + profile collection |
| `modes/research.md` | Phase 2 keyword research |
| `modes/apply-workflow.md` | Phase 4 apply logic |
| `modes/networking.md` | Phase 5 LinkedIn |
| `modes/gmail-tracking.md` | Phase 6 Gmail |
| `modes/learning.md` | Phase 7 learning engine |
| `data/orchestration-state.json` | Persistent state |
| `scripts/orchestrate-state.mjs` | State utilities |

---

## Dependencies

- `scan.mjs` — US portal scanning
- `scan-india.mjs` — India portal scanning
- `scan-h1b.mjs` / `scan-h1b-parallel.mjs` — H1B company scanning
- `oferta.md` — Job evaluation
- `negotiation-calc.mjs` — Salary negotiation
- Gmail API OAuth — Email tracking

---

## Success Metrics

- [ ] Onboarding collects CV, profile, roles in < 10 minutes
- [ ] Research updates keywords based on market analysis
- [ ] Pipeline populated with source-tagged URLs
- [ ] Applications auto-submitted for score >= 4.2
- [ ] Gmail tracks responses and updates tracker
- [ ] Learning insights improve over time
