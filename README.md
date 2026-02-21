# Quant Alpha Engine — Deployment Guide

Multi-factor S&P 500 signal screener. Momentum · Value · Quality · Growth.
Refreshes daily at 6 AM ET, served from your custom domain.

---

## Project Structure

```
quant-screener/
├── src/
│   ├── main.jsx              ← React entry point
│   └── App.jsx               ← Full screener UI
├── api/
│   └── refresh-data.js       ← Vercel serverless function (daily cron)
├── scripts/
│   └── fetch_factors.py      ← Python data fetcher (GitHub Actions)
├── public/
│   └── data/
│       └── stocks.json       ← Generated daily — DO NOT edit manually
├── .github/
│   └── workflows/
│       └── daily-refresh.yml ← GitHub Actions schedule
├── index.html
├── vite.config.js
├── vercel.json               ← Cron schedule + function config
└── package.json
```

---

## Step 1 — Run Locally First

```bash
# Install Node dependencies
npm install

# Install Python dependencies (for data fetching)
pip install yfinance pandas numpy

# Generate initial data
python scripts/fetch_factors.py

# Start dev server
npm run dev
# → Open http://localhost:5173
```

---

## Step 2 — Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/quant-screener.git
git branch -M main
git push -u origin main
```

---

## Step 3 — Deploy to Vercel

1. Go to **vercel.com** → Sign up / Log in with GitHub
2. Click **"Add New Project"** → Import your `quant-screener` repo
3. Vercel auto-detects Vite. Leave all settings as default.
4. Click **Deploy** — your site is live in ~60 seconds.

Vercel reads `vercel.json` and automatically schedules the daily cron:
```
"schedule": "0 6 * * 1-5"   ← 6 AM ET, Monday–Friday
```

> **Note:** Cron jobs require Vercel's **Hobby plan (free)** or higher.
> The function runs, fetches Yahoo Finance, writes `stocks.json`, and
> Vercel serves the updated file to your React app automatically.

---

## Step 4 — Connect Your Custom Domain

1. In Vercel dashboard → your project → **Settings → Domains**
2. Type your domain (e.g. `quantalpha.com`) → **Add**
3. Vercel shows you DNS records to add. Go to your domain registrar:

| Record type | Name | Value                        |
|-------------|------|------------------------------|
| A           | @    | `76.76.21.21`               |
| CNAME       | www  | `cname.vercel-dns.com`      |

4. Save. DNS propagates in 10–30 minutes.
5. Vercel automatically provisions a free **SSL certificate** (HTTPS). ✓

---

## Step 5 — (Optional) Secure the Cron Endpoint

To prevent anyone from manually triggering your data refresh:

1. In Vercel dashboard → your project → **Settings → Environment Variables**
2. Add: `CRON_SECRET` = `some-long-random-string-here`
3. Vercel automatically sends this as a header when it triggers the cron.
   The function checks it and rejects unauthorized calls.

---

## How the Daily Refresh Works

```
6:00 AM ET (weekdays)
    │
    ▼
Vercel cron triggers GET /api/refresh-data
    │
    ▼
Function loops through 60 tickers
Fetches from Yahoo Finance (price history + fundamentals)
    │
    ▼
Computes factor scores (momentum, value, quality, growth)
    │
    ▼
Writes public/data/stocks.json
    │
    ▼
React app fetches /data/stocks.json on next page load
Displays live ranked buy/sell lists
```

---

## Expanding the Universe

To add more tickers, edit **two places** in `src/App.jsx` and `api/refresh-data.js`:

```js
const UNIVERSE = [
  // Add your tickers here
  "SPY", "QQQ", "YOUR_TICKER",
  ...
];

const SECTOR_MAP = {
  YOUR_TICKER: "Tech",   // assign a sector
};
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `stocks.json` not found | Run `python scripts/fetch_factors.py` locally first, commit the file |
| Cron not running | Check Vercel dashboard → your project → **Logs → Cron** |
| Yahoo Finance errors | Some tickers intermittently fail; the app falls back to simulated data |
| Domain not resolving | DNS can take up to 48h; check with `dig yourdomain.com` |

---

## Tech Stack

- **React 18** + **Vite 5** — frontend
- **Vercel** — hosting + cron scheduling
- **Yahoo Finance** (unofficial API) — market data, no key required
- **yfinance** Python library — data fetching script
- **GitHub Actions** — alternative to Vercel cron (both included)
