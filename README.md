# Quan Ly Sinh Vien

## Local Development

The backend API and React frontend use different local ports:

- Backend API: `http://localhost:3000`
- React frontend: `http://localhost:3001`

Do not open `http://localhost:3000` to access the user interface. That port belongs to the backend API; open `http://localhost:3001` for the React application.

### Backend

```powershell
cd backend
npm install
npm run dev
```

The backend listens on `http://localhost:3000`.

### Frontend

```powershell
cd frontend/reactjs-template
Copy-Item .env.example .env
npm ci --legacy-peer-deps
npm start
```

Open `http://localhost:3001` after the development server finishes compiling.

The `.env` file is local-only configuration and must not be committed. Copy `.env.example` only on a machine that does not already have a `.env` file, so existing local configuration is preserved.

The frontend currently requires `npm ci --legacy-peer-deps` because the project uses a React 17-era dependency tree and template.
