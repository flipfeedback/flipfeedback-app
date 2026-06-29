# Intended structure (sketch, not yet built)

This is a direction sketch for when the app is fleshed out. The harness and per-area spec
will settle the real stack and layout. Nothing here is binding.

```
flipfeedback-app/
  web/            front end for app.flipfeedback.com (inbox, triage, analytics, settings, auth)
  api/            back end for api.flipfeedback.com (REST/GraphQL, auth, data access)
  shared/         shared types/models between web and api
  seed/           hooks for loading seed data (generators live in flipfeedback-ops)
  tests/
  .github/        CI; deploy is wired from flipfeedback-infra
```

Stack is to be decided in the app spec. Keep it ordinary and believable for a small SaaS
startup; the point is realistic development, not novelty.
