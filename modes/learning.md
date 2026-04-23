# Learning Mode — Phase 7

## Overview

Analyzes patterns from application history to improve future targeting and messaging. Triggered after each application cycle or via `/career-ops learn`.

## What Gets Learned

| Category | Tracking |
|----------|----------|
| Keywords | Which CV keywords get responses (compare cv.md terms against response rates) |
| Companies | Which companies reply vs ignore (from applications.md) |
| Messages | Which LinkedIn templates get accepted (from follow-ups.md) |
| Timing | When you get fastest responses (days to response by company) |
| Compensation | Which offers are negotiable (from any offer data) |

## Data Sources

- `data/applications.md` — Application history with statuses
- `data/pipeline.md` — Pipeline history with source tags
- `data/follow-ups.md` — LinkedIn outreach history
- Gmail sync data (if available)
- `modes/_profile.md` — Existing learnings

## Analysis Process

1. **Scan applications.md** for companies that responded vs no response
2. **Map source tags** (H1B-US, INDIA, US-OTHER) to response rates
3. **Cross-reference cv.md keywords** with response data
4. **Check follow-ups.md** for message template effectiveness
5. **Calculate response_rate_by_company and response_rate_by_keyword**

## Learnings Output

Update orchestration state via `updateLearnings()`:

```javascript
{
  learnings: {
    keywords_that_work: ["AI Operations", "RevOps"],
    keywords_that_dont: ["Marketing Operations"],
    companies_that_respond: ["Stripe", "Razorpay", "Coinbase"],
    companies_that_dont: ["Amazon", "Google"],
    best_message_templates: ["Short (50 words) + specific metric"],
    response_rate_by_keyword: {
      "AI Operations": 0.31,
      "RevOps": 0.27
    },
    response_rate_by_company: {
      "Stripe": 0.45,
      "Razorpay": 0.38
    }
  }
}
```

## Storage

Also update `modes/_profile.md` with a Learnings section at the bottom:

```markdown
## Learnings

### Keywords That Work
- AI Operations (31% response rate)
- RevOps (27% response rate)

### Keywords That Don't
- Marketing Operations

### Companies That Respond
- Stripe, Razorpay, Coinbase

### Companies That Don't
- Amazon, Google

### Best Message Templates
- Short (50 words) + specific metric
```

## Display to User

Show a summary:
```
Learning Insights:

Keywords That Work:
- AI Operations: 31% response rate
- RevOps: 27% response rate

Companies That Respond:
- Stripe (45%)
- Razorpay (38%)
- Coinbase (33%)

Companies to Avoid:
- Amazon (5%)
- Google (8%)

Best Performing Source:
- H1B-US: 34% response rate
```

## Transition

After learning, cycle back to Phase 3 (Scan) for next iteration, or stay in Phase 7 to review learnings.
