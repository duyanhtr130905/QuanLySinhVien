# Backend NestJS (parallel migration)

`backend-nest` is the NestJS application running alongside the existing Express backend during the
migration. The legacy Express backend (`backend/`) remains unchanged on port 3000.

## Current migration state

All 47 API routes are migrated and active:

| Module | Routes | Contract suite |
|---|---|---|
| Health | `GET /` | global |
| Hobby | list, create, delete | hobby |
| Class — core | page (2), list, get, create, update, delete | class-core |
| Class — advanced | membership (4), copy (5), import, export (2) | class-advanced |
| Student — read | page (2), list, get | student-read |
| Student — write | create, update, delete, soft-delete, restore, permanent-delete | student-write |
| Student — copy | preview, validate, commit, copy-by-id, bulk-copy | student-copy |
| Student — file | import template, import (3), export (2) | student-file |

Database and Storage infrastructure: PostgreSQL via `pg` pool; Supabase Storage adapter injected
for Student images. Production cutover has **not** occurred; `backend/` remains the production
default.

## Local port topology

| Service | Port |
|---|---|
| Legacy Express (`backend/`) | 3000 |
| React dev server (`frontend/`) | 3001 |
| **NestJS (`backend-nest/`) — this app** | **3002** |

## Requirements

- Node.js 20 or later
- npm
- PostgreSQL database accessible via `DATABASE_URL`
- Supabase credentials when exercising image storage flows

## Setup

```bash
cd backend-nest
npm ci
```

Copy `.env.example` to `.env` only when a local override is needed. The default port is `3002`.

## Run

```bash
npm run start:dev
```

The health endpoint is `GET http://localhost:3002/` and returns the unchanged legacy payload:

```json
{
  "status": "ok",
  "message": "Quản lý Sinh viên API đang hoạt động"
}
```

## Verify

```bash
npm test          # unit tests
npm run test:e2e  # e2e tests (requires DATABASE_URL)
npm run build     # TypeScript compilation
```

The Express backend remains independent in `../backend`; its server and dependencies are not used
by this application.

## Dual-target HTTP contract tests

The contract suite performs black-box HTTP checks against the running Express and NestJS
applications. It verifies each selected target against the Phase 0 canonical contract; it does not
import either application's internal modules or compare one backend's response to the other.

Start the applications in separate terminals:

```bash
cd backend
npm start
```

```bash
cd backend-nest
npm run start:dev
```

Then run the shared suite from PowerShell:

```powershell
cd backend-nest
$env:LEGACY_BASE_URL="http://127.0.0.1:3000"
$env:NEST_BASE_URL="http://127.0.0.1:3002"
$env:CONTRACT_TARGET="both"
npm run test:contract
```

`CONTRACT_TARGET` accepts `legacy`, `nest`, or `both` (the default). Only the base URL for
selected targets is required. The runner trims trailing slashes and fails with the target name,
URL, and connection/timeout detail when a target is unavailable.
See `.env.contract.example` for the variables; they are deliberately separate from runtime `.env`
configuration.

To run one target, keep its URL and set the target explicitly:

```powershell
$env:CONTRACT_TARGET="legacy"
npm run test:contract

$env:CONTRACT_TARGET="nest"
npm run test:contract
```

## Known risks

- `xlsx` carries one accepted high advisory; no new dependency was added in Phase 8A.
- CORS is enabled permissively (`app.enableCors()` with no origin restriction); must be restricted
  before any production cutover.
- Frontend React 17 toolchain has pre-existing dependency advisories; separately scoped upgrade
  required.
