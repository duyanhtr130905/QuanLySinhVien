# Contract hardening proposals

> Task 7 is an audit only. This document proposes future decisions and migrations; it does not change the current API, runtime behaviour, database, frontend, or test expectations.

The API contracts referenced below are recorded in `api-contract-baseline.md`. The PTTK rule about immutable Class codes is supplied in this task's requirements; no separate PTTK source document was found in this repository during this audit.

## Decision overview

| Topic | Recommended direction | Mentor decision required |
| --- | --- | --- |
| Class code updates | Make `code` immutable through an explicit, versioned contract change | Yes |
| Class mass delete result | Add `blockedIds` additively before considering a v2 summary shape | Yes |
| Hobby delete | Choose explicitly between retaining hard delete and soft-disable semantics | Yes |
| `toplist` | Preserve legacy parsing now; introduce canonicalisation and strict parsing only through an agreed migration | Yes |
| Error model | Adopt an internal PostgreSQL-to-`AppError` adapter without exposing new error fields yet | Yes, for public error/detail policy |

## 1. Class `code` can currently be updated

### Hiện trạng

`PUT /class/:id` accepts `code`, `name`, and `description`, and passes all three fields to `class.service.update`. A changed code can therefore be persisted. The current baseline records this body shape, and existing controller tests characterize that behaviour.

### PTTK

The supplied PTTK requirement says that a Class code must not be edited after creation. That rule conflicts with the current API contract. There is also a design inconsistency with Student, whose service explicitly treats its code as immutable after creation.

### Rủi ro

- Clients may already rely on correcting or renaming a Class code through `PUT`.
- Rejecting or ignoring `code` changes without a migration would be a breaking behavioural change.
- Silently ignoring a supplied code leaves a UI showing a value that was not saved.
- Changing a code may affect external references or reports even when database foreign keys use the numeric class id.

### Phương án A — enforce immutability (recommended)

Keep the current `PUT` route, but reject a request that attempts to change `code` with a documented validation error. The error status, code, and message must be chosen and versioned deliberately; reusing an unrelated existing validation code would make the contract ambiguous.

### Phương án B — compatibility transition

Keep accepting the current body for a deprecation period. Frontend stops sending editable code, while the backend logs or marks changed-code requests as deprecated. At the announced cutover, apply Option A. An alternative compatibility rule is to accept only a code equal to the stored value, but this still needs a clear response for a changed value and an additional lookup.

### API/frontend/database impact

- API: Option A changes the successful-update contract for requests containing a changed `code`; body documentation must mark `code` as create-only.
- Frontend: the Class edit form must display code as read-only or omit it from the update payload.
- Tests: current characterization expectations for updating code must be replaced only when the new contract is approved.
- Database: neither option requires a schema migration. Existing data remains valid.

### Migration cần thiết

1. Inventory clients that send Class update requests.
2. Update API documentation and frontend form/payload.
3. Add a deprecation window if Option B is selected.
4. Add approved contract tests for changed code, unchanged code, and updates that omit code.
5. Enforce the new rule only after the cutover date or API-version boundary.

### Khuyến nghị

Use Option B to avoid a surprise break, then converge on Option A. Do not silently discard a changed code.

### Cần mentor quyết định

Yes: whether this is a breaking change now or versioned/deprecated first, and the public error status/code/message for a rejected changed code.

## 2. Class `massDelete` does not expose both result sets clearly

### Hiện trạng

`class.service.massDelete` returns both `deletedIds` and `blockedIds`. It classifies PostgreSQL foreign-key errors (`23503`) per id as blocked. The controller's response data currently contains only `{ ids: deletedIds }`; its message varies when blocked ids exist, but clients cannot reliably obtain the complete blocked-id list from response data.

### PTTK

The supplied architecture direction favors explicit controller contracts. A batch mutation should make successful and blocked items machine-readable, rather than requiring clients to infer details from a message.

