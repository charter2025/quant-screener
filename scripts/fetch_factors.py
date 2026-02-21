"""
scripts/fetch_factors.py
────────────────────────
Run by GitHub Actions every weekday morning.
Pulls factor data from Yahoo Finance via yfinance,
scores each stock, and writes public/data/stocks.json.

Usage:
    python -m pip install yfinance pandas numpy
    python scripts/fetch_factors.py
"""

import json
import os
import time
from datetime import datetime, date

import numpy as np
import yfinance as yf

# ── Full S&P 500 Universe (503 components) ────────────────────────────────────

UNIVERSE = [
    "MMM","AOS","ABT","ABBV","ACN","ADBE","AMD","AES","AFL","A","APD","ABNB",
    "AKAM","ALB","ARE","ALGN","ALLE","LNT","ALL","GOOGL","GOOG","MO","AMZN",
    "AMCR","AEE","AAL","AEP","AXP","AIG","AMT","AWK","AMP","AME","AMGN",
    "APH","ADI","ANSS","AON","APA","AAPL","AMAT","APTV","ACGL","ADM","ANET",
    "AJG","AIZ","T","ATO","ADSK","ADP","AZO","AVB","AVY","AXON","BKR","BALL",
    "BAC","BK","BBWI","BAX","BDX","WRB","BRK-B","BBY","BIO","TECH","BIIB",
    "BLK","BX","BA","BCR","BMY","AVGO","BR","BRO","BF-B","BLDR","BSX","BG",
    "CHRW","CDNS","CZR","CPT","CPB","COF","CAH","KMX","CCL","CARR","CTLT",
    "CAT","CBOE","CBRE","CDW","CE","COR","CNC","CNX","CDAY","CF","CRL","SCHW",
    "CHTR","CVX","CMG","CB","CHD","CI","CINF","CTAS","CSCO","C","CFG","CLX",
    "CME","CMS","KO","CTSH","CL","CMCSA","CMA","CAG","COP","ED","STZ","CEG",
    "COO","CPRT","GLW","CPAY","CTVA","CSGP","COST","CTRA","CCI","CSX","CMI",
    "CVS","DHI","DHR","DRI","DVA","DAY","DECK","DE","DAL","DVN","DXCM","FANG",
    "DLR","DFS","DG","DLTR","D","DPZ","DOV","DOW","DHR","DTE","DUK","DD",
    "EMN","ETN","EBAY","ECL","EIX","EW","EA","ELV","LLY","EMR","ENPH","ETR",
    "EOG","EPAM","EQT","EFX","EQIX","EQR","ESS","EL","ETSY","EG","EVRG","ES",
    "EXC","EXPE","EXPD","EXR","XOM","FFIV","FDS","FICO","FAST","FRT","FDX",
    "FIS","FITB","FSLR","FE","FI","FMC","F","FTNT","FTV","FOXA","FOX","BEN",
    "FCX","GRMN","IT","GE","GEHC","GEV","GEN","GNRC","GD","GIS","GM","GPC",
    "GILD","GPN","GL","GDDY","GS","HAL","HIG","HAS","HCA","DOC","HSIC","HSY",
    "HES","HPE","HLT","HOLX","HD","HON","HRL","HST","HWM","HPQ","HUBB","HUM",
    "HBAN","HII","IBM","IEX","IDXX","ITW","INCY","IR","PODD","INTC","ICE",
    "IFF","IP","IPG","INTU","ISRG","IVZ","INVH","IQV","IRM","JBAL","JKHY",
    "J","JBL","JNPR","JPM","JNPR","K","KVUE","KDP","KEY","KEYS","KMB","KIM",
    "KMI","KLAC","KHC","KR","LHX","LH","LRCX","LW","LVS","LDOS","LEN","LIN",
    "LYV","LKQ","LMT","L","LOW","LULU","LYB","MTB","MRO","MPC","MKTX","MAR",
    "MMC","MLM","MAS","MA","MTCH","MKC","MCD","MCK","MDT","MET","META","MTD",
    "MGM","MCHP","MU","MSFT","MAA","MRNA","MHK","MOH","TAP","MDLZ","MPWR",
    "MNST","MCO","MS","MOS","MSI","MSCI","NDAQ","NTAP","NOV","NWSA","NWS",
    "NEE","NKE","NEM","NFLX","NWL","NRG","NI","NDSN","NSC","NTRS","NOC",
    "NCLH","NRG","NUE","NVDA","NVR","NXPI","ORLY","OXY","ODFL","OMC","ON",
    "OKE","ORCL","OTIS","PCAR","PKG","PLTR","PH","PAYX","PAYC","PYPL","PNR",
    "PEP","PFE","PCG","PM","PSX","PNW","PXD","PNC","POOL","PPG","PPL","PFG",
    "PG","PGR","PRU","PEG","PTCT","PTC","PSA","PHM","QRVO","PWR","QCOM",
    "DGX","RL","RJF","RTX","O","REG","REGN","RF","RSG","RMD","RVTY","ROK",
    "ROL","ROP","ROST","RCL","SPGI","CRM","SBAC","SLB","STX","SRE","NOW",
    "SHW","SPG","SWKS","SJM","SNA","SOLV","SO","LUV","SWK","SBUX","STT",
    "STLD","STE","SYK","SMCI","SYF","SNPS","SYY","TMUS","TROW","TTWO","TPR",
    "TRGP","TGT","TEL","TDY","TFX","TER","TSLA","TXN","TXT","TMO","TJX",
    "TSCO","TT","TDG","TRV","TRMB","TFC","TYL","TSN","USB","UBER","UDR",
    "ULTA","UNP","UAL","UPS","URI","UNH","UHS","VLO","VTR","VLTO","VRSN",
    "VRSK","VZ","VRTX","VTRS","VICI","V","VST","VMC","WRK","WAB","WMT","WBA",
    "WM","WAT","WEC","WFC","WELL","WST","WDC","WY","WHR","WMB","WTW","GWW",
    "WYNN","XEL","XYL","YUM","ZBRA","ZBH","ZTS","DKS","AMP","ALLE",
]

