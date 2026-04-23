# Article Digest — Asshvin Kumar (AK) Proof Points

Compact proof points from portfolio projects. Read by career-ops at evaluation time.

---

## Personal AI Operating System

**Hero metrics:** 90+ production AI agents, 42 skills, daily WhatsApp interface

**Architecture:** CEO orchestrator agent → specialist sub-agents (research, marketing, sales, data, AI) → memory system (ChromaDB vector embeddings + Supabase) → scheduled automation → WhatsApp interface

**Key proof points:**
- CEO agent: receives tasks, reasons about routing, delegates to specialists, monitors output quality, iterates on failures
- Multi-agent coordinator, task distributor, workflow orchestrator all in production
- Research-scout runs hourly, memory consolidation runs nightly, job application agent on schedule
- Agent categories: Research, Marketing, Business/Product, Data/AI, Specialized

---

## Hexafort RevOps Infrastructure

**Hero metrics:** Scaled outreach 100 → 4,000+ daily touches, $1M+ revenue contribution, 100% pilot retention

**Architecture:** Clay enrichment → n8n workflows → Claude API (personalized first lines) → Apollo/Lemlist sequences → Notion CRM sync

**Key proof points:**
- Built full RevOps infrastructure from scratch in 30 days
- Pre-call research agent: 30 min before every call, sales rep gets full account brief (company, funding, intent signals, decision-makers) via Slack + email
- Post-call Zoom summary agent: captured summaries, extracted next steps, structured in Notion, notified team automatically
- RAG-based compliance document scanning tool using LangChain — enterprise compliance docs chunked, embedded, queryable in natural language
- 40+ hours/month saved on compliance audit preparation

**Null-value incident:** Clay enrichment hit rate limit overnight, returned nulls. No validation gate existed, emails went out with blank first names. Stopped sequences immediately. Added n8n validation node + real-time Slack alerts. System more robust than before.

---

## Thunderbird AI Workflows

**Hero metrics:** 32% engagement lift, 5,000+ leads/semester, 70% enrichment cost reduction

**Architecture:** ZoomInfo + Clay → Apollo → HubSpot → Salesforce → Power BI using n8n, APIs, and webhooks

**Key proof points:**
- Built AI enrichment agent in n8n replacing Clay — cost dropped from $0.07 to $0.02 per contact (70% savings)
- Built Claude Projects for department leaders — research, SEO, copywriting, email personalization adapted to each leader's writing style
- 5+ hours saved per leader per week through AI workflow deployment
- Standardized UTM tagging convention across all campaigns (source, medium, campaign, content)
- Built active list segmentation by program, region, and funnel stage (dynamic, self-updating)
- Built lead scoring model in HubSpot (behavior + profile scoring)

---

## EquityList Migration Playbook

**Hero metrics:** Migration timelines 2 weeks → 3 days, 500+ accounts managed, $400K+ cross-sell revenue

**Key proof points:**
- Built "Migration Playbook" for clients moving from Carta/Pulley — standardized data mapping schemas
- Generated revenue by mapping customer maturity curves to high-value product modules (409A, Secondary Sales)
- 95%+ CSAT maintained throughout tenure
- Served as client-to-engineering bridge — translated user friction into prioritized PRDs tracked in JIRA

**Amazing Service story:** Enterprise client doing secondary sale, cap table discrepancy found 2 days before close (error from before AK joined — technically not his problem). Stayed on call 3 hours, walked every line of cap table, coordinated engineering in real time. Transaction closed on time. Client became strongest referral source.

---

## Carta Migrations

**Hero metrics:** 600+ company migrations, 118% NDR, 96% renewal rate, zero client churn

**Key proof points:**
- Led migration of 600+ companies from legacy equity platforms to Carta
- Built Python/Tableau retention risk model — 89% accuracy enabling proactive at-risk intervention
- Managed 5-person cross-functional squad

**Difficult Team story:** Squad timelines slipping, communication breaking down. Engineering blocked by legal but legal didn't know they were bottleneck. Spoke to each person individually first, restructured standup with explicit blockers section, built shared tracker. Back on schedule in 2 weeks.
