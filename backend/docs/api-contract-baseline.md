# API contract baseline

Source of truth: `backend/src` on `develop` commit `74f50c767d375c95d15def9710bd513243ab9979`. This is a characterization document, not a proposal.

## Global contract

- Routes have no `/api` or version prefix. `cors()` and `express.json()` apply before all module routes. There is no authentication middleware.
- JSON success is always HTTP 200: `{ "code": "200", "status": 200, "message": "<Vietnamese message>", "data": <payload> }`.
- JSON errors are `{ "code": "<module code>", "status": <HTTP status>, "message": "<Vietnamese message>", "data": null }`; import-commit validation is the exception and returns invalid rows in `data`.
- Known errors with `statusCode` and `errorCode` preserve those values. Unexpected errors use the controller fallback (`B600` through `L600`), HTTP 500, and `Lỗi hệ thống không xác định`.
- `GET /` is the only non-envelope success: `{ "status": "ok", "message": "Quản lý Sinh viên API đang hoạt động" }`.

## Route ordering and multipart

Fixed Student paths (`/page`, `/deleted/*`, `/copy/*`, `/import/*`, `/export/*`) precede `/:id`; `/copy`, `/copy/preview`, `/copy/validate`, and `/copy/commit` precede `/copy/:id`. Fixed Class paths similarly precede `/:id`; membership paths `/:id/students*` precede `/:id`. This declaration order is part of the contract.

- Student create/update: `multipart/form-data`, optional `attachment`, memory storage, jpg/jpeg/png only, max 5 MB. Multer rejects invalid type/oversize with `400 E603`, `Ảnh phải là jpg/jpeg/png, tối đa 5MB`.
- Student copy commit: `upload.any()`; draft images use fields `attachment-<draftKey>`. The same image error middleware runs.
- Student import and Class import: multipart field `file`, memory storage, max 10 MB. Class oversize becomes `400 J604`, `File không được vượt quá 10MB`; Student import has no local multer-error mapper and other Multer errors fall through the global handler.
- Supported import/export types are `csv`, `xlsx`, `json`, `xml`; default export type is `xlsx`. Binary responses do not use the envelope.

## Class routes (`/class`)