# Remove duplicates while preserving order
seen = set()
UNIVERSE = [x for x in UNIVERSE if not (x in seen or seen.add(x))]

SECTOR_MAP = {
    # Technology
    "AAPL":"Tech","MSFT":"Tech","NVDA":"Tech","AVGO":"Tech","ORCL":"Tech",
    "ADBE":"Tech","CRM":"Tech","CSCO":"Tech","ACN":"Tech","AMD":"Tech",
    "INTU":"Tech","IBM":"Tech","QCOM":"Tech","TXN":"Tech","INTC":"Tech",
    "AMAT":"Tech","ANET":"Tech","ADI":"Tech","MU":"Tech","LRCX":"Tech",
    "KLAC":"Tech","CDNS":"Tech","SNPS":"Tech","ADSK":"Tech","FTNT":"Tech",
    "CTSH":"Tech","IT":"Tech","GDDY":"Tech","EPAM":"Tech","KEYS":"Tech",
    "TRMB":"Tech","TDY":"Tech","JNPR":"Tech","FFIV":"Tech","CDW":"Tech",
    "JKHY":"Tech","PTC":"Tech","TER":"Tech","NTAP":"Tech","WDC":"Tech",
    "STX":"Tech","SWKS":"Tech","QRVO":"Tech","NXPI":"Tech","ON":"Tech",
    "MCHP":"Tech","MPWR":"Tech","ANSS":"Tech","SMCI":"Tech","PLTR":"Tech",
    "APH":"Tech","TEL":"Tech","GLW":"Tech","ZBRA":"Tech",

    # Communication Services
    "GOOGL":"Comm","GOOG":"Comm","META":"Comm","NFLX":"Comm","DIS":"Comm",
    "CMCSA":"Comm","T":"Comm","VZ":"Comm","TMUS":"Comm","CHTR":"Comm",
    "NWSA":"Comm","NWS":"Comm","WBD":"Comm","FOXA":"Comm","FOX":"Comm",
    "LYV":"Comm","EA":"Comm","TTWO":"Comm","MTCH":"Comm","ZM":"Comm",
    "OMC":"Comm","IPG":"Comm","AKAM":"Comm","NDAQ":"Comm",

    # Consumer Discretionary
    "AMZN":"Consumer","TSLA":"Consumer","HD":"Consumer","MCD":"Consumer",
    "BKNG":"Consumer","LOW":"Consumer","NKE":"Consumer","SBUX":"Consumer",
    "TJX":"Consumer","TGT":"Consumer","ROST":"Consumer","GM":"Consumer",
    "F":"Consumer","ORLY":"Consumer","AZO":"Consumer","CMG":"Consumer",
    "MAR":"Consumer","HLT":"Consumer","LVS":"Consumer","MGM":"Consumer",
    "WYNN":"Consumer","RCL":"Consumer","CCL":"Consumer","NCLH":"Consumer",
    "DRI":"Consumer","YUM":"Consumer","DPZ":"Consumer","EXPE":"Consumer",
    "ABNB":"Consumer","EBAY":"Consumer","ETSY":"Consumer","BBY":"Consumer",
    "DG":"Consumer","DLTR":"Consumer","DECK":"Consumer","LULU":"Consumer",
    "TPR":"Consumer","RL":"Consumer","PVH":"Consumer","WHR":"Consumer",
    "MHK":"Consumer","LEN":"Consumer","DHI":"Consumer","PHM":"Consumer",
    "NVR":"Consumer","POOL":"Consumer","KMX":"Consumer","AN":"Consumer",
    "TSCO":"Consumer","ULTA":"Consumer","DKS":"Consumer","LKQ":"Consumer",
    "APTV":"Consumer","GRMN":"Consumer","LVS":"Consumer",

    # Consumer Staples
    "PG":"Staples","KO":"Staples","PEP":"Staples","COST":"Staples",
    "WMT":"Staples","PM":"Staples","MO":"Staples","MDLZ":"Staples",
    "CL":"Staples","GIS":"Staples","KMB":"Staples","KHC":"Staples",
    "KR":"Staples","SJM":"Staples","CAG":"Staples","CPB":"Staples",
    "HRL":"Staples","MKC":"Staples","TAP":"Staples","STZ":"Staples",
    "BG":"Staples","ADM":"Staples","TSN":"Staples","WBA":"Staples",
    "CHD":"Staples","CLX":"Staples","EL":"Staples","KVUE":"Staples",
    "MNST":"Staples","K":"Staples","KDP":"Staples","BF-B":"Staples",

    # Health Care
    "LLY":"Health","JNJ":"Health","UNH":"Health","ABBV":"Health",
    "MRK":"Health","ABT":"Health","TMO":"Health","DHR":"Health",
    "PFE":"Health","AMGN":"Health","BSX":"Health","MDT":"Health",
    "EW":"Health","SYK":"Health","ISRG":"Health","GILD":"Health",
    "VRTX":"Health","REGN":"Health","BIIB":"Health","MRNA":"Health",
    "IQV":"Health","ZBH":"Health","BAX":"Health","BDX":"Health",
    "CAH":"Health","MCK":"Health","COR":"Health","HSIC":"Health",
    "HOLX":"Health","IDXX":"Health","PODD":"Health","DXCM":"Health",
    "HCA":"Health","UHS":"Health","MOH":"Health","CNC":"Health",
    "ELV":"Health","HUM":"Health","CVS":"Health","CI":"Health",
    "SOLV":"Health","CTLT":"Health","CRL":"Health","MTD":"Health",
    "A":"Health","ALGN":"Health","TECH":"Health","BIO":"Health",
    "RVTY":"Health","RMD":"Health","TFX":"Health","VTRS":"Health",
    "INCY":"Health","PTCT":"Health","GEHC":"Health","DOC":"Health",

    # Financials
    "BRK-B":"Finance","JPM":"Finance","V":"Finance","MA":"Finance",
    "BAC":"Finance","WFC":"Finance","GS":"Finance","MS":"Finance",
    "BLK":"Finance","BX":"Finance","SCHW":"Finance","AXP":"Finance",
    "SPGI":"Finance","MCO":"Finance","COF":"Finance","USB":"Finance",
    "PNC":"Finance","TFC":"Finance","AIG":"Finance","MET":"Finance",
    "PRU":"Finance","AFL":"Finance","ALL":"Finance","PGR":"Finance",
    "TRV":"Finance","CB":"Finance","HIG":"Finance","CINF":"Finance",
    "GL":"Finance","AIZ":"Finance","WRB":"Finance","ACGL":"Finance",
    "AMP":"Finance","BEN":"Finance","IVZ":"Finance","TROW":"Finance",
    "STT":"Finance","BK":"Finance","NTRS":"Finance","KEY":"Finance",
    "CFG":"Finance","HBAN":"Finance","RF":"Finance","MTB":"Finance",
    "FI":"Finance","FIS":"Finance","PYPL":"Finance","CPAY":"Finance",
    "GPN":"Finance","DFS":"Finance","SYF":"Finance","AJG":"Finance",
    "MMC":"Finance","AON":"Finance","WTW":"Finance","MSCI":"Finance",
    "NDAQ":"Finance","ICE":"Finance","CME":"Finance","CBOE":"Finance",
    "MKTX":"Finance","RJF":"Finance","SF":"Finance","FRT":"Finance",

    # Industrials
    "RTX":"Industrial","HON":"Industrial","UPS":"Industrial","GE":"Industrial",
    "CAT":"Industrial","DE":"Industrial","LMT":"Industrial","BA":"Industrial",
    "GD":"Industrial","NOC":"Industrial","LHX":"Industrial","HII":"Industrial",
    "TXT":"Industrial","L3":"Industrial","LDOS":"Industrial","AXON":"Industrial",
    "MMM":"Industrial","EMR":"Industrial","ETN":"Industrial","PH":"Industrial",
    "ROK":"Industrial","AME":"Industrial","FTV":"Industrial","GNRC":"Industrial",
    "SWK":"Industrial","IR":"Industrial","ITW":"Industrial","DOV":"Industrial",
    "GWW":"Industrial","FAST":"Industrial","MSI":"Industrial","OTIS":"Industrial",
    "CARR":"Industrial","TT":"Industrial","XYL":"Industrial","WM":"Industrial",
    "RSG":"Industrial","EXPD":"Industrial","CHRW":"Industrial","ODFL":"Industrial",
    "NSC":"Industrial","UNP":"Industrial","CSX":"Industrial","DAL":"Industrial",
    "UAL":"Industrial","LUV":"Industrial","AAL":"Industrial","FDX":"Industrial",
    "UNH":"Industrial","URI":"Industrial","PCAR":"Industrial","CMI":"Industrial",
    "CTAS":"Industrial","ROP":"Industrial","NDSN":"Industrial","HUBB":"Industrial",
    "WAB":"Industrial","GEV":"Industrial","HWM":"Industrial","TDG":"Industrial",
    "PWR":"Industrial","J":"Industrial","JBAL":"Industrial","BLDR":"Industrial",
    "MAS":"Industrial","AOS":"Industrial","ROL":"Industrial","CPRT":"Industrial",
    "VRSK":"Industrial","BR":"Industrial","PAYX":"Industrial","ADP":"Industrial",

    # Energy
    "XOM":"Energy","CVX":"Energy","COP":"Energy","EOG":"Energy","SLB":"Energy",
    "MPC":"Energy","PSX":"Energy","VLO":"Energy","PXD":"Energy","DVN":"Energy",
    "HAL":"Energy","BKR":"Energy","FANG":"Energy","OXY":"Energy","APA":"Energy",
    "MRO":"Energy","HES":"Energy","TRGP":"Energy","OKE":"Energy","WMB":"Energy",
    "KMI":"Energy","EQT":"Energy","CNX":"Energy","NRG":"Energy","VST":"Energy",
    "CEG":"Energy",

    # Materials
    "LIN":"Materials","APD":"Materials","SHW":"Materials","ECL":"Materials",
    "FCX":"Materials","NEM":"Materials","NUE":"Materials","STLD":"Materials",
    "ALB":"Materials","DOW":"Materials","DD":"Materials","EMN":"Materials",
    "IFF":"Materials","PPG":"Materials","RPM":"Materials","CE":"Materials",
    "LYB":"Materials","MOS":"Materials","CF":"Materials","MLM":"Materials",
    "VMC":"Materials","PKG":"Materials","IP":"Materials","WRK":"Materials",
    "AVY":"Materials","SEE":"Materials","SON":"Materials","BALL":"Materials",
    "AMCR":"Materials","FMC":"Materials",

    # Real Estate
    "AMT":"RealEstate","PLD":"RealEstate","CCI":"RealEstate","EQIX":"RealEstate",
    "PSA":"RealEstate","O":"RealEstate","WELL":"RealEstate","DLR":"RealEstate",
    "SBAC":"RealEstate","SPG":"RealEstate","EXR":"RealEstate","AVB":"RealEstate",
    "EQR":"RealEstate","MAA":"RealEstate","UDR":"RealEstate","ESS":"RealEstate",
    "ARE":"RealEstate","INVH":"RealEstate","VICI":"RealEstate","IRM":"RealEstate",
    "REG":"RealEstate","FRT":"RealEstate","CPT":"RealEstate","KIM":"RealEstate",
    "HST":"RealEstate","CSGP":"RealEstate","CBRE":"RealEstate",

    # Utilities
    "NEE":"Utilities","DUK":"Utilities","SO":"Utilities","D":"Utilities",
    "AEP":"Utilities","SRE":"Utilities","EXC":"Utilities","XEL":"Utilities",
    "WEC":"Utilities","ES":"Utilities","ETR":"Utilities","AEE":"Utilities",
    "CMS":"Utilities","LNT":"Utilities","NI":"Utilities","PNW":"Utilities",
    "EVRG":"Utilities","ATO":"Utilities","AWK":"Utilities","PCG":"Utilities",
    "PEG":"Utilities","ED":"Utilities","FE":"Utilities","EIX":"Utilities",
    "PPL":"Utilities","DTE":"Utilities",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def fetch_stock(ticker: str) -> dict | None:
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}

        # ── Price history for momentum ────────────────────────────────────────
        hist = t.history(period="1y", interval="1mo")
        closes = hist["Close"].dropna().tolist()

        if len(closes) >= 2:
            mom12m = (closes[-1] - closes[0]) / closes[0] * 100
            changes = np.diff(closes)
            gains  = np.where(changes > 0, changes, 0)
            losses = np.where(changes < 0, -changes, 0)
            avg_gain = gains[-14:].mean()  if len(gains)  >= 14 else gains.mean()
            avg_loss = losses[-14:].mean() if len(losses) >= 14 else losses.mean()
            rsi = 100 - (100 / (1 + avg_gain / avg_loss)) if avg_loss > 0 else 100.0
        else:
            mom12m, rsi = None, None

        # ── Raw metrics ───────────────────────────────────────────────────────
        pe        = info.get("trailingPE")
        pfcf      = info.get("priceToFreeCashflows") or info.get("priceToSalesTrailing12Months")
        ev_ebitda = info.get("enterpriseToEbitda")
        roe       = info.get("returnOnEquity")
        gross_m   = info.get("grossMargins")
        debt_eq   = info.get("debtToEquity")
        eps_g     = info.get("earningsGrowth")
        rev_g     = info.get("revenueGrowth")
        fwd_eps   = info.get("forwardEps")
        trail_eps = info.get("trailingEps")
        fwd_rev   = ((fwd_eps - trail_eps) / abs(trail_eps) * 100
                     if fwd_eps and trail_eps and trail_eps != 0 else None)

        # ── Factor scores (0–1) ───────────────────────────────────────────────

        # Momentum
        if mom12m is not None and rsi is not None:
            mom_score = clamp(mom12m / 90 * 0.7 + (rsi - 30) / 50 * 0.3)
        else:
            mom_score = 0.5

        # Value
        pe_s   = (1 - clamp(pe        / 63, 0, 1)) if pe        else 0.5
        pfcf_s = (1 - clamp(pfcf      / 70, 0, 1)) if pfcf      else 0.5
        ev_s   = (1 - clamp(ev_ebitda / 36, 0, 1)) if ev_ebitda else 0.5
        val_score = clamp(pe_s * 0.4 + pfcf_s * 0.3 + ev_s * 0.3)

        # Quality
        roe_pct   = roe    * 100 if roe    is not None else None
        gross_pct = gross_m * 100 if gross_m is not None else None
        roe_s  = clamp(max(0, roe_pct) / 75)        if roe_pct   is not None else 0.4
        gm_s   = clamp(gross_pct / 85)              if gross_pct is not None else 0.4
        de_s   = (1 - clamp(debt_eq / 300, 0, 1))  if debt_eq   is not None else 0.5
        qual_score = clamp(roe_s * 0.4 + gm_s * 0.4 + de_s * 0.2)

        # Growth
        eps_pct = eps_g * 100 if eps_g is not None else None
        rev_pct = rev_g * 100 if rev_g is not None else None
        eg_s = clamp(max(-1, eps_pct) / 65) if eps_pct is not None else 0.4
        rg_s = clamp(max(-1, rev_pct) / 40) if rev_pct is not None else 0.4
        fr_s = clamp((fwd_rev + 15) / 45)   if fwd_rev is not None else 0.4
        growth_score = clamp(eg_s * 0.4 + rg_s * 0.35 + fr_s * 0.25)

        return {
            "ticker":      ticker,
            "sector":      SECTOR_MAP.get(ticker, "Other"),
            "lastUpdated": str(date.today()),
            "momentum": {
                "score":  round(mom_score, 4),
                "mom12m": f"{mom12m:.1f}" if mom12m is not None else "N/A",
                "rsi":    f"{rsi:.0f}"    if rsi    is not None else "N/A",
            },
            "value": {
                "score":    round(val_score, 4),
                "pe":       f"{pe:.1f}"        if pe        else "N/A",
                "pfcf":     f"{pfcf:.1f}"      if pfcf      else "N/A",
                "evEbitda": f"{ev_ebitda:.1f}" if ev_ebitda else "N/A",
            },
            "quality": {
                "score":       round(qual_score, 4),
                "roe":         f"{roe_pct:.1f}"   if roe_pct   is not None else "N/A",
                "grossMargin": f"{gross_pct:.1f}" if gross_pct is not None else "N/A",
                "debtEq":      f"{debt_eq/100:.2f}" if debt_eq is not None else "N/A",
            },
            "growth": {
                "score":          round(growth_score, 4),
                "epsGrowth":      f"{eps_pct:.1f}" if eps_pct is not None else "N/A",
                "revGrowth":      f"{rev_pct:.1f}" if rev_pct is not None else "N/A",
                "fwdEpsRevision": f"{fwd_rev:.1f}" if fwd_rev is not None else "N/A",
            },
        }

    except Exception as e:
        print(f"  ✗ {ticker}: {e}")
        return None


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"[fetch_factors] Starting refresh — {len(UNIVERSE)} tickers")
    results = []
    errors  = []

    for i, ticker in enumerate(UNIVERSE):
        print(f"  [{i+1}/{len(UNIVERSE)}] {ticker} ...", end=" ", flush=True)
        stock = fetch_stock(ticker)
        if stock:
            results.append(stock)
            print("✓")
        else:
            errors.append(ticker)
            print("✗")
        time.sleep(0.5)  # polite rate limiting

    output = {
        "generatedAt":     str(date.today()),
        "generatedAtFull": datetime.utcnow().isoformat() + "Z",
        "tickerCount":     len(results),
        "errors":          errors,
        "stocks":          results,
    }

    out_path = os.path.join(os.path.dirname(__file__), "..", "public", "data", "stocks.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n[fetch_factors] Done — {len(results)} stocks written, {len(errors)} errors.")
    print(f"  Written to: {os.path.abspath(out_path)}")


if __name__ == "__main__":
    main()