# API contract baseline (Task 0)

Snapshot taken from the current `develop` implementation before the backend controller refactor.  Routes have **no `/api` or version prefix**.  Unless noted otherwise, successful controller responses use HTTP 200 and this envelope:

```json
{ "code": "200", "status": 200, "message": "<Vietnamese message>", "data": "<payload>" }
```

All JSON errors use `{ "code": "<module code>", "status": <HTTP status>, "message": "<Vietnamese message>", "data": null }`. Unhandled controller/service errors call `next(err)` after setting the documented fallback code; `errorHandler` returns HTTP 500 with that fallback code and message `Lỗi hệ thống không xác định`. Errors that already carry `httpStatus` and `errorCode` retain those values.

## Application-level routes and middleware

| Method | Route | Inputs | Success response | Errors / behavior | Called service |
|---|---|---|---|---|---|
| GET | `/` | none | HTTP 200, raw `{ status: "ok", message: "Quản lý Sinh viên API đang hoạt động" }` (not the envelope) | Express/default errors only | none |

`express.json()` parses JSON globally and CORS is enabled. Student image create/update routes run multer memory storage for field `attachment`: only jpg/jpeg/png, max 5 MB; rejected files return `400 E603` (`Ảnh phải là jpg/jpeg/png, tối đa 5MB`). Import runs memory storage field `file`, max 10 MB (other multer errors pass to the global handler).

## Class (`/class`)

| Method | Route | Inputs | Success `data` / message | Error status/code | Controller service method |
|---|---|---|---|---|---|
| GET | `/class` | query: `columnlist` | array of classes; `Lấy danh sách lớp thành công` | unhandled → `B600` | `classService.getAll(columnlist)` |
| GET | `/class/page` and `/class/page/:init` | query: required `page`, `size`; optional `order`, `search`, `columnlist`, `toplist` (comma-separated integers) | `{ page_info, records }`; `Lấy danh sách lớp theo trang thành công` | `400 C601` invalid page; `400 C602` invalid size; unhandled → `C600`. `:init` is not read by controller. | `getByPage({ page: parseInt(page), size: parseInt(size), order, search, columnlist, toplist: valid parsed ints })` |
| POST | `/class` | JSON body: required `code`, `name`; optional `description` | service result (normally `{ id }`); `Tạo lớp thành công` | `400 E603` missing required / `code` >50 / `name` >255; `409 E603` duplicate code; unhandled → `E600` | `store({ code, name, description })` |
| PUT | `/class/:id` | path `id`; JSON body: optional `code`, `name`, `description` | service result; `Cập nhật lớp thành công` | `400 F601` invalid id; `400 F603` too-long code/name or blank supplied name; `404 F604` absent result; `409 F603` duplicate code; unhandled → `F600` | `update(parseInt(id), { code, name, description })` |
| DELETE | `/class/delete` | JSON body: nonempty `ids` array | `{ ids: deletedIds }`; all deleted: `Xóa các lớp thành công`; partial blocked: `Đã xóa N lớp. Không thể xóa M lớp vì còn sinh viên liên kết (ids: …)` | `400 I604` invalid `ids`; unhandled → `I600` | `massDelete(ids)` |
| DELETE | `/class/:id` | path `id` | service result; `Xóa lớp thành công` | `400 G601` invalid id; `404 G604` `existsById` false; `409 G605` FK `23503`; unhandled → `G600` | `existsById(id)`, then `destroy(id)` |
| POST | `/class/copy/:id` | path `id` | copied class; `Sao chép lớp thành công` | `400 H601` invalid id; `404 H604` null result; unhandled → `H600` | `copyOne(id)` |
| POST | `/class/copy` | JSON body: nonempty `idlist` array | `created` array; all found: `Sao chép N lớp thành công`; partial: `Đã sao chép N lớp. Không tìm thấy ids: …` | `400 H603` invalid list; `404 H604` when all are missing; unhandled → `H600` | `massCopy(idlist)` |

## Hobby (`/hobby`)

| Method | Route | Inputs | Success `data` / message | Error status/code | Controller service method |
|---|---|---|---|---|---|
| GET | `/hobby` | none | active hobby array; `Lấy danh sách sở thích thành công` | unhandled → `B600` | `hobbyService.getAll()` |
| POST | `/hobby` | JSON body: required `name` (trimmed, nonempty, max 30) | created hobby; `Tạo sở thích thành công` | `400 E603` invalid name; `422 E604` exhausted hobby bits; `409 E603` unique violation (message varies by constraint); unhandled → `E600` | `store(name.trim())` |
| DELETE | `/hobby/:id` | path `id` | `{ id }` normally; `Xóa sở thích thành công` | `400 G601` invalid id; `404 G604` hobby missing; `409 G605` used by a non-deleted student; unhandled → `G600` | `findById(id)`, `isUsedByStudent(hobby.bit_value)`, then `destroy(id)` |

## Student (`/student`)

Student bodies are JSON when invoked directly, or `multipart/form-data` on create/update. Multipart conversion is part of the existing contract: `sex` strings `true`/`false` become booleans (other strings become `null`); `class_id` `''`, `'-1'`, or invalid becomes `null`; `hobbies` empty/invalid becomes `0`.

