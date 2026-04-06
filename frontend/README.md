# DharmaReels AI — frontend (Phase 4)

Vite + React + Tailwind. Calls the backend REST API (`POST/GET /videos`, download).

## Setup

```bash
cd frontend
npm install
copy .env.example .env
```

Set `VITE_API_BASE_URL` to your API origin (default `http://localhost:3001`).

## Dev

```bash
npm run dev
```

Open the printed URL (usually `http://localhost:5173`). Start the backend separately.

## Production build

```bash
npm run build
npm run preview
```

Serve `dist/` behind your web server; ensure `VITE_API_BASE_URL` points at the public API URL and CORS allows your origin.
