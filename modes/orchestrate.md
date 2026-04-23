# Orchestrate Mode — Master Job Search Orchestrator

## Overview

Persistent orchestrator that manages the complete job search lifecycle from onboarding to learning. Triggered via `/career-ops start`.

## State

Reads from `data/orchestration-state.json` via `scripts/orchestrate-state.mjs`.

## Phase 0: Geography Selection

**Trigger:** `/career-ops start` or phase === 0

Ask the user:
> "Where do you want to work?"
- A) US only (H1B first → US other)
- B) India only
- C) Both US + India

Set preferences:
- US only: `h1b_priority: true`, `india_companies: false`
- India only: `h1b_priority: false`, `india_companies: true`
- Both: `h1b_priority: true`, `india_companies: true`

Transition to Phase 1.

## Phase 1: Onboarding

**Trigger:** First run or `profile_complete: false`

Delegate to `onboarding.md` mode.

## Phase 2: Research

**Trigger:** After onboarding, or `keywords_need_update: true`

Delegate to `research.md` mode.

## Phase 3: Scan

**Trigger:** `/career-ops scan` or automatic after research

Based on `preferences.geography`:
- **US only:** Scan h1b-categories/ + scan.mjs for non-H1B US
- **India only:** Run scan-india.mjs
- **Both:** H1B → India → US other (combined)

Tag each URL with source: `H1B-US`, `INDIA`, `US-OTHER`.

Add to `data/pipeline.md`.

Update stats.total_scanned.

## Phase 4: Apply

**Trigger:** `/career-ops apply` or pipeline is full

For each role in pipeline:
1. Evaluate via `oferta.md` mode
2. Get score (1-5)
3. **Score >= 4.2:** Auto-generate PDF + auto-submit
4. **Score 4.0-4.2:** Generate PDF, ask for approval
5. **Score < 4.0:** Skip (don't apply)

Update `data/applications.md` tracker.
Update stats.total_applications and stats.auto_submitted.

## Phase 5: Networking

**Trigger:** `/career-ops network` or after applying

Delegate to `networking.md` mode.

## Phase 6: Gmail Tracking

**Trigger:** `/career-ops gmail` or scheduled

Delegate to `gmail-tracking.md` mode.

## Phase 7: Learning Engine

**Trigger:** After each application cycle or `/career-ops learn`

Delegate to `learning.md` mode.

## Commands

| Command | Phase | What it does |
|---------|-------|-------------|
| `/career-ops start` | 0 | Begin, ask geography |
| `/career-ops status` | any | Show state + stats |
| `/career-ops onboard` | 1 | Run onboarding |
| `/career-ops research` | 2 | Research keywords |
| `/career-ops scan` | 3 | Scan portals |
| `/career-ops apply` | 4 | Apply to roles |
| `/career-ops network` | 5 | LinkedIn networking |
| `/career-ops gmail` | 6 | Sync Gmail |
| `/career-ops learn` | 7 | Show learnings |
| `/career-ops continue` | any | Resume workflow |