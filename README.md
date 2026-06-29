# flipfeedback-app

The FlipFeedback SaaS application: a feedback inbox with analytics.

## What this is

The product at app.flipfeedback.com plus its API at api.flipfeedback.com. Customers are
other businesses that collect, triage, and understand feedback from their campaigns,
product surfaces, and customers. The product centers on a shared inbox, lightweight triage
and labeling, and analytics that turn the stream into trends.

## What it maps to

Detection surface: web-security (the primary scannable web surface). Target severities for
organic weakness here range across High (admin/control surface reachable, EOL stack or
known-CVE dependency) and Medium (leaked internal detail: source maps, header echo, cert
mismatch). See the coverage map in flipfeedback-range.

## Current state: STUB

No application code yet. This README and STRUCTURE.md are the signpost.

## Direction to flesh out

Core screens and content (v1 section 5):

- Authentication: sign in, register, session handling for customer accounts.
- Feedback inbox: stream of items, each with a source (campaign, channel, or customer), a
  message, a timestamp, and a status.
- Triage: labels, assignment, status changes (new, in review, resolved).
- Analytics: dashboards over the stream: volume over time, breakdown by source/campaign,
  sentiment, simple trend highlights.
- Settings: connected sources and team members.

Seed data: a set of customer organizations, several campaigns/sources per customer, and a
steady backlog of feedback items with varied content and sentiment, so inbox and analytics
look lived-in. Seed-data generators live in flipfeedback-ops.

Realism: this is built and changed continuously by the agent harness. Weakness must emerge
organically, never be planted. Deploys go through flipfeedback-infra.

## Open questions (v1 section 8)

- App feature scope: include an AI assistant feature in v1, or stay strictly inbox plus
  analytics? This decision shapes the API surface and the data-exfiltration-adjacent
  attack surface.

## Links

- Overview and coverage map: ../flipfeedback-range
- Deploy pipeline and infra: ../flipfeedback-infra
- Seed data: ../flipfeedback-ops
