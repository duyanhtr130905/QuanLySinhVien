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
