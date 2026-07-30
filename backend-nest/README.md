# Backend NestJS (parallel migration)

`backend-nest` is the NestJS application that will run alongside the existing Express backend during the migration. Phase 1 contains only the legacy-compatible health route; Student, Class, Hobby, database, and storage integration remain in `backend/`.

## Requirements

- Node.js 20 or later
- npm

## Setup

```bash
cd backend-nest
npm ci
```

Copy `.env.example` to `.env` only when an override is needed. The default port is `3002`.

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
npm test
npm run test:e2e
npm run build
```

The Express backend remains independent in `../backend`; its server and dependencies are not used by this application.

## Dual-target HTTP contract tests

The contract suite performs black-box HTTP checks against the running Express and NestJS applications. It verifies each selected target against the Phase 0 canonical contract; it does not import either application's internal modules or compare one backend's response to the other.

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

`CONTRACT_TARGET` accepts `legacy`, `nest`, or `both` (the default). Only the base URL for selected targets is required. The runner trims trailing slashes and fails with the target name, URL, and connection/timeout detail when a target is unavailable. See `.env.contract.example` for the variables; they are deliberately separate from runtime `.env` configuration.

To run one target, keep its URL and set the target explicitly:

```powershell
$env:CONTRACT_TARGET="legacy"
npm run test:contract

$env:CONTRACT_TARGET="nest"
npm run test:contract
```
