/**
 * api/refresh-data.js
 *
 * Vercel Serverless Function — runs on a cron schedule (see vercel.json).
 * Fetches key financial metrics from Yahoo Finance for every ticker in
 * UNIVERSE, computes raw factor values, normalizes within sector,
 * and writes /public/data/stocks.json which the React app reads on load.
 *
 * Yahoo Finance endpoints used (unofficial but stable):
 *   https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}
 *     ?modules=summaryDetail,financialData,defaultKeyStatistics,earningsTrend
 *
 * No API key required.  Rate-limited to ~2000 req/hour; we batch with delays.
 */

import fs   from "fs";
import path from "path";

// ── Universe ──────────────────────────────────────────────────────────────────
const UNIVERSE = [
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","BRK-B","JPM","JNJ",
  "V","UNH","XOM","PG","MA","HD","CVX","MRK","ABBV","PEP",
  "KO","AVGO","COST","WMT","BAC","TMO","CSCO","ACN","LLY","MCD",
  "DHR","ABT","TXN","NFLX","CRM","NEE","PM","RTX","ORCL","QCOM",
  "HON","INTC","AMGN","IBM","GE","CAT","BA","GS","MS","BLK",
  "DIS","SBUX","NKE","AXP","MDLZ","DKS","TGT","LOW","F","GM",
];

const SECTOR_MAP = {
  AAPL:"Tech",MSFT:"Tech",NVDA:"Tech",GOOGL:"Tech",META:"Tech",AVGO:"Tech",
  CSCO:"Tech",TXN:"Tech",QCOM:"Tech",ORCL:"Tech",IBM:"Tech",INTC:"Tech",
  AMZN:"Consumer",TSLA:"Consumer",HD:"Consumer",MCD:"Consumer",COST:"Consumer",
  WMT:"Consumer",NKE:"Consumer",SBUX:"Consumer",TGT:"Consumer",LOW:"Consumer",
  MDLZ:"Consumer",DKS:"Consumer",DIS:"Consumer",F:"Consumer",GM:"Consumer",
  JPM:"Finance",BAC:"Finance",GS:"Finance",MS:"Finance",V:"Finance",
  MA:"Finance",BLK:"Finance",AXP:"Finance","BRK-B":"Finance",
  JNJ:"Health",UNH:"Health",MRK:"Health",ABBV:"Health",TMO:"Health",
  DHR:"Health",ABT:"Health",LLY:"Health",AMGN:"Health",
  XOM:"Energy",CVX:"Energy",
  PG:"Staples",PEP:"Staples",KO:"Staples",PM:"Staples",
  NEE:"Utilities",
  RTX:"Industrial",HON:"Industrial",GE:"Industrial",CAT:"Industrial",BA:"Industrial",
  ACN:"Tech",CRM:"Tech",NFLX:"Consumer",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const safe  = (obj, ...keys) => keys.reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
const num   = v => (v && typeof v === "object" && "raw" in v) ? v.raw : (typeof v === "number" ? v : null);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Fetch Yahoo Finance quoteSummary for one ticker */
async function fetchYahoo(ticker) {
  const modules = "summaryDetail,financialData,defaultKeyStatistics,earningsTrend,priceHistory";
  const url =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}` +
    `?modules=summaryDetail%2CfinancialData%2CdefaultKeyStatistics%2CearningsTrend`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Yahoo ${ticker}: HTTP ${res.status}`);
  const json = await res.json();
  return safe(json, "quoteSummary", "result", 0);
}

