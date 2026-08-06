# NestJS cutover readiness

Status: **GO for a controlled Nest cutover rehearsal; production default remains unchanged.** This evidence does not delete `backend`, change its port, or deploy Nest as the production default.

## Route inventory — 47/47 active

All API routes use the legacy `{ code, status, message, data }` envelope unless marked binary. Fixed routes are registered before dynamic `:id` routes. The contract suites named below run each route against legacy, Nest, and both targets; `both` checks parity as well as each target's expected contract.

| # | Legacy route | Nest route | Coverage | Status / notes |
|---:|---|---|---|---|
| 1 | GET `/` | GET `/` | global | Active; exact health payload |
| 2 | GET `/hobby` | GET `/hobby` | hobby | Active |
| 3 | POST `/hobby` | POST `/hobby` | hobby | Active |
| 4 | DELETE `/hobby/:id` | DELETE `/hobby/:id` | hobby | Active |
| 5 | GET `/class/page` | GET `/class/page` | class-core | Active |
| 6 | GET `/class/page/:init` | GET `/class/page/:init` | class-core | Active |
| 7 | DELETE `/class/delete` | DELETE `/class/delete` | class-core | Active; partial success preserved |
| 8 | POST `/class/copy` | POST `/class/copy` | class-advanced | Active |
| 9 | POST `/class/copy/preview` | POST `/class/copy/preview` | class-advanced | Active; read-only |
| 10 | POST `/class/copy/validate` | POST `/class/copy/validate` | class-advanced | Active; read-only |
| 11 | POST `/class/copy/commit` | POST `/class/copy/commit` | class-advanced | Active; transaction |
| 12 | POST `/class/copy/:id` | POST `/class/copy/:id` | class-advanced | Active; fixed prefix ordered |
| 13 | POST `/class/import` | POST `/class/import` | class-advanced | Active; multipart `file`, 10 MB |
| 14 | POST `/class/export` | POST `/class/export` | class-advanced | Active; binary headers |
| 15 | GET `/class/export/:id` | GET `/class/export/:id` | class-advanced | Active; binary headers |
| 16 | GET `/class` | GET `/class` | class-core | Active |
| 17 | POST `/class` | POST `/class` | class-core | Active |
| 18 | GET `/class/:id/students` | GET `/class/:id/students` | class-advanced | Active |
| 19 | GET `/class/:id/available-students` | GET `/class/:id/available-students` | class-advanced | Active |
| 20 | POST `/class/:id/students` | POST `/class/:id/students` | class-advanced | Active |
| 21 | PATCH `/class/:id/students/remove` | PATCH `/class/:id/students/remove` | class-advanced | Active |
| 22 | DELETE `/class/:id/students/:studentId` | DELETE `/class/:id/students/:studentId` | class-advanced | Active |
| 23 | GET `/class/:id` | GET `/class/:id` | class-core | Active |
| 24 | PUT `/class/:id` | PUT `/class/:id` | class-core | Active |
| 25 | DELETE `/class/:id` | DELETE `/class/:id` | class-core | Active |
| 26 | GET `/student/page` | GET `/student/page` | student-read | Active |
| 27 | GET `/student/page/:init` | GET `/student/page/:init` | student-read | Active |
| 28 | GET `/student/deleted/page` | GET `/student/deleted/page` | student-write | Active |
| 29 | PATCH `/student/deleted/restore` | PATCH `/student/deleted/restore` | student-write | Active |
| 30 | DELETE `/student/deleted/permanent` | DELETE `/student/deleted/permanent` | student-write | Active |
| 31 | POST `/student/copy` | POST `/student/copy` | student-copy | Active; partial success preserved |
| 32 | POST `/student/copy/preview` | POST `/student/copy/preview` | student-copy | Active; read-only |
| 33 | POST `/student/copy/validate` | POST `/student/copy/validate` | student-copy | Active; read-only |
| 34 | POST `/student/copy/commit` | POST `/student/copy/commit` | student-copy | Active; multipart attachments, 5 MB |
| 35 | POST `/student/copy/:id` | POST `/student/copy/:id` | student-copy | Active; fixed prefix ordered |
| 36 | GET `/student/import/template` | GET `/student/import/template` | student-file | Active; binary headers |
| 37 | POST `/student/import` | POST `/student/import` | student-file | Active; multipart `file`, 10 MB, read-only |
| 38 | POST `/student/import/validate` | POST `/student/import/validate` | student-file | Active; read-only |
| 39 | POST `/student/import/commit` | POST `/student/import/commit` | student-file | Active; transaction |
| 40 | POST `/student/export` | POST `/student/export` | student-file | Active; binary headers |
| 41 | GET `/student/export/:id` | GET `/student/export/:id` | student-file | Active; binary headers |
| 42 | GET `/student` | GET `/student` | student-read | Active |
| 43 | GET `/student/:id` | GET `/student/:id` | student-read | Active; fixed routes precede it |
| 44 | POST `/student` | POST `/student` | student-write | Active; multipart `attachment`, 5 MB |
| 45 | PUT `/student/:id` | PUT `/student/:id` | student-write | Active; multipart `attachment`, 5 MB |
| 46 | DELETE `/student` | DELETE `/student` | student-write | Active; partial success preserved |
| 47 | DELETE `/student/:id` | DELETE `/student/:id` | student-write | Active |