| Method and route | Input and normalization | Success (HTTP 200) | Errors / flow |
|---|---|---|---|
| `GET /class` | query `columnlist` | class list; `Lấy danh sách lớp thành công` | fallback `B600`; `classService.getAll(columnlist)` |
| `GET /class/page`, `/class/page/:init` | required query `page`, `size`; optional `order`, `search`, `columnlist`, comma `toplist`. Legacy `parseInt`; invalid toplist entries omitted; `:init` ignored. | `{ page_info, records }`; `Lấy danh sách lớp theo trang thành công` | `400 C601` `Số trang không hợp lệ`; `400 C602` `Cỡ trang không hợp lệ`; fallback `C600`; `getByPage` |
| `GET /class/:id` | positive legacy-parsed `id` | class including `student_count`; `Lấy chi tiết lớp thành công` | `400 D601`; `404 D604` `Không tìm thấy bản ghi lớp học`; fallback `D600`; `getOneById` |
| `POST /class` | JSON `code`, `name` required and trimmed; optional `description`; limits 50/255 | `{ id }`; `Tạo lớp thành công` | `400 E603` required/length; `409 E603` `Mã lớp (code) đã tồn tại`; fallback `E600`; `store` |
| `PUT /class/:id` | legacy id; JSON optional `name`, `description`; supplied `code` is ignored | `{ id }`; `Cập nhật lớp thành công` | `400 F601` invalid id; `400 F603` blank/too-long name; `404 F604`; fallback `F600`; `update` |
| `DELETE /class/:id` | legacy id | `{ id }`; `Xóa lớp thành công` | `400 G601`; `404 G604`; PostgreSQL `23503` -> `409 G605` `Không thể xóa: Lớp học này vẫn còn sinh viên liên kết`; fallback `G600`; `existsById`, `destroy` |
| `DELETE /class/delete` | JSON nonempty array `ids`; values are passed through without per-item validator | `{ deletedIds, blockedIds }`; full `Xóa các lớp thành công`, otherwise message names blocked ids | `400 I604` `Danh sách ids không hợp lệ`; fallback `I600`; each delete is independent, `23503` is added to `blockedIds`, missing ids are silently omitted; `massDelete` |
| `POST /class/copy/:id` | legacy id | copied record; `Sao chép lớp thành công` | `400 H601`; `404 H604`; fallback `H600`; `copyOne` |
| `POST /class/copy` | JSON nonempty `idlist`, values passed through | created-record array; full/partial copy Vietnamese count message | `400 H603`; all missing -> `404 H604`; fallback `H600`; mass copy transaction rolls back unexpected writes but treats missing sources as partial success |
| `POST /class/copy/preview` | JSON `idlist` | `{ drafts }`; `Đã tạo N draft lớp` | copy errors `H603/H604`; read-only batched lookup; `getCopyPreview` |
| `POST /class/copy/validate` | JSON `drafts` | validation payload; `ÄÃ£ kiá»ƒm tra cÃ¡c báº£n sao lá»›p` | draft errors `400 H603`; `validateCopyDrafts` |
| `POST /class/copy/commit` | JSON nonempty drafts, each `{ draftKey, sourceId, values:{code,name,description} }`; code/name trimmed | `{ created:[{draftKey,record}] }`; `Đã tạo N lớp` | malformed `400 H603`; duplicate `409 E603`; source missing `404 H604`; transaction rechecks sources and duplicates then commits all or rolls back; `commitCopyDrafts` |
| `GET /class/:id/students` | legacy class id; required `page`,`size`; optional `search`,`order`,`columnlist` | `{ page_info, records }`; `Lấy danh sách sinh viên trong lớp thành công` | `400 L601/L609/L610`; missing class `404 L604`; fallback `L600`; active students only, no password; `getStudentsByClass` |
| `GET /class/:id/available-students` | same paging input | `{ page_info, records }`; `Lấy danh sách sinh viên có thể thêm vào lớp thành công` | same `L*` errors; active, unassigned students only; `getAvailableStudentsByClass` |
| `POST /class/:id/students` | legacy id; JSON nonempty valid positive `studentIds`, deduplicated | `{ studentIds }`; `Thêm sinh viên vào lớp thành công` | `400 L601/L603`, `404 L604/L605`, `409 L606/L607`; fallback `L600`; locks class/students and atomically assigns all or rolls back; `assignStudents` |
| `PATCH /class/:id/students/remove` | same `studentIds` input | `{ studentIds }`; `Loại sinh viên khỏi lớp thành công` | `400 L601/L603`, `404 L604/L605`, `409 L606/L608`; fallback `L600`; transactional all-or-nothing unlink; `removeStudents` |
| `DELETE /class/:id/students/:studentId` | two legacy ids | `{ studentId }`; `Loại sinh viên khỏi lớp thành công` | `400 L601`; `404 L604/L605`; `409 L608` if not assigned to class; fallback `L600`; only clears `class_id`; `removeStudent` |
| `POST /class/import` | multipart `file`; rows `code`, `name`, optional `description`; code/name trimmed | `{ created, failed }`; `Import thành công N dòng, lỗi M dòng` | `400 J601` unsupported type; `400 J604` missing/unreadable/empty/oversize; fallback `J600`; each row calls `store`, so valid rows remain when later rows fail |
| `GET /class/export/:id` | legacy id; query `type` | binary, `attachment; filename="class-<id>.<ext>"` | `400 K601` invalid id/type; `404 K604`; fallback `K600`; `getOneForExport` |
| `POST /class/export` | JSON nonempty positive `idlist`, optional `type` | binary, `attachment; filename="classes-export.<ext>"` | `400 K601`; fallback `K600`; `getManyForExport` |