### Rủi ro

- The frontend cannot identify which selected rows need user action.
- A localized message is unsuitable as a data protocol.
- Changing `ids` to a different field name would break existing consumers.
- The service currently does not report ids that were not found, so a future summary must define that case separately rather than imply they were deleted or blocked.

### Phương án A — additive response field (recommended first step)

Keep all current status codes, messages, and `data.ids`, then add `data.blockedIds`:

```json
{
  "code": 200,
  "message": "...",
  "data": {
    "ids": [1, 2],
    "blockedIds": [3]
  }
}
```

This keeps `ids` as the legacy alias for successful deletions. It is an additive response change for clients that ignore unknown fields.

### Phương án B — versioned batch-result contract

Introduce a v2 or explicitly negotiated response shape such as:

```json
{
  "deletedIds": [1, 2],
  "blockedIds": [3],
  "notFoundIds": [4]
}
```

This is clearer, but requires deciding how `notFoundIds`, duplicate request ids, and partial-success status/message are defined.

### API/frontend/database impact

- API: Option A is additive; Option B is a contract/version change.
- Frontend: can display blocked selections precisely after adopting Option A or B.
- Tests: add assertions for both arrays once approved; do not change the current baseline before then.
- Database: no schema or data migration is needed.

### Migration cần thiết

1. Confirm whether nonexistent ids must be reported.
2. Publish the chosen result schema and partial-success semantics.
3. If Option A is selected, release the additive field and update the frontend to consume it while retaining `ids`.
4. If Option B is selected, support the legacy shape until client migration completes.

### Khuyến nghị

Adopt Option A first, with `ids` retained exactly as today. Plan Option B only if batch APIs are standardized across modules.

### Cần mentor quyết định

Yes: whether missing ids are part of the public result and whether a partial batch should retain the current status/message convention.

## 3. Hobby deletion: hard delete versus soft-disable

### Hiện trạng

Hobby rows have `is_active`, and `getAll` returns only active rows. `store` creates an active row. Despite that column, `DELETE /hobby/:id` performs a hard delete after checking whether an active student uses the hobby bit. The bit-allocation query considers all remaining rows; a hard-deleted bit can therefore become available for reuse. `findById` itself does not filter on `is_active`.

### PTTK

No decision in the supplied task mandates soft deletion for Hobby. The existing `is_active` column makes soft-disable a plausible design, but is not proof that it is the intended deletion contract.

### Rủi ro

- Hard delete removes history and permits future reuse of a bit value after the row is gone.
- Soft-disable preserves history but requires an explicit policy for reading inactive records, reactivation, unique values, and bit allocation.
- Changing to soft-disable alters delete semantics even if the HTTP response remains unchanged.
- The current in-use check considers active students; any future history/reporting requirement must state whether deleted students count.

### Phương án A — retain hard delete

Keep the current behaviour: reject deletion when in use by an active student, otherwise physically remove the row. This preserves the current API and permits bit-value reuse once the row is deleted.

### Phương án B — soft-disable

Replace deletion with `is_active = false`, keep normal list endpoints filtered to active rows, and define privileged/history access separately. Decide whether inactive hobby codes/names/bit values remain reserved (the current bit-allocation logic would reserve them) and whether reactivation is supported.

### API/frontend/database impact

- API: Option A has no change. Option B changes the meaning of successful delete and needs explicit not-found/inactive behaviour for detail and repeated delete requests.
- Frontend: Option B may need an inactive-history or reactivate workflow; ordinary selection lists already filter active records.
- Tests: Option B needs lifecycle tests beyond the current delete contract.
- Database: `is_active` already exists, so no schema migration is inherently required; data/backfill rules are needed only if historical deletes must be represented.

### Migration cần thiết

1. Establish retention, audit, reactivation, and bit-reuse policies.
2. If Option B is selected, define inactive-row visibility and uniqueness/bit allocation rules.
3. Add an approved migration for any historical reconstruction only if a source of deleted rows exists.
4. Update API and frontend contract tests before changing delete implementation.

