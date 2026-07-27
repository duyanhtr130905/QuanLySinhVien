# Backend architecture after controller refactor

## Request path

Routes remain mounted by `src/app.js` at `/class`, `/hobby`, and `/student`. Each route selects a controller function; no route paths, request field names, or response envelopes were changed by this refactor.

Controllers are HTTP orchestration only. They read `req`, invoke validators/services, select the established success or error response, and coordinate endpoint-specific side effects. They do not contain SQL.

## Module responsibilities

### Controller

- `class.controller.js`, `hobby.controller.js`, and `student.controller.js` preserve endpoint messages, status codes, and response shapes.
- Shared handlers are used only where the flow matches exactly: list reads, paging, detail reads, and compatible copy endpoints.
- Create/update/delete/import/export flows stay local when they need module-specific checks, transactions, response variants, or file lifecycle ordering.

### Validator and error configuration

- `*.validator.js` holds request validation and legacy-compatible parsing needed to preserve current endpoint behavior.
- `*.errors.js` is the source of module HTTP error metadata and constraint-message mapping.
- Student validation is shared by create, update, and import. It retains password rules, class FK error mapping, and hobby bitmask validation.

### Service

Services own application and persistence operations: write queries, password hashing, copying, soft deletion, transactions, hobby bit allocation, and Supabase storage adapters. Controllers do not expose SQL or transaction details.

### Repository

`src/core/database/createListRepository.js` is read-only. Given allowlisted configuration, it provides `getAll(columnlist)` and `getByPage(...)`.

- Class: `tra_class`, search on `code`, `name`, `description`, no deleted filter.
- Student: `tra_student`, search on `fullname`, `description`, `email`, with `deleted_at IS NULL` as its deleted filter and no `password` in its selectable columns.

The repository reuses `resolveColumns` and `resolveOrderBy`. Request-derived values (`search`, `toplist`, `size`, and `offset`) are query parameters; table names, columns, and order aliases come only from module configuration. Writes, copy transactions, imports, and exports are intentionally not genericized.

## Core HTTP

- `asyncHandler` sends rejected async work to Express `next(error)` without creating a response.
- `AppError` carries `statusCode`, `errorCode`, `message`, `details`, and `cause` for parser and validation failures.
- `requestParsers` provides pure parsing with strict defaults and explicit legacy options where old controllers used permissive `parseInt` or omitted invalid toplist values.
- `controllerHandlers` composes common service/parser/success/not-found/fallback flows and continues to use the existing response envelope helper.

## Error flow

Expected validation or not-found errors are converted to the existing `{ code, status, message, data: null }` response in the controller or shared handler. Constraint-specific errors retain their existing mappings. Unexpected errors receive the endpoint fallback code and are passed to `middlewares/errorHandler`, which produces the established 500 response.

## Student multipart and storage flow

`student.multipart.js` normalizes multipart values without mutating `req.body`: boolean `sex`, nullable `class_id`, and integer `hobbies` retain existing semantics, including `false`, `null`, and `0`.

`student.fileService.js` has no HTTP response logic or SQL. It validates attachment metadata, uploads new files through the storage adapter, cleans up a new file after a failed database write, and removes the old file only after a successful update. The route fields remain `attachment` for create/update and `file` for import.