## Hobby routes (`/hobby`)

| Method and route | Input | Success (HTTP 200) | Errors / flow |
|---|---|---|---|
| `GET /hobby` | none | active hobbies ordered by bit; `Lấy danh sách sở thích thành công` | fallback `B600`; `getAll` |
| `POST /hobby` | JSON required `name`, trim, max 30 | hobby `{id,code,name,bit_value,is_active}`; `Tạo sở thích thành công` | `400 E603`; `422 E604` when all bits 2^0..2^30 are occupied; `409 E603` unique constraint message; fallback `E600`. `store` allocates the smallest unused bit and code `HB<bit_value>` |
| `DELETE /hobby/:id` | legacy id | `{ id }`; `Xóa sở thích thành công` | `400 G601`; `404 G604`; `409 G605` `Không thể xóa: sở thích này đang được sinh viên sử dụng`; fallback `G600`. Hard delete only after checking active students' hobby bitmask |

## Student routes (`/student`)

Student create validation requires `code`, `fullname`, `email`, `username`, `password`. It enforces lengths, email/Facebook regexes, strong password, and hobby bitmask against active hobbies. Update validates only supplied fields. Multipart normalization preserves typed JSON values: `sex` string `true`/`false` becomes boolean (other string -> `null`); `class_id` `''`, `-1`, or unparseable -> `null`; `hobbies` empty/unparseable -> `0`.

