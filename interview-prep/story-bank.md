# Story Bank — Asshvin Kumar (AK) STAR+R Stories

## How it works

1. Before your next interview, review this file
2. Your stories are organized by theme
3. The "Big Three" questions can be answered with stories from this bank:
   - "Tell me about yourself" → combine 2-3 stories into a narrative
   - "Tell me about your most impactful project" → pick your highest-impact story
   - "Tell me about a conflict you resolved" → find a story with a Reflection

## Stories

### Amazing Service — External (EquityList cap table)
**Best for:** Customer obsession, ownership, going above and beyond
**S:** Enterprise client doing secondary sale, millions at stake, cap table discrepancy found 2 days before close
**T:** Not AK's fault (error from before he joined) but his account, client panicking
**A:** Stayed on call 3 hours that evening, walked every line of cap table, coordinated engineering in real time, personally validated every entry
**R:** Transaction closed on time, client praised AK to manager, became strongest referral source
**Reflection:** When it's your account, it's your problem — regardless of who created it.

### Amazing Service — Internal (Thunderbird AI workflows)
**Best for:** Proactive problem-solving, delivering value without being asked
**S:** Senior Manager spending hours weekly on research, content, email drafting
**T:** Nobody asked AK to fix it — he saw the friction himself
**A:** Built Claude Projects adapted to each leader's writing style, tested with real tasks, iterated on feedback
**R:** 5+ hours saved per leader per week, used every single day
**Reflection:** The best work often comes from seeing friction and deciding to fix it unprompted.

### Mistake / Error Recovery (Hexafort null values)
**Best for:** Handling failures, building robust systems, accountability
**S:** Outbound pipeline running at 4,000 daily touches, three weeks in
**T:** Sales team flagged emails going out with blank first names
**A:** Stopped sequences immediately. Diagnosed: Clay rate limit returned nulls, no validation gate existed. Fixed with n8n validation node + real-time Slack alerts for enrichment failure rates above threshold.
**R:** Re-enrolled affected contacts same day, lost less than a day of output. System more robust than before.
**Reflection:** Never trust a successful API response means good data — validate before acting.

### Difficult Team / Cross-functional Leadership (Carta migration squad)
**Best for:** Leading without authority, resolving blockers, communication
**S:** 5-person cross-functional squad, timelines slipping, communication breaking down
**T:** Project lead responsible for getting back on schedule without destroying relationships
**A:** Spoke to each person individually first (not group meeting). Found: engineering blocked by legal but legal didn't know they were bottleneck. Restructured standup with explicit blockers section. Built shared tracker showing real-time status.
**R:** Back on schedule within 2 weeks. Finished on time. 118% NDR, 96% renewal.
**Reflection:** Group meetings make people defensive. Individual conversations surface real blockers.

### Multiple Priorities (Thunderbird + Masters)
**Best for:** Time management, handling competing deadlines, work-life balance
**S:** Three simultaneous campaigns, event assets, Masters coursework all at same time
**T:** Everything had real deadlines and real stakeholders
**A:** Time-blocked calendar strictly. Proactive communication on at-risk deadlines. Leaned on automated HubSpot workflows to create time.
**R:** All campaigns launched on time, assets delivered, strong academic record. 5,000+ leads that semester.
**Reflection:** Proactive communication buys you goodwill when timelines slip.

### Learn Fast / Fast Prototyping (Hexafort n8n/Clay)
**Best for:** Learning new tools, fast delivery, building from scratch
**S:** No RevOps infrastructure existed at Hexafort. Needed to build full pipeline using n8n and Clay — tools AK hadn't used deeply before
**T:** Responsible for building and deploying in 30 days
**A:** Spent week 1 in documentation and YouTube, built small test workflows, made mistakes deliberately in sandbox to understand failure modes
**R:** Live in 30 days. 4,000+ daily touches within 60 days. 25% acquisition efficiency improvement.
**Reflection:** Learn by building in production, not by waiting for perfect knowledge.

### Building to Scale (Hexafort outbound)
**Best for:** Scaling systems, automation, operational excellence
**S:** Outbound team starting from zero, needed to scale quickly
**T:** Build a system that could handle 4,000+ daily touches without manual intervention
**A:** Built Clay → n8n → Claude API → Apollo/Lemlist pipeline. Pre-call research agent delivers account briefs 30 min before every call. Post-call summary agent extracts next steps automatically.
**R:** Scaled from 100 to 4,000+ daily touches. 25% acquisition efficiency improvement. $1M+ revenue contribution. 100% pilot retention.
**Reflection:** The best systems run 24/7 without anyone pressing run.