### Khuyến nghị

Do not change the current hard-delete implementation merely because `is_active` exists. Choose Option B only if product needs retention or reversible deactivation and accepts reserved bit semantics.

### Cần mentor quyết định

Yes: retention requirement, reactivation policy, and whether an inactive hobby's bit may ever be reused.

## 4. `toplist` parsing and paging hardening

### Hiện trạng

Class and Student list validators retain legacy parsing for `toplist`: invalid entries are omitted rather than causing an HTTP error. The repository factory validates/normalizes request-derived ids and supplies list, search, limit, offset, and `CASE` ordering values as query parameters; table, columns, aliases, and order expressions come from configured allow-lists rather than request interpolation.

Duplicate ids are not deduplicated before the query. In the current SQL semantics, duplicates add redundant bound values but do not duplicate rows: the `IN` condition and `CASE` ordering still operate on the matching row once. `page_info.total_items` is calculated from the base/search filter and intentionally does not include `toplist`, because toplist only reorders matching rows and should not affect the total count.

### PTTK

The supplied requirements ask for parameterized values, no arbitrary table/column/order input, and preservation of current `toplist` and page-info semantics. The current implementation meets the parameterization and count-semantics requirements; legacy invalid-id omission remains an intentional compatibility behaviour.

### Rủi ro

- Silently omitting malformed ids can hide client bugs and make an incomplete toplist difficult to diagnose.
- Duplicates increase query parameters unnecessarily and leave desired ordering ambiguous to clients.
- Making invalid ids strict immediately would break clients that rely on current omission.
- Changing the count to include toplist would be incorrect: it would make a reorder filter behave like a record filter.

### Phương án A — compatibility hardening (recommended now)

Preserve legacy omission and the existing page count. Canonicalize valid values by stable de-duplication before repository execution, optionally emit internal metrics/logging for discarded invalid values, and document that only positive unique ids are meaningful. This does not change the returned record set or `page_info`; it only removes redundant bind parameters.

### Phương án B — strict API contract

Introduce a versioned endpoint or explicit opt-in mode in which any invalid `toplist` id produces a documented `400` response and duplicates are either rejected or normalized. Keep legacy mode unchanged until clients migrate.

### API/frontend/database impact

- API: Option A is intended to preserve function and response shape; Option B is a behavioural change and needs versioning/negotiation.
- Frontend: should submit positive, unique ids in desired order. Strict mode requires error handling for malformed query values.
- Tests: preserve the current invalid-id omission characterization; add separate approved tests for any strict mode.
- Database: none. Parameterization and count queries remain unchanged.

### Migration cần thiết

1. Document current legacy omission and duplicate semantics.
2. Add stable deduplication only after confirming no consumer depends on redundant ids.
3. If strict parsing is desired, publish an opt-in/versioned contract and migrate frontend query generation.
4. Keep total-item count tied only to the base/search predicate in every mode.

### Khuyến nghị

Keep the existing parameterized SQL and page count. Start with Option A; do not turn invalid ids into errors without a compatibility plan.

### Cần mentor quyết định

Yes: whether strict query validation is worth a versioned breaking change, and whether duplicate input should be rejected or normalized in that future contract.

## 5. Error model and manual PostgreSQL constraint mapping

### Hiện trạng

`AppError` carries `statusCode`, `errorCode`, `message`, `details`, and `cause`. It is sufficient as an internal error envelope, and generic handlers can return expected errors with a status/code. It is not yet a fully unified public error model:

- `errorHandler` recognizes the legacy `httpStatus` plus `errorCode` convention, not `AppError.statusCode` alone.
- `response.js` does not expose `details`; error responses keep `data` as `null`.
- Controllers still translate known PostgreSQL errors into endpoint-specific response codes/messages directly, which preserves the baseline but duplicates persistence knowledge.
- There is no documented policy for exposing causes/details, retryability, stable error categories, or correlation identifiers.

