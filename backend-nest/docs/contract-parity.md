# HTTP contract parity

Phase 0 enumerated 47 legacy routes in [the API contract baseline](../../backend/docs/api-contract-baseline.md). That document remains the source of truth for request and response behavior. This document only tracks the contract suites that are actively exercised while NestJS migrates in parallel.

| Area | Legacy | Nest | Shared contract |
| --- | ---: | ---: | --- |
| Health/global | Yes | Yes | Active |
| Hobby | Yes | Yes | Active |
| Class core | Yes | Yes | Active |
| Class advanced | Yes | Not migrated | Pending |
| Student core | Yes | Not migrated | Pending |
| Student advanced | Yes | Not migrated | Pending |

The active global suite checks `GET /` for the exact legacy health payload and `GET /api` for a `404` status. The active Hobby suite checks the active list, validation, create/duplicate/delete/not-found flow, and legacy envelopes independently against every selected HTTP target, so matching responses between two targets alone is never treated as sufficient evidence of compliance.

Hobby in-use protection and bit exhaustion are covered by NestJS unit tests. They are intentionally not black-box fixture tests yet: the contract harness does not create Student records or consume all 31 hobby bits in a shared database.

Class core active coverage includes list, page, detail, create, immutable-code update, single delete, and non-blocked mass delete. FK-blocked single delete and partial `blockedIds` remain unit-test-only until a safe Student fixture/cross-module test is available.

No skipped placeholder tests are recorded for modules that have not yet migrated. New module contract suites will be added only when their NestJS endpoints exist.
