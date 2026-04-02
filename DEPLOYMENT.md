# Moeving Sales Dashboard — Deployment Guide

## Architecture

```
[Vercel Frontend (React)]  ──HTTPS──▶  [Render Backend (FastAPI)]
                                              │
                                        [PostgreSQL DB]
                                     (Render managed or SQLite)
```

## Prerequisites

- GitHub account
- Render account (render.com) — free tier works
- Vercel account (vercel.com) — free tier works
- Your code pushed to a GitHub repository

---

## STEP 1 — Push to GitHub

```bash
cd D:\Viv\Claude\sales-dashboard
git init
git add .
git commit -m "Initial production build"
git remote add origin https://github.com/YOUR_USERNAME/moeving-sales-dashboard.git
git push -u origin main
```

---

## STEP 2 — Deploy Backend on Render

### 2a. Create a new Web Service

1. Go to [https://render.com](https://render.com) → **New +** → **Web Service**
2. Connect your GitHub repo
3. Set the following:

| Setting | Value |
|---------|-------|
| **Name** | `moeving-sales-api` |
| **Region** | Singapore (closest to India) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

### 2b. Set Environment Variables

In Render → **Environment** tab, add:

```
SECRET_KEY          = <run: python -c "import secrets; print(secrets.token_hex(32))">
ACCESS_TOKEN_EXPIRE_HOURS = 24
DATABASE_URL        = sqlite:///./moeving.db   (or use Render PostgreSQL — see 2c)
FRONTEND_URL        = https://your-app.vercel.app   (fill after Step 3)
MAX_FILE_MB         = 20
```

### 2c. (Optional) Add PostgreSQL for persistence across deploys

1. Render Dashboard → **New +** → **PostgreSQL** → Create
2. Copy the **Internal Database URL**
3. Set `DATABASE_URL` = that URL in your Web Service environment variables

> SQLite data is wiped on each Render deploy. Use PostgreSQL if you need data to persist.

### 2d. Deploy

Click **Create Web Service**. Wait ~3 minutes for the first build.

Your backend URL will be: `https://moeving-sales-api.onrender.com`

---

## STEP 3 — Deploy Frontend on Vercel

### 3a. Import project

1. Go to [https://vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Set **Root Directory** → `frontend`

### 3b. Set Environment Variables

In Vercel → **Settings** → **Environment Variables**:

```
VITE_API_URL = https://moeving-sales-api.onrender.com
```

### 3c. Deploy settings

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

Click **Deploy**.

Your app URL will be: `https://your-app.vercel.app`

---

## STEP 4 — Connect Frontend ↔ Backend

1. Copy your Vercel URL (e.g. `https://moeving-sales-dashboard.vercel.app`)
2. Go to Render → your Web Service → **Environment**
3. Update `FRONTEND_URL` = your Vercel URL
4. Click **Save Changes** — Render will redeploy automatically

---

## STEP 5 — Verify Everything Works

Open your Vercel URL and:

- [ ] Login page loads
- [ ] Create an account (Sign Up)
- [ ] Upload Deals + Projects CSVs
- [ ] Dashboard renders with all charts
- [ ] Sign out and sign back in — dashboard loads from saved data
- [ ] "Last Updated" timestamp shows in the header

---

## Local Development

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
cp .env.example .env           # edit SECRET_KEY
uvicorn main:app --reload
# API running at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
# For local dev, VITE_API_URL is not needed (Vite proxy handles it)
npm run dev
# App running at http://localhost:5173
```

---

## Environment Variables Reference

### Backend (`.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | Random hex string for JWT signing |
| `ACCESS_TOKEN_EXPIRE_HOURS` | No | Default: 24 |
| `DATABASE_URL` | No | Default: SQLite (`./moeving.db`) |
| `FRONTEND_URL` | Yes | Your Vercel URL for CORS |
| `MAX_FILE_MB` | No | Default: 20 |

### Frontend (`.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes (prod) | Your Render backend URL |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS error in browser | Set `FRONTEND_URL` on Render to your exact Vercel URL |
| 401 on every request | Check `SECRET_KEY` is set on Render |
| Charts show no data | Check browser console — likely CORS or API URL mismatch |
| Render sleeping (free tier) | First request after inactivity takes ~30s to wake up |
| Login works but upload fails | Check `MAX_FILE_MB` and file is valid CSV |
