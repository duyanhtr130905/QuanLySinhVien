# HTTP contract parity

Phase 0 enumerated 47 legacy routes in [the API contract baseline](../../backend/docs/api-contract-baseline.md). That document remains the source of truth for request and response behavior. This document only tracks the contract suites that are actively exercised while NestJS migrates in parallel.

| Area | Legacy | Nest | Shared contract |
| --- | ---: | ---: | --- |
| Health/global | Yes | Yes | Active |
| Hobby | Yes | Not migrated | Pending Phase 4 |
| Class core | Yes | Not migrated | Pending |
| Class advanced | Yes | Not migrated | Pending |
| Student core | Yes | Not migrated | Pending |
| Student advanced | Yes | Not migrated | Pending |

The active global suite checks `GET /` for the exact legacy health payload and `GET /api` for a `404` status. It runs independently against every selected HTTP target, so matching responses between two targets alone is never treated as sufficient evidence of compliance.

No skipped placeholder tests are recorded for modules that have not yet migrated. New module contract suites will be added only when their NestJS endpoints exist.
