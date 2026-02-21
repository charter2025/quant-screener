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

function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(Math.sin(h + 1) * 10000) % 1;
}

function simulateStock(ticker) {
  const r = offset => Math.abs(seededRandom(ticker + String(offset)));
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
  const clamp = (v, lo=0, hi=1) => Math.max(lo, Math.min(hi, v));

  return {
    ticker,
    sector: SECTOR_MAP[ticker] || "Other",
    lastUpdated: new Date().toISOString().split("T")[0],
    momentum: {
      score: clamp(mom12m/90*0.7 + (rsi-30)/50*0.3),
      mom12m: mom12m.toFixed(1), rsi: rsi.toFixed(0),
    },
    value: {
      score: clamp(1-((pe/63*0.4)+(pfcf/70*0.3)+(evEbitda/36*0.3))),
      pe: pe.toFixed(1), pfcf: pfcf.toFixed(1), evEbitda: evEbitda.toFixed(1),
    },
    quality: {
      score: clamp((Math.max(0,roe)/75*0.4)+(grossM/85*0.4)+((1-debtEq/3)*0.2)),
      roe: roe.toFixed(1), grossMargin: grossM.toFixed(1), debtEq: debtEq.toFixed(2),
    },
    growth: {
      score: clamp((Math.max(-1,epsG)/65*0.4)+(Math.max(-1,revG)/40*0.35)+((fwdRev+15)/45*0.25)),
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

const ScoreBar = ({ score, color }) => (
  <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
    <div style={{ flex:1, height:"3px", background:"#1a1a2e", borderRadius:"2px", overflow:"hidden", minWidth:"30px" }}>
      <div style={{ width:`${score*100}%`, height:"100%", background:color, borderRadius:"2px" }} />
    </div>
    <span style={{ fontSize:"9px", color:"#888", minWidth:"20px", textAlign:"right" }}>
      {(score*100).toFixed(0)}
    </span>
  </div>
);

const Badge = ({ label, color }) => (
  <span style={{
    fontSize:"8px", fontWeight:"700", padding:"1px 4px", borderRadius:"3px",
    background:`${color}22`, color, border:`1px solid ${color}44`,
    letterSpacing:"0.3px", textTransform:"uppercase", whiteSpace:"nowrap",
  }}>{label}</span>
);

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #080810; overflow-x: hidden; }

  .layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    min-height: calc(100vh - 90px);
  }

  .sidebar {
    background: #0a0a18;
    border-right: 1px solid #1a1a30;
    padding: 16px 14px;
  }

  .main {
    padding: 16px 20px;
    min-width: 0;
  }

  .table-header {
    display: grid;
    grid-template-columns: 24px 64px 56px 1fr 70px 70px 70px 70px 76px;
    gap: 6px;
    padding: 5px 8px;
    font-size: 7px;
    color: #444;
    letter-spacing: 2px;
    font-weight: 700;
    border-bottom: 1px solid #1a1a30;
    margin-bottom: 4px;
    font-family: 'Courier New', monospace;
  }

  .table-row {
    display: grid;
    grid-template-columns: 24px 64px 56px 1fr 70px 70px 70px 70px 76px;
    gap: 6px;
    padding: 7px 8px;
    border-bottom: 1px solid #0f0f20;
    cursor: pointer;
    align-items: center;
    font-family: 'Courier New', monospace;
    transition: background 0.15s;
    border-left: 2px solid transparent;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  .sliders-toggle { display: none; }

  @media (max-width: 768px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .sidebar {
      border-right: none;
      border-bottom: 1px solid #1a1a30;
      padding: 12px;
    }

    .sliders-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      margin-bottom: 0;
    }

    .sliders-content {
      overflow: hidden;
      transition: max-height 0.3s ease;
    }

    .sliders-content.collapsed {
      max-height: 0;
    }

    .sliders-content.expanded {
      max-height: 500px;
    }

    .main {
      padding: 10px 8px;
    }

    .table-header {
      grid-template-columns: 20px 52px 44px 1fr 52px 52px 76px;
      gap: 4px;
      font-size: 6.5px;
    }

    .table-header .hide-mobile { display: none; }

    .table-row {
      grid-template-columns: 20px 52px 44px 1fr 52px 52px 76px;
      gap: 4px;
      padding: 6px 6px;
    }

    .table-row .hide-mobile { display: none; }

    .detail-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 400px) {
    .table-header {
      grid-template-columns: 18px 46px 36px 1fr 46px 76px;
      gap: 3px;
    }
    .table-header .hide-mobile2 { display: none; }
    .table-row {
      grid-template-columns: 18px 46px 36px 1fr 46px 76px;
      gap: 3px;
    }
    .table-row .hide-mobile2 { display: none; }
  }
`;

export default function App() {
  const [stocks, setStocks]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [dataSource, setDataSource] = useState("live");
  const [lastUpdated, setLastUpdated] = useState("");
  const [weights, setWeights]   = useState({ momentum:0.25, value:0.25, quality:0.25, growth:0.25 });
  const [tab, setTab]           = useState("buys");
  const [selected, setSelected] = useState(null);
  const [status, setStatus]     = useState("Fetching market data...");
  const [slidersOpen, setSlidersOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setStatus("Connecting to data feed...");
        const res = await fetch("/data/stocks.json");
        if (!res.ok) throw new Error("No live data");
        const json = await res.json();
        setStatus("Parsing factor scores...");
        await new Promise(r => setTimeout(r, 300));
        setStocks(json.stocks);
        setLastUpdated(json.generatedAt || "");
        setDataSource("live");
      } catch {
        setStatus("Using simulated data...");
        await new Promise(r => setTimeout(r, 400));
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
  const accent = tab === "buys" ? "#00ff9d" : "#ff4444";

  const updateWeight = (factor, val) => {
    const next = { ...weights, [factor]: val/100 };
    const total = Object.values(next).reduce((a,b) => a+b, 0);
    setWeights(Object.fromEntries(Object.entries(next).map(([k,v]) => [k, v/total])));
  };

  return (
    <>
      <style>{css}</style>
      <div style={{ fontFamily:"'Courier New', monospace", background:"#080810", minHeight:"100vh", color:"#e0e0e0" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#0d0d1a,#111128)", borderBottom:"1px solid #1e1e3a", padding:"14px 16px 12px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:"10px", letterSpacing:"3px", color:"#00ff9d", fontWeight:"700", marginBottom:"2px" }}>
                ▸ QUANT ALPHA ENGINE
              </div>
              <h1 style={{ fontSize:"20px", fontWeight:"700", color:"#f0f0f0", letterSpacing:"-0.5px", lineHeight:1 }}>
                Factor Signal Scanner
              </h1>
            </div>
            {!loading && (
              <span style={{
                marginLeft:"auto", fontSize:"9px", padding:"2px 8px", borderRadius:"3px",
                background: dataSource==="live" ? "#00ff9d22" : "#ff6b3522",
                color:      dataSource==="live" ? "#00ff9d"   : "#ff6b35",
                border:`1px solid ${dataSource==="live" ? "#00ff9d44" : "#ff6b3544"}`,
                whiteSpace:"nowrap",
              }}>
                {dataSource==="live" ? "● LIVE" : "◌ SIM"}
              </span>
            )}
          </div>
          <p style={{ margin:"4px 0 0", fontSize:"10px", color:"#555" }}>
            {loading ? status : `${stocks.length} stocks · Updated ${lastUpdated}`}
          </p>
        </div>

        <div className="layout">

          {/* Sidebar */}
          <div className="sidebar">
            {/* Mobile toggle */}
            <div className="sliders-toggle" onClick={() => setSlidersOpen(o => !o)}>
              <span style={{ fontSize:"9px", letterSpacing:"3px", color:"#444", fontWeight:"700" }}>FACTOR WEIGHTS</span>
              <span style={{ color:"#444", fontSize:"12px" }}>{slidersOpen ? "▲" : "▼"}</span>
            </div>

            {/* Desktop label (always visible on desktop) */}
            <div style={{ fontSize:"9px", letterSpacing:"3px", color:"#444", fontWeight:"700", marginBottom:"14px" }}
              className="sliders-toggle-desktop">
            </div>

            <div className={`sliders-content ${slidersOpen ? "expanded" : "collapsed"}`}
              style={{ paddingTop: slidersOpen ? "12px" : 0 }}>
              {Object.entries(FACTORS).map(([key, f]) => (
                <div key={key} style={{ marginBottom:"16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
                    <span style={{ fontSize:"10px", color:f.color, fontWeight:"700", letterSpacing:"1px", textTransform:"uppercase" }}>{f.label}</span>
                    <span style={{ fontSize:"10px", color:"#888" }}>{(weights[key]*100).toFixed(0)}%</span>
                  </div>
                  <input type="range" min="5" max="70"
                    value={Math.round(weights[key]*100)}
                    onChange={e => updateWeight(key, parseInt(e.target.value))}
                    style={{ width:"100%", accentColor:f.color, cursor:"pointer" }}
                  />
                  <div style={{ fontSize:"8px", color:"#444", marginTop:"3px" }}>
                    {key==="momentum" && "12m return · RSI · trend"}
                    {key==="value"    && "P/E · EV/EBITDA · P/FCF"}
                    {key==="quality"  && "ROE · margins · leverage"}
                    {key==="growth"   && "EPS · revenue · revisions"}
                  </div>
                </div>
              ))}
            </div>

            {/* Always show on desktop */}
            <style>{`
              @media (min-width: 769px) {
                .sliders-toggle { display: none !important; }
                .sliders-content { max-height: none !important; overflow: visible !important; }
                .sliders-content.collapsed { max-height: none !important; }
              }
              @media (max-width: 768px) {
                .sliders-toggle-desktop { display: none; }
              }
            `}</style>

            <div style={{ borderTop:"1px solid #1a1a30", paddingTop:"12px", marginTop:"4px" }}>
              <p style={{ fontSize:"9px", color:"#444", lineHeight:"1.6" }}>
                Top 20 = <span style={{color:"#00ff9d"}}>buys</span> · Bottom 20 = <span style={{color:"#ff4444"}}>sells</span><br/>
                Data refreshes daily 6AM ET via Yahoo Finance.
              </p>
            </div>
          </div>

          {/* Main */}
          <div className="main">
            {loading ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"300px", gap:"14px" }}>
                <div style={{ width:"36px", height:"36px", border:"2px solid #1a1a30", borderTop:"2px solid #00ff9d", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
                <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
                <div style={{ fontSize:"10px", color:"#555", letterSpacing:"2px" }}>{status}</div>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div style={{ display:"flex", gap:"4px", marginBottom:"14px", flexWrap:"wrap" }}>
                  {[["buys","▲ TOP 20 BUYS","#00ff9d"],["sells","▼ TOP 20 SELLS","#ff4444"]].map(([t,label,c]) => (
                    <button key={t} onClick={() => { setTab(t); setSelected(null); }} style={{
                      padding:"6px 14px", background:tab===t?`${c}15`:"transparent",
                      border:`1px solid ${tab===t?c:"#1a1a30"}`, color:tab===t?c:"#444",
                      borderRadius:"4px", cursor:"pointer", fontSize:"9px",
                      letterSpacing:"1.5px", fontWeight:"700", fontFamily:"'Courier New',monospace",
                    }}>{label}</button>
                  ))}
                </div>

                {/* Table header */}
                <div className="table-header">
                  <span>#</span>
                  <span>TICKER</span>
                  <span>SECTOR</span>
                  <span>SIGNALS</span>
                  <span className="hide-mobile">MOM</span>
                  <span className="hide-mobile">VAL</span>
                  <span className="hide-mobile2">QUAL</span>
                  <span>GROW</span>
                  <span style={{textAlign:"right"}}>SCORE</span>
                </div>

                {/* Rows */}
                {rows.map((stock, i) => {
                  const isSelected = selected === stock.ticker;
                  const fScores = { Momentum:stock.momentum.score, Value:stock.value.score, Quality:stock.quality.score, Growth:stock.growth.score };
                  const sorted  = Object.entries(fScores).sort((a,b) => b[1]-a[1]);
                  const drivers = sorted.slice(0,2).map(([k])=>k);
                  const drags   = sorted.slice(-1).map(([k])=>k);

                  return (
                    <div key={stock.ticker}>
                      <div
                        className="table-row"
                        onClick={() => setSelected(isSelected ? null : stock.ticker)}
                        style={{
                          background: isSelected ? `${accent}08` : i%2===0 ? "#0a0a18" : "#080810",
                          borderLeft:`2px solid ${isSelected ? accent : "transparent"}`,
                        }}
                      >
                        <span style={{ fontSize:"9px", color:"#444" }}>{i+1}</span>
                        <span style={{ fontSize:"12px", fontWeight:"700", color:accent, letterSpacing:"0.5px" }}>{stock.ticker}</span>
                        <span style={{ fontSize:"8px", color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{stock.sector}</span>
                        <div style={{ display:"flex", gap:"3px", flexWrap:"wrap", overflow:"hidden" }}>
                          {drivers.map(d => <Badge key={d} label={d.slice(0,3)} color={FACTORS[d.toLowerCase()]?.color || "#888"} />)}
                        </div>
                        <div className="hide-mobile"><ScoreBar score={stock.momentum.score} color={FACTORS.momentum.color} /></div>
                        <div className="hide-mobile"><ScoreBar score={stock.value.score} color={FACTORS.value.color} /></div>
                        <div className="hide-mobile2"><ScoreBar score={stock.quality.score} color={FACTORS.quality.color} /></div>
                        <ScoreBar score={stock.growth.score} color={FACTORS.growth.color} />
                        <div style={{ textAlign:"right" }}>
                          <span style={{ fontSize:"13px", fontWeight:"700",
                            color: stock.composite>0.65?"#00ff9d":stock.composite>0.45?"#ffcc00":"#ff4444" }}>
                            {(stock.composite*100).toFixed(1)}
                          </span>
                        </div>
                      </div>

                      {/* Detail panel */}
                      {isSelected && (
                        <div style={{
                          background:"#0c0c1e", border:`1px solid ${accent}33`,
                          borderTop:"none", padding:"12px", marginBottom:"2px",
                        }}>
                          <div style={{ fontSize:"10px", color:accent, fontWeight:"700", marginBottom:"10px", letterSpacing:"2px" }}>
                            ▸ {stock.ticker} · BREAKDOWN
                          </div>
                          <div className="detail-grid">
                            {Object.entries(FACTORS).map(([key, f]) => {
                              const fd = stock[key];
                              return (
                                <div key={key} style={{ background:"#080810", border:`1px solid ${f.color}22`, borderRadius:"6px", padding:"10px" }}>
                                  <div style={{ fontSize:"8px", color:f.color, letterSpacing:"2px", fontWeight:"700", marginBottom:"6px" }}>{f.label.toUpperCase()}</div>
                                  <div style={{ fontSize:"16px", fontWeight:"700", color:"#f0f0f0", marginBottom:"6px" }}>
                                    {(fd.score*100).toFixed(0)}<span style={{ fontSize:"9px", color:"#555" }}>/100</span>
                                  </div>
                                  <div style={{ fontSize:"9px", color:"#666", lineHeight:"1.7" }}>
                                    {key==="momentum" && <><span style={{color:parseFloat(fd.mom12m)>0?"#00ff9d":"#ff4444"}}>{fd.mom12m>0?"+":""}{fd.mom12m}%</span> 12m<br/>RSI {fd.rsi}</>}
                                    {key==="value"    && <>P/E {fd.pe}x<br/>EV/EBITDA {fd.evEbitda}x</>}
                                    {key==="quality"  && <>ROE {fd.roe}%<br/>Margin {fd.grossMargin}%</>}
                                    {key==="growth"   && <>EPS {fd.epsGrowth>0?"+":""}{fd.epsGrowth}%<br/>Rev {fd.revGrowth>0?"+":""}{fd.revGrowth}%</>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ marginTop:"10px", fontSize:"10px", color:"#555", lineHeight:"1.7" }}>
                            <span style={{color:accent}}>■</span>{" "}
                            {tab==="buys"?"BUY":"SELL"} THESIS: {stock.ticker} driven by{" "}
                            <span style={{color:"#e0e0e0"}}>{drivers.join(" + ")}</span>.
                            {drags.length>0 && <> Watch: weaker <span style={{color:"#888"}}>{drags[0]}</span>.</>}
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
    </>
  );
}
