# Class management API

This document records the Class-management contract added on `feature/class-management`. All JSON responses use the existing envelope:

```json
{ "code": "200", "status": 200, "message": "...", "data": {} }
```

Errors retain `data: null` and module error codes.

## Existing Class updates

`PUT /class/:id` now treats `code` as immutable. A submitted `code` is ignored for compatibility; only `name` and `description` can change. The success envelope and existing validation/error codes for mutable fields remain unchanged.

## Class list and detail

`GET /class`, `GET /class/page`, and `GET /class/page/:init` retain their existing inputs and page-info shape. Every returned Class record now includes `student_count`, counting only `tra_student` rows where `class_id` is the Class id and `deleted_at IS NULL`.

The count is a correlated aggregate in the Class list SQL, not a per-record query. It therefore does not introduce N+1 database access.

`GET /class/:id` returns:

```json
{
  "id": 7,
  "code": "C01",
  "name": "Class 1",
  "description": "...",
  "student_count": "2",
  "created_at": "...",
  "updated_at": "..."
}
```

Invalid id returns `400 D601`; a missing Class returns `404 D604`.

## Students in a Class

`GET /class/:id/students` accepts required query parameters `page` and `size`, and optional `search`, `order`, and `columnlist`.

- Search covers `code`, `fullname`, `email`, `username`, and `description`.
- Only students with the requested `class_id` and `deleted_at IS NULL` are returned.
- `password` is never selectable.
- The response data is `{ "page_info": {}, "records": [] }`, using the existing page-info shape.
- A missing Class returns `404 L604`; invalid path/query values use `L601`, `L609`, or `L610`.

## Assign and remove existing Students

`POST /class/:id/students` accepts:

```json
{ "studentIds": [1, 2, 3] }
```

Duplicate ids are removed before processing. On success, it returns:

```json
{ "studentIds": [1, 2, 3] }
```

The service opens one transaction, locks the Class and requested Student rows, verifies every Student, updates `class_id`, then commits. If any requested Student is missing (`L605`), soft-deleted (`L606`), or already assigned to any Class (`L607`), the transaction rolls back completely. A missing Class is `404 L604` and an invalid `studentIds` body is `400 L603`.

`DELETE /class/:id/students/:studentId` does not delete the Student. It sets only `class_id = NULL` (and the normal `updated_at` timestamp) when the active Student belongs to that Class. Success data is `{ "studentId": 3 }`. A Student outside the Class returns `409 L608`.

## Class deletion

`DELETE /class/:id` remains blocked by the database foreign key when active or otherwise linked Students exist, returning `409 G605`.

`DELETE /class/delete` retains partial success and now exposes both result arrays:

```json
{
  "deletedIds": [1, 2],
  "blockedIds": [3]
}
```

No batch rollback occurs: deletable Classes are deleted, while linked Classes remain in `blockedIds`. The message reports both counts.

## Import

`POST /class/import` accepts multipart field `file`, with a 10 MB limit. Supported extensions are `csv`, `xlsx`, `json`, and `xml`; parsing uses the shared `fileFormat.js` implementation.

Each row accepts `code`, `name`, and optional `description`. `code` and `name` are trimmed; both are required, with maximum lengths 50 and 255 respectively. Unique-code conflicts are reported per row. The success data is:

```json
{
  "created": [{ "id": 1 }],
  "failed": [{ "row": 3, "reason": "..." }]
}
```

Unsupported formats return `400 J601`; missing, unreadable, empty, or oversize files return `400 J604`.

## Export

`GET /class/export/:id?type=csv|xlsx|json|xml` exports one Class. `POST /class/export` accepts `{ "idlist": [1, 2], "type": "csv|xlsx|json|xml" }` for multiple Classes. The default type is `xlsx`.

Exports contain only `code`, `name`, and `description`, use the shared `fileFormat.js` binary response, and set `Content-Type` plus an attachment filename. Invalid type/id input uses `400 K601`; a missing single Class returns `404 K604`.