| Method and route | Input and normalization | Success (HTTP 200) | Errors / flow |
|---|---|---|---|
| `GET /student` | query `columnlist` | active list; `Lấy danh sách sinh viên thành công` | fallback `B600`; `getAll` |
| `GET /student/page`, `/student/page/:init` | required `page`,`size`; optional `order`,`search`,`columnlist`,`toplist`,`exclude_ids` or `exclude_ids[]`; legacy parseInt and omit invalid ids; `:init` ignored | `{ page_info, records }`; `Lấy danh sách sinh viên theo trang thành công` | `400 C601/C602`; fallback `C600`; active rows, no password; `getByPage` |
| `GET /student/:id` | legacy id | record; `Lấy chi tiết sinh viên thành công` | `400 D601`; `404 D604` `Không tìm thấy sinh viên`; fallback `D600`; `getOneById` |
| `POST /student` | JSON or multipart fields above; optional image `attachment` | created record without password; `Tạo sinh viên thành công` | validation/class FK `400 E603`; unique `409 E603`; fallback `E600`; uploads before DB write and compensates by deleting new upload on failure; `getActiveHobbyMask`, storage adapter, `store` |
| `PUT /student/:id` | legacy id; optional create fields/image; `code` and `username` are ignored by service | updated active record; `Cập nhật sinh viên thành công` | `400 F601/F603`; `404 F604`; unique `409 F603`; fallback `F600`. New upload is deleted if DB fails/missing row; old upload is removed only after DB success; failed old-file cleanup does not roll back DB. `update` |
| `DELETE /student/:id` | legacy id | `{ id }`; `Xóa sinh viên thành công` | `400 G601`; `404 G604`; fallback `G600`; database trigger performs soft delete; `destroy` |
| `DELETE /student` | JSON nonempty `idlist`; individual values passed through | `{ deleted, notFound }`; full or partial count message | `400 G603`; if none deleted `404 G604`; fallback `G600`. One transaction rolls back unexpected errors but commits partial missing-id result; `massDestroy` |
| `GET /student/deleted/page` | page query as active paging | `{ page_info, records }`; `Lấy danh sách sinh viên đã xóa thành công` | `400 C601/C602`; fallback `L600`; selects only soft-deleted rows; `getDeletedByPage` |
| `PATCH /student/deleted/restore` | JSON nonempty strictly positive `idlist` | `{ restored, notFound, conflicts }`; `Đã khôi phục N sinh viên` | `400 L603`; fallback `L600`. Deduplicates ids; one transaction, per-row savepoint turns uniqueness race into `conflicts`; `restoreDeleted` |
| `DELETE /student/deleted/permanent` | JSON nonempty strictly positive `idlist` | `{ deleted, notFound }`; `Đã xóa vĩnh viễn N sinh viên` | `400 L603`; fallback `L600`. Deletes only soft-deleted rows transactionally; after commit, deletes only unreferenced unique attachment URLs. Storage cleanup failure is logged and does not undo DB deletion; `permanentlyDelete` |
| `POST /student/copy/:id` | legacy id | copied record; `Sao chép sinh viên thành công` | `400 H601`; `404 H604`; fallback `H600`; `copyOne` |
| `POST /student/copy` | JSON nonempty `idlist`, values passed through | created-record array, full/partial count message | `400 H603`; all missing `404 H604`; fallback `H600`; transaction rolls back unexpected writes, but missing sources are partial success; `massCopy` |
| `POST /student/copy/preview` | JSON `idlist` | `{ drafts }`; `Đã tạo N draft sinh viên` | `H603/H604`; read-only batched preview; no password/internal fields; `getCopyPreview` |
| `POST /student/copy/validate` | JSON `drafts` | validation payload; `Đã kiểm tra các bản sao sinh viên` | expected `H*` errors; fallback `H600`; `validateCopyDrafts` |
| `POST /student/copy/commit` | multipart `drafts` JSON plus optional `attachment-<draftKey>` files; draft requires unique `draftKey`, positive `sourceId`, and normalized editable values | `{ created:[{draftKey,record}] }`; `Đã tạo N sinh viên` | malformed/duplicate/class errors map to `H603`; missing source `H604`; fallback `H600`. Uploads are compensated on any failure; DB transaction locks/rechecks source and unique code/email/username then commits all or rolls back; `commitCopyDrafts` |
| `GET /student/import/template` | optional query `type` | binary template `student-import-template.<ext>` | `400 J601`; fallback `J600`; `buildFile(createTemplateRow())` |
| `POST /student/import` | multipart `file` | preview `{ rows, lookups }`; `Import preview created without database writes` | `400 J601` unsupported; `400 J604` missing/unreadable/empty; fallback `J600`. Parses rows then calls `validateImportDrafts`; no student write |
| `POST /student/import/validate` | JSON `drafts` | `{ rows, lookups }`; `Import drafts validated` | unhandled fallback `J600`; validates normalized file values, duplicates, classes and active hobby names without writes |
| `POST /student/import/commit` | JSON `drafts` | `{ created, updated }`; `Student import committed` | invalid preview -> `400 J604` with invalid rows in `data`; `23505` -> `409 J604` `Duplicate student data`; fallback `J600`. Revalidates inside one transaction before any write; creates by code or updates active match; `commitImportDrafts` |
| `GET /student/export/:id` | `id` is `parseInt` without validator; query `type` | binary `student-<id>.<ext>` | invalid type `400 K601`; missing `404 K604`; fallback `K600`; `getOneById`, lookup conversion, `buildFile` |
| `POST /student/export` | JSON nonempty `idlist`, optional `type` | binary `students-export.<ext>` | `400 K601`; fallback `K600`; missing requested ids are omitted by `getManyByIds` |

## Binary format and legacy invariants

`csv` is `text/csv`; `xlsx` is `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; `json` is `application/json`; `xml` is `application/xml`. Student export/template uses ordered columns `code, fullname, dob, gender, class, email, username, password, homecity, address, hobbies, description, hair_color, facebook`; exported password is always empty.

Keep these quirks in the Nest migration: HTTP 200 for creates/deletes; legacy `parseInt` accepts prefixes such as `1x`; Class update silently ignores `code`; permissive list-id arrays are not per-item normalized on several legacy mass endpoints; Class mass delete and legacy mass copy/delete deliberately have partial-success semantics; and document/API strings above, including English messages on Student preview/commit imports, are observable behavior.
