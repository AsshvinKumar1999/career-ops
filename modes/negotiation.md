# Mode: negotiation — Salary Negotiation Coach

Interactive + research-augmented negotiation coaching for job offers.

## Triggers

- "Negotiate this offer"
- "Help me negotiate"
- "/career-ops negotiation"
- "Salary negotiation"

## What It Does

### Phase 1: Research
1. Research the company's Glassdoor/Blind compensation data
2. Find role-specific negotiation patterns
3. Check LinkedIn for similar roles
4. Identify company-specific negotiation history

### Phase 2: Position Calculation
Uses `negotiation-calc.mjs` to calculate:
- **Walk-away:** Your minimum (from profile.yml)
- **Target:** Your target salary
- **Counter:** Target + 12%
- **Opening:** Counter + 5%
- **Stretch:** Maximum reasonable

### Phase 3: Drafting
Generates customized:
- Acknowledgment email (requests time to review)
- Counter offer email (with specific language)
- Phone talking points (for live negotiation)

### Phase 4: Coaching
Interactive guidance:
- Scenario simulation
- Objection handling templates
- Real-time negotiation coaching

## Usage

```bash
# Calculate positions
node scripts/negotiation-calc.mjs --offer 90000 --target 110000 --min 85000

# Full negotiation mode
/career-ops negotiation
```

## Position Matrix

| Position | Calculation | Example ($110K target) |
|----------|-------------|------------------------|
| Walk-away | Minimum acceptable | $85,000 |
| Target | Goal for negotiation | $110,000 |
| Stretch | Maximum reasonable | $130,000 |
| Counter | Target + 12% | $123,200 |
| Opening | Counter + 5% | $129,360 |

## Email Templates

### Acknowledgment Email
Subject: Re: [Company] Offer — [Role Title]

Hi [Recruiter],

Thank you for the offer. I'm excited about the opportunity to join [Company] as [Role Title].

I'm currently reviewing the details and will get back to you by [date + 2-3 business days]. Would that work for you?

Best,
[Your Name]

### Counter Offer Email
Subject: Re: [Company] Offer — [Role Title]

Hi [Recruiter],

Thank you for the offer. I'm genuinely excited about [Company] and the [Role Title] role.

However, based on market data for similar roles, I'd like to propose [Counter] as my compensation package. I'm also open to discussing [equity/flexibility/benefits] if base salary has constraints.

Would you be able to connect to discuss this further?

Best,
[Your Name]

## Phone Talking Points

1. Lead with enthusiasm (not demands)
2. State your number clearly and firmly
3. Reference market data ("Based on market research...")
4. Have benefits ready as alternatives
5. Know your walk-away point before the call
6. Silence is okay — don't rush to fill gaps
