# Networking Mode — Phase 5

## Overview

Find LinkedIn contacts at target companies and draft personalized connection messages. Triggered via `/career-ops network` or after applying to companies.

## Workflow

For each company user has applied to or is interested in:
1. Find LinkedIn contacts (2nd/3rd degree connections) via LinkedIn search
2. Research contact background (their profile, shared connections, recent activity)
3. Draft personalized connection message

## Message Template Variables

| Variable | Description |
|----------|-------------|
| `{{contact_name}}` | First name |
| `{{company_name}}` | Company they're at |
| `{{shared_connection}}` | Mutual connection name (if any) |
| `{{your_achievement}}` | Relevant proof point from user's CV |
| `{{role_target}}` | Role you're targeting |

## Message Templates

**Short template (50 words):**
```
Hi {{contact_name}}, I noticed you work at {{company_name}} and share interest in AI operations. I'm targeting {{role_target}} roles and have experience building automation that delivered {{your_achievement}}. Would love to connect and learn more about your team.
```

**With mutual connection:**
```
Hi {{contact_name}}, {{shared_connection}} suggested I reach out. I'm a Marketing Ops professional focused on AI Operations, targeting roles at {{company_name}}. My background includes {{your_achievement}}. Would appreciate connecting to learn more about opportunities there.
```

**Follow-up template (if no response after 5 days):**
```
Hi {{contact_name}}, just following up on my earlier message. I'm still very interested in opportunities at {{company_name}} and believe my background in {{role_target}} could add value. Would love to connect when you have time.
```

## Approval Flow (Critical)

1. **ALWAYS present draft messages for user approval first**
2. Show: contact name, company, their profile summary, draft message
3. User reviews and approves OR edits
4. **NEVER auto-send messages** — user must explicitly approve
5. After approval, send and record in `data/follow-ups.md`

## Data Storage

Record sent messages in `data/follow-ups.md`:
```markdown
## LinkedIn Outreach

| Date | Contact | Company | Message Used | Response |
|------|---------|---------|--------------|----------|
| YYYY-MM-DD | Name | Company | short/template | Pending |
```

## Transition

After networking, go to Phase 6 (Gmail) or Phase 7 (Learning).