| Method | Route | Inputs | Success `data` / message | Error status/code | Controller service method |
|---|---|---|---|---|---|
| GET | `/student` | query: `columnlist` | active (not soft-deleted) student array; `Lấy danh sách sinh viên thành công` | unhandled → `B600` | `studentService.getAll(columnlist)` |
| GET | `/student/page` and `/student/page/:init` | query: required `page`, `size`; optional `order`, `search`, `columnlist`, `toplist` comma-list | `{ page_info, records }`; `Lấy danh sách sinh viên theo trang thành công` | `400 C601` invalid page; `400 C602` invalid size; unhandled → `C600`. `:init` is ignored. | `getByPage({ page, size, order, search, columnlist, toplist })` after integer parsing |
| GET | `/student/export/:id` | path `id`; query `type` (`csv`, `xlsx`, `json`, `xml`; default `xlsx`) | binary body from `buildFile([student], type)`, headers `Content-Type` and `attachment; filename="student-{id}.{extension}"` | `400 K601` invalid type; `404 K604` service returned null; unhandled → `K600`. No controller validation of `id` before service call. | `getOneById(parseInt(id))` |
| GET | `/student/:id` | path `id` | student record; `Lấy chi tiết sinh viên thành công` | `400 D601` invalid id; `404 D604` null result; unhandled → `D600` | `getOneById(parseInt(id))` |
| POST | `/student` | multipart/JSON: required `code`, `fullname`, `email`, `username`, `password`; optional `dob`, `sex`, `homecity`, `address`, `hair_color`, `facebook`, `class_id`, `description`, `hobbies`; optional image `attachment` | created student; `Tạo sinh viên thành công` | `400 E603` validation or invalid `class_id`; `409 E603` unique violation; unhandled → `E600` (uploaded attachment is cleaned up on failure) | `getActiveHobbyMask()`, optional `uploadAttachment(file, code)`, `store({ ...parsedBody, attachment })` |
| PUT | `/student/:id` | path `id`; same optional multipart/JSON fields; optional image `attachment` | updated student; `Cập nhật sinh viên thành công` | `400 F601` invalid id; `400 F603` validation or invalid `class_id`; `404 F604` null result; `409 F603` unique violation; unhandled → `F600` (new attachment cleaned on DB failure; old attachment removed after success) | `getActiveHobbyMask()`, optional `getAttachmentById(id)`, `uploadAttachment(file, "id{id}")`, `update(id, body)` |
| DELETE | `/student` | JSON body: nonempty `idlist` array | `{ deleted, notFound }`; full: `Xóa N sinh viên thành công`; partial: `Đã xóa N sinh viên. Không tìm thấy ids: …` | `400 G603` invalid list; `404 G604` when none deleted and missing; unhandled → `G600` | `massDestroy(idlist)` |
| DELETE | `/student/:id` | path `id` | service result (normally `{ id }`); `Xóa sinh viên thành công` | `400 G601` invalid id; `404 G604` null result; unhandled → `G600` | `destroy(parseInt(id))` |
| POST | `/student/copy/:id` | path `id` | copied student; `Sao chép sinh viên thành công` | `400 H601` invalid id; `404 H604` null result; unhandled → `H600` | `copyOne(parseInt(id))` |
| POST | `/student/copy` | JSON body: nonempty `idlist` array | `created` array; full: `Sao chép N sinh viên thành công`; partial: `Đã sao chép N sinh viên. Không tìm thấy ids: …` | `400 H603` invalid list; `404 H604` when all missing; unhandled → `H600` | `massCopy(idlist)` |
| POST | `/student/import` | multipart field `file`; extension must be csv/xlsx/json/xml; each parsed row follows create validation | `{ created, failed }`; `Import thành công N dòng, lỗi M dòng` | `400 J604` missing/unreadable/empty file; `400 J601` unsupported extension; unhandled → `J600` | `getActiveHobbyMask()` once, then `store(normalizedRow)` for each valid row. File parsing uses `parseFile`. |
| POST | `/student/export` | JSON body: nonempty `idlist`; optional `type` (`csv`, `xlsx`, `json`, `xml`; default `xlsx`) | binary `buildFile(students, type)`, headers `Content-Type` and `attachment; filename="students-export.{extension}"` | `400 K601` invalid list or type; unhandled → `K600` | `getManyByIds(idlist)` |

### Student validation currently enforced by controller

- Create requires nonblank `code`, `fullname`, `email`, `username`, and `password`.
- `code`/`username` max 50; `fullname` max 30 and nonblank; `homecity`/`address` max 100; `hair_color` max 7; email/facebook max 256 with the controller's current regexes.
- Password must be at least 8 characters and include uppercase, lowercase, digit, and non-alphanumeric character.
- `hobbies` must be a nonnegative integer and a subset of the active hobby bitmask. Update performs the same checks only for supplied fields.

## Deliberately retained quirks

- All successful non-export controller operations use HTTP 200; creates and deletes do not use 201/204.
- `parseInt` is used without strict numeric-string validation, so values such as `"1x"` are accepted as `1` where a numeric path/query value is parsed.
- Class mass-delete reports partially blocked rows as a successful 200 and returns only deleted ids (not `blockedIds`) in `data`.
- The service response is forwarded as-is. No controller response schema is imposed beyond the common envelope.