## Frontend API audit

`StudentService`, `ClassService`, and `HobbyService` call only paths in the inventory. `HobbyService.destroy` is included for the active DELETE route. Axios has one base-URL source: `EnvironmentConfig.js` reads `REACT_APP_API_BASE_URL`, with the existing local legacy `http://localhost:3000` fallback. `.env.example` documents `http://localhost:3002` for Nest validation. No production default was changed.

## Runtime and smoke evidence

- Health: `GET /` is covered by the global contract.
- CORS: Nest enables CORS; the frontend origin `http://localhost:3001` is accepted during local API smoke.
- PostgreSQL: both targets use the same configured `DATABASE_URL`; contract fixtures exercise transactions and clean exact IDs.
- Storage: the Supabase adapter remains injected for Student images; copy uses legacy shared-URL semantics and import/export does not touch Storage.
- Shutdown: Nest calls `enableShutdownHooks`; database pools implement application-shutdown cleanup.
- Multipart limits: Student image/copy 5 MB; Student/Class data files 10 MB; contract and unit coverage include the file paths.
- Error envelopes and binary `Content-Type`/`Content-Disposition` headers are covered by the contract suites.
- Timeouts: frontend Axios is 60 seconds; contract integration requests use 30 seconds to accommodate XLSX/remote PostgreSQL without changing runtime timeouts.
- Secrets: response projections exclude password hashes; export columns keep `password` empty. No credentials are committed in frontend environment files.
- Dependency risk: `xlsx` remains the one accepted high advisory; no new dependency was added.

The Nest-target contract suite is the direct API smoke: Hobby create/delete; Class core, membership, copy/import/export; Student read/write/trash, copy preview/validate/commit, file preview/validate/commit/export/template. Fixtures use contract prefixes and cleanup exact active and soft-deleted records.

## Required environment

- Nest: `DATABASE_URL`, optional `PORT` (local smoke uses `3002`), and existing Supabase Storage configuration when image flows are exercised.
- Frontend: set `REACT_APP_API_BASE_URL=http://localhost:3002` in `frontend/reactjs-template/.env.local` for Nest validation; leave it unset for the current local legacy default.

## Rollback and known risks

Rollback is configuration-only: point the single frontend environment variable back to the legacy base URL, keep legacy `backend` running, and redeploy the prior frontend configuration. No database migration or legacy deletion is part of this readiness phase.

Known risks: the accepted `xlsx` advisory remains; the unchanged frontend React 17 toolchain has pre-existing dependency advisories that need a separately scoped upgrade; contract integration can take longer than five seconds with remote PostgreSQL/XLSX; CORS is permissive and should be restricted to production origins as part of deployment configuration. These are operational hardening follow-ups, not functional parity blockers.

## Go / No-Go

**GO for controlled cutover readiness only.** All 47 routes are active and covered, frontend endpoints resolve to Nest routes through one configurable base URL, Nest smoke/contract coverage passes, and fixtures are clean. Production cutover, legacy removal, legacy-port changes, and automatic merge of this readiness branch remain explicitly out of scope.