Manual PostgreSQL mappings found in the current backend are:

| Location | PostgreSQL code / constraint | Current meaning |
| --- | --- | --- |
| `modules/class/class.controller.js` store | `23505` | duplicate Class code, `409 E603` |
| `modules/class/class.controller.js` update | `23505` | duplicate Class code, `409 F603` |
| `modules/class/class.controller.js` destroy | `23503` | Class is still referenced by students, `409 G605` |
| `modules/class/class.service.js` massDelete | `23503` | classify an id into `blockedIds` |
| `modules/hobby/hobby.controller.js` store | `23505`; `tra_hobby_name_key`, `tra_hobby_code_key`, `tra_hobby_bit_value_key` | endpoint-specific duplicate message via `uniqueMessageForConstraint` |
| `modules/student/student.controller.js` store | `23505`; `23503` | duplicate code/email/username or nonexistent class id |
| `modules/student/student.controller.js` update | `23505`; `23503` | duplicate code/email/username or nonexistent class id |
| `modules/student/student.controller.js` importStudents | `23505` | per-row generic import failure: duplicate code/email/username |

### PTTK

The refactor introduces shared HTTP utilities without requiring immediate controller migration. A hardening phase can centralize technical database-error classification while retaining module-specific public contract codes/messages.

### Rủi ro

- A broad global mapper may accidentally turn an endpoint-specific error code/message into a generic response, breaking API clients.
- Exposing `details` or `cause` can disclose SQL, internal identifiers, file/storage metadata, or secrets.
- Leaving mappings scattered makes new constraints easy to map inconsistently.
- Replacing the legacy `httpStatus` convention without an adapter may route expected errors to the generic `500` handler.

### Phương án A — incremental internal adapter (recommended)

Create an internal PostgreSQL-to-domain-error adapter used by modules that opt in. Each module supplies its existing public status/code/message configuration; the adapter only classifies technical facts such as `23505`, `23503`, and named constraints. Add an `AppError`/legacy adapter in the error flow, but continue returning the exact current response envelope and keep `details`/`cause` server-only by default.

### Phương án B — versioned public error catalogue

Define a cross-module error catalogue with stable domain categories, optional safe details, and correlation ids. Move all modules to it through a v2 API or a declared compatibility layer. This gives a stronger long-term model but has wider API and frontend consequences.

### API/frontend/database impact

- API: Option A should preserve all current status/error code/message values. Option B may add fields or alter code semantics and must be versioned.
- Frontend: no change for Option A; Option B requires a documented error-client migration.
- Tests: retain existing exact error assertions for Option A and add mapper tests; change expectations only for an approved v2 contract.
- Database: no schema migration. Constraint names should be treated as database configuration and covered by migration/repository review.

### Migration cần thiết

1. Freeze the existing endpoint error map in contract tests.
2. Define a server-only error adapter and migrate one module at a time.
3. Verify every named constraint has a deterministic fallback when a migration renames it.
4. Decide whether any sanitized details/correlation id become public, then version and document that response change if necessary.
5. Remove direct mappings only after their adapter coverage is proven by tests.

### Khuyến nghị

Adopt Option A. `AppError` is adequate as a carrier but needs an explicit bridge to the legacy error handler and a clear policy that `cause` and `details` are not returned by default. Preserve module-owned public error configurations until a versioned public catalogue is approved.

### Cần mentor quyết định

Yes: whether public error details/correlation ids are desired, the compatibility policy for legacy `httpStatus`, and whether a shared catalogue may replace existing module-specific error codes.

## Audit conclusion

All five areas are contract decisions rather than safe mechanical refactors. The current baseline should remain authoritative until each proposed change has an approved API decision, frontend plan, and updated characterization/contract tests.
