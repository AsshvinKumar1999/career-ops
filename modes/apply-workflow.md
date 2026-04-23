# Apply Workflow Mode — Phase 4

## Overview

Evaluates roles in pipeline and handles CV generation + submission based on score. Triggered via `/career-ops apply` or when pipeline is full.

## Workflow

For each unchecked role in `data/pipeline.md`:
1. Evaluate via `oferta.md` mode (or read existing report from `reports/`)
2. Get score (1-5)

### Score Thresholds

| Score | Action |
|-------|--------|
| >= 4.2 | Auto-generate PDF + auto-submit |
| 4.0-4.2 | Generate PDF, ask for approval before submit |
| < 4.0 | Skip (don't apply, mark as SKIP in tracker) |

### Auto-Submit Threshold: 4.2/5

**Important:** Never auto-submit without user review for scores 4.0-4.2. The user makes the final call.

## Pipeline Entry Format

Each line in `data/pipeline.md` should have a source tag:
```
- [ ] https://jobs.url (H1B-US - CompanyName)
- [ ] https://jobs.url (INDIA - CompanyName)
- [ ] https://jobs.url (US-OTHER - CompanyName)
```

## Process Per Role

1. **Verify job is still active** using Playwright (check-liveness.mjs)
2. **Evaluate** if no existing report, otherwise skip to step 4
3. **Generate PDF** using `generate-pdf.mjs` with job-specific keywords
4. **Apply based on score:**
   - >= 4.2: Ask "Ready to submit?" then submit
   - 4.0-4.2: Show preview, ask "Submit this?"
   - < 4.0: Mark as SKIP, skip to next
5. **Update tracker** with result in `data/applications.md`

## Output

- PDF generated to `output/`
- Tracker updated in `data/applications.md`
- State stats updated:
  - `stats.total_applications++`
  - `stats.auto_submitted++` (if auto-submitted, score >= 4.2)
  - `stats.total_evaluated++`

## Transition

After applying to all pipeline items:
- Offer Phase 5 (Networking): `/career-ops network`
- Or Phase 6 (Gmail): `/career-ops gmail`
- Or Phase 7 (Learning): `/career-ops learn`
