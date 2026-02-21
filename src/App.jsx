import { useState, useEffect } from "react";

const FACTORS = {
  momentum: { label: "Momentum", color: "#00ff9d" },
  value:    { label: "Value",    color: "#ff6b35" },
  quality:  { label: "Quality",  color: "#4fc3f7" },
  growth:   { label: "Growth",   color: "#ce93d8" },
};

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

const UNIVERSE = [
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","BRK-B","JPM","JNJ",
  "V","UNH","XOM","PG","MA","HD","CVX","MRK","ABBV","PEP",
  "KO","AVGO","COST","WMT","BAC","TMO","CSCO","ACN","LLY","MCD",
  "DHR","ABT","TXN","NFLX","CRM","NEE","PM","RTX","ORCL","QCOM",
  "HON","INTC","AMGN","IBM","GE","CAT","BA","GS","MS","BLK",
  "DIS","SBUX","NKE","AXP","MDLZ","DKS","TGT","LOW","F","GM"
];

// Fallback: deterministic simulated data (used when API data unavailable)
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return (Math.sin(h + 1) * 10000) % 1;
}
function abs(v) { return v < 0 ? -v : v; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function simulateStock(ticker) {
  const r = offset => abs(seededRandom(ticker + String(offset)));
  const mom12m   = r(1) * 120 - 30;
  const rsi      = 30 + r(2) * 50;
  const pe       = 8  + r(3) * 55;
  const pfcf     = 10 + r(4) * 60;
  const evEbitda = 6  + r(5) * 30;
  const roe      = -5 + r(6) * 80;
  const grossM   = 10 + r(7) * 75;
  const debtEq   = r(8) * 3;
  const epsG     = -15 + r(9)  * 80;
  const revG     = -5  + r(10) * 45;
  const fwdRev   = -15 + r(11) * 30;

  return {
    ticker,
    sector: SECTOR_MAP[ticker] || "Other",
    lastUpdated: new Date().toISOString().split("T")[0],
    momentum: {
      score: clamp((mom12m / 90 * 0.7) + ((rsi - 30) / 50 * 0.3), 0, 1),
      mom12m: mom12m.toFixed(1), rsi: rsi.toFixed(0),
    },
    value: {
      score: clamp(1 - ((pe/63*0.4) + (pfcf/70*0.3) + (evEbitda/36*0.3)), 0, 1),
      pe: pe.toFixed(1), pfcf: pfcf.toFixed(1), evEbitda: evEbitda.toFixed(1),
    },
    quality: {
      score: clamp((Math.max(0,roe)/75*0.4) + (grossM/85*0.4) + ((1-debtEq/3)*0.2), 0, 1),
      roe: roe.toFixed(1), grossMargin: grossM.toFixed(1), debtEq: debtEq.toFixed(2),
    },
    growth: {
      score: clamp((Math.max(-1,epsG)/65*0.4) + (Math.max(-1,revG)/40*0.35) + ((fwdRev+15)/45*0.25), 0, 1),
      epsGrowth: epsG.toFixed(1), revGrowth: revG.toFixed(1), fwdEpsRevision: fwdRev.toFixed(1),
    },
  };
}

function composite(stock, weights) {
  return stock.momentum.score * weights.momentum
    + stock.value.score    * weights.value
    + stock.quality.score  * weights.quality
    + stock.growth.score   * weights.growth;
}

// ── UI primitives ─────────────────────────────────────────────────────────────

const ScoreBar = ({ score, color }) => (
  <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
    <div style={{ flex:1, height:"4px", background:"#1a1a2e", borderRadius:"2px", overflow:"hidden" }}>
      <div style={{ width:`${score*100}%`, height:"100%", background:color, borderRadius:"2px", transition:"width 0.5s ease" }} />
    </div>
    <span style={{ fontSize:"10px", color:"#888", minWidth:"26px", textAlign:"right" }}>
      {(score*100).toFixed(0)}
    </span>
  </div>
);

const Badge = ({ label, color }) => (
  <span style={{
    fontSize:"9px", fontWeight:"700", padding:"2px 6px", borderRadius:"3px",
    background:`${color}22`, color, border:`1px solid ${color}44`,
    letterSpacing:"0.5px", textTransform:"uppercase",
  }}>{label}</span>
);

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [stocks, setStocks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState("live");  // "live" | "simulated"
  const [lastUpdated, setLastUpdated] = useState("");
  const [weights, setWeights] = useState({ momentum:0.25, value:0.25, quality:0.25, growth:0.25 });
  const [tab, setTab]         = useState("buys");
  const [selected, setSelected] = useState(null);
  const [status, setStatus]   = useState("Fetching market data...");

  // ── Data fetch: try live API first, fall back to simulation ─────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setStatus("Connecting to data feed...");
        // Vercel serverless function writes to /data/stocks.json daily
        const res = await fetch("/data/stocks.json");
        if (!res.ok) throw new Error("No live data");
        const json = await res.json();
        setStatus("Parsing factor scores...");
        await new Promise(r => setTimeout(r, 400));
        setStocks(json.stocks);
        setLastUpdated(json.generatedAt || "");
        setDataSource("live");
      } catch {
        // Fall back to client-side simulation
        setStatus("Live data unavailable — using simulated factors...");
        await new Promise(r => setTimeout(r, 600));
        setStocks(UNIVERSE.map(simulateStock));
        setDataSource("simulated");
        setLastUpdated(new Date().toISOString().split("T")[0]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const ranked = [...stocks]
    .map(s => ({ ...s, composite: composite(s, weights) }))
    .sort((a, b) => b.composite - a.composite);

  const buys  = ranked.slice(0, 20);
  const sells = ranked.slice(-20).reverse();
  const rows  = tab === "buys" ? buys : sells;

  const updateWeight = (factor, val) => {
    const next = { ...weights, [factor]: val / 100 };
    const total = Object.values(next).reduce((a,b) => a+b, 0);
    setWeights(Object.fromEntries(Object.entries(next).map(([k,v]) => [k, v/total])));
  };

  const accent = tab === "buys" ? "#00ff9d" : "#ff4444";

  return (
    <div style={{ fontFamily:"'Courier New', monospace", background:"#080810", minHeight:"100vh", color:"#e0e0e0" }}>

      {/* ── Header ── */}
      <div style={{ background:"linear-gradient(135deg,#0d0d1a,#111128)", borderBottom:"1px solid #1e1e3a", padding:"20px 28px 16px" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:"12px", marginBottom:"4px" }}>
          <span style={{ fontSize:"11px", letterSpacing:"4px", color:"#00ff9d", fontWeight:"700" }}>▸ QUANT ALPHA ENGINE</span>
          <span style={{ fontSize:"10px", color:"#444", letterSpacing:"2px" }}>S&P 500 · MULTI-FACTOR</span>
          {!loading && (
            <span style={{
              marginLeft:"auto", fontSize:"9px", padding:"2px 8px", borderRadius:"3px",
              background: dataSource === "live" ? "#00ff9d22" : "#ff6b3522",
              color:      dataSource === "live" ? "#00ff9d"   : "#ff6b35",
              border:`1px solid ${dataSource === "live" ? "#00ff9d44" : "#ff6b3544"}`,
            }}>
              {dataSource === "live" ? "● LIVE DATA" : "◌ SIMULATED"}
            </span>
          )}
        </div>
        <h1 style={{ margin:0, fontSize:"24px", fontWeight:"700", color:"#f0f0f0", letterSpacing:"-0.5px" }}>
          Factor Signal Scanner
        </h1>
        <p style={{ margin:"4px 0 0", fontSize:"11px", color:"#555", letterSpacing:"0.5px" }}>
          {loading ? status : `${stocks.length} stocks · 4-factor composite · Updated ${lastUpdated}`}
        </p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", minHeight:"calc(100vh - 100px)" }}>

        {/* ── Sidebar ── */}
        <div style={{ background:"#0a0a18", borderRight:"1px solid #1a1a30", padding:"20px 16px" }}>
          <div style={{ fontSize:"9px", letterSpacing:"3px", color:"#444", marginBottom:"16px", fontWeight:"700" }}>
            FACTOR WEIGHTS
          </div>
          {Object.entries(FACTORS).map(([key, f]) => (
            <div key={key} style={{ marginBottom:"20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                <span style={{ fontSize:"11px", color:f.color, fontWeight:"700", letterSpacing:"1px", textTransform:"uppercase" }}>{f.label}</span>
                <span style={{ fontSize:"11px", color:"#888" }}>{(weights[key]*100).toFixed(0)}%</span>
              </div>
              <input type="range" min="5" max="70"
                value={Math.round(weights[key]*100)}
                onChange={e => updateWeight(key, parseInt(e.target.value))}
                style={{ width:"100%", accentColor:f.color, cursor:"pointer", height:"3px" }}
              />
              <div style={{ fontSize:"9px", color:"#444", marginTop:"4px" }}>
                {key==="momentum" && "12m-1m return · RSI · trend strength"}
                {key==="value"    && "P/E · EV/EBITDA · P/FCF"}
                {key==="quality"  && "ROE · gross margin · D/E ratio"}
                {key==="growth"   && "EPS · revenue · fwd revisions"}
              </div>
            </div>
          ))}

          <div style={{ borderTop:"1px solid #1a1a30", paddingTop:"16px", marginTop:"8px" }}>
            <div style={{ fontSize:"9px", letterSpacing:"3px", color:"#444", marginBottom:"10px", fontWeight:"700" }}>MODEL INFO</div>
            <p style={{ fontSize:"10px", color:"#555", lineHeight:"1.6", margin:0 }}>
              Stocks scored 0–100 on four factor families, normalized within sector.
              Weighted composite drives the final rank.
            </p>
            <p style={{ fontSize:"10px", color:"#444", lineHeight:"1.6", margin:"8px 0 0" }}>
              Top 20 = <span style={{color:"#00ff9d"}}>buys</span> &nbsp;·&nbsp; Bottom 20 = <span style={{color:"#ff4444"}}>sells</span>
            </p>
            <p style={{ fontSize:"10px", color:"#333", lineHeight:"1.6", margin:"8px 0 0" }}>
              Data refreshes daily at 6 AM ET via scheduled Vercel function pulling Yahoo Finance.
            </p>
          </div>
        </div>

        {/* ── Main ── */}
        <div style={{ padding:"20px 24px" }}>
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"400px", gap:"16px" }}>
              <div style={{ width:"40px", height:"40px", border:"2px solid #1a1a30", borderTop:"2px solid #00ff9d", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
              <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
              <div style={{ fontSize:"11px", color:"#555", letterSpacing:"2px" }}>{status}</div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div style={{ display:"flex", gap:"2px", marginBottom:"20px" }}>
                {[["buys","▲ TOP 20 BUYS","#00ff9d"],["sells","▼ TOP 20 SELLS","#ff4444"]].map(([t,label,c]) => (
                  <button key={t} onClick={() => { setTab(t); setSelected(null); }} style={{
                    padding:"8px 20px", background:tab===t?`${c}15`:"transparent",
                    border:`1px solid ${tab===t?c:"#1a1a30"}`, color:tab===t?c:"#444",
                    borderRadius:"4px", cursor:"pointer", fontSize:"10px",
                    letterSpacing:"2px", fontWeight:"700", fontFamily:"'Courier New',monospace",
                    transition:"all 0.2s",
                  }}>{label}</button>
                ))}
                <div style={{ flex:1 }} />
                <span style={{ fontSize:"10px", color:"#333", alignSelf:"center", letterSpacing:"1px" }}>
                  CLICK ROW FOR DETAIL ▸
                </span>
              </div>

              {/* Table header */}
              <div style={{
                display:"grid", gridTemplateColumns:"28px 80px 70px 1fr 80px 80px 80px 80px 90px",
                gap:"8px", padding:"6px 10px",
                fontSize:"8px", color:"#444", letterSpacing:"2px", fontWeight:"700",
                borderBottom:"1px solid #1a1a30", marginBottom:"4px",
              }}>
                <span>#</span><span>TICKER</span><span>SECTOR</span>
                <span>SIGNAL DRIVERS</span>
                <span>MOM</span><span>VALUE</span><span>QUAL</span><span>GROW</span>
                <span style={{textAlign:"right"}}>SCORE</span>
              </div>

              {/* Rows */}
              {rows.map((stock, i) => {
                const isSelected = selected === stock.ticker;
                const fScores = { Momentum:stock.momentum.score, Value:stock.value.score, Quality:stock.quality.score, Growth:stock.growth.score };
                const sorted  = Object.entries(fScores).sort((a,b)=>b[1]-a[1]);
                const drivers = sorted.slice(0,2).map(([k])=>k);
                const drags   = sorted.slice(-1).map(([k])=>k);

                return (
                  <div key={stock.ticker}>
                    <div onClick={() => setSelected(isSelected ? null : stock.ticker)} style={{
                      display:"grid", gridTemplateColumns:"28px 80px 70px 1fr 80px 80px 80px 80px 90px",
                      gap:"8px", padding:"8px 10px",
                      borderBottom:"1px solid #0f0f20",
                      cursor:"pointer",
                      background: isSelected ? `${accent}08` : i%2===0 ? "#0a0a18" : "#080810",
                      borderLeft:`2px solid ${isSelected ? accent : "transparent"}`,
                      transition:"all 0.15s", alignItems:"center",
                    }}>
                      <span style={{ fontSize:"10px", color:"#444" }}>{i+1}</span>
                      <span style={{ fontSize:"13px", fontWeight:"700", color:accent, letterSpacing:"0.5px" }}>{stock.ticker}</span>
                      <span style={{ fontSize:"9px", color:"#555" }}>{stock.sector}</span>
                      <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                        {drivers.map(d => <Badge key={d} label={d} color={FACTORS[d.toLowerCase()]?.color || "#888"} />)}
                      </div>
                      {["momentum","value","quality","growth"].map(f => (
                        <ScoreBar key={f} score={stock[f].score} color={FACTORS[f].color} />
                      ))}
                      <div style={{ textAlign:"right" }}>
                        <span style={{ fontSize:"14px", fontWeight:"700",
                          color: stock.composite > 0.65 ? "#00ff9d" : stock.composite > 0.45 ? "#ffcc00" : "#ff4444" }}>
                          {(stock.composite*100).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Detail panel */}
                    {isSelected && (
                      <div style={{
                        background:"#0c0c1e", border:`1px solid ${accent}33`,
                        borderTop:"none", padding:"16px", marginBottom:"2px",
                      }}>
                        <div style={{ fontSize:"11px", color:accent, fontWeight:"700", marginBottom:"12px", letterSpacing:"2px" }}>
                          ▸ {stock.ticker} · FACTOR BREAKDOWN
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px" }}>
                          {Object.entries(FACTORS).map(([key, f]) => {
                            const fd = stock[key];
                            return (
                              <div key={key} style={{ background:"#080810", border:`1px solid ${f.color}22`, borderRadius:"6px", padding:"12px" }}>
                                <div style={{ fontSize:"9px", color:f.color, letterSpacing:"2px", fontWeight:"700", marginBottom:"8px" }}>{f.label.toUpperCase()}</div>
                                <div style={{ fontSize:"18px", fontWeight:"700", color:"#f0f0f0", marginBottom:"8px" }}>
                                  {(fd.score*100).toFixed(0)}<span style={{ fontSize:"10px", color:"#555" }}>/100</span>
                                </div>
                                <div style={{ fontSize:"10px", color:"#666", lineHeight:"1.7" }}>
                                  {key==="momentum" && <>{`12m Ret: `}<span style={{color:parseFloat(fd.mom12m)>0?"#00ff9d":"#ff4444"}}>{fd.mom12m>0?"+":""}{fd.mom12m}%</span><br/>RSI: {fd.rsi}</>}
                                  {key==="value"    && <>{`P/E: ${fd.pe}x`}<br/>{`EV/EBITDA: ${fd.evEbitda}x`}<br/>{`P/FCF: ${fd.pfcf}x`}</>}
                                  {key==="quality"  && <>{`ROE: ${fd.roe}%`}<br/>{`Gross Margin: ${fd.grossMargin}%`}<br/>{`D/E: ${fd.debtEq}x`}</>}
                                  {key==="growth"   && <>{`EPS Growth: ${fd.epsGrowth>0?"+":""}${fd.epsGrowth}%`}<br/>{`Rev Growth: ${fd.revGrowth>0?"+":""}${fd.revGrowth}%`}<br/>{`Fwd Rev: ${fd.fwdEpsRevision>0?"+":""}${fd.fwdEpsRevision}%`}</>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ marginTop:"12px", fontSize:"11px", color:"#555", lineHeight:"1.8" }}>
                          <span style={{color:accent}}>■</span>{" "}
                          {tab==="buys"?"BUY":"SELL"} THESIS: {stock.ticker} ranks in the {tab==="buys"?"top":"bottom"} quintile
                          driven by strong <span style={{color:"#e0e0e0"}}>{drivers.join(" + ")}</span> signals.
                          {drags.length > 0 && <> Watch: weaker <span style={{color:"#888"}}>{drags[0]}</span> score.</>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
