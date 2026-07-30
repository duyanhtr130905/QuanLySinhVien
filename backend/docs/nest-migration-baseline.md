# Nest migration baseline

## Baseline

- Source commit: `74f50c767d375c95d15def9710bd513243ab9979` (`feat(frontend): add shared keyboard shortcut foundation`).
- Runtime observed: Node `v22.16.0`, npm `11.10.1`.
- Commands: `cd backend && npm.cmd start`, `npm.cmd run dev`, `npm.cmd test`.
- Test command uses the Node test runner: `node --test test/*.test.js`. In an isolated copy of this backend, `npm ci && npm test` passes **113/113**. The workspace's direct `npm ci` remains interrupted by a locked `bcrypt.node` held by the running backend nodemon/server process; it was not stopped automatically.

## Current modules

- **Student:** CRUD, soft-delete trash/restore/permanent delete, Supabase attachments, copy workflows, import preview/validate/commit, and binary import/export/template.
- **Class:** CRUD, `student_count`, student membership, copy workflows, row-by-row import, and binary export.
- **Hobby:** active-list, generated bit allocation, create, and guarded hard delete.
- **Shared/core:** Express app bootstrap, response/error helpers, async handler, request parsing, allowlisted list repository, PostgreSQL pool, Supabase client, Multer, and CSV/XLSX/JSON/XML helpers.

## External dependencies

- Express `^5.2.1`; PostgreSQL via `pg ^8.22.0` and `DATABASE_URL` (SSL is always configured with `rejectUnauthorized: false`).
- Supabase Storage via `@supabase/supabase-js ^2.110.2`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`, bucket `student-attachments`.
- Multer `^2.2.0` memory storage; bcrypt `^6.0.0` (10 salt rounds); CSV (`csv-parse ^7.0.1`, `csv-stringify ^6.8.1`), XLSX `^0.18.5`, JSON, XML (`xml2js ^0.6.2`).
- Required environment variables in `.env.example`: `DATABASE_URL`, `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## High-risk flows

- Student create uploads an attachment before DB insert and deletes the new object on a DB failure. Update uploads replacement before DB update, deletes it if DB update fails, and removes the old object only after a successful DB update.
- Student soft delete relies on a database trigger. Restore is transactional with savepoints for per-row unique conflicts. Permanent deletion is transactional; attachment deletion happens after commit and is best-effort.
- Hobby allocation chooses the lowest unused power-of-two across all hobby rows; active students block hobby hard delete.
- Class membership add/remove-many locks Class and Student rows in a transaction. Any missing/deleted/already-assigned/not-in-class student rolls back the batch.
- Class bulk delete is intentionally non-atomic: each foreign-key blocked Class is retained in `blockedIds`, while other Classes delete.
- Copy preview is read-only; validate returns diagnostics; commit rechecks sources and uniqueness in a transaction. Student copy may upload files before commit and compensates failed uploads.
- Student import is preview/validate/transactional commit. Class import writes rows independently and reports `{ created, failed }` partial success.
- Export writes binary buffers with type-specific `Content-Type` and attachment filenames.

## Migration invariants

The NestJS phase must preserve:

- every route, method, route declaration ordering, path/query/body field, multipart field name, and 5 MB/10 MB limit;
- HTTP status, `{ code, status, message, data }` response envelope, raw health response, Vietnamese and existing English messages, and fallback error code;
- PostgreSQL constraint mappings, soft-delete trigger behavior, transactions, savepoints, and partial-success results;
- Supabase upload/cleanup ordering and best-effort post-commit cleanup;
- csv/xlsx/json/xml parsing behavior, Student file schema, binary content types, and exact download filename patterns;
- legacy parsing: permissive `parseInt`, ignored Class update `code`, invalid `toplist` omission, and selected mass endpoints that pass id-list entries through rather than normalize them.

## Known gaps

- No HTTP integration suite exercises a real Express server, PostgreSQL database, Multer parser, or Supabase instance; tests mock dependencies/unit-test controllers and services.
- Direct workspace `npm ci` remains blocked by the active backend dev process locking `backend/node_modules/bcrypt/prebuilds/win32-x64/bcrypt.node`; it removed some installed modules before failing. The identical isolated verification passes 113/113. Once the dev server is stopped, restore this workspace with `npm.cmd ci` then `npm.cmd test`.
- Existing tests characterize response/error helpers, ordering-sensitive controller contracts, multipart normalization, class membership atomicity, Class bulk-delete partial success, Student trash lifecycle, attachment compensation, hobby delete guard, copy preview/validate/commit, import validation/commit, export formats/headers, and transaction rollback. They do not prove real database constraints, real Supabase cleanup, trigger installation, or network storage behavior.
- `backend/docs/api-contract-baseline.md` is now based on source. Older architecture/proposal documents are historical and may describe earlier contracts; they are not the migration source of truth.