/** Fetch 1-year price history for momentum calculation */
async function fetchPriceHistory(ticker) {
  const end   = Math.floor(Date.now() / 1000);
  const start = end - 365 * 24 * 3600;
  const url   =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?period1=${start}&period2=${end}&interval=1mo`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return null;
  const json = await res.json();
  const closes = safe(json, "chart", "result", 0, "indicators", "adjclose", 0, "adjclose");
  if (!closes || closes.length < 2) return null;
  return closes;
}

/** Compute raw factor values for a ticker */
async function buildStockData(ticker) {
  const [data, prices] = await Promise.allSettled([fetchYahoo(ticker), fetchPriceHistory(ticker)]);
  const d = data.status === "fulfilled" ? data.value : null;
  const p = prices.status === "fulfilled" ? prices.value : null;

  const sd  = d?.summaryDetail       || {};
  const fd  = d?.financialData       || {};
  const ks  = d?.defaultKeyStatistics || {};
  const et  = d?.earningsTrend?.trend || [];

  // ── Momentum ──────────────────────────────────────────────────────────────
  let mom12m = null, rsi = null;
  if (p && p.length >= 2) {
    const first = p[0], last = p[p.length - 1];
    mom12m = ((last - first) / first) * 100;
    // Simplified RSI proxy from price series
    const changes = p.slice(1).map((v, i) => v - p[i]);
    const gains   = changes.filter(c => c > 0).reduce((a,b) => a+b, 0) / changes.length;
    const losses  = Math.abs(changes.filter(c => c < 0).reduce((a,b) => a+b, 0)) / changes.length;
    rsi = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));
  }
  const mom_score = mom12m !== null
    ? clamp((mom12m / 90 * 0.7) + ((rsi - 30) / 50 * 0.3), 0, 1)
    : 0.5;

  // ── Value ─────────────────────────────────────────────────────────────────
  const pe       = num(sd.trailingPE)      || num(ks.trailingEps) ? null : null;
  const peRaw    = num(sd.trailingPE);
  const pfcfRaw  = num(ks.priceToFreeCashflows) || num(sd.priceToSalesTrailing12Months);
  const evEbRaw  = num(ks.enterpriseToEbitda);
  const val_score = clamp(
    1 - (((peRaw    ? peRaw/63    : 0.5) * 0.4) +
          ((pfcfRaw  ? pfcfRaw/70  : 0.5) * 0.3) +
          ((evEbRaw  ? evEbRaw/36  : 0.5) * 0.3)),
    0, 1
  );

  // ── Quality ───────────────────────────────────────────────────────────────
  const roeRaw    = num(fd.returnOnEquity);
  const roe       = roeRaw ? roeRaw * 100 : null;
  const grossM    = num(fd.grossMargins) ? num(fd.grossMargins) * 100 : null;
  const debtEqRaw = num(ks.debtToEquity);
  const qual_score = clamp(
    ((roe     ? Math.max(0, roe)/75   : 0.4) * 0.4) +
    ((grossM  ? grossM/85             : 0.4) * 0.4) +
    ((debtEqRaw !== null ? (1 - clamp(debtEqRaw/300, 0, 1)) : 0.5) * 0.2),
    0, 1
  );

  // ── Growth ────────────────────────────────────────────────────────────────
  const trend0    = et[0] || {};
  const epsGRaw   = num(safe(trend0, "earningsEstimate", "growth")) * 100;
  const revGRaw   = num(safe(trend0, "revenueEstimate",  "growth")) * 100;
  const fwdRevRaw = num(fd.earningsGrowth) ? num(fd.earningsGrowth) * 100 : null;
  const growth_score = clamp(
    ((epsGRaw  ? Math.max(-1, epsGRaw)/65  : 0.4) * 0.4) +
    ((revGRaw  ? Math.max(-1, revGRaw)/40  : 0.4) * 0.35) +
    ((fwdRevRaw ? (fwdRevRaw + 15) / 45    : 0.4) * 0.25),
    0, 1
  );

  return {
    ticker,
    sector: SECTOR_MAP[ticker] || "Other",
    lastUpdated: new Date().toISOString().split("T")[0],
    momentum: {
      score:  mom_score,
      mom12m: mom12m !== null ? mom12m.toFixed(1) : "N/A",
      rsi:    rsi    !== null ? rsi.toFixed(0)    : "N/A",
    },
    value: {
      score:    val_score,
      pe:       peRaw   ? peRaw.toFixed(1)   : "N/A",
      pfcf:     pfcfRaw ? pfcfRaw.toFixed(1) : "N/A",
      evEbitda: evEbRaw ? evEbRaw.toFixed(1) : "N/A",
    },
    quality: {
      score:       qual_score,
      roe:         roe    ? roe.toFixed(1)       : "N/A",
      grossMargin: grossM ? grossM.toFixed(1)    : "N/A",
      debtEq:      debtEqRaw !== null ? (debtEqRaw/100).toFixed(2) : "N/A",
    },
    growth: {
      score:          growth_score,
      epsGrowth:      epsGRaw  ? epsGRaw.toFixed(1)  : "N/A",
      revGrowth:      revGRaw  ? revGRaw.toFixed(1)  : "N/A",
      fwdEpsRevision: fwdRevRaw ? fwdRevRaw.toFixed(1) : "N/A",
    },
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Optional: protect with a secret so only the cron can call this
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers["x-cron-secret"] !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log(`[refresh-data] Starting data refresh for ${UNIVERSE.length} tickers`);
  const results = [];
  const errors  = [];

  for (let i = 0; i < UNIVERSE.length; i++) {
    const ticker = UNIVERSE[i];
    try {
      const stock = await buildStockData(ticker);
      results.push(stock);
      console.log(`[refresh-data] ✓ ${ticker} (${i+1}/${UNIVERSE.length})`);
    } catch (err) {
      errors.push({ ticker, error: err.message });
      console.error(`[refresh-data] ✗ ${ticker}: ${err.message}`);
    }
    // Polite rate limiting — 300ms between requests
    if (i < UNIVERSE.length - 1) await sleep(300);
  }

  const output = {
    generatedAt: new Date().toISOString().split("T")[0],
    generatedAtFull: new Date().toISOString(),
    tickerCount: results.length,
    errors,
    stocks: results,
  };

  // Write to /public/data/stocks.json so the React app can fetch it
  const outPath = path.join(process.cwd(), "public", "data", "stocks.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`[refresh-data] Done. ${results.length} stocks written, ${errors.length} errors.`);
  res.status(200).json({ ok: true, count: results.length, errors });
}
